require("dotenv").config();
var express = require("express");
var crypto = require("crypto");
const customerService = require("../services/customer.service");
const entryServices = require("../services/entry.services");

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
}

module.exports = new WebhookControllers();
