const cron = require("node-cron");
const { createAndSendInvoice } = require("../controllers/invoice.controllers");
const entryService = require("../services/entry.services");

function startScheduledJob() {
  // Schedule the function to run on the last day of each month at a specific time (e.g., 00:00)
  cron.schedule(
    "05 17 * * *",
    async () => {
      const currentDate = new Date();
      try {
        const entries = await entryService.getAllDealerEntriesInThePast24Hrs(
          currentDate
        );

        for (const entry of entries) {
          if (!entry.invoice.qbId) {
            await createAndSendInvoice(entry);
            console.log("Sent Invoice");
          }
        }
      } catch (error) {
        console.error("Error executing scheduled task:", error);
      }
    },
    {
      scheduled: true,
      timezone: "Africa/Lagos",
    }
  );
}

module.exports = startScheduledJob;
