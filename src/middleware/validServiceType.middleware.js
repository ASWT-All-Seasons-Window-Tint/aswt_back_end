const { jsonResponse } = require("../common/messages.common");

module.exports = function (req, res, next) {
  const { type } = req.params;
  const typeToLowerCase = type.toLowerCase();
  const validServiceTypes = ["installation", "removal"];

  if (!validServiceTypes.includes(typeToLowerCase))
    return jsonResponse(
      res,
      400,
      false,
      "You provided an invalid service type"
    );

  next();
};
