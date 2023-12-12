const { Service } = require("../model/service.model");
const { errorMessage } = require("../common/messages.common");
const { default: mongoose } = require("mongoose");

class ServiceService {
  //Create new service
  async createService(service) {
    return (await service.save()).populate(
      "filmQualityOrVehicleCategoryAmount.filmQualityId",
      "name"
    );
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

  getServiceAndIfDealershipHaveCustomPrice(serviceId, customerId) {
    return Service.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(serviceId),
        },
      },
      {
        $addFields: {
          doesDealershipHaveCustomPrice: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: "$dealershipPrices",
                    cond: {
                      $eq: ["$$this.customerId", customerId],
                    },
                  },
                },
              },
              0,
            ],
          },
        },
      },
    ]);
  }

  getDealershipPriceBreakDown(serviceIds, customerId, filmQualityId) {
    return Service.aggregate([
      {
        $addFields: {
          id: {
            $toString: "$_id",
          },
          filmQualityId: {
            $toObjectId: filmQualityId,
          },
        },
      },
      {
        $unwind: {
          path: "$dealershipPrices",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $lookup: {
          from: "filmqualities",
          localField: "filmQualityId",
          foreignField: "_id",
          as: "filmqualities",
        },
      },
      {
        $match: {
          id: {
            $in: serviceIds,
          },
          "dealershipPrices.customerId": customerId,
        },
      },
      {
        $addFields: {
          dealershipPrice: "$dealershipPrices.price",
          filmQualityName: {
            $cond: [
              {
                $eq: ["$type", "installation"],
              },
              {
                $first: "$filmqualities.name",
              },
              "$$REMOVE",
            ],
          },
        },
      },
      {
        $project: {
          _id: 0,
          serviceId: {
            $toString: "$_id",
          },
          serviceName: "$name",
          price: "$dealershipPrice",
          filmQuality: "$filmQualityName",
          serviceType: "$type",
          qbId: "$qbId",
          dealership: { $literal: true },
        },
      },
    ]);
  }

  getGeneralPriceBreakdown(filmQualityId, serviceIds) {
    return Service.aggregate([
      {
        $addFields: {
          id: {
            $toString: "$_id",
          },
          filmQualityId: {
            $toObjectId: filmQualityId,
          },
        },
      },
      {
        $unwind: {
          path: "$filmQualityOrVehicleCategoryAmount",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "filmqualities",
          localField: "filmQualityId",
          foreignField: "_id",
          as: "filmqualities",
        },
      },
      {
        $match: {
          $or: [
            {
              id: {
                $in: serviceIds,
              },
              type: "removal",
            },
            {
              $and: [
                {
                  id: {
                    $in: serviceIds,
                  },
                },
                {
                  "filmQualityOrVehicleCategoryAmount.filmQualityId":
                    new mongoose.Types.ObjectId(filmQualityId),
                },
              ],
            },
          ],
        },
      },
      {
        $addFields: {
          dealershipPrice: "$dealershipPrices.price",
          price: {
            $cond: [
              {
                $eq: ["$type", "installation"],
              },
              "$filmQualityOrVehicleCategoryAmount.amount",
              "$amount",
            ],
          },
          filmQualityName: {
            $cond: [
              {
                $eq: ["$type", "installation"],
              },
              {
                $first: "$filmqualities.name",
              },
              "$$REMOVE",
            ],
          },
        },
      },
      {
        $project: {
          _id: 0,
          serviceId: {
            $toString: "$_id",
          },
          serviceName: "$name",
          price: "$price",
          filmQuality: "$filmQualityName",
          serviceType: "$type",
          qbId: "$qbId",
          dealership: { $literal: false },
        },
      },
    ]);
  }
  async getAllServices(lean = { lean: false }) {
    return lean.lean
      ? await Service.find({ isResidential: undefined })
          .lean()
          .sort({ _id: -1 })
          .populate("filmQualityOrVehicleCategoryAmount.filmQualityId", "name")
      : await Service.find({ isResidential: undefined })
          .sort({ _id: -1 })
          .populate("filmQualityOrVehicleCategoryAmount.filmQualityId", "name");
  }

  getFilmQualityPriceForInstallation(serviceId, filmQualityId) {
    return Service.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(serviceId),
        },
      },
      {
        $unwind: {
          path: "$filmQualityOrVehicleCategoryAmount",
          includeArrayIndex: "string",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: {
          "filmQualityOrVehicleCategoryAmount.filmQualityId":
            new mongoose.Types.ObjectId(filmQualityId),
        },
      },
      {
        $project: {
          name: 1,
          filmQualityOrVehicleCategoryAmount: 1,
          filmQualityPrice: "$filmQualityOrVehicleCategoryAmount.amount",
        },
      },
    ]);
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
        [{ field: "Name", value: Name, operator: "=" }],
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

  getDealershipPrice(serviceIds, customerId) {
    return Service.aggregate([
      {
        $addFields: {
          id: {
            $toString: "$_id",
          },
        },
      },
      {
        $unwind: {
          path: "$dealershipPrices",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $match: {
          id: {
            $in: serviceIds,
          },
          "dealershipPrices.customerId": customerId,
        },
      },
      {
        $addFields: {
          dealershipPrice: "$dealershipPrices.price",
        },
      },
      {
        $project: {
          defaultPrices: 0,
          filmQualityOrVehicleCategoryAmount: 0,
          timeOfCompletion: 0,
          id: 0,
        },
      },
    ]);
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
