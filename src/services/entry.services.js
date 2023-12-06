const mongoose = require("mongoose");
const { Entry } = require("../model/entry.model");
const serviceServices = require("./service.services");
const { DATE, errorMessage } = require("../common/constants.common");
const { getNewAccessToken } = require("../utils/getNewAccessToken.utils");
const getWebhookDataUtils = require("../utils/getWebhookData.utils");
const { pipeline } = require("../utils/entry.utils");
const { carDetailsProperties, invoiceProperties, entryProperties } =
  require("../model/entry.model").joiValidator;

class EntryService {
  getCarsThatHasNotBeenPickedUp(carDetails) {
    const filteredCarDetails = carDetails.filter((car) => {
      // Check if geoLocations array has only "Scanned" locationType
      const hasOnlyScanned = car.geoLocations.every(
        (location) => location.locationType === "Scanned"
      );

      // Return only the car details with geoLocation of locationType "Scanned"
      return hasOnlyScanned;
    });

    return filteredCarDetails;
  }

  getEntries = async (args = { entryId: undefined, customerId: undefined }) => {
    const { entryId, customerId } = args;

    return await Entry.aggregate(pipeline({ entryId, customerId }));
  };

  getEntryById(entryId) {
    return Entry.findById(entryId);
  }
  getTodayAndTomorrow() {
    const today = new Date(); // This gives you the current date and time in your local time zone
    today.setHours(0, 0, 0, 0); // Set the time to midnight

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1); // Get the date for tomorrow

    return { today, tomorrow };
  }

  getEntryByVin = async (vin, lean, porter, isFromDealership) => {
    const query = Entry.findOne({
      "invoice.carDetails": {
        $elemMatch: {
          vin,
          ...(porter ? { porterId: { $ne: null } } : {}),
        },
      },
      ...(isFromDealership ? { isFromDealership } : {}),
    }).sort({ _id: -1 });

    return lean
      ? query.populate("invoice.carDetails.serviceIds", "name").lean()
      : query;
  };
  getEntryByCarId = async (carId) => {
    return Entry.findOne({
      "invoice.carDetails": {
        $elemMatch: {
          _id: carId,
        },
      },
    });
  };

  getCarThatIsStillInShopByVin(vin) {
    return Entry.aggregate([
      {
        $match: {
          $and: [
            {
              "invoice.carDetails.vin": vin,
              "invoice.carDetails.geoLocations": {
                $elemMatch: {
                  locationType: "TakenToShop",
                },
              },
            },
            {
              "invoice.carDetails.geoLocations": {
                $not: {
                  $elemMatch: {
                    locationType: "TakenFromShop",
                  },
                },
              },
            },
          ],
        },
      },
      {
        $project: {
          vehicle: {
            $filter: {
              input: "$invoice.carDetails",
              as: "carDetail",
              cond: {
                $and: [
                  {
                    $in: [
                      "TakenToShop",
                      "$$carDetail.geoLocations.locationType",
                    ],
                  },
                  {
                    $not: {
                      $in: [
                        "TakenFromShop",
                        "$$carDetail.geoLocations.locationType",
                      ],
                    },
                  },
                  {
                    $eq: ["$$carDetail.vin", vin],
                  },
                ],
              },
            },
          },
        },
      },
      {
        $match: {
          $expr: { $ne: [{ $size: "$vehicle" }, 0] },
        },
      },
    ]);
  }

  getAllVehiclesInTheShop() {
    return Entry.aggregate([
      {
        $match: {
          $and: [
            {
              "invoice.carDetails.geoLocations": {
                $elemMatch: {
                  locationType: "TakenToShop",
                },
              },
            },
            {
              "invoice.carDetails.geoLocations": {
                $not: {
                  $elemMatch: {
                    locationType: "TakenFromShop",
                  },
                },
              },
            },
          ],
        },
      },
      {
        $project: {
          carDetails: {
            $filter: {
              input: "$invoice.carDetails",
              as: "carDetail",
              cond: {
                $and: [
                  {
                    $in: [
                      "TakenToShop",
                      "$$carDetail.geoLocations.locationType",
                    ],
                  },
                  {
                    $not: {
                      $in: [
                        "TakenFromShop",
                        "$$carDetail.geoLocations.locationType",
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      },
    ]);
  }

  getDateDifference(targetDate) {
    const now = new Date();
    const definedDate = new Date(targetDate);

    // Calculating the difference in milliseconds
    const difference = now - definedDate;

    // Calculating days, hours, minutes, and seconds
    const daysDifference = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hoursDifference = Math.floor(
      (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const minutesDifference = Math.floor(
      (difference % (1000 * 60 * 60)) / (1000 * 60)
    );
    const secondsDifference = Math.floor((difference % (1000 * 60)) / 1000);

    // Constructing the formatted difference string
    const formattedDifference = `${daysDifference} days, ${hoursDifference} hours, ${minutesDifference} minutes, ${secondsDifference} seconds`;

    return formattedDifference;
  }

  getEntryWithCompletedCarVin = async (vin) => {
    const query = Entry.findOne({
      "invoice.carDetails": {
        $elemMatch: {
          vin,
          isCompleted: true,
          isDroppedOff: undefined,
        },
      },
    }).sort({ _id: -1 });

    return query.populate("invoice.carDetails.serviceIds", "name").lean();
  };

  getRecentEntryWithVin = async (vin) => {
    const query = Entry.findOne({
      "invoice.carDetails": {
        $elemMatch: {
          vin,
        },
      },
    }).sort({ _id: -1 });

    return query.populate("invoice.carDetails.serviceIds", "name").lean();
  };

  checkLocationType(
    currentLocationType,
    currentLocations,
    locationTypeToCheck
  ) {
    for (const location of currentLocations) {
      const locationType = location.locationType;
      if (locationType === locationTypeToCheck)
        return currentLocationType === "PickupFromDealership"
          ? "Vehicle already taken to shop"
          : "The trip has been completed for this vehicle";
    }
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

  getCarAddedByStaffOnPremise(staffId, vin, carId) {
    return Entry.aggregate([
      {
        $unwind: "$invoice.carDetails",
      },
      vin
        ? {
            $match: {
              "invoice.carDetails.vin": vin,
            },
          }
        : {
            $match: {
              "invoice.carDetails._id": new mongoose.Types.ObjectId(carId),
            },
          },
      {
        $unwind: "$invoice.carDetails.servicesDone",
      },
      {
        $match: {
          "invoice.carDetails.servicesDone.staffId":
            new mongoose.Types.ObjectId(staffId),
        },
      },
    ]);
  }

  getCarsDoneByStaff = async (
    entryId,
    staffId,
    customerId,
    date,
    startDate,
    endDate,
    vin,
    porterId,
    waitingList,
    isFromAppointment,
    carId
  ) => {
    return Entry.aggregate(
      pipeline({
        entryId,
        staffId,
        customerId,
        date,
        startDate,
        endDate,
        vin,
        porterId,
        waitingList,
        isFromAppointment,
        carId,
      })
    );
  };

  getStaffEntriesAndAllEntries = async (filterArguments) => {
    const results = {};

    [results.staffEntries, results.entries] = await Promise.all([
      this.getCarsDoneByStaff(...filterArguments),
      this.getEntries(),
    ]);

    return results;
  };

  getEntryForCustomerLast24Hours = async (customerId, lean) => {
    const { today, tomorrow } = this.getTodayAndTomorrow();

    return lean
      ? Entry.findOne({
          customerId,
          entryDate: {
            $gte: today,
            $lt: tomorrow,
          },
          isActive: true,
        }).lean()
      : Entry.findOne({
          customerId,
          entryDate: {
            $gte: today,
            $lt: tomorrow,
          },
          isActive: true,
        });
  };

  getServiceAndEntry = async (carDetails, customerId, customer) => {
    const results = {};

    const serviceIds = carDetails.serviceIds;
    const vin = carDetails.vin;
    const isEntryFromDealership = await this.getEntryByVin(
      vin,
      false,
      undefined,
      true
    );

    [results.services, results.entry] = await Promise.all([
      serviceServices.getMultipleServices(serviceIds),
      isEntryFromDealership
        ? isEntryFromDealership
        : (await this.getEntryForCustomerLast24Hours(customerId))
        ? this.getEntryForCustomerLast24Hours(customerId)
        : this.createNewEntry(customer),
    ]);

    return results;
  };

  async getEntryForCustomerWithQboId(customerId, qbId) {
    return Entry.findOne({
      customerId,
      "invoice.qbId": qbId,
    });
  }

  getEntryPayMentDetails = async (apiEndpoint) => {
    const payload = await getWebhookDataUtils(apiEndpoint, getNewAccessToken);

    const customerId = payload.Payment.CustomerRef.value;
    const amount = payload.Payment.TotalAmt;
    const currency = payload.Payment.CurrencyRef.value;
    const { invoiceId } = this.getQbIdAndNumber(payload);
    const paymentDate = new Date(payload.time);

    return { customerId, currency, invoiceId, paymentDate, amount };
  };

  getQbIdAndNumber(data) {
    const invoiceLine = data.Payment.Line.find((item) => {
      return (
        item.LinkedTxn &&
        item.LinkedTxn.length > 0 &&
        item.LinkedTxn[0].TxnType === "Invoice"
      );
    });

    if (invoiceLine) {
      const invoiceId = invoiceLine.LinkedTxn[0].TxnId;
      const invoiceNumber = invoiceLine.LineEx.any.find(
        (item) =>
          item.name === "{http://schema.intuit.com/finance/v3}NameValue" &&
          item.value.Name === "txnReferenceNumber"
      )?.value.Value;
      return { invoiceId, invoiceNumber };
    }
  }
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

  getPriceForService = (services, customerId, category, lineId) => {
    const lowerCaseCategory = category.toLowerCase();
    // To check if customer has a dealership price
    const dealershipPrices = services.filter((service) =>
      service.dealershipPrices.some(
        (price) => price.customerId.toString() === customerId.toString()
      )
    );
    const defaultPrices = services
      .filter(
        (service) => !dealershipPrices.some((dp) => dp._id === service._id) // Default prices for services without dealership
      )
      .map((service) => {
        lineId++;

        return {
          dealership: false,
          serviceName: service.name,
          price: service.defaultPrices.find(
            (p) => p.category === lowerCaseCategory
          ).price,
          serviceType: service.type,
          serviceId: service._id,
          qbId: service.qbId,
          lineId,
        };
      });

    const priceBreakdown = [
      ...dealershipPrices.map((service) => {
        lineId++;

        return {
          dealership: true,
          serviceName: service.name,
          price: service.dealershipPrices.find(
            (p) => p.customerId.toString() === customerId.toString()
          ).price,
          serviceType: service.type,
          serviceId: service._id,
          qbId: service.qbId,
          lineId,
        };
      }),
      ...defaultPrices,
    ];

    const price = this.calculateServicePriceDoneforCar(priceBreakdown);

    return { price, priceBreakdown, lowerCaseCategory };
  };

  getCarBylineIdAndEntryId(entryId, lineId) {
    return Entry.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(entryId),
        },
      },
      {
        $unwind: "$invoice.carDetails",
      },
      {
        $unwind: "$invoice.carDetails.priceBreakdown",
      },
      {
        $match: {
          "invoice.carDetails.priceBreakdown.lineId": lineId,
        },
      },
    ]);
  }

  getCompleteServiceIds(carWithVin) {
    const porterServiceIds = carWithVin.serviceIds.map((id) =>
      id ? id.toString() : id
    );
    const staffServiceIds = carWithVin.servicesDone
      ? carWithVin.servicesDone.map((serviceDone) => {
          if (serviceDone) {
            const serviceId = serviceDone.serviceId.toString();
            return serviceId;
          }
        })
      : [];

    const validServiceIds = [...porterServiceIds, ...staffServiceIds];

    return validServiceIds;
  }

  addLineId(entry) {
    let lineId = 0;

    entry.invoice.carDetails.map((car) => {
      car.priceBreakdown.map((price) => {
        lineId++;

        price.lineId = lineId;
      });
    });
  }

  modifyCarWithVinPrice = (carWithVin, serviceId, price) => {
    let priceBreakdown = carWithVin.priceBreakdown;

    const { servicePrice, servicePriceIndex } = this.getServicePrice(
      priceBreakdown,
      serviceId
    );

    servicePrice.price = parseFloat(price);
    priceBreakdown[servicePriceIndex] = servicePrice;

    carWithVin.price = this.calculateServicePriceDoneforCar(priceBreakdown);

    return servicePrice;
  };

  calculateServicePriceDoneforCar(priceBreakdown) {
    const price = priceBreakdown.reduce((acc, curr) => {
      return acc + curr.price;
    }, 0);

    return price;
  }

  async updateEntryById(id, entry, session) {
    return await Entry.findByIdAndUpdate(
      id,
      {
        $set: entry,
      },
      { session }
    );
  }

  async modifyPrice({ entryId, vin, priceBreakdown, totalPrice }) {
    return await Entry.updateOne(
      {
        _id: entryId, // entry document id
        "invoice.carDetails.vin": vin,
      },
      {
        $set: {
          "invoice.carDetails.$.priceBreakdown": priceBreakdown, // new price
          "invoice.carDetails.$.price": price, // new price
          "invoice.totalPrice": totalPrice,
        },
      },
      { new: true }
    );
  }
  sumPriceBreakdownLength(entry) {
    let totalPriceBreakdownLength = 0;

    // Check if entry has carDetails
    // Loop through each carDetail
    for (const carDetail of entry.invoice.carDetails) {
      // Check if carDetail has priceBreakdown array
      if (carDetail.priceBreakdown && Array.isArray(carDetail.priceBreakdown)) {
        totalPriceBreakdownLength += carDetail.priceBreakdown.length;
      }
    }

    return totalPriceBreakdownLength;
  }
  getCarDoneByStaff(entry, req, vin) {
    const { carDetails } = entry.invoice;

    const carIndex = carDetails.findIndex((car) => {
      if (car.staffId || car.porterId) {
        const id = car.staffId ? car.staffId : car.porterId;

        return (
          id.toString() === req.user._id.toString() &&
          car.vin.toString() === vin.toString()
        );
      }
    });

    const carDoneByStaff = carDetails[carIndex];

    return { carIndex, carDoneByStaff };
  }

  getCarAddedByCustomer(entry, vin) {
    const { carDetails } = entry.invoice;

    const carIndex = carDetails.findIndex((car) => {
      return car.vin.toString() === vin.toString();
    });

    const carAddedByCustomer = carDetails[carIndex];

    return { carIndex, carAddedByCustomer };
  }

  getDrivingSpeedForPorter = () => {
    return Entry.aggregate([
      {
        $unwind: "$invoice.carDetails",
      },
      {
        $match: {
          "invoice.carDetails.geoLocations.locationType": "TakenToShop",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "invoice.carDetails.porterId",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $project: {
          _id: 1,
          ...this.getEntryField(),
          invoice: {
            ...this.getInvoiceField("$invoice"),
            carDetails: {
              _id: "$invoice.carDetails._id",
              ...this.getCarDetailsField("$invoice.carDetails"),
              porterName: {
                $concat: [
                  { $first: "$user.firstName" },
                  " ",
                  { $first: "$user.lastName" },
                ],
              },
              pickUpLocation: {
                $first: {
                  $filter: {
                    input: "$invoice.carDetails.geoLocations",
                    as: "geolocation",
                    cond: {
                      $eq: [
                        "$$geolocation.locationType",
                        "PickupFromDealership",
                      ],
                    },
                  },
                },
              },
              takenToShopLocation: {
                $first: {
                  $filter: {
                    input: "$invoice.carDetails.geoLocations",
                    as: "geolocation",
                    cond: {
                      $eq: ["$$geolocation.locationType", "TakenToShop"],
                    },
                  },
                },
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          ...this.getEntryField(),
          invoice: {
            ...this.getInvoiceField("$invoice"),
            carDetails: {
              _id: "$invoice.carDetails._id",
              ...this.getCarDetailsField("$invoice.carDetails"),
              porterName: "$invoice.carDetails.porterName",
              distance: {
                $round: [
                  {
                    $let: {
                      vars: {
                        earthRadius: 6371,
                        lat2: "$invoice.carDetails.pickUpLocation.coordinates.latitude",
                        lat1: "$invoice.carDetails.takenToShopLocation.coordinates.latitude",
                        dLat: {
                          $multiply: [
                            {
                              $subtract: [
                                "$invoice.carDetails.pickUpLocation.coordinates.latitude",
                                "$invoice.carDetails.takenToShopLocation.coordinates.latitude",
                              ],
                            },
                            Math.PI / 180,
                          ],
                        },
                        dLong: {
                          $multiply: [
                            {
                              $subtract: [
                                "$invoice.carDetails.pickUpLocation.coordinates.longitude",
                                "$invoice.carDetails.takenToShopLocation.coordinates.longitude",
                              ],
                            },
                            Math.PI / 180,
                          ],
                        },
                      },
                      in: {
                        $let: {
                          vars: {
                            ab: {
                              $multiply: [
                                {
                                  $sin: {
                                    $divide: ["$$dLat", 2],
                                  },
                                },
                                {
                                  $sin: {
                                    $divide: ["$$dLat", 2],
                                  },
                                },
                              ],
                            },
                            de: {
                              $cos: {
                                $multiply: ["$$lat1", Math.PI / 180],
                              },
                            },
                            fg: {
                              $cos: {
                                $multiply: ["$$lat2", Math.PI / 180],
                              },
                            },
                            hi: {
                              $sin: {
                                $divide: ["$$dLong", 2],
                              },
                            },
                            kl: {
                              $sin: {
                                $divide: ["$$dLong", 2],
                              },
                            },
                          },
                          in: {
                            $let: {
                              vars: {
                                a: {
                                  $add: [
                                    "$$ab",
                                    {
                                      $multiply: [
                                        "$$de",
                                        "$$fg",
                                        "$$hi",
                                        "$$kl",
                                      ],
                                    },
                                  ],
                                },
                              },
                              in: {
                                $let: {
                                  vars: {
                                    c: {
                                      $multiply: [
                                        {
                                          $atan2: [
                                            {
                                              $sqrt: "$$a",
                                            },
                                            {
                                              $sqrt: {
                                                $subtract: [1, "$$a"],
                                              },
                                            },
                                          ],
                                        },
                                        2,
                                      ],
                                    },
                                  },
                                  in: {
                                    $multiply: ["$$earthRadius", "$$c"],
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                  2,
                ],
              },
              drivingTime: {
                $dateToString: {
                  format: "%Hh:%Mm:%Ss",
                  date: {
                    $toDate: {
                      $subtract: [
                        "$invoice.carDetails.takenToShopLocation.timestamp",
                        "$invoice.carDetails.pickUpLocation.timestamp",
                      ],
                    },
                  },
                },
              },
              hourTime: {
                $divide: [
                  {
                    $subtract: [
                      "$invoice.carDetails.takenToShopLocation.timestamp",
                      "$invoice.carDetails.pickUpLocation.timestamp",
                    ],
                  },
                  3600000,
                ],
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          ...this.getEntryField(),
          invoice: {
            ...this.getInvoiceField("$invoice"),
            carDetails: {
              _id: "$invoice.carDetails._id",
              ...this.getCarDetailsField("$invoice.carDetails"),
              porterName: "$invoice.carDetails.porterName",
              distance: "$invoice.carDetails.distance",
              drivingTime: "$invoice.carDetails.drivingTime",
              drivingSpeedPerHour: {
                $round: [
                  {
                    $multiply: [
                      {
                        $divide: [
                          "$invoice.carDetails.distance",
                          "$invoice.carDetails.hourTime",
                        ],
                      },
                      0.621371,
                    ],
                  },
                  2,
                ],
              },
            },
          },
        },
      },
      {
        $lookup: {
          from: "services",
          localField: "invoice.carDetails.servicesDone.serviceId",
          foreignField: "_id",
          as: "servicesDet",
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
        $lookup: {
          from: "users",
          localField: "invoice.carDetails.servicesDone.staffId",
          foreignField: "_id",
          as: "staffs",
        },
      },
      {
        $addFields: {
          "invoice.carDetails.servicesLeftDetails": {
            $map: {
              input: "$services",
              as: "service",
              in: {
                serviceName: "$$service.name",
                serviceType: "$$service.type",
              },
            },
          },
        },
      },
      {
        $addFields: {
          "invoice.carDetails.servicesDoneDetails": {
            $map: {
              input: {
                $map: {
                  input: "$invoice.carDetails.servicesDone",
                  as: "serviceDone",
                  in: {
                    $mergeObjects: [
                      {
                        $first: {
                          $filter: {
                            input: "$servicesDet",
                            as: "serviceDet",
                            cond: {
                              $eq: [
                                "$$serviceDone.serviceId",
                                "$$serviceDet._id",
                              ],
                            },
                          },
                        },
                      },
                      "$$serviceDone",
                    ],
                  },
                },
              },
              as: "serviceDet",
              in: {
                serviceName: "$$serviceDet.name",
                serviceType: "$$serviceDet.type",
                staffName: {
                  $first: {
                    $map: {
                      input: {
                        $filter: {
                          input: "$staffs",
                          as: "staff",
                          cond: {
                            $eq: ["$$staff._id", "$$serviceDet.staffId"],
                          },
                        },
                      },
                      as: "staffDetails",
                      in: {
                        $concat: [
                          "$$staffDetails.firstName",
                          " ",
                          "$$staffDetails.lastName",
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
      {
        $group: {
          _id: "$_id",
          ...this.getEntryField(true),
          invoice: {
            $first: "$invoice",
          },
          carDetails: {
            $push: "$invoice.carDetails",
          },
        },
      },
      {
        $project: {
          ...this.getEntryField(),
          invoice: {
            ...this.getInvoiceField("$invoice"),
            carDetails: "$carDetails",
          },
        },
      },
      {
        $sort: {
          _id: -1,
        },
      },
    ]);
  };

  getCarByVin({ entry, vin, carId }) {
    const { carDetails } = entry.invoice;

    const carIndex = carDetails.findIndex((car) => {
      return vin
        ? car.vin.toString() === vin.toString()
        : car._id.toString() === carId.toString();
    });

    const carWithVin = carDetails[carIndex];

    return { carIndex, carWithVin };
  }

  async getSentInvoices() {
    return Entry.find({ "invoice.sent": true });
  }

  getServicePrice(priceBreakdown, serviceId) {
    const servicePriceIndex = priceBreakdown.findIndex(
      (price) => price.serviceId.toString() === serviceId.toString()
    );

    const servicePrice = priceBreakdown[servicePriceIndex];

    return { servicePrice, servicePriceIndex };
  }

  sortCarDetailsByPrice(carDetails) {
    // Use the sort() method with a comparison function
    carDetails.sort(function (a, b) {
      // Convert the prices to numbers for comparison
      const priceA = parseFloat(a.price);
      const priceB = parseFloat(b.price);

      // Compare the prices in descending order
      // (highest price first, lowest price last)
      return priceB - priceA;
    });

    // Create a new array with the sorted car details without "price" and "priceBreakdown" properties
    const sortedCarDetailsWithoutPrice = carDetails.map(function (car) {
      // Destructure the car object to create a new object without "price" and "priceBreakdown"
      const { price, priceBreakdown, ...carWithoutPrice } = car;
      return carWithoutPrice;
    });

    return sortedCarDetailsWithoutPrice;
  }

  calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) + //ab
      Math.cos(lat1 * (Math.PI / 180)) * //cd
        Math.cos(lat2 * (Math.PI / 180)) * //ef
        Math.sin(dLon / 2) * //gh
        Math.sin(dLon / 2); //ij
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance; // The distance in kilometers
  }

  getHaversineDistanceArgs({ initialLocation, finalLocation }) {
    const haversineDistanceArgs = [
      initialLocation.coordinates.latitude,
      initialLocation.coordinates.longitude,
      finalLocation.coordinates.latitude,
      finalLocation.coordinates.longitude,
    ];

    return haversineDistanceArgs;
  }

  getCurrentLoction = (porterId, locationType) => {
    return Entry.aggregate([
      {
        $match: {
          "invoice.carDetails.porterId": new mongoose.Types.ObjectId(porterId),
        },
      },
      { $unwind: "$invoice.carDetails" },
      {
        $lookup: {
          from: "services",
          localField: "invoice.carDetails.serviceIds",
          foreignField: "_id",
          as: "services",
        },
      },
      {
        $addFields: {
          "invoice.carDetails.serviceIds": {
            $map: {
              input: "$services",
              as: "service",
              in: {
                name: "$$service.name",
                id: "$$service._id",
              },
            },
          },
        },
      },
      {
        $addFields: {
          "invoice.carDetails.serviceDone.serviceName": "services",
        },
      },
      {
        $match: {
          "invoice.carDetails.porterId": new mongoose.Types.ObjectId(porterId),
        },
      },
      { $unwind: "$invoice.carDetails.geoLocations" },

      {
        $match: {
          "invoice.carDetails.geoLocations.locationType": locationType,
        },
      },
      { $sort: { "invoice.carDetails.geoLocations.timestamp": -1 } },
      {
        $group: {
          _id: null,
          mostRecentCar: { $first: "$invoice.carDetails" },
        },
      },
      {
        $project: {
          _id: 0,
          carDetails: {
            ...this.getCarDetailsField("$mostRecentCar"),
          },
        },
      },
      {
        $lookup: {
          from: "services",
          localField: "carDetails.servicesDone.serviceId",
          foreignField: "_id",
          as: "service",
        },
      },
      {
        $project: {
          carDetails: {
            ...this.getCarDetailsField("$carDetails"),
            servicesDone: {
              $map: {
                input: "$carDetails.servicesDone",
                as: "serviceDone",
                in: {
                  $mergeObjects: [
                    "$$serviceDone",
                    {
                      serviceName: {
                        $let: {
                          vars: {
                            serviceId: "$$serviceDone.serviceId",
                          },
                          in: {
                            $first: {
                              $filter: {
                                input: {
                                  $map: {
                                    input: "$service",
                                    as: "service",
                                    in: {
                                      $cond: [
                                        {
                                          $eq: [
                                            "$$service._id",
                                            {
                                              $toObjectId: "$$serviceId",
                                            },
                                          ],
                                        },
                                        "$$service.name",
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
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    ]);
  };

  getCarDetailsField(field) {
    const carDetailsField = carDetailsProperties.reduce((result, property) => {
      if (property !== "price" && property !== "priceBreakdown")
        result[property] = `${field}.${property}`;

      return result;
    }, {});

    return carDetailsField;
  }

  getInvoiceField(field) {
    const invoiceField = invoiceProperties.reduce((result, property) => {
      if (property !== "carDetails") result[property] = `${field}.${property}`;

      return result;
    }, {});

    return invoiceField;
  }
  getEntryField(field) {
    const entryField = !field
      ? entryProperties.reduce((result, property) => {
          if (property !== "carDetails") result[property] = 1;

          return result;
        }, {})
      : entryProperties.reduce((result, property) => {
          if (property !== "carDetails")
            result[property] = { $first: `$${property}` };

          return result;
        }, {});

    return entryField;
  }

  getCarLocationByType(car, locationType) {
    const locationByType = car.geoLocations.find(
      (location) => location.locationType === locationType
    );

    return locationByType;
  }

  //Create new entry
  async createEntry(entry) {
    return await entry.save();
  }

  createNewEntry = async (customer, numberOfVehicles) => {
    const customerId = customer.Id;
    const customerName = customer.DisplayName;
    const customerEmail = customer.PrimaryEmailAddr.Address;

    let entry = new Entry({
      customerId,
      customerName,
      customerEmail,
      isActive: true,
      numberOfVehicles,
    });

    const invoiceNumber = await Entry.getNextInvoiceNumber();
    entry.invoice.name = invoiceNumber;

    entry = await this.createEntry(entry);
    entry.id = entry._id;

    return entry;
  };

  updateEntryInvoicePaymentDetails = async ({
    entry,
    currency,
    paymentDate,
    amount,
  }) => {
    // const { currency, paymentDate, amount } = await this.getEntryPayMentDetails(
    //   apiEndpoint
    // );

    // const entry = await this.getEntryForCustomerWithQboId(
    //   customerId,
    //   invoiceId
    // );

    if (!entry) return;

    entry.invoice.paymentDetails.paymentDate = paymentDate;
    entry.invoice.paymentDetails.currency = currency;

    const totalAmountPaid = entry.invoice.paymentDetails.amountPaid + amount;
    entry.invoice.paymentDetails.amountPaid = totalAmountPaid;

    const amountDue = entry.invoice.totalPrice - totalAmountPaid;
    entry.invoice.paymentDetails.amountDue = amountDue;

    return await this.updateEntryById(entry._id, entry);
  };

  updateEntryPaymentDetails = async ({
    entryId,
    currency,
    paymentDate,
    amount,
  }) => {
    const [entry] = await this.getEntries({ entryId });

    if (!entry) return;

    entry.invoice.paymentDetails.paymentDate = paymentDate;
    entry.invoice.paymentDetails.currency = currency;

    const totalAmountPaid = entry.invoice.paymentDetails.amountPaid + amount;
    entry.invoice.paymentDetails.amountPaid = totalAmountPaid;

    const amountDue = entry.invoice.totalPrice - totalAmountPaid;
    entry.invoice.paymentDetails.amountDue = amountDue;

    return await this.updateEntryById(entry._id, entry);
  };

  async updateEntryById(id, entry, session, isNew) {
    return await Entry.findByIdAndUpdate(
      id,
      {
        $set: entry,
      },
      isNew ? { new: true } : { session }
    );
  }

  updateServicesDoneOnCar = async (carWithVin, serviceId, staffId) => {
    // Remove service done on care from serviceIds
    let serviceIds = carWithVin.serviceIds;
    serviceIds = serviceIds.filter(
      (service) => service.toString() !== serviceId.toString()
    );

    if (serviceIds.length < 1) {
      carWithVin.waitingList = false;
      carWithVin.isCompleted = true;
    }

    carWithVin.serviceIds = serviceIds;

    const serviceDone = {
      staffId,
      serviceId,
    };

    carWithVin.servicesDone.push(serviceDone);

    return carWithVin;
  };

  createServicesDone(serviceIds, staffId) {
    const servicesDone = serviceIds.map((serviceId) => {
      return { serviceId, staffId };
    });

    return servicesDone;
  }

  getSerViceIdsDone(carDetail, serviceId) {
    const servicesDone = carDetail.servicesDone;
    const intialServicIdsDone = servicesDone
      ? []
      : servicesDone.length < 1
      ? []
      : servicesDone.map((serviceDone) => serviceDone.serviceId.toString());

    const serviceIdsDone = [...intialServicIdsDone, serviceId];

    return serviceIdsDone;
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

  async checkDuplicateEntry(customerId, vin) {
    const { today, tomorrow } = this.getTodayAndTomorrow();
    return await Entry.findOne({
      $and: [
        { customerId },
        { "invoice.carDetails.vin": vin },
        {
          entryDate: {
            $gte: today,
            $lte: tomorrow,
          },
        },
      ],
    });
  }

  checkDuplicateEntryForMultipleVins(customerId, vinsArray) {
    const { today, tomorrow } = this.getTodayAndTomorrow();
    return Entry.find({
      $and: [
        { customerId },
        { "invoice.carDetails.vin": { $in: vinsArray } },
        {
          entryDate: {
            $gte: today,
            $lte: tomorrow,
          },
        },
      ],
    });
  }

  calculateServicePriceDoneforCar(priceBreakdown) {
    const price = priceBreakdown.reduce((acc, curr) => {
      return acc + curr.price;
    }, 0);

    return price;
  }

  async modifyPrice({ entryId, vin, priceBreakdown, totalPrice }) {
    return await Entry.updateOne(
      {
        _id: entryId, // entry document id
        "invoice.carDetails.vin": vin,
      },
      {
        $set: {
          "invoice.carDetails.$.priceBreakdown": priceBreakdown, // new price
          "invoice.carDetails.$.price": price, // new price
          "invoice.totalPrice": totalPrice,
        },
      },
      { new: true }
    );
  }

  async addCarDetail(entryId, carDetails) {
    return await Entry.findOneAndUpdate(
      { _id: entryId },
      {
        $push: { "invoice.carDetails": carDetails },
        $inc: { numberOfCarsAdded: carDetails.length },
        $set: { isFromDealership: true },
      },
      { new: true }
    );
  }

  hasDuplicateVins(vinsArray) {
    const seenVins = new Set();

    for (const vin of vinsArray) {
      // If the VIN is already in the Set, it's a duplicate
      if (seenVins.has(vin)) {
        return true;
      }

      // Otherwise, add the VIN to the Set
      seenVins.add(vin);
    }

    // No duplicates found
    return false;
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

  errorChecker({ missingIds, entry, services, isCarServiceAdded }) {
    const errorResult = {};

    const setErrorMessage = (message, status) => {
      errorResult.message = message;
      errorResult.status = status;
      return errorResult;
    };

    if (missingIds.length > 0) {
      return setErrorMessage(
        {
          message: `Services with IDs: ${missingIds} could not be found`,
          status: false,
        },
        404
      );
    }

    if (!entry || !services) {
      const fieldName = !entry ? "entry" : "services";
      return setErrorMessage(errorMessage(fieldName), 404);
    }

    if (isCarServiceAdded) {
      return setErrorMessage(
        { message: "Duplicate entry", success: false },
        400
      );
    }
    return errorResult;
  }

  updateCarDetails = (
    entry,
    carDetails,
    price,
    priceBreakdown,
    staffId,
    carExist,
    porterId
  ) => {
    const newDate = new Date();

    carDetails.price = price;
    carDetails.category = carDetails.category.toLowerCase();
    staffId ? (carDetails.staffId = staffId) : (carDetails.porterId = porterId);
    carDetails.priceBreakdown = staffId ? priceBreakdown : [];
    carDetails.entryDate = newDate;

    if (carDetails.geoLocation) {
      carDetails.geoLocations = [
        {
          timeStamp: new Date(),
          locationType: "Scanned",
          ...carDetails.geoLocation,
        },
      ];
    }

    if (staffId) {
      const serviceIds = carDetails.serviceIds;
      const servicesDone = this.createServicesDone(serviceIds, staffId);
      carDetails.servicesDone = servicesDone;
    }

    if (carExist) {
      const { carIndex, carAddedByCustomer } = this.getCarAddedByCustomer(
        entry,
        carDetails.vin
      );

      const combinedCardetail = this.mergeCarObjects(
        carAddedByCustomer,
        carDetails
      );

      entry.invoice.carDetails[carIndex] = combinedCardetail;
    } else {
      entry.invoice.carDetails.push(carDetails);
    }

    entry.invoice.totalPrice = this.getTotalprice(entry.invoice);
    entry.numberOfCarsAdded = this.getNumberOfCarsAdded(
      entry.invoice.carDetails
    );

    return entry;
  };

  mergeCarObjects(carAddedByCustomer, carAddedByStaff) {
    // Create a new object to store the merged result
    const mergedCar = {};

    // Iterate through properties in carAddedByCustomer
    for (const key in carAddedByCustomer) {
      // Check if the property exists in carAddedByStaff
      if (carAddedByStaff.hasOwnProperty(key)) {
        // Use the value from carAddedByStaff in case of conflict
        mergedCar[key] = carAddedByStaff[key];
      } else {
        // Use the value from carAddedByCustomer if not in carAddedByStaff
        mergedCar[key] = carAddedByCustomer[key];
      }
    }

    // Iterate through properties in carAddedByStaff to include any additional properties
    for (const key in carAddedByStaff) {
      // Check if the property doesn't exist in the merged result
      if (!mergedCar.hasOwnProperty(key)) {
        // Include the property from carAddedByStaff
        mergedCar[key] = carAddedByStaff[key];
      }
    }

    return mergedCar;
  }

  carWasAddedRecently = (car) => {
    const now = new Date();
    const carEntryDate = new Date(car.entryDate);

    const diffTime = Math.abs(now - carEntryDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays <= 1;
  };

  async deleteEntry(id) {
    return await Entry.findByIdAndRemove(id);
  }
}

module.exports = new EntryService();
