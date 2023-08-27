const { Department } = require("../model/department.model");

class DepartmentService {
  //Create new department
  async createDepartment(department) {
    return await department.save();
  }

  async getDepartmentById(departmentId) {
    return await Department.findById(departmentId);
  }

  async validateDepartmentIds(departmentIds) {
    const departments = await Department.find({
      _id: { $in: departmentIds },
    });

    const foundIds = departments.map((d) => d._id.toString());

    const missingIds = departmentIds.filter((id) => !foundIds.includes(id));

    return missingIds;
  }

  async getDepartmentsForManager(departmentIds) {
    return await Department.find({
      _id: { $in: departmentIds },
    });
  }

  async getDepartmentByName(name) {
    const caseInsensitiveName = new RegExp(name, "i");

    return await Department.findOne({ name: caseInsensitiveName });
  }

  async getAllDepartments() {
    return await Department.find().sort({ _id: -1 });
  }

  async updateDepartmentById(id, department) {
    return await Department.findByIdAndUpdate(
      id,
      {
        $set: department,
      },
      { new: true }
    );
  }

  async deleteDepartment(id) {
    return await Department.findByIdAndRemove(id);
  }
}

module.exports = new DepartmentService();
