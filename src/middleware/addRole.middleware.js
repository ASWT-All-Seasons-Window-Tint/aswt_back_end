const { forbiddenResponse } = require("../common/messages.common");

module.exports = function (req, res, next) {
  if (req.user.role === "customer") {
    if (!req.user.customerDetails.canCreate)
      return forbiddenResponse(res, "Access Denied");

    req.body.isCustomer = true;
  }

  next();
};
