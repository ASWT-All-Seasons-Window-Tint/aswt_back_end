const mongoose = require("mongoose");
const { Entry } = require("../model/entry.model");
const serviceServices = require("./service.services");

class EntryService {
  //Create new entry
  async createEntry(entry) {
    return await entry.save();
  }

  async getEntryById(entryId) {
    return await Entry.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(entryId),
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "customerId",
          foreignField: "_id",
          as: "customer",
        },
      },
      {
        $unwind: "$invoice.carDetails", // Unwind the carDetails array
      },
      {
        $lookup: {
          from: "services", // Replace "services" with your actual service collection name
          localField: "invoice.carDetails.serviceId",
          foreignField: "_id",
          as: "service",
        },
      },
      {
        $addFields: {
          "invoice.carDetails.serviceName": {
            $arrayElemAt: ["$service.name", 0],
          },
        },
      },
      {
        $group: {
          _id: "$_id",
          root: { $first: "$$ROOT" }, // Preserve the original fields
          invoice: { $push: "$invoice" }, // Group back the invoice array
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              "$root",
              { invoice: { $arrayElemAt: ["$invoice", 0] } },
            ],
          },
        },
      },
      {
        $project: {
          customerName: {
            $concat: [
              { $arrayElemAt: ["$customer.firstName", 0] },
              " ",
              { $arrayElemAt: ["$customer.lastName", 0] },
            ],
          },
          numberOfVehicles: 1,
          vehiclesLeft: 1,
          entryDate: 1,
          invoice: {
            name: "$invoice.name",
            carDetails: "$invoice.carDetails",
            totalPrice: {
              $sum: "$invoice.carDetails.price",
            },
          },
        },
      },
    ]);
  }

  async validateEntryIds(entryIds) {
    const entrys = await Entry.find({
      _id: { $in: entryIds },
    });

    const foundIds = entrys.map((d) => d._id.toString());

    const missingIds = entryIds.filter((id) => !foundIds.includes(id));

    return missingIds;
  }

  async getEntryByName(name) {
    const caseInsensitiveName = new RegExp(name, "i");

    return await Entry.findOne({ name: caseInsensitiveName });
  }

  getCarsDoneByStaff = async (entryId, staffId) => {
    const match = {};
    if (entryId) {
      match._id = new mongoose.Types.ObjectId(entryId);
    }

    const pipeline = [
      {
        $match: match,
      },
      {
        $project: {
          customerId: 1,
          numberOfVehicles: 1,
          vehiclesLeft: 1,
          filteredDetails: {
            $filter: {
              input: "$invoice.carDetails",
              as: "car",
              cond: {
                $eq: ["$$car.staffId", new mongoose.Types.ObjectId(staffId)],
              },
            },
          },
        },
      },

      {
        $lookup: {
          from: "users",
          localField: "customerId",
          foreignField: "_id",
          as: "customer",
        },
      },
      {
        $lookup: {
          from: "services",
          localField: "filteredDetails.serviceId",
          foreignField: "_id",
          as: "services",
        },
      },

      {
        $project: {
          customerName: {
            $concat: [
              { $arrayElemAt: ["$customer.firstName", 0] },
              " ",
              { $arrayElemAt: ["$customer.lastName", 0] },
            ],
          },
          numberOfVehicles: 1,
          vehiclesLeft: 1,
          invoice: {
            name: 1,
            carDetails: {
              $map: {
                input: "$filteredDetails",
                as: "car",
                in: {
                  vin: "$$car.vin",
                  year: "$$car.year",
                  make: "$$car.make",
                  colour: "$$car.colour",
                  staffId: "$$car.staffId",
                  serviceName: {
                    $first: {
                      $map: {
                        input: "$services",
                        as: "service",
                        in: {
                          $cond: [
                            {
                              $eq: [
                                "$$service._id",
                                { $toObjectId: "$$car.serviceId" },
                              ],
                            },
                            "$$service.name",
                            false,
                          ],
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      {
        $match: {
          "invoice.carDetails": { $ne: [] },
        },
      },
    ];

    return Entry.aggregate(pipeline);
  };
  // async getCarsDoneByStaffPerEntryId(entryId, staffId) {
  //   return await Entry.aggregate([
  //     {
  //       $match: {
  //         _id: new mongoose.Types.ObjectId(entryId),
  //       },
  //     },
  //     {
  //       $project: {
  //         customerId: 1,
  //         numberOfVehicles: 1,
  //         vehiclesLeft: 1,
  //         filteredDetails: {
  //           $filter: {
  //             input: "$invoice.carDetails",
  //             as: "car",
  //             cond: {
  //               $eq: ["$$car.staffId", new mongoose.Types.ObjectId(staffId)],
  //             },
  //           },
  //         },
  //       },
  //     },

  //     {
  //       $lookup: {
  //         from: "users",
  //         localField: "customerId",
  //         foreignField: "_id",
  //         as: "customer",
  //       },
  //     },

  //     {
  //       $project: {
  //         customerName: {
  //           $concat: [
  //             { $arrayElemAt: ["$customer.firstName", 0] },
  //             " ",
  //             { $arrayElemAt: ["$customer.lastName", 0] },
  //           ],
  //         },
  //         numberOfVehicles: 1,
  //         vehiclesLeft: 1,
  //         invoice: {
  //           name: 1,
  //           carDetails: {
  //             $map: {
  //               input: "$filteredDetails",
  //               as: "car",
  //               in: {
  //                 vin: "$$car.vin",
  //                 year: "$$car.year",
  //                 make: "$$car.make",
  //                 colour: "$$car.colour",
  //                 staffId: "$$car.staffId",
  //               },
  //             },
  //           },
  //         },
  //       },
  //     },
  //   ]);
  // }

  async getAllEntries() {
    return await Entry.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "customerId",
          foreignField: "_id",
          as: "customer",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "invoice.carDetails.staffId",
          foreignField: "_id",
          as: "staff",
        },
      },

      {
        $lookup: {
          from: "services",
          localField: "invoice.carDetails.serviceId",
          foreignField: "_id",
          as: "services",
        },
      },

      {
        $project: {
          customerName: {
            $concat: [
              { $arrayElemAt: ["$customer.firstName", 0] },
              " ",
              { $arrayElemAt: ["$customer.lastName", 0] },
            ],
          },
          numberOfVehicles: 1,
          vehiclesLeft: 1,
          entryDate: 1,

          // Keep existing invoice projection
          invoice: {
            name: "$invoice.name",
            carDetails: {
              $map: {
                input: "$invoice.carDetails",
                as: "car",
                in: {
                  $mergeObjects: [
                    {
                      $arrayToObject: {
                        $filter: {
                          input: { $objectToArray: "$$car" },
                          as: "item",
                          cond: { $ne: ["$$item.k", "serviceId"] },
                        },
                      },
                    },
                    {
                      serviceName: {
                        $first: {
                          $filter: {
                            input: {
                              $map: {
                                input: "$services",
                                as: "service",
                                in: {
                                  $cond: [
                                    {
                                      $eq: [
                                        "$$service._id",
                                        { $toObjectId: "$$car.serviceId" },
                                      ],
                                    },
                                    "$$service.name",
                                    false,
                                  ],
                                },
                              },
                            },
                            as: "item",
                            cond: {
                              $ne: ["$$item", false],
                            },
                          },
                        },
                      },
                    },
                    {
                      staffName: {
                        $first: {
                          $filter: {
                            input: {
                              $map: {
                                input: "$staff",
                                as: "staff",
                                in: {
                                  $cond: [
                                    {
                                      $eq: [
                                        "$$staff._id",
                                        { $toObjectId: "$$car.staffId" },
                                      ],
                                    },
                                    {
                                      $concat: [
                                        "$$staff.firstName",
                                        " ",
                                        "$$staff.lastName",
                                      ],
                                    },
                                    null,
                                  ],
                                },
                              },
                            },
                            as: "item",
                            cond: {
                              $ne: ["$$item", null],
                            },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
            totalPrice: {
              $sum: "$invoice.carDetails.price",
            },
          },
        },
      },
    ]);
  }

  async checkDuplicateEntry(entryId, vin, serviceId) {
    return await Entry.findOne({
      $and: [
        { _id: entryId },
        { "invoice.carDetails.serviceId": serviceId },
        { "invoice.carDetails.vin": vin },
      ],
    });
  }

  getServiceAndEntry = async (carDetails, entryId) => {
    const results = {};

    results.service = await serviceServices.getServiceById(
      carDetails.serviceId
    );

    results.entry = await this.getEntryById(entryId);

    return results;
  };

  getTotalprice(invoice) {
    invoice.totalPrice = 0;

    invoice.carDetails.forEach((detail) => {
      invoice.totalPrice += detail.price;
    });

    return invoice.totalPrice;
  }

  getVehiclesLeft(entry) {
    if (entry.vehiclesLeft === 0) return 0;
    let vehiclesLeft = entry.numberOfVehicles;

    const vehiclesAdded = entry.invoice.carDetails.length;
    vehiclesLeft = vehiclesLeft - vehiclesAdded;

    return vehiclesLeft;
  }

  getPriceForService(service, customerId, category) {
    const [customerDealershipPrice] = service.dealershipPrices.filter(
      (dealershipPrice) =>
        dealershipPrice.custumerId.toString() == customerId.toString()
    );

    const categoryInLowercase = category.toLowerCase();

    const price = customerDealershipPrice
      ? customerDealershipPrice.price
      : service.defaultPrice[categoryInLowercase];

    return price;
  }

  async updateEntryById(id, entry) {
    return await Entry.findByIdAndUpdate(
      id,
      {
        $set: entry,
      },
      { new: true }
    );
  }

  async deleteEntry(id) {
    return await Entry.findByIdAndRemove(id);
  }
}

module.exports = new EntryService();
