const { jsonResponse } = require("../common/messages.common");
// when the router handler function is passed as an argument to this function,
// it helps to handle the rejected promise of the handler function
module.exports = function (handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res);
    } catch (error) {
      const errorResponseLowercase = JSON.parse(
        JSON.stringify(error).toLowerCase()
      );

      if (errorResponseLowercase.fault) {
        const type = errorResponseLowercase.fault.type;

        if (type === "validationfault") {
          if (errorResponseLowercase.fault.error[0].code === "610")
            return res
              .status(404)
              .json({ success: false, message: "Resource not found" });

          console.log(errorResponseLowercase.fault);
          return res
            .status(400)
            .json({ success: false, message: error.Fault.Error[0].Message });
        }

        if (type === "authentication") {
          console.log(errorResponseLowercase.fault);
          // Requires Human intervention
          return res.redirect("/api/v1/oauth2/");
        }

        console.log(errorResponseLowercase.fault);

        return jsonResponse(res, 500, false, "Something failed");
      }

      function isStringified(input) {
        try {
          const parsed = JSON.parse(input);
          return typeof parsed === "object" && parsed !== null;
        } catch (error) {
          return false;
        }
      }
      let errorMessage = {};

      if (isStringified(error.message))
        errorMessage = JSON.parse(error.message);
      jsonResponse(
        res,
        errorMessage.status || 500,
        false,
        errorMessage.message || "Something failed"
      );

      next(error);
    }
  };
};
