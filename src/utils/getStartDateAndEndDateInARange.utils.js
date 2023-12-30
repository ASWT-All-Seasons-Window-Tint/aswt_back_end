module.exports = function (daysAgo) {
  // Get the current date
  let currentDate = new Date();

  // Set the time to 12:00 AM for the date 'daysAgo' days ago
  currentDate.setDate(currentDate.getDate() - daysAgo);
  currentDate.setHours(0, 0, 0, 0);

  // Set the time to 11:59:59.999 PM for the current date
  let endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  // Return an object with start and end dates
  return {
    startDate: currentDate,
    endDate,
  };
};
