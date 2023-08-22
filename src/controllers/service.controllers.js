const { Service } = require("../model/service.model");
const serviceService = require("../services/service.services");
const serviceService = require("../services/service.services");
const { errorMessage, successMessage } = require("../common/messages.common");
const { MESSAGES, errorAlreadyExists } = require("../common/constants.common");

class ServiceController {
  async getStatus(req, res) {
    res.status(200).send({ message: MESSAGES.DEFAULT, success: true });
  }

  //Create a new service
  async createService(req, res) {
    const { type, category, defaultPrice } = req.body;

    let service = new Service({
      type,
      category,
      defaultPrice,
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
