const { Department } = require("../model/department.model");
const departmentService = require("../services/department.services");
const { errorMessage, successMessage } = require("../common/messages.common");
const { MESSAGES, errorAlreadyExists } = require("../common/constants.common");

class DepartmentController {
  async getStatus(req, res) {
    res.status(200).send({ message: MESSAGES.DEFAULT, success: true });
  }

  //Create a new department
  async createDepartment(req, res) {
    const { name, description } = req.body;

    let department = await departmentService.getDepartmentByName(name);
    if (department)
      return res.status(400).send(errorAlreadyExists("department"));

    department = new Department({ name, description });

    department = await departmentService.createDepartment(department);

    res.send(successMessage(MESSAGES.CREATED, department));
  }

  //get department from the database, using their email
  async getDepartmentById(req, res) {
    const department = await departmentService.getDepartmentById(req.params.id);
    if (!department) return res.status(404).send(errorMessage("department"));

    res.send(successMessage(MESSAGES.FETCHED, department));
  }

  //get all departments in the department collection/table
  async fetchAllDepartments(req, res) {
    const departments = await departmentService.getAllDepartments();

    res.send(successMessage(MESSAGES.FETCHED, departments));
  }

  //Update/edit department data
  async updateDepartment(req, res) {
    const department = await departmentService.getDepartmentById(req.params.id);

    if (!department) return res.status(404).send(errorMessage("department"));

    let updatedDepartment = req.body;

    updatedDepartment = await departmentService.updateDepartmentById(
      req.params.id,
      updatedDepartment
    );

    res.send(successMessage(MESSAGES.UPDATED, updatedDepartment));
  }

  //Delete department account entirely from the database
  async deleteDepartment(req, res) {
    const department = await departmentService.getDepartmentById(req.params.id);

    if (!department) return res.status(404).send(errorMessage("department"));

    await departmentService.deleteDepartment(req.params.id);

    res.send(successMessage(MESSAGES.DELETED, department));
  }
}

module.exports = new DepartmentController();
