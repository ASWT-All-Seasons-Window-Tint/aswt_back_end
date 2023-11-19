const { jsonResponse } = require("../common/messages.common");
const freeTimeSlotServices = require("../services/freeTimeSlot.services");
const newDateUtils = require("../utils/newDate.utils");
const { VALID_TIME_SLOTS } =
  require("../common/constants.common").FREE_TIME_SLOTS;

module.exports = function (req, res, next) {
  const { startTime } = req.body;

  if (startTime) {
    if (!validateTimeString(startTime))
      return jsonResponse(res, 400, false, "Invalid date-time format");

    const { formattedTime } = freeTimeSlotServices.getFormattedDate(startTime);
    if (!VALID_TIME_SLOTS().includes(formattedTime))
      return jsonResponse(res, 400, false, "You provided an invalid time");

    if (!isFutureDateTime(startTime))
      return jsonResponse(
        res,
        400,
        false,
        "Start date and time must be a future date"
      );
  }

  next();
};

function validateTimeString(dateString) {
  const date = new Date(dateString);

  // Check if the date is valid
  // The Date object will return 'Invalid Date' for invalid dates
  if (isNaN(date)) {
    return false;
  }

  // Additional checks can be done if necessary
  // For example, you can compare the parsed date with the original input

  // Return true if the date is valid
  return true;
}

function isFutureDateTime(dateTimeString) {
  // Parse the provided datetime string
  const providedDateTime = new Date(dateTimeString);

  // Get the current date and time
  const currentDate = newDateUtils();

  // Compare the provided datetime with the current datetime
  return providedDateTime > currentDate;
}
