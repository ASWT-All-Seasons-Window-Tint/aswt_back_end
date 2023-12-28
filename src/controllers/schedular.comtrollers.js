const Queue = require("bull");
const { successMessage } = require("../common/messages.common");
const { MESSAGES } = require("../common/constants.common");

const redisConnection = { url: process.env.redisUrl };
const entryQueue = new Queue("auto-send-invoice", redisConnection);
const appointmentQueue = new Queue("reminders", redisConnection);

class SchedularController {
  scheduleInvoice = (req, res) => {
    const { entryId, delay } = req.params;

    entryQueue.add(
      {
        entryId,
      },
      {
        delay,
      }
    );

    res.send(successMessage(MESSAGES.CREATED, true));
  };

  scheduleSms = (req, res) => {
    const { customerNumber, messageBody, delay } = req.body;

    appointmentQueue.add(
      {
        customerNumber,
        body: messageBody,
      },
      {
        delay,
      }
    );

    res.send(successMessage(MESSAGES.CREATED, true));
  };

  exportEntryQueue() {
    return entryQueue;
  }

  exportQueue() {
    return appointmentQueue;
  }
}

module.exports = new SchedularController();
