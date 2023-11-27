const { badReqResponse } = require("../common/messages.common");

module.exports = function (req, res, next) {
  const { date, startDate, endDate } = req.params;

  if (!startDate && endDate) {
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
    const monthName = new Intl.DateTimeFormat("en-US", {
      month: "long",
    }).format(parsedDate);
    // Get year
    const year = parsedDate.getFullYear();

    req.parsedYear = `${year}`;
    req.parsedMonthName = monthName;
  }

  if (startDate && endDate) {
    const currentDate = new Date();
    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);
    const parsedDates = [parsedStartDate, parsedEndDate];

    for (const parsedDate of parsedDates) {
      if (isNaN(parsedDate.getTime())) {
        return badReqResponse(
          res,
          `Date parameter with value (${parsedDate}) is not valid; the accepted format is: YYYY-MM-DD.`
        );
      }

      const year = parsedDate.getFullYear();

      if (year < 2023)
        return badReqResponse(res, "Year value should not be less than 2023");
    }

    if (parsedStartDate > currentDate)
      return badReqResponse(res, "Start date should not be future date");

    if (startDate > endDate)
      return badReqResponse(res, "Start date should not be ahead of end date");

    const daysDifference = getDaysDifference(startDate, endDate);

    const numberOfDaysAllowed = 7;

    if (daysDifference > numberOfDaysAllowed)
      return badReqResponse(
        res,
        `The difference between end date and start date should not be more than ${numberOfDaysAllowed} days`
      );

    // Move to the next middleware or route handler
  }
  next();
};

function getDaysDifference(startDate, endDate) {
  // Parse the input date string into a Date object
  const startDateTime = new Date(startDate);
  const endDateTime = new Date(endDate);

  // Calculate the difference in milliseconds
  const timeDifference = endDateTime - startDateTime;

  // Convert milliseconds to days
  const daysDifference = Math.ceil(timeDifference / (1000 * 60 * 60 * 24));

  return daysDifference;
}
