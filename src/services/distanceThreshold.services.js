const { DistanceThreshold } = require("../model/distanceThreshold.model");

class DistanceThresholdService {
  //Create new distanceThreshold
  async createDistanceThreshold(distanceThreshold) {
    return await distanceThreshold.save();
  }

  async getDistanceThreshold() {
    return DistanceThreshold.findOne().limit(1);
  }

  async updateDistanceThresholdById(id, distanceThreshold) {
    return await DistanceThreshold.findByIdAndUpdate(
      id,
      {
        $set: distanceThreshold,
      },
      { new: true }
    );
  }
}

module.exports = new DistanceThresholdService();
