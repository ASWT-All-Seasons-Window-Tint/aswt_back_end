const { Service } = require("../model/service.model");
const serviceService = require("../services/service.services");
const customerService = require("../services/customer.service");
const { MESSAGES } = require("../common/constants.common");
const initializeQuickBooks = require("../utils/initializeQb.utils");
const { getOrSetCache, updateCache } = require("../utils/getOrSetCache.utils");
const errorChecker = require("../utils/paginationErrorChecker.utils");
const {
  errorMessage,
  successMessage,
  jsonResponse,
} = require("../common/messages.common");

class ServiceController {
  async getStatus(req, res) {
    res.status(200).send({ message: MESSAGES.DEFAULT, success: true });
  }

  //Create a new service
  createService = async (req, res) => {
    let { type, name, defaultPrices, timeOfCompletion } = req.body;
    // const categoryNames = Object.keys(defaultPrices);

    // const [missingNames, categoriesMissing] = await Promise.all([
    //   validateCategoryNames(categoryNames),
    //   missingCategoryNames(categoryNames),
    // ]);

    // if (missingNames.length > 0)
    //   return res.status(400).send({
    //     message: `These categories: ${missingNames} are not recognize`,
    //     success: false,
    //   });

    // if (categoriesMissing.length > 0)
    //   return res.status(400).send({
    //     message: `You have not provided prices for: ${categoriesMissing}`,
    //     success: false,
    //   });
    const { serviceOnQb, error } = await this.createQbService(name);
    if (error)
      return jsonResponse(res, 400, false, error.Fault.Error[0].Detail);

    const qbId = serviceOnQb.Id;

    defaultPrices = serviceService.defaultPricesInArray(defaultPrices);

    let service = new Service({
      type,
      name,
      defaultPrices,
      qbId,
      timeOfCompletion,
    });

    service = await serviceService.createService(service);

    res.send(successMessage(MESSAGES.CREATED, service));
  };

  async createQbService(serviceName) {
    const results = {};
    try {
      // Initialize the QuickBooks SDK
      const qbo = await initializeQuickBooks();

      const serviceData = {
        Name: serviceName,
        IncomeAccountRef: {
          value: "1",
          name: "Services",
        },
        Type: "Service",
      };

      const serviceOnQb = await serviceService.createQuickBooksService(
        qbo,
        serviceData
      );
      results.serviceOnQb = serviceOnQb;
      return results;
    } catch (error) {
      results.error = error;
      return results;
    }
  }

  async getQbServices(req, res) {
    const qbo = await initializeQuickBooks();
    const { pageNumber, itemName } = req.params;
    const expiryTimeInSecs = 1800;
    const pageSize = 10;

    if (itemName) {
      const { data: service, error } = await getOrSetCache(
        `services?name${itemName.toLowerCase()}`,
        expiryTimeInSecs,
        serviceService.fetchItemByName,
        [qbo, itemName]
      );
      if (error) return jsonResponse(res, 404, false, error);

      return res.send(successMessage(MESSAGES.FETCHED, service));
    }

    const { data: count } = await getOrSetCache(
      `serviceCount`,
      expiryTimeInSecs,
      serviceService.fetchItemsCount,
      [qbo]
    );

    const totalPages = Math.ceil(count / pageSize);

    const { message } = errorChecker(pageNumber, totalPages);
    if (message) return jsonResponse(res, 400, false, message);

    const { data: services, error: servicesError } = await getOrSetCache(
      `services?pageNumber${pageNumber}`,
      expiryTimeInSecs,
      serviceService.fetchAllItems,
      [qbo, pageNumber, pageSize]
    );

    if (servicesError) return jsonResponse(res, 404, false, servicesError);

    return res.send(successMessage(MESSAGES.FETCHED, services));
  }

  //get service from the database, using their email
  async getServiceById(req, res) {
    const service = await serviceService.getServiceById(req.params.id);
    if (!service) return res.status(404).send(errorMessage("service"));

    res.send(successMessage(MESSAGES.FETCHED, service));
  }

  async getServiceByIdWeb(req, res) {
    let service = await serviceService.getServiceById(req.params.id, {
      lean: true,
    });
    if (!service) return res.status(404).send(errorMessage("service"));

    service = serviceService.serviceDefaultPricesToObject(service);

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

  async getMultipleServices(req, res) {
    const services = await serviceService.getMultipleServices(
      req.body.serviceIds
    );

    res.send(successMessage(MESSAGES.FETCHED, services));
  }

  //get all services in the service collection/table
  async fetchAllServices(req, res) {
    const services = await serviceService.getAllServices();

    res.send(successMessage(MESSAGES.FETCHED, services));
  }

  async fetchAllServicesWeb(req, res) {
    let services = await serviceService.getAllServices({ lean: true });

    services = serviceService.servicesDefaultPricesToObject(services);

    res.send(successMessage(MESSAGES.FETCHED, services));
  }

  async addDealershipPrice(req, res) {
    const { customerId, price } = req.body;

    const [service, customerDealership] = await Promise.all([
      serviceService.getServiceById(req.params.id),
      serviceService.getServiceByCustomer(customerId, req.params.id),
    ]);

    const { data: customer, error } =
      await customerService.getOrSetCustomerOnCache(customerId);

    if (!service) return res.status(404).send(errorMessage("service"));
    if (!customer) return res.status(404).send(errorMessage("customer"));
    if (customerDealership)
      return res.status(400).send({
        message: "The customer already have a dealership for this service",
        success: false,
      });

    const dealershipPrice = { customerId, price };

    service.dealershipPrices.push(dealershipPrice);

    const updatedService = await serviceService.updateServiceById(
      req.params.id,
      service
    );

    res.send(successMessage(MESSAGES.UPDATED, updatedService));
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

  async updateDealershipPrice(req, res) {
    const { serviceId, customerId } = req.params;
    const service = await serviceService.getServiceById(serviceId, {
      lean: true,
    });
    if (!service) return res.status(404).send(errorMessage("service"));

    const { error: customerError } =
      await customerService.getOrSetCustomerOnCache(customerId);
    if (customerError)
      return jsonResponse(res, 404, false, customerError.Fault.Error[0].Detail);

    let { updatedService, error } = serviceService.updateCustomerPrice(
      service,
      customerId,
      req.body.price
    );

    if (error) return jsonResponse(res, 404, false, error);

    updatedService = await serviceService.updateServiceById(
      serviceId,
      updatedService
    );

    res.send(
      successMessage(
        "Customer's delearship price is succefully updated",
        updatedService
      )
    );
  }

  async deleteCustomerDealerShip(req, res) {
    const { serviceId, customerId } = req.params;

    const { error, service } = await serviceService.deleteCustomerDealerShip(
      serviceId,
      customerId
    );
    if (error) return jsonResponse(res, 404, false, error);

    const updatedService = await serviceService.updateServiceById(
      serviceId,
      service
    );

    res.send(successMessage(MESSAGES.DELETED, updatedService));
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
