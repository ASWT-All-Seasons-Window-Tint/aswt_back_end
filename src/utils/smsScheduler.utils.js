const cron = require("node-cron");
const { Appointment } = require("../model/appointment.model");
const sendTextMessage = require("./sendTextMessage.utils");
const getSmsDateUtils = require("./getSmsDate.utils");
const newDate = require("./newDate.utils");

// Function to send SMS reminder
async function sendReminder(appointment) {
  const startTime = appointment.startTime;
  const smsDate = getSmsDateUtils(startTime);
  const customerNumber = appointment.customerNumber;

  const body = `Hi, your appointment is in 1 hour by ${smsDate}.`;

  try {
    sendTextMessage("+234", customerNumber, body);

    // Update the appointment record to mark the reminder as sent
    await Appointment.updateOne(
      { _id: appointment._id },
      { reminderSent: true }
    );
  } catch (error) {
    console.error(`Error sending reminder to customer:`, error);
  }
}

// Schedule the task to run every hour
function startReminderScheduler() {
  cron.schedule("* * * * *", async () => {
    // Get the current time
    const currentTime = newDate();

    // Find appointments within the next hour that haven't had a reminder sent
    const upcomingAppointments = await Appointment.find({
      appointmentDate: {
        $gt: currentTime,
        $lt: new Date(currentTime.getTime() + 60 * 60 * 1000),
      },
      reminderSent: false,
    });

    if (upcomingAppointments.length < 1) return;

    // Send reminders for each upcoming appointment
    for (const appointment of upcomingAppointments) {
      await sendReminder(appointment);
    }
  });
}

module.exports = startReminderScheduler;
