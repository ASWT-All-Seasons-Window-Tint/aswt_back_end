const { jsonResponse } = require("../common/messages.common");
const freeTimeSlotServices = require("../services/freeTimeSlot.services");
const newDateUtils = require("../utils/newDate.utils");
const { VALID_TIME_SLOTS } =
  require("../common/constants.common").FREE_TIME_SLOTS;

module.exports = function (req, res, next) {
  const { startTime } = req.body;

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

  next();
};

function validateTimeString(timeString) {
  const pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+\d{2}:\d{2}$/;
  return pattern.test(timeString);
}

function isFutureDateTime(dateTimeString) {
  // Parse the provided datetime string
  const providedDateTime = new Date(dateTimeString);

  // Get the current date and time
  const currentDate = newDateUtils();

  // Compare the provided datetime with the current datetime
  return providedDateTime > currentDate;
}
