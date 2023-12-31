require("dotenv").config();
const stripe = require("stripe")(process.env.stripeSecretKey);
const { MESSAGES } = require("../common/constants.common");
const {
  jsonResponse,
  errorMessage,
  successMessage,
  badReqResponse,
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
      if (!appointment.startTime)
        return badReqResponse(res, "Start time is required to make payment");
      if (appointment.paymentDetails.hasPaid)
        return jsonResponse(res, 400, false, "Payment has already been made");

      const session = await stripeServices.createStripeSession(
        appointment,
        appointmentId
      );

      await appointmentServices.updateAppointmentSessionId(
        appointmentId,
        session.id
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
