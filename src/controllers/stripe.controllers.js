require("dotenv").config();
const stripe = require("stripe")(process.env.stripeSecretKey);
const { MESSAGES } = require("../common/constants.common");
const {
  jsonResponse,
  errorMessage,
  successMessage,
} = require("../common/messages.common");
const appointmentServices = require("../services/appointment.services");
const stripeServices = require("../services/stripe.services");
const stripeAccount = process.env.stripeAccount;
const Joi = require("joi");

class StripeController {
  async stripeCheckoutSession(req, res) {
    const { appointmentId } = req.body;

    try {
      const appointment = await appointmentServices.getAppointmentById(
        appointmentId
      );
      if (!appointment)
        return res.status(404).send(errorMessage("appointment"));

      const appointmentType = appointment.appointmentType;
      const autoAppointmentType = appointmentType === "auto";
      let customerMeasurementAwareness = true;

      if (!autoAppointmentType) {
        customerMeasurementAwareness =
          appointment.residentialDetails.customerMeasurementAwareness;
      }

      if (appointment.paymentDetails.hasPaid)
        return jsonResponse(res, 400, false, "Payment has already been made");

      const priceBreakdown = autoAppointmentType
        ? appointment.carDetails.priceBreakdown
        : appointment.residentialDetails.priceBreakdown;

      const totalPrice = autoAppointmentType
        ? appointment.carDetails.price
        : appointment.residentialDetails.price;

      const thirtyPercentOfPrice = (totalPrice * 30) / 100;

      const pricePlusStripeFee = stripeServices.calculateStripeFee(totalPrice);

      const thirtyPercentOfPricePlusStripeFee =
        stripeServices.calculateStripeFee(thirtyPercentOfPrice);

      const stripeFee = customerMeasurementAwareness
        ? Math.round(
            (thirtyPercentOfPricePlusStripeFee - thirtyPercentOfPrice) * 100
          ) / 100
        : Math.round((pricePlusStripeFee - totalPrice) * 100) / 100;

      const stripeServiceName = "Stripe processing fee";

      const stripeFeeeService = {
        price: stripeFee,
        serviceName: stripeServiceName,
      };

      priceBreakdown.push(stripeFeeeService);

      const session = await stripe.checkout.sessions.create(
        {
          payment_method_types: ["card"],
          mode: "payment",
          line_items: priceBreakdown.map((item) => {
            const price = item.price;
            const thirtyPercentOfPriceInCents = Math.round(price * 30);

            return {
              price_data: {
                currency: "usd",
                product_data: {
                  name: item.serviceName,
                },
                unit_amount: customerMeasurementAwareness
                  ? item.serviceName === stripeServiceName
                    ? Math.round(price * 100)
                    : thirtyPercentOfPriceInCents
                  : Math.round(price * 100),
              },
              quantity: 1,
            };
          }),
          automatic_tax: {
            enabled: true,
          },
          invoice_creation: {
            enabled: true,
          },
          allow_promotion_codes: true,
          payment_intent_data: {
            metadata: {
              appointmentId,
              stripeConnectedAccountId: process.env.stripeConnectedAccountId,
            },
          },
          success_url: process.env.stripeSuccessUrl,
          cancel_url: `${process.env.apiUrl}/client/cancel.html`,
        }
        // {
        //   stripeAccount,
        // }
      );
      res.json({ url: session.url });
    } catch (e) {
      res.status(500).json({ error: e.message });
      console.log(e);
    }
  }

  async initiateRefund(appointment) {
    const results = {};
    try {
      const paymentIntentId = appointment.paymentDetails.paymentIntentId;
      const refund = await stripe.refunds.create(
        {
          payment_intent: paymentIntentId,
          reason: "requested_by_customer", // You can customize the reason as needed
        }
        // {
        //   stripeAccount,
        // }
      );

      if (refund.status === "succeeded") {
        await appointmentServices.refundPaymentDetails({ appointment, refund });
      }

      results.refund = refund;
    } catch (error) {
      results.error = error;
      console.error("Refund failed:", error);
    }

    return results;
  }

  async createPromoCode(req, res) {
    const { percentageOff, expirationDate, promoCode } = req.body;

    const promotionCode = await stripeServices.createPromoCode(
      percentageOff,
      expirationDate,
      promoCode
    );

    return res.send(successMessage(MESSAGES.CREATED, promotionCode));
  }

  async getAllPromoCodes(req, res) {
    const promotionCodes = await stripeServices.getAllPromoCodes();

    return res.send(successMessage(MESSAGES.FETCHED, promotionCodes));
  }

  validate(entry) {
    const schema = Joi.object({
      appointmentId: Joi.objectId().required(),
    });

    return schema.validate(entry);
  }

  validatePromoCode(stripeData) {
    const schema = Joi.object({
      percentageOff: Joi.number().greater(0).max(100).required(),
      expirationDate: Joi.date().required(),
      promoCode: Joi.string().required(),
    });

    return schema.validate(stripeData);
  }
}

module.exports = new StripeController();
