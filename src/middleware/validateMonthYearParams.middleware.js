const { validMonthNames } = require("../common/constants.common");
const { badReqResponse } = require("../common/messages.common");

// This middleware checks if the user is an educator.
// The isAdmin property is only given at the database level for authencity
module.exports = function (req, res, next) {
  let { monthName, year } = req.params;

  if (!monthName && !year) {
    year = req.parsedYear;
    monthName = req.parsedMonthName;
  }
  const invalidMonth = "Invalid month name. Please provide a valid month name.";
  const invalidYear =
    "Invalid year. Please provide a valid positive integer year.";
  const beyondMonthYear =
    "Year and month cannot be beyond the current year and month.";

  const behindYear = "Year cannot be before 2023";

  function isNumber(value) {
    return typeof value === "number" || !isNaN(Number(value));
  }

  if (monthName && !validMonthNames.includes(monthName))
    return badReqResponse(res, invalidMonth);

  // Validation for year
  if (!isNumber(year) || year <= 0) return badReqResponse(res, invalidYear);

  if (year < 2023) return badReqResponse(res, behindYear);
  // Get the current date
  const currentDate = new Date();

  // Check if the provided year and month are beyond the current date
  if (year > currentDate.getFullYear()) {
    return badReqResponse(res, beyondMonthYear);
  } else if (monthName) {
    const monthIndex = getMonthIndex(monthName);
    if (
      year === currentDate.getFullYear() ||
      monthIndex > currentDate.getMonth()
    )
      return badReqResponse(res, beyondMonthYear);
  }

  function getMonthIndex(monthName) {
    const date = new Date(`${monthName} 1, 2000`); // Using a specific date and year (2000) for consistency
    const monthIndex = date.getMonth();
    return monthIndex;
  }

  next();
};
