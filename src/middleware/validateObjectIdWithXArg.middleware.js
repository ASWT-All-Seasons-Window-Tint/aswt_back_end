const mongoose = require("mongoose");

module.exports = (ids) => {
  return function (req, res, next) {
    if (!Array.isArray(ids)) {
      return res.status(401).send({
        success: false,
        message: "ids must be an array",
      });
    }

    const invalidIds = ids.filter((id) => {
      return !mongoose.Types.ObjectId.isValid(req.params[id]);
    });

    if (invalidIds.length > 0) {
      return res.status(401).send({
        success: false,
        message: `Invalid ids: ${req.params[ids[0]]}`,
      });
    }

    next();
  };
};
