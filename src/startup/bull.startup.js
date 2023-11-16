require("dotenv").config();
const { exportQueue } = require("../controllers/webhook.controllers");
const { exportEntryQueue } = require("../controllers/entry.controllers");
const sendTextMessageUtils = require("../utils/sendTextMessage.utils");
const {
  createAndSendInvoice,
  sendInvoiceWithoutCreating,
} = require("../controllers/invoice.controllers");
const entryServices = require("../services/entry.services");

// Worker function for the scheduleSmsQueue
function scheduleSmsWorker(job) {
  const customerNumber = job.data.customerNumber;
  const body = job.data.body;
  sendTextMessageUtils(customerNumber, body);
}

// Worker function for the autoSendInvoiceAfter24Hrs
async function autoSendInvoiceWorker(job) {
  const entryId = job.data.entryId;

  try {
    const entry = await entryServices.getEntryById(entryId);

    if (entry.invoice.qbId) {
      await sendInvoiceWithoutCreating(entry);
    } else {
      await createAndSendInvoice(entry);
    }
  } catch (error) {
    console.log(error);
  }
}

module.exports = {
  startScheduleSmsQueue: function () {
    exportQueue().process(scheduleSmsWorker);
  },
  startAutoSendInvoiceQueue: function () {
    exportEntryQueue().process(autoSendInvoiceWorker);
  },
};
