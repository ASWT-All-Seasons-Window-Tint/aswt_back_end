const { forbiddenResponse } = require("../common/messages.common");

module.exports = function (req, res, next) {
  if (["customer", "temporal"].includes(req.user.role)) {
    if (!req.user.customerDetails.canCreate)
      return forbiddenResponse(res, "Access Denied");

    req.body.isCustomer = true;
  }

  next();
};
