const { badReqResponse } = require("../common/messages.common");

// Another middleware function to check the ID parameter.
// this middle ware takes the id property.
module.exports = () => {
  return function (req, res, next) {
    const validActions = [
      "PickupFromDealership",
      "TakenToShop",
      "TakenFromShop",
      "DropOffCompleted",
    ];

    const { locationType } = req.params;

    if (!validActions.includes(locationType))
      return badReqResponse(res, `Cannot PUT ${req.originalUrl}`);

    req.body.geoLocation.locationType = locationType;

    next();
  };
};
