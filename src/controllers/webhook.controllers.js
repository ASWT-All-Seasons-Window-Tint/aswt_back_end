require("dotenv").config();
var express = require("express");
var app = express();
var crypto = require("crypto");
const { getNewAccessToken } = require("../utils/getNewAccessToken.utils");
const getWebhookDataUtils = require("../utils/getWebhookData.utils");
const { updateCache } = require("../utils/getOrSetCache.utils");
const { EXPIRES } = require("../common/constants.common");
const customerService = require("../services/customer.service");
const initializeQbUtils = require("../utils/initializeQb.utils");

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

      console.log(
        "EventNotification: ",
        eventNotifications[0].dataChangeEvent.entities
      );

      const qboUrl = process.env.qboUrl;
      const realmId = eventNotifications[0].realmId;
      const paymentId = eventNotifications[0].dataChangeEvent.entities[0].id;
      const name =
        eventNotifications[0].dataChangeEvent.entities[0].name.toLowerCase();

      const apiEndpoint = `${qboUrl}/${realmId}/${name}/${paymentId}`;

      const paymentData = await getWebhookDataUtils(
        apiEndpoint,
        getNewAccessToken
      );

      if (name === "customer") {
        const id = paymentData.Customer.Id;
        const customer = paymentData.Customer;
        const qbo = await initializeQbUtils();
        const customers = await customerService.fetchAllCustomers(qbo);
        //console.log(id);

        updateCache(`customers?Id=${id}`, EXPIRES, customer);
        updateCache(`customers`, EXPIRES, customers);
      }

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
