const { getEntries } = require("../services/entry.services");
const invoiceService = require("../services/invoice.services");
const {
  errorMessage,
  successMessage,
  jsonResponse,
} = require("../common/messages.common");
const { MESSAGES, errorAlreadyExists } = require("../common/constants.common");
const convertEntryQbInvoiceReqBody = require("../utils/convertDbInvoiceToQbInvoiceReqBody.utils");
const initializeQbUtils = require("../utils/initializeQb.utils");

class DepartmentController {
  async getStatus(req, res) {
    res.status(200).send({ message: MESSAGES.DEFAULT, success: true });
  }

  //Create a new department
  async sendInvoice(req, res) {
    try {
      const [entry] = await getEntries({ entryId: req.params.id });
      const { invoice: invoiceData } = convertEntryQbInvoiceReqBody(entry);
      const qbo = await initializeQbUtils();

      const invoice = await invoiceService.createInvoiceOnQuickBooks(
        qbo,
        invoiceData
      );
      return res.send(successMessage(MESSAGES.FETCHED, invoice));
    } catch (error) {
      console.log(error);
      return jsonResponse(res, 400, false, error.Fault.Error[0].Detail);
    }
  }

  //get department from the database, using their email
  async getDepartmentById(req, res) {
    const department = await departmentService.getDepartmentById(req.params.id);
    if (!department) return res.status(404).send(errorMessage("department"));

    res.send(successMessage(MESSAGES.FETCHED, department));
  }

  //get all departments in the department collection/table
  async fetchAllDepartments(req, res) {
    const departments =
      req.user.role === "manager"
        ? await departmentService.getDepartmentsForManager(req.user.departments)
        : await departmentService.getAllDepartments();

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
