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
          return res
            .status(400)
            .json({ success: false, message: error.Fault.Error[0].Detail });
        }

        if (type === "authentication") {
          console.log(errorResponseLowercase.fault);
          // Requires Human intervention
          return res.redirect("/api/v1/oauth2/");
          // To do
        }

        console.log(errorResponseLowercase.fault);

        return jsonResponse(res, 500, false, "Something failed");
      }

      next();
    }
  };
};
