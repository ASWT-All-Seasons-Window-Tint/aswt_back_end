const {} = require("../common/messages.common");

module.exports = function (req, res, next) {
  const errorMessage = "Invalid role";
  let role = req.params.role;
  if (role) role = role.toLowerCase();

  const roleLists = ["customer", "manager", "staff"];

  if (!roleLists.includes(role))
    return res
      .status(400)
      .send({ success: false, message: "Invalid learning track" });

  next();
};
