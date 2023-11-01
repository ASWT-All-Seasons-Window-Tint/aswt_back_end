const mongoose = require("mongoose");
const { Entry } = require("../model/entry.model");
const serviceServices = require("./service.services");
const { DATE, errorMessage } = require("../common/constants.common");
const { getNewAccessToken } = require("../utils/getNewAccessToken.utils");
const getWebhookDataUtils = require("../utils/getWebhookData.utils");
const {
  pipeline,
  pipelineForCustomerIdAndVin,
  test,
} = require("../utils/entry.utils");
const { validMonthNames } = require("../common/constants.common");
const newDateUtils = require("../utils/newDate.utils");
const { carDetailsProperties, entryProperties } =
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

  getEntryByVin = async (vin, lean) => {
    const { today, tomorrow } = this.getTodayAndTomorrow();

    const query = Entry.findOne({
      entryDate: {
        $gte: today,
        $lt: tomorrow,
      },
      "invoice.carDetails": {
        $elemMatch: {
          vin,
        },
      },
    });

    return lean
      ? query.populate("invoice.carDetails.serviceIds", "name").lean()
      : query;
  };

  getEntryWithCompletedCarVin = async (vin) => {
    const query = Entry.findOne({
      "invoice.carDetails": {
        $elemMatch: {
          vin,
          isCompleted: true,
          isDroppedOff: undefined,
        },
      },
    }).sort({ createdAt: -1 });

    return query.populate("invoice.carDetails.serviceIds", "name").lean();
  };

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

  getCarsDoneByStaff = async (
    entryId,
    staffId,
    customerId,
    date,
    startDate,
    endDate,
    vin,
    porterId,
    waitingList
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

    [results.services, results.entry] = await Promise.all([
      serviceServices.getMultipleServices(serviceIds),
      (await this.getEntryForCustomerLast24Hours(customerId))
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

  getPriceForService = (services, customerId, category) => {
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
      .map((service) => ({
        dealership: false,
        serviceName: service.name,
        price: service.defaultPrices.find(
          (p) => p.category === lowerCaseCategory
        ).price,
        serviceType: service.type,
        serviceId: service._id,
        qbId: service.qbId,
      }));

    const priceBreakdown = [
      ...dealershipPrices.map((service) => ({
        dealership: true,
        serviceName: service.name,
        price: service.dealershipPrices.find(
          (p) => p.customerId.toString() === customerId.toString()
        ).price,
        serviceType: service.type,
        serviceId: service._id,
        qbId: service.qbId,
      })),
      ...defaultPrices,
    ];

    const price = this.calculateServicePriceDoneforCar(priceBreakdown);

    return { price, priceBreakdown, lowerCaseCategory };
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

  getCarByVin({ entry, vin }) {
    const { carDetails } = entry.invoice;

    const carIndex = carDetails.findIndex((car) => {
      return car.vin.toString() === vin.toString();
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
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
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
    const customerName = customer.FullyQualifiedName;
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

  updateEntryInvoicePaymentDetails = async (apiEndpoint) => {
    const { customerId, currency, invoiceId, paymentDate, amount } =
      await this.getEntryPayMentDetails(apiEndpoint);

    const entry = await this.getEntryForCustomerWithQboId(
      customerId,
      invoiceId
    );

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

  async updateEntryById(id, entry, session) {
    return await Entry.findByIdAndUpdate(
      id,
      {
        $set: entry,
      },
      { session }
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

  async addCarDetail(entryId, carDetail) {
    return await Entry.findOneAndUpdate(
      { _id: entryId },
      {
        $push: { "invoice.carDetails": carDetail },
        $inc: { numberOfCarsAdded: 1 },
      },
      { new: true }
    );
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
    carDetails.priceBreakdown = priceBreakdown;
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
