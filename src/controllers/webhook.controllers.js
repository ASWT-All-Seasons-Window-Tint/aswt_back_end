require("dotenv").config();
const Queue = require("bull");
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
const getWbHksPayMentDetailsUtils = require("../utils/getWbHksPayMentDetails.utils");
const sendTextMessageUtils = require("../utils/sendTextMessage.utils");
const { carDetailsProperties } = require("../model/entry.model").joiValidator;
const { SMS } = require("../common/messages.common");
const {
  createInvoiceOnQuickBooks,
  sendInvoicePdf,
} = require("../services/invoice.services");
const getDateAndTimeUtils = require("../utils/getDateAndTime.utils");
const axiosRequestUtils = require("../utils/axiosRequest.utils");
const userServices = require("../services/user.services");

// const redisConnection = { url: process.env.redisUrl };
// const appointmentQueue = new Queue("reminders", redisConnection);

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
            const qbo = await initializeQbUtils();
            const appointment = await appointmentServices.getAppointmentById(
              appointmentId
            );

            if (!appointment) {
              console.log("Apointment not found");
              return;
            }

            const {
              customerEmail,
              carDetails,
              residentialDetails,
              appointmentType,
              startTime,
              customerName,
              customerNumber,
              paymentDetails,
            } = appointment;

            const smsService =
              appointmentType === "auto"
                ? `${carDetails.priceBreakdown[0].serviceName} ${appointment.carDetails.priceBreakdown[0].serviceType} and more`
                : appointment.residentialDetails.customerMeasurementAwareness
                ? "Window Tinting"
                : "Measurement Enquiry";

            const delay = this.getDelay(startTime);
            const { nowBody, reminderBody } = SMS;

            const { date, time } = getDateAndTimeUtils(startTime);

            sendTextMessageUtils(
              customerNumber,
              nowBody(date, time, customerName, smsService)
            );

            const token = await userServices.getToken();
            const messageBody = reminderBody(
              date,
              time,
              customerName,
              process.env.customerContactNumber
            );
            const params = { delay, customerNumber, messageBody, token };

            await axiosRequestUtils(params, "sms");

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

              const entry = await entryServices.createNewEntry(customer);
              appointment.invoiceNumber = entry.invoice.invoiceNumber;

              const { sessionId } = paymentDetails;
              const qbId = customer.Id;
              const { invoice: invoiceReqBody } =
                convertDbInvoiceToQbInvoiceReqBodyUtils(
                  appointment,
                  appointmentType
                );

              delete appointment.invoiceNumber;

              if (!invoiceReqBody.DocNumber) delete invoiceReqBody.DocNumber;

              invoiceReqBody.CustomerRef.value = qbId;

              const checkoutSession = await stripe.checkout.sessions.retrieve(
                sessionId
              );

              const discount = checkoutSession.total_details.amount_discount;
              if (discount > 0) {
                const DiscountLineDetail =
                  appointmentServices.getDiscountLine(discount);

                invoiceReqBody.Line.push(DiscountLineDetail);
              }

              const { invoice } = await createInvoiceOnQuickBooks(
                qbo,
                invoiceReqBody,
                customerEmail,
                false
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

              await sendInvoicePdf(qbo, invoiceId, customerEmail);

              const qbPaymentId = payment.Id;

              if (appointmentType === "auto") {
                const { serviceIds } =
                  appointmentServices.getServiceIdsAndfilmQualityIds(
                    appointment.carDetails.serviceDetails
                  );

                const carDetails = {};
                for (const property of carDetailsProperties) {
                  if (property === "serviceIds") {
                    carDetails[property] = serviceIds;
                  } else {
                    carDetails[property] = appointment.carDetails[property];
                  }
                }

                entry.invoice.carDetails = [carDetails];

                entry.invoice.qbId = invoiceId;
                entry.numberOfCarsAdded = 1;
                entry.invoice.invoiceNumber = invoiceNumber;
                entry.invoice.sent = true;
                entry.isFromAppointment = true;
                entry.invoice.totalPrice = carDetails.price;

                await entryServices.updateEntryInvoicePaymentDetails({
                  entry,
                  currency,
                  paymentDate,
                  amount: netAmount,
                });
              }

              appointment.paymentDetails.customerDisplayName =
                customer.DisplayName;
              appointment.customerId = customer.Id;

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

  getDelay(startTime) {
    const currentDate = newDateUtils();
    const appointmentTime = new Date(startTime);

    //   date.setMinutes(date.getMinutes() + 1);

    const TwentyFourHours = 24 * 60 * 60 * 1000;

    const delay =
      appointmentTime.getTime() - currentDate.getTime() - TwentyFourHours;

    return delay > 0 ? delay : delay + TwentyFourHours;
  }

  exportQueue() {
    return appointmentQueue;
  }
}

module.exports = new WebhookControllers();
