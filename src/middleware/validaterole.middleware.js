const { jsonResponse } = require("../common/messages.common");

module.exports = function (req, res, next) {
  const errorMessage = "Invalid role";
  let role = req.params.role;
  if (role) role = role.toLowerCase();

  const roleLists = ["customer", "manager", "staff"];

  if (!roleLists.includes(role))
    return jsonResponse(res, 400, false, errorMessage);

  next();
};
