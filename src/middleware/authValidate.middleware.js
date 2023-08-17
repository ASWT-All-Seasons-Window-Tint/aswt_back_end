// this middleware is used to validate the body of the request.

const { errorMessage } = require("../common/constants.common");
const userServices = require("../services/user.services");

// it takes the models validator as a function and acts as a factory fuction.
module.exports = (validator) => {
  return async (req, res, next) => {
    let { error } = validator(req.body);
    if (error)
      return res
        .status(400)
        .send({ success: false, message: error.details[0].message });

    const user = await userServices.getUserByEmail(req.body.email);
    if (!user)
      return res
        .status(404)
        .send({ success: false, message: errorMessage("user") });

    req.user = user;

    if (user.role == "staff") {
      req.body.role = user.role;
      const { error } = validator(req.body);
      if (error)
        return res
          .status(400)
          .send({ success: false, message: error.details[0].message });
    }

    next();
  };
};
