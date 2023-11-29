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
    return Incentive.find()
      .populate("eligibleStaffs", "firstName lastName email")
      .sort({ _id: -1 });
  }

  getIncentiveById(id) {
    return Incentive.findById(id)
      .populate("eligibleStaffs", "firstName lastName email")
      .sort({ _id: -1 });
  }

  isIncentiveOngoing = (startDate, endDate) => {
    startDate = new Date(startDate);
    endDate = new Date(endDate);

    return Incentive.findOne({
      $or: [{ endTime: { $gte: startDate } }, { startTime: { $lt: endDate } }],
    });
  };

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
