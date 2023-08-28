const { Service } = require("../model/service.model");

class ServiceService {
  //Create new service
  async createService(service) {
    return await service.save();
  }

  async getServiceById(serviceId) {
    return await Service.findById(serviceId);
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

  async getAllServices() {
    return await Service.find().sort({ _id: -1 });
  }

  async getCustomerDealershipPrice(serviceId, customerId) {
    Service.findOne({
      _id: serviceId,
      "dealershipPrice.custumerId": customerId,
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
