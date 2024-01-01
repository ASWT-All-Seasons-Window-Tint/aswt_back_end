const cron = require("node-cron");
const { sendUpaidInvoices } = require("../controllers/invoice.controllers");

function startScheduledJob() {
  // Schedule the function to run on the last day of each month at a specific time (e.g., 00:00)
  cron.schedule(
    "* * * * *",
    async () => {
      try {
        // await sendUpaidInvoices();
        console.log("Scheduled task executed.");
      } catch (error) {
        console.error("Error executing scheduled task:", error);
      }
    },
    {
      scheduled: true,
      timezone: "Etc/UTC",
    }
  );
}

module.exports = startScheduledJob;
