const { Service } = require("../model/service.model");
const { errorMessage } = require("../common/messages.common");

class ServiceService {
  //Create new service
  async createService(service) {
    return await service.save();
  }

  async getServiceById(serviceId, lean = { lean: false }) {
    return lean.lean
      ? Service.findById(serviceId).lean()
      : Service.findById(serviceId);
  }

  async validateServiceIds(serviceIds) {
    const services = await Service.find({
      _id: { $in: serviceIds },
    });

    const foundIds = services.map((d) => d._id.toString());

    const missingIds = serviceIds.filter((id) => !foundIds.includes(id));

    return missingIds;
  }

  findServicesNotInArray(serviceIds) {
    return Service.find({
      _id: { $nin: serviceIds },
      isResidential: undefined,
    });
  }

  async getServiceByName(name) {
    const caseInsensitiveName = new RegExp(name, "i");

    return await Service.findOne({ name: caseInsensitiveName });
  }

  async getSunRoofServices() {
    return await Service.find({ sunRoof: true });
  }

  async getServiceByType(type) {
    const caseInsensitiveType = new RegExp(type, "i");

    return await Service.find({ type: caseInsensitiveType });
  }

  async getAllServices(lean = { lean: false }) {
    return lean.lean
      ? await Service.find({ isResidential: undefined })
          .lean()
          .sort({ _id: -1 })
      : await Service.find({ isResidential: undefined }).sort({ _id: -1 });
  }

  async getCustomerDealershipPrice(serviceId, customerId) {
    Service.findOne({
      _id: serviceId,
      "dealershipPrices.customerId": customerId,
    });
  }

  async getMultipleServices(serviceIds, lean) {
    return lean
      ? await Service.find({
          _id: {
            $in: serviceIds,
          },
        }).lean()
      : await Service.find({
          _id: {
            $in: serviceIds,
          },
        });
  }

  async updateServiceById(id, service) {
    return await Service.findByIdAndUpdate(
      id,
      {
        $set: service,
      },
      { new: true }
    );
  }

  // Function to create a customer in QuickBooks
  createQuickBooksService(qbo, serviceData) {
    return new Promise((resolve, reject) => {
      qbo.createItem(serviceData, (err, service) => {
        if (err) {
          reject(err);
        } else {
          resolve(service);
        }
      });
    });
  }

  async fetchAllItems(qbo, pageNumber, pageSize) {
    const limit = pageSize;
    const offset = limit * (pageNumber - 1);

    return new Promise((resolve, reject) => {
      qbo.findItems(
        { asc: "Id", limit, offset, type: "Service" },
        (err, service) => {
          if (err) {
            reject(err);
          } else {
            resolve(service.QueryResponse.Item);
          }
        }
      );
    });
  }

  async fetchItemByName(qbo, itemName) {
    const Name = itemName;

    return new Promise((resolve, reject) => {
      qbo.findItems(
        [{ field: "Name", value: `%${Name}%`, operator: "LIKE" }],
        (err, service) => {
          if (err) {
            reject(err);
          } else {
            resolve(service.QueryResponse.Item);
          }
        }
      );
    });
  }

  async fetchItemsCount(qbo) {
    return new Promise((resolve, reject) => {
      qbo.findItems({ count: true, type: "Service" }, (err, service) => {
        if (err) {
          reject(err);
        } else {
          resolve(service.QueryResponse.totalCount);
        }
      });
    });
  }

  defaultPricesInArray(defaultPrices) {
    const defaultPricesInArray = [];

    for (const property in defaultPrices) {
      defaultPricesInArray.push({
        category: property,
        price: defaultPrices[property],
      });
    }

    return defaultPricesInArray;
  }

  serviceDefaultPricesToObject(service) {
    const obj = {};

    for (const priceObj in service.defaultPrices) {
      obj[service.defaultPrices[priceObj]["category"]] =
        service.defaultPrices[priceObj]["price"];
    }

    service.defaultPrices = obj;
    service.id = service._id;

    return service;
  }

  servicesDefaultPricesToObject = (services) => {
    return services.map((service) =>
      this.serviceDefaultPricesToObject(service)
    );
  };

  updateCustomerPrice(service, customerId, newPrice) {
    const customerNotFound = "We can't find the customer for this dealership";
    const customer = service.dealershipPrices.find(
      (c) => c.customerId.toString() === customerId.toString()
    );
    const results = {};

    if (!customer) results.error = customerNotFound;

    customer.price = newPrice;
    results.updatedService = service;

    return results;
  }

  deleteCustomerDealerShip = async (serviceId, customerId) => {
    const results = {};
    const service = await this.getServiceById(serviceId, { lean: true });
    if (!service) {
      results.error = "We can't find service for the given ID";
      return results;
    }

    const customerIndex = service.dealershipPrices.findIndex(
      (c) => c.customerId.toString() === customerId.toString()
    );

    if (customerIndex === -1) {
      results.error = "No dealership found for this customer";
      return results;
    }

    service.dealershipPrices.splice(customerIndex, 1);

    results.service = service;

    return results;
  };

  async getServiceByCustomer(customerId, serviceId) {
    return Service.findOne({
      $and: [{ _id: serviceId }, { "dealershipPrices.customerId": customerId }],
    });
  }

  async deleteService(id) {
    return await Service.findByIdAndRemove(id);
  }
}

module.exports = new ServiceService();
