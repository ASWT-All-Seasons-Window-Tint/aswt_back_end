const { Service } = require("../model/service.model");

class ServiceService {
  //Create new service
  async createService(service) {
    return await service.save();
  }

  async getServiceById(serviceId, lean = { lean: false }) {
    return lean.lean
      ? await Service.findById(serviceId).lean()
      : await Service.findById(serviceId);
  }

  async validateServiceIds(serviceIds) {
    const services = await Service.find({
      _id: { $in: serviceIds },
    });

    const foundIds = services.map((d) => d._id.toString());

    const missingIds = serviceIds.filter((id) => !foundIds.includes(id));

    return missingIds;
  }

  async getServiceByName(name) {
    const caseInsensitiveName = new RegExp(name, "i");

    return await Service.findOne({ name: caseInsensitiveName });
  }

  async getAllServices(lean = { lean: false }) {
    return lean.lean
      ? await Service.find().lean().sort({ _id: -1 })
      : await Service.find().sort({ _id: -1 });
  }

  async getCustomerDealershipPrice(serviceId, customerId) {
    Service.findOne({
      _id: serviceId,
      "dealershipPrices.customerId": customerId,
    });
  }

  async getMultipleServices(serviceIds) {
    return await Service.find({
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
