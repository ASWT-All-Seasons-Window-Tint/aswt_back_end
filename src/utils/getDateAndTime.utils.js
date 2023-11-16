module.exports = function (date) {
  // Check if the input is a valid Date object
  if (!(date instanceof Date) || isNaN(date)) {
    throw new Error("Invalid Date object");
  }

  // Format date with month name, day, and year in US format using the specified time zone
  const formattedDate = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Format time in US format (12-hour clock with AM/PM) using the specified time zone
  const formattedTime = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  });

  // Return an object with separate date and time properties
  return {
    date: formattedDate,
    time: formattedTime,
  };
};
