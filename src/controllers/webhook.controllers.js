require("dotenv").config();
const stripe = require("stripe")(process.env.stripeSecretKey);
var express = require("express");
var crypto = require("crypto");
const customerService = require("../services/customer.service");
const entryServices = require("../services/entry.services");
const newDateUtils = require("../utils/newDate.utils");
const appointmentServices = require("../services/appointment.services");
const appointmentControllers = require("./appointment.controllers");

class WebhookControllers {
  async webhook(req, res) {
    var webhookPayload = JSON.stringify(req.body);
    //console.log("The payload is :" + JSON.stringify(req.body));
    var signature = req.get("intuit-signature");

    // if signature is empty return 401
    if (!signature) {
      return res.status(401).send("FORBIDDEN");
    }

    // if payload is empty, don't do anything
    if (!webhookPayload) {
      return res.status(200).send("success");
    }

    /**
     * Validates the payload with the intuit-signature hash
     */
    var hash = crypto
      .createHmac("sha256", process.env.webhooksVerifier)
      .update(webhookPayload)
      .digest("base64");
    if (signature === hash) {
      const { eventNotifications } = req.body;

      const qboUrl = process.env.qboUrl;
      const realmId = process.env.realmId;
      const eventNotification = eventNotifications.find(
        (notification) => notification.realmId === realmId
      );
      eventNotification.dataChangeEvent.entities.forEach(async (entity) => {
        const entityNameToLowerCase = entity.name.toLowerCase();
        const entityId = entity.id;
        const entryOperation = entity.operation.toLowerCase();

        const apiEndpoint = `${qboUrl}/${realmId}/${entityNameToLowerCase}/${entityId}`;

        if (entityNameToLowerCase === "customer") {
          await customerService.updateCustomerOnRedisViaWebhook(apiEndpoint);
        }

        if (entityNameToLowerCase === "payment") {
          return await entryServices.updateEntryInvoicePaymentDetails(
            apiEndpoint
          );
        }
      });

      //console.log(`Payment Data: ${paymentData}`);
      /**
       * Write the notification to CSV file
       */
      return res.status(200).send("SUCCESS");
    }
    return res.status(401).send("FORBIDDEN");
  }
  stripeWebHook = async (req, res) => {
    const signature = req.headers["stripe-signature"];

    try {
      const event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        process.env.stripeWebhookSecret
      );

      let paymentIntentId;

      // Successfully constructed event
      // console.log("✅ Success:", event.id);

      // Cast event data to Stripe object
      if (event.type === "payment_intent.succeeded") {
        const intent = event.data.object;

        if (intent.status === "succeeded") {
          const centToUsd = 100;
          const amount = intent.amount_received / centToUsd;
          const currency = intent.currency;
          const appointmentId = intent.metadata.appointmentId;
          const stripeConnectedAccountId =
            intent.metadata.stripeConnectedAccountId;
          const paymentDate = newDateUtils();
          const paymentIntentId = intent.id;

          if (
            appointmentId &&
            stripeConnectedAccountId === process.env.stripeConnectedAccountId
          ) {
            await appointmentServices.updateAppointmentPaymentDetails({
              appointmentId,
              amount,
              currency,
              paymentDate,
              paymentIntentId,
              chargeId: intent.latest_charge,
            });
          }
        }
      } else if (event.type === "payment_intent.payment_failed") {
        const intent = event.data.object;

        const appointmentId = intent.metadata.appointmentId;
        const appointment = await appointmentServices.getAppointmentById(
          appointmentId
        );

        await appointmentControllers.retrieveTimeSlot(appointment);

        // console.log(`Charge: ${charge.payment_intent}`);
      } else if (event.type === "charge.succeeded") {
        const charge = event.data.object;
        // console.log(`Charge: ${charge.payment_intent}`);
      } else if (event.type === "checkout.session.completed") {
        const checkout = event.data.object;
        // if (checkout.payment_status === "paid") {
        //   await entryServices.updateEntryPaymentDetails({
        //     entryId,
        //     amount,
        //     currency,
        //     paymentDate,
        //   });
        // }
      } else {
        console.warn(`🤷‍♀️ Unhandled event type: `); //${event.type}`);
      }

      // Return a response to acknowledge receipt of the event
      res.json({ received: true });
    } catch (err) {
      console.log(err);
      res.status(400).send(`Webhook error: ${err.message}`);
    }
  };
}

module.exports = new WebhookControllers();
