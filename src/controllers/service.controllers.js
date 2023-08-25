const { Service } = require("../model/service.model");
const serviceService = require("../services/service.services");
const { errorMessage, successMessage } = require("../common/messages.common");
const { MESSAGES, errorAlreadyExists } = require("../common/constants.common");
const categoryServices = require("../services/category.services");
const { Category } = require("../model/category.model");

class ServiceController {
  async getStatus(req, res) {
    res.status(200).send({ message: MESSAGES.DEFAULT, success: true });
  }

  //Create a new service
  async createService(req, res) {
    const { type, name, defaultPrices } = req.body;

    const categoryNames = defaultPrices.map((categoryName) =>
      categoryName.category.toLowerCase()
    );

    let missingNames = await categoryServices.validateCategoryNames(
      categoryNames
    );

    if (missingNames.length > 0)
      return res.status(400).send({
        message: `These categories: ${missingNames} are not recognize`,
        success: false,
      });

    const defaultPricesInLowerCase = defaultPrices.map((categoryName) => {
      return {
        category: categoryName.category.toLowerCase(),
        price: categoryName.price,
      };
    });

    let service = new Service({
      type,
      name,
      defaultPrices: defaultPricesInLowerCase,
    });

    service = await serviceService.createService(service);

    res.send(successMessage(MESSAGES.CREATED, service));
  }

  //get service from the database, using their email
  async getServiceById(req, res) {
    const service = await serviceService.getServiceById(req.params.id);
    if (!service) return res.status(404).send(errorMessage("service"));

    res.send(successMessage(MESSAGES.FETCHED, service));
  }

  async getServiceByEntryIdAndStaffId(req, res) {
    const { entryId, staffId } = req.body;

    const service = await serviceService.getServiceByEntryIdAndStaffId(
      entryId,
      staffId
    );
    if (!service) return res.status(404).send(errorMessage("service"));

    res.send(successMessage(MESSAGES.FETCHED, service));
  }

  //get all entries in the service collection/table
  async fetchAllServices(req, res) {
    const entries = await serviceService.getAllServices();

    res.send(successMessage(MESSAGES.FETCHED, entries));
  }

  //Update/edit service data
  async updateService(req, res) {
    const service = await serviceService.getServiceById(req.params.id);
    if (!service) return res.status(404).send(errorMessage("service"));

    let updatedService = req.body;
    updatedService = await serviceService.updateServiceById(
      req.params.id,
      updatedService
    );

    res.send(successMessage(MESSAGES.UPDATED, updatedService));
  }

  //Delete service account entirely from the database
  async deleteService(req, res) {
    const service = await serviceService.getServiceById(req.params.id);
    if (!service) return res.status(404).send(errorMessage("service"));

    await serviceService.deleteService(req.params.id);

    res.send(successMessage(MESSAGES.DELETED, service));
  }
}

module.exports = new ServiceController();
