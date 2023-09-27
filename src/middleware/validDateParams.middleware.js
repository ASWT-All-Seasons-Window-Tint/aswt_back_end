const { badReqResponse } = require("../common/messages.common");

module.exports = function (req, res, next) {
  const { date } = req.params;

  // Check if the date parameter is not provided
  if (!date) {
    return badReqResponse(res, "Date parameter is required");
  }

  // Attempt to create a Date object from the provided date parameter
  const parsedDate = new Date(date);

  // Check if the parsed date is not a valid date
  if (isNaN(parsedDate.getTime())) {
    return badReqResponse(
      res,
      "Date parameter is not valid; the accepted format is: YYYY-MM-DD."
    );
  }
  // Get month name
  const monthName = new Intl.DateTimeFormat("en-US", { month: "long" }).format(
    parsedDate
  );
  // Get year
  const year = parsedDate.getFullYear();

  req.parsedYear = `${year}`;
  req.parsedMonthName = monthName;

  // Move to the next middleware or route handler
  next();
};
