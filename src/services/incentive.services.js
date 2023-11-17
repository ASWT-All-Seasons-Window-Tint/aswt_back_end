const { Incentive } = require("../model/incentive.model").incentive;

class IncentiveService {
  //Create new incentive
  async createIncentive(reqBody) {
    const { startTime, endTime, numberOfVehiclesThreshold, amountToBePaid } =
      reqBody;

    const incentive = new Incentive({
      startTime,
      endTime,
      numberOfVehiclesThreshold,
      amountToBePaid,
    });

    return await incentive.save();
  }

  getAllIncentives() {
    return Incentive.find().sort({ _id: -1 });
  }

  isIncentiveActive = async () => {
    const currentDate = new Date();
    const activeIncentive = await Incentive.findOne({
      startTime: { $lte: currentDate },
      endTime: { $gte: currentDate },
    });

    return activeIncentive;
  };

  async updateIncentiveById(id, incentive) {
    return await Incentive.findByIdAndUpdate(
      id,
      {
        $set: incentive,
      },
      { new: true }
    );
  }

  async deleteIncentive(id) {
    return await Incentive.findByIdAndRemove(id);
  }
}

module.exports = new IncentiveService();
