require("dotenv").config();
const { exportQueue } = require("../controllers/appointment.controllers");
const sendTextMessageUtils = require("../utils/sendTextMessage.utils");

module.exports = function () {
  return exportQueue().process(function (job) {
    const customerNumber = job.data.customerNumber;
    const body = job.data.body;
    sendTextMessageUtils(customerNumber, body);
  });
};
