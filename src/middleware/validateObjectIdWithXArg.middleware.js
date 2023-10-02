const mongoose = require("mongoose");
const { badReqResponse } = require("../common/messages.common");

module.exports = (ids) => {
  return function (req, res, next) {
    if (!Array.isArray(ids)) {
      return badReqResponse(res, "ids must be an array");
    }

    const invalidIds = ids
      .filter((id) => {
        return !mongoose.Types.ObjectId.isValid(req.params[id]);
      })
      .map((id) => req.params[id]);

    if (invalidIds.length > 0) {
      return badReqResponse(
        res,
        `The parameter with the value(s) [${invalidIds}] not valid`
      );
    }

    next();
  };
};
