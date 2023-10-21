module.exports = function () {
  const today = new Date(); // This gives you the current date and time in your local time zone
  today.setHours(0, 0, 0, 0); // Set the time to midnight

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1); // Get the date for tomorrow

  return { today, tomorrow };
};
