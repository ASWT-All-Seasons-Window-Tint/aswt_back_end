module.exports = function () {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const date = new Date();
  const options = { timeZone: "America/Chicago" };

  // Use toLocaleString to format the date in the desired time zone
  const formattedDateString = date.toLocaleString("en-US", options);

  // Parse the formatted date string back into a Date object
  const parsedDate = new Date(`${formattedDateString} UTC`);

  return parsedDate;
};
