const { DistanceThreshold } = require("../model/distanceThreshold.model");
const distanceThresholdService = require("../services/distanceThreshold.services");
const { MESSAGES } = require("../common/constants.common");
const {
  successMessage,
  jsonResponse,
  forbiddenResponse,
} = require("../common/messages.common");
const { validLocationType } = require("../model/entry.model").joiValidator;

class DistanceThresholdController {
  async getStatus(req, res) {
    res.status(200).send({ message: MESSAGES.DEFAULT, success: true });
  }

  //Create a new distanceThreshold
  async createDistanceThreshold(req, res) {
    const thresholdDistance =
      await distanceThresholdService.getDistanceThreshold();

    if (thresholdDistance)
      return forbiddenResponse(
        res,
        "Threshold distance can only be added once"
      );

    const {
      Scanned,
      TakenFromShop,
      TakenToShop,
      PickupFromDealership,
      DropOffCompleted,
    } = req.body;

    const distanceThreshold = new DistanceThreshold({
      Scanned,
      TakenFromShop,
      TakenToShop,
      PickupFromDealership,
      DropOffCompleted,
    });

    await distanceThreshold.save();

    res.send(successMessage(MESSAGES.FETCHED, distanceThreshold));
  }
  async getDistanceThreshold(req, res) {
    const distanceThreshold =
      await distanceThresholdService.getDistanceThreshold();
    if (!distanceThreshold)
      return res.status(404).send(errorMessage("distanceThreshold"));

    res.send(successMessage(MESSAGES.UPDATED, distanceThreshold));
  }

  async updateDistanceThreshold(req, res) {
    const distanceThreshold =
      await distanceThresholdService.getDistanceThreshold();
    if (!distanceThreshold)
      return res.status(404).send(errorMessage("distanceThreshold"));

    for (const locationType of Object.keys(req.body))
      distanceThreshold[locationType] = req.body[locationType];

    await distanceThreshold.save();

    res.send(successMessage(MESSAGES.UPDATED, distanceThreshold));
  }
}

module.exports = new DistanceThresholdController();
