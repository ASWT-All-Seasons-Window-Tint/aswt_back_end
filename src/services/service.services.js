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

  getTimeOfCompletionAndInvalids(serviceIds) {
    return Service.aggregate([
      {
        $addFields: {
          id: { $toString: "$_id" },
        },
      },
      {
        $match: {
          id: {
            $in: serviceIds,
          },
        },
      },
      {
        $group: {
          _id: "id",
          timeOfCompletion: { $sum: "$timeOfCompletion" },
          validIds: { $push: "$id" },
        },
      },
      {
        $project: {
          timeOfCompletion: 1,
          invalidIds: {
            $setDifference: [serviceIds, "$validIds"],
          },
        },
      },
    ]);
  }

  async getServiceById(serviceId, lean = { lean: false }) {
    return lean.lean
      ? Service.findOne({ _id: serviceId, isDeleted: undefined }).lean()
      : Service.findOne({ _id: serviceId, isDeleted: undefined });
  }

  async validateServiceIds(serviceIds) {
    const services = await Service.find({
      _id: { $in: serviceIds },
      isDeleted: undefined,
    });

    const foundIds = services.map((d) => d._id.toString());

    const missingIds = serviceIds.filter((id) => !foundIds.includes(id));

    return missingIds;
  }

  findServicesNotInArray(serviceIds) {
    return Service.find({
      _id: { $nin: serviceIds },
      isResidential: undefined,
      isDeleted: undefined,
    });
  }

  async getServiceByName(name) {
    function escapeRegExp(string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    const escapedPattern = `^${escapeRegExp(name)}$`;

    const caseInsensitiveName = new RegExp(escapedPattern, "i");

    return Service.findOne({
      name: { $regex: caseInsensitiveName },
      isDeleted: undefined,
    }).sort({ _id: -1 });
  }

  containsSunroof = (text) => {
    const pattern = /sunroof/i;
    return pattern.test(text);
  };

  async getSunRoofServices() {
    return await Service.find({ sunRoof: true, isDeleted: undefined });
  }

  async getServiceByType(type) {
    const caseInsensitiveType = new RegExp(type, "i");

    return await Service.find({
      type: caseInsensitiveType,
      isDeleted: undefined,
    }).sort({ _id: -1 });
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

  getDealershipPriceBreakDown(serviceIds, customerId, serviceDetails) {
    return Service.aggregate([
      {
        $addFields: {
          id: {
            $toString: "$_id",
          },
          serviceDetails: {
            $map: {
              input: serviceDetails,
              in: {
                serviceId: {
                  $toObjectId: "$$this.serviceId",
                },
                filmQualityId: {
                  $toObjectId: "$$this.filmQualityId",
                },
              },
            },
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
        $addFields: {
          filmQualityId: {
            $first: {
              $map: {
                input: {
                  $filter: {
                    input: "$serviceDetails",
                    cond: {
                      $eq: ["$$this.serviceId", "$_id"],
                    },
                  },
                },
                in: "$$this.filmQualityId",
              },
            },
          },
        },
      },
      {
        $lookup: {
          from: "filmqualities",
          localField: "filmQualityId",
          foreignField: "_id",
          as: "filmquality",
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
          needsFilmQuality: {
            $and: [
              {
                $eq: ["$type", "installation"],
              },
              {
                $eq: ["$filmQualityId", null],
              },
            ],
          },
          serviceName: "$name",
          price: "$dealershipPrice",
          filmQuality: {
            $first: "$filmquality.name",
          },
          serviceType: "$type",
          qbId: "$qbId",
          dealership: { $literal: true },
        },
      },
    ]);
  }

  getGeneralPriceBreakdown(serviceDetails, serviceIds, customerId) {
    const agg = [
      {
        $addFields: {
          id: {
            $toString: "$_id",
          },
          serviceDetails: {
            $map: {
              input: serviceDetails,
              in: {
                serviceId: {
                  $toObjectId: "$$this.serviceId",
                },
                filmQualityId: {
                  $toObjectId: "$$this.filmQualityId",
                },
              },
            },
          },
        },
      },
      {
        $match: {
          $or: [
            {
              id: {
                $in: serviceIds,
              },
            },
          ],
        },
      },
      {
        $addFields: {
          dealershipPrice: {
            $first: {
              $filter: {
                input: "$dealershipPrices",
                cond: {
                  $eq: ["$$this.customerId", customerId],
                },
              },
            },
          },
          filmQualityId: {
            $first: {
              $map: {
                input: {
                  $filter: {
                    input: "$serviceDetails",
                    cond: {
                      $eq: ["$$this.serviceId", "$_id"],
                    },
                  },
                },
                in: "$$this.filmQualityId",
              },
            },
          },
        },
      },
      {
        $lookup: {
          from: "filmqualities",
          localField: "filmQualityId",
          foreignField: "_id",
          as: "filmquality",
        },
      },
      {
        $addFields: {
          needsFilmQuality: {
            $and: [
              {
                $eq: ["$type", "installation"],
              },
              {
                $eq: ["$filmQualityId", null],
              },
            ],
          },
          installationPrice: {
            $first: {
              $filter: {
                input: "$filmQualityOrVehicleCategoryAmount",
                cond: {
                  $eq: ["$$this.filmQualityId", "$filmQualityId"],
                },
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          serviceId: "$id",
          serviceName: "$name",
          price: {
            $cond: [
              "$dealershipPrice",
              "$dealershipPrice.price",
              {
                $cond: [
                  {
                    $eq: ["$type", "installation"],
                  },
                  "$installationPrice.amount",
                  "$amount",
                ],
              },
            ],
          },
          dealership: { $cond: ["$dealershipPrice", true, false] },
          filmQuality: {
            $first: "$filmquality.name",
          },
          serviceType: "$type",
          qbId: "$qbId",
          needsFilmQuality: 1,
        },
      },
    ];

    return Service.aggregate(agg);
  }

  getInstallationService(serviceIds) {
    return Service.aggregate([
      {
        $addFields: {
          id: { $toString: "$_id" },
        },
      },
      {
        $match: {
          type: "installation",
          id: { $in: serviceIds },
          isDeleted: undefined,
        },
      },
    ]);
  }

  updateServiceWithFilmQualityPrice(
    serviceId,
    updatedFilmQualityPrices,
    otherServiceDetails
  ) {
    const update = {
      $set: { ...otherServiceDetails },
    };

    const filter = {
      _id: serviceId,
    };

    const options = {
      new: true,
    };

    if (updatedFilmQualityPrices) {
      filter.type = "installation";

      const arrayFilters = updatedFilmQualityPrices.map(
        (filmQualityPrice, index) => {
          update.$set[
            `filmQualityOrVehicleCategoryAmount.$[elem${index}].amount`
          ] = filmQualityPrice.amount;

          return {
            [`elem${index}.filmQualityId`]: filmQualityPrice.filmQualityId,
          };
        }
      );

      options.arrayFilters = arrayFilters;
    }

    return Service.findOneAndUpdate(filter, update, options);
  }

  async getAllServices(lean = { lean: false }) {
    return lean.lean
      ? await Service.find({ isResidential: undefined, isDeleted: undefined })
          .lean()
          .sort({ _id: -1 })
          .populate("filmQualityOrVehicleCategoryAmount.filmQualityId", "name")
      : await Service.find({ isResidential: undefined, isDeleted: undefined })
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
      isDeleted: undefined,
    });
  }

  async getMultipleServices(serviceIds, lean) {
    return lean
      ? await Service.find({
          _id: {
            $in: serviceIds,
          },
          isDeleted: undefined,
        }).lean()
      : await Service.find({
          _id: {
            $in: serviceIds,
          },
          isDeleted: undefined,
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
        [
          { field: "Name", value: Name, operator: "=" },
          { field: "Type", value: "Service", operator: "=" },
        ],
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
    return await Service.findOneAndUpdate(
      { _id: id, isDeleted: undefined },
      { $set: { isDeleted: true } }
    );
  }
}

module.exports = new ServiceService();
