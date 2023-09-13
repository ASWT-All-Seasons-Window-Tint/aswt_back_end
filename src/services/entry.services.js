const mongoose = require("mongoose");
const { Entry } = require("../model/entry.model");
const serviceServices = require("./service.services");
const { DATE } = require("../common/constants.common");

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
          vehiclesLeft: { $gte: 0 },
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
          from: "users",
          localField: "invoice.carDetails.staffId",
          foreignField: "_id",
          as: "staff",
        },
      },

      {
        $lookup: {
          from: "services",
          localField: "invoice.carDetails.serviceIds",
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
          customerId: 1,
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
                      serviceNames: {
                        $map: {
                          input: "$$car.serviceIds",
                          as: "serviceId",
                          in: {
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
                                            { $toObjectId: "$$serviceId" },
                                          ],
                                        },
                                        "$$service.name",
                                        false,
                                      ],
                                    },
                                  },
                                },
                                as: "item",
                                cond: { $ne: ["$$item", false] },
                              },
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
                    { serviceId: "$$car.serviceId" },
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

  async getEntries(filter = { entryId: undefined }) {
    const match = {};
    if (filter.entryId) {
      match._id = new mongoose.Types.ObjectId(filter.entryId);
    }

    return await Entry.aggregate([
      {
        $match: match,
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
          from: "users",
          localField: "invoice.carDetails.staffId",
          foreignField: "_id",
          as: "staff",
        },
      },

      {
        $lookup: {
          from: "services",
          localField: "invoice.carDetails.serviceIds",
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
          customerId: 1,
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
                      serviceNames: {
                        $map: {
                          input: "$$car.serviceIds",
                          as: "serviceId",
                          in: {
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
                                            { $toObjectId: "$$serviceId" },
                                          ],
                                        },
                                        "$$service.name",
                                        false,
                                      ],
                                    },
                                  },
                                },
                                as: "item",
                                cond: { $ne: ["$$item", false] },
                              },
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
                    { serviceId: "$$car.serviceId" },
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

  getCarsDoneByStaff = async (entryId, staffId, vehiclesLeft = { $gte: 0 }) => {
    const match = { vehiclesLeft };
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
          entryDate: 1,
          invoice: 1,
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
          localField: "filteredDetails.serviceIds",
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
                  entryDate: "$$car.entryDate",
                  model: "$$car.model",
                  note: "$$car.note",
                  colour: "$$car.colour",
                  staffId: "$$car.staffId",
                  serviceIds: "$$car.serviceIds",
                  serviceNames: {
                    $map: {
                      input: "$$car.serviceIds",
                      as: "serviceId",
                      in: {
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
                                        { $toObjectId: "$$serviceId" },
                                      ],
                                    },
                                    "$$service.name",
                                    false,
                                  ],
                                },
                              },
                            },
                            as: "item",
                            cond: { $ne: ["$$item", false] },
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
        $match: {
          vehiclesLeft: { $gt: 0 },
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
          from: "users",
          localField: "invoice.carDetails.staffId",
          foreignField: "_id",
          as: "staff",
        },
      },

      {
        $lookup: {
          from: "services",
          localField: "invoice.carDetails.serviceIds",
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
                      serviceNames: {
                        $map: {
                          input: "$$car.serviceIds",
                          as: "serviceId",
                          in: {
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
                                            { $toObjectId: "$$serviceId" },
                                          ],
                                        },
                                        "$$service.name",
                                        false,
                                      ],
                                    },
                                  },
                                },
                                as: "item",
                                cond: { $ne: ["$$item", false] },
                              },
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

  async getEntryForCustomerLast24Hours(customerId) {
    return Entry.findOne({
      customerId,
      entryDate: {
        $gte: DATE.yesterday,
      },
    });
  }

  createNewEntry = async (customerId) => {
    let entry = new Entry({
      customerId,
    });

    const invoiceNumber = await Entry.getNextInvoiceNumber();
    entry.invoice.name = invoiceNumber;

    entry = await this.createEntry(entry);
    entry.id = entry._id;

    return entry;
  };

  async checkDuplicateEntry(customerId, vin) {
    return await Entry.findOne({
      $and: [
        { customerId },
        { "invoice.carDetails.vin": vin },
        {
          entryDate: {
            $gte: DATE.yesterday,
          },
        },
      ],
    });
  }

  getServiceAndEntry = async (carDetails, customerId) => {
    const results = {};

    const serviceIds = carDetails.serviceIds;

    [results.services, results.entry] = await Promise.all([
      serviceServices.getMultipleServices(serviceIds),
      (await this.getEntryForCustomerLast24Hours(customerId))
        ? this.getEntryForCustomerLast24Hours(customerId)
        : this.createNewEntry(customerId),
    ]);

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
    let vehiclesLeft = entry.numberOfVehicles;

    const vehiclesAdded = entry.invoice.carDetails.length;
    vehiclesLeft = vehiclesLeft - vehiclesAdded;

    if (vehiclesLeft < 1) return 0;

    return vehiclesLeft;
  }

  getNumberOfCarsAdded(carDetails) {
    const numberOfCarsAdded = carDetails.length;

    return numberOfCarsAdded;
  }

  getPriceForService(services, customerId, category) {
    const dealershipPrices = services.filter((service) =>
      service.dealershipPrices.some(
        (price) => price.customerId.toString() === customerId.toString()
      )
    );

    const defaultPrices = services
      .filter(
        (service) => !dealershipPrices.some((dp) => dp._id === service._id)
      )
      .map((service) => ({
        serviceName: service.name,
        price: service.defaultPrices.find((p) => p.category === category).price,
        serviceType: service.type,
      }));

    const priceBreakdown = [
      ...dealershipPrices.map((service) => ({
        serviceName: service.name,
        price: service.dealershipPrices.find(
          (p) => p.customerId.toString() === customerId.toString()
        ).price,
        serviceType: service.type,
      })),
      ...defaultPrices,
    ];

    const price = priceBreakdown.reduce((acc, curr) => {
      return acc + curr.price;
    }, 0);

    return { price, priceBreakdown };
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

  async modifyPrice(entryId, vin, serviceId, price) {
    return await Entry.updateOne(
      {
        _id: entryId, // entry document id
        "invoice.carDetails.vin": vin,
        "invoice.carDetails.serviceId": serviceId,
      },
      {
        $set: {
          "invoice.carDetails.$.price": price, // new price
        },
      },
      { new: true }
    );
  }

  getCarDoneByStaff(entry, req, vin) {
    const { carDetails } = entry.invoice;

    const carIndex = carDetails.findIndex((car) => {
      if (car.staffId)
        return (
          car.staffId.toString() === req.user._id.toString() &&
          car.vin.toString() === vin.toString()
        );
    });

    const carDoneByStaff = carDetails[carIndex];

    return { carIndex, carDoneByStaff };
  }

  updateCarProperties(req, carDoneByStaff) {
    if (req.body.category) {
      req.body.category = req.body.category.toLowerCase();
    }

    for (const property in req.body) {
      if (carDoneByStaff.hasOwnProperty(property)) {
        carDoneByStaff[property] = req.body[property];
      }
    }

    if (req.body.note) carDoneByStaff["note"] = req.body.note;
  }

  recalculatePrices = (req, entry, services, carDoneByStaff) => {
    if (req.body.serviceIds || req.body.category) {
      const { price, priceBreakdown } = this.getPriceForService(
        services,
        entry.customerId,
        carDoneByStaff.category
      );

      carDoneByStaff.price = price;
      carDoneByStaff.priceBreakdown = priceBreakdown;

      entry.invoice.totalPrice = this.getTotalprice(entry.invoice);
    }
  };

  carWasAddedRecently = (car) => {
    const now = new Date();
    const carEntryDate = new Date(car.entryDate);

    const diffTime = Math.abs(now - carEntryDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays <= 1;
  };

  getStaffEntriesAndAllEntries = async (staffId, req, role) => {
    const results = {};

    [results.staffEntries, results.entries] = await Promise.all([
      req.user.role !== role
        ? this.getCarsDoneByStaff(null, staffId)
        : this.getCarsDoneByStaff(null, staffId, { $gt: 0 }),
      req.user.role !== role
        ? this.getEntries()
        : this.getEntries({ vehiclesLeft: { $gt: 0 } }),
    ]);

    return results;
  };

  async deleteEntry(id) {
    return await Entry.findByIdAndRemove(id);
  }
}

module.exports = new EntryService();
