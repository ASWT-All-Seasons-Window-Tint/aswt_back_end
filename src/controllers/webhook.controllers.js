require("dotenv").config();
const stripe = require("stripe")(process.env.stripeSecretKey);
var express = require("express");
var crypto = require("crypto");
const customerService = require("../services/customer.service");
const entryServices = require("../services/entry.services");
const newDateUtils = require("../utils/newDate.utils");
const appointmentServices = require("../services/appointment.services");
const paymentServices = require("../services/payment.services");
const appointmentControllers = require("./appointment.controllers");
const initializeQbUtils = require("../utils/initializeQb.utils");
const { getCustomerByNameOrEmail } = require("./customer.controllers");
const convertDbInvoiceToQbInvoiceReqBodyUtils = require("../utils/convertDbInvoiceToQbInvoiceReqBody.utils");
const { createInvoiceOnQuickBooks } = require("../services/invoice.services");
const getWbHksPayMentDetailsUtils = require("../utils/getWbHksPayMentDetails.utils");
const { User } = require("../model/user.model").user;

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
          const {
            amount,
            currency,
            customerId,
            invoiceId,
            invoiceNumber,
            paymentDate,
            qbPaymentId,
          } = await getWbHksPayMentDetailsUtils(apiEndpoint);

          const entry = await entryServices.getEntryForCustomerWithQboId(
            customerId,
            invoiceId
          );
          if (entry) {
            return await entryServices.updateEntryInvoicePaymentDetails({
              entry,
              currency,
              paymentDate,
              amount,
            });
          }

          const appointment =
            await appointmentServices.getAppointmentByQbIdAndInvoiceNumber({
              invoiceId,
              invoiceNumber,
            });

          if (appointment) {
            return await appointmentServices.updateAppointmentPaymentDetails({
              invoiceId,
              invoiceNumber,
              currency,
              paymentDate,
              amount,
              qbPaymentId,
            });
          }

          return;
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

          if (appointmentId) {
            console.log("Hit");
            const qbo = await initializeQbUtils();
            const appointment = await appointmentServices.getAppointmentById(
              appointmentId
            );

            if (!appointment) {
              console.log("Apointment not found");
              return;
            }

            const { customerEmail, carDetails, residentialDetails } =
              appointment;

            await appointmentServices.updateAppointmentPaymentDetails({
              appointmentId,
              amount,
              currency,
              paymentDate,
              paymentIntentId,
              chargeId: intent.latest_charge,
            });

            if (!appointment.paymentDetails.invoiceId) {
              let { error, customer } = await getCustomerByNameOrEmail({
                qbo,
                email: customerEmail,
              });

              if (error) {
                if (error.toLowerCase() === "data not found") {
                  customer =
                    await customerService.createCustomerFromAppointmentDetails(
                      qbo,
                      appointment
                    );
                } else {
                  console.log(error);
                  return;
                }
              }
              if (Array.isArray(customer)) customer = customer[0];

              console.log(customer);

              const qbId = customer.Id;
              const { invoice: invoiceReqBody } =
                convertDbInvoiceToQbInvoiceReqBodyUtils(
                  appointment,
                  "resdential"
                );

              invoiceReqBody.CustomerRef.value = qbId;

              const { invoice } = await createInvoiceOnQuickBooks(
                qbo,
                invoiceReqBody,
                customerEmail
              );

              const invoiceId = invoice.Id;
              const invoiceNumber = invoice.DocNumber;

              let netAmount;
              if (carDetails) netAmount = (carDetails.price * 30) / 100;
              else if (residentialDetails) {
                netAmount = residentialDetails.customerMeasurementAwareness
                  ? (residentialDetails.price * 30) / 100
                  : residentialDetails.price;
              }

              const paymentData = paymentServices.getPaymentReqBody(
                customer,
                netAmount,
                invoiceId
              );

              const payment = await paymentServices.createPayment(
                qbo,
                paymentData
              );

              const qbPaymentId = payment.Id;

              await appointmentServices.updateAppointmentInvoiceDetails({
                invoiceId,
                invoiceNumber,
                appointment,
                qbPaymentId,
              });
            }
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
