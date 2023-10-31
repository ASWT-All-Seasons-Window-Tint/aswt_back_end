require("dotenv").config();
const { jsonResponse, errorMessage } = require("../common/messages.common");
const appointmentServices = require("../services/appointment.services");
const stripe = require("stripe")(process.env.stripeSecretKey);
const stripeAccount = process.env.stripeAccount;
const Joi = require("joi");

class StripeController {
  async stripeCheckoutSession(req, res) {
    const { appointmentId } = req.body;

    try {
      const appointment = await appointmentServices.getAppointmentById(
        appointmentId
      );
      const appointmentType = appointment.appointmentType;
      const autoAppointmentType = appointmentType === "auto";

      if (!appointment)
        return res.status(404).send(errorMessage("appointment"));

      if (appointment.paymentDetails.hasPaid)
        return jsonResponse(res, 400, false, "Payment has already been made");

      const priceBreakdown = autoAppointmentType
        ? appointment.carDetails.priceBreakdown
        : appointment.residentialDetails.priceBreakdown;

      const session = await stripe.checkout.sessions.create(
        {
          payment_method_types: ["card"],
          mode: "payment",
          line_items: priceBreakdown.map((item) => {
            let customerMeasurementAwareness = true;
            const thirtyPercentOfPriceInCents = Math.round(item.price * 10) * 3;
            const priceInCents = item.price * 100;

            if (!autoAppointmentType) {
              customerMeasurementAwareness =
                appointment.residentialDetails.customerMeasurementAwareness;
            }

            return {
              price_data: {
                currency: "usd",
                product_data: {
                  name: item.serviceName,
                },
                unit_amount: customerMeasurementAwareness
                  ? thirtyPercentOfPriceInCents
                  : priceInCents,
              },
              quantity: 1,
            };
          }),
          payment_intent_data: {
            metadata: {
              appointmentId,
              stripeConnectedAccountId: process.env.stripeConnectedAccountId,
            },
          },

          success_url: process.env.stripeSuccessUrl,
          cancel_url: `${process.env.apiUrl}/client/cancel.html`,
        },
        {
          stripeAccount,
        }
      );
      res.json({ url: session.url });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }

  async initiateRefund(appointment) {
    const results = {};
    try {
      const paymentIntentId = appointment.paymentDetails.paymentIntentId;
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        reason: "requested_by_customer", // You can customize the reason as needed
      });

      if (refund.status === "succeeded") {
        appointmentServices.refundPaymentDetails({ appointment, refund });
      }

      results.refund = refund;
    } catch (error) {
      results.error = error;
      console.error("Refund failed:", error);
    }

    return results;
  }

  validate(entry) {
    const schema = Joi.object({
      appointmentId: Joi.objectId().required(),
    });

    return schema.validate(entry);
  }
}

module.exports = new StripeController();
