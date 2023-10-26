const { DistanceThreshold } = require("../model/department.model");

class DistanceThresholdService {
  //Create new department
  async createDistanceThreshold(department) {
    return await department.save();
  }

  async getDistanceThresholdById(departmentId) {
    return await DistanceThreshold.findById(departmentId);
  }

  async validateDistanceThresholdIds(departmentIds) {
    if (departmentIds) {
      const departments = await DistanceThreshold.find({
        _id: { $in: departmentIds },
      });

      const foundIds = departments.map((d) => d._id.toString());

      const missingIds = departmentIds.filter((id) => !foundIds.includes(id));

      return missingIds;
    }
    return [];
  }

  async getDistanceThresholdsForManager(departmentIds) {
    return await DistanceThreshold.find({
      _id: { $in: departmentIds },
    });
  }

  async getDistanceThresholdByName(name) {
    const caseInsensitiveName = new RegExp(name, "i");

    return await DistanceThreshold.findOne({ name: caseInsensitiveName });
  }

  async getAllDistanceThresholds() {
    return await DistanceThreshold.find().sort({ _id: -1 });
  }

  async updateDistanceThresholdById(id, department) {
    return await DistanceThreshold.findByIdAndUpdate(
      id,
      {
        $set: department,
      },
      { new: true }
    );
  }

  async deleteDistanceThreshold(id) {
    return await DistanceThreshold.findByIdAndRemove(id);
  }
}

module.exports = new DistanceThresholdService();
