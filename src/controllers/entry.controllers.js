const _ = require("lodash");
const { DistanceThreshold } = require("../model/distanceThreshold.model");
const entryService = require("../services/entry.services");
const userService = require("../services/user.services");
const customerService = require("../services/customer.service");
const serviceService = require("../services/service.services");
const { MESSAGES } = require("../common/constants.common");
const { getJobCounts, getFilterArguments } = require("../utils/entry.utils");

const {
  errorMessage,
  successMessage,
  jsonResponse,
  notFoundResponse,
  badReqResponse,
  forbiddenResponse,
} = require("../common/messages.common");
const { default: mongoose } = require("mongoose");
const mongoTransactionUtils = require("../utils/mongoTransaction.utils");
const entryServices = require("../services/entry.services");

class EntryController {
  async getStatus(req, res) {
    res.status(200).send({ message: MESSAGES.DEFAULT, success: true });
  }

  //Create a new entry
  async createEntry(req, res) {
    const { customerId, numberOfVehicles } = req.body;

    const { data: customer, error } =
      await customerService.getOrSetCustomerOnCache(customerId);
    if (error)
      return jsonResponse(res, 404, false, error.Fault.Error[0].Detail);

    const isEntryAddedWithin24Hrs =
      await entryService.getEntryForCustomerLast24Hours(customerId);

    if (isEntryAddedWithin24Hrs)
      return jsonResponse(
        res,
        403,
        false,
        "You cannot create multiple entries within 24 hours."
      );

    const entry = await entryService.createNewEntry(customer, numberOfVehicles);

    res.send(successMessage(MESSAGES.CREATED, entry));
  }

  async addVin(req, res) {
    const { id: customerId } = req.params;
    const { carDetails } = req.body;
    const { vin } = carDetails;

    const customerOnDb = userService.findCustomerByQbId(customerId);
    if (!customerOnDb) return res.status(404).send(errorMessage("customer"));

    const { data: customer, error } =
      await customerService.getOrSetCustomerOnCache(customerId);
    if (error)
      return jsonResponse(res, 404, false, error.Fault.Error[0].Detail);

    let [entry, isVinAdded] = await Promise.all([
      (await entryService.getEntryForCustomerLast24Hours(customerId))
        ? await entryService.getEntryForCustomerLast24Hours(customerId)
        : await entryService.createNewEntry(customer),
      entryService.checkDuplicateEntry(customerId, vin),
    ]);

    if (isVinAdded) return badReqResponse(res, "Duplicate Entry");

    entry = await entryService.addCarDetail(entry._id, carDetails);

    res.send(successMessage(MESSAGES.CREATED, entry));
  }

  addInvoice = async (req, res) => {
    const { id: customerId } = req.params;
    const { carDetails } = req.body;
    const { category, serviceIds, vin } = carDetails;
    const role = req.user.role;

    const { data: customer, error } =
      await customerService.getOrSetCustomerOnCache(customerId);
    if (error)
      return jsonResponse(res, 404, false, error.Fault.Error[0].Detail);

    if (!customer.PrimaryEmailAddr)
      return jsonResponse(
        res,
        404,
        false,
        "Customer does not have a primary email address"
      );
    let staffId;
    let porterId;

    if (role === "porter") {
      carDetails.waitingList = true;
      porterId = req.user._id;
    } else if (role === "staff") {
      staffId = req.user._id;
    }

    carDetails.serviceIds = [...new Set(serviceIds)];

    req.params = {
      ...req.params,
      vin,
      staffId,
      porterId,
    };

    const filterArguments = getFilterArguments(req);

    let [[isCarServiceAdded], carExist, { services, entry }, missingIds] =
      await Promise.all([
        entryService.getCarsDoneByStaff(...filterArguments),
        entryService.checkDuplicateEntry(customerId, vin),
        entryService.getServiceAndEntry(carDetails, customerId, customer),
        serviceService.validateServiceIds(serviceIds),
      ]);

    if (Array.isArray(entry)) entry = entry[0];

    const { message, status } = entryService.errorChecker({
      missingIds,
      entry,
      services,
      isCarServiceAdded,
    });

    if (message || status) return res.status(status).send(message);

    const { price, priceBreakdown } = entryService.getPriceForService(
      services,
      entry.customerId,
      category
    );

    entryService.updateCarDetails(
      entry,
      carDetails,
      price,
      priceBreakdown,
      staffId,
      carExist,
      porterId
    );

    const mongoSession = await mongoose.startSession();

    const results = await mongoTransactionUtils(mongoSession, async () => {
      await userService.updateStaffTotalEarnings(req.user, mongoSession);

      const id = entry._id;
      const updatedEntry = await entryService.updateEntryById(
        id,
        entry,
        mongoSession
      );

      updatedEntry.id = updatedEntry._id;
    });
    if (results) return jsonResponse(res, 500, false, "Something failed");

    delete carDetails.priceBreakdown;
    delete carDetails.price;

    res.send(successMessage(MESSAGES.UPDATED, carDetails));
  };

  async addCarGeoLocation(req, res) {
    const { vin, locationType } = req.params;

    req.body.geoLocation.locationType = locationType;

    const { geoLocation } = req.body;

    const pickupLocationType = ["PickupFromDealership", "TakenToShop"].includes(
      locationType
    );

    geoLocation.timestamp = new Date();

    const entry = pickupLocationType
      ? await entryService.getEntryByVin(vin, true)
      : await entryService.getEntryWithCompletedCarVin(vin);

    if (!pickupLocationType && !entry)
      return jsonResponse(
        res,
        404,
        false,
        "This car has either not had its services completed or has not been added to the system."
      );

    if (!entry) return res.status(404).send(errorMessage("entry"));

    const { carIndex, carWithVin } = entryService.getCarByVin({ entry, vin });

    const locationByType = entryService.getCarLocationByType(
      carWithVin,
      locationType
    );
    if (locationByType)
      return badReqResponse(
        res,
        `${locationType} location has already been added`
      );

    const scannedLocation = entryService.getCarLocationByType(
      carWithVin,
      "Scanned"
    );

    if (!scannedLocation)
      return badReqResponse(res, "First scanning has to be done");

    if (["PickupFromDealership", "DropOffCompleted"].includes(locationType)) {
      const distanceThreshold = await DistanceThreshold.findOne()
        .limit(1)
        .lean();

      if (!distanceThreshold)
        return res.status(404).send(errorMessage("distanceThreshold"));

      const threshold = distanceThreshold[locationType];

      const haversineDistanceArgs = entryService.getHaversineDistanceArgs({
        initialLocation: scannedLocation,
        finalLocation: geoLocation,
      });

      const distance = entryService.calculateHaversineDistance(
        ...haversineDistanceArgs
      );

      if (locationType === "DropOffCompleted") {
        const takenFromShopLocation = entryService.getCarLocationByType(
          carWithVin,
          "TakenFromShop"
        );

        if (!takenFromShopLocation)
          return badReqResponse(res, "No taken from shop location");
      }

      if (distance > threshold)
        return badReqResponse(
          res,
          "The car is not within the within the Dealership location"
        );
    }

    carWithVin.geoLocations.push(geoLocation);

    entry.invoice.carDetails[carIndex] = carWithVin;

    const { price, priceBreakdown, ...carWithoutPrice } = carWithVin;

    if (["PickupFromDealership", "TakenFromShop"].includes(locationType)) {
      geoLocation.locationType = locationType;

      const mongoSession = await mongoose.startSession();

      const results = await mongoTransactionUtils(mongoSession, async () => {
        await userService.updatePorterCurrentLocation(
          req.user,
          mongoSession,
          geoLocation
        );

        const id = entry._id;
        await entryService.updateEntryById(id, entry, mongoSession);
      });
      if (results) return jsonResponse(res, 500, false, "Something failed");

      return res.send(successMessage(MESSAGES.UPDATED, carWithoutPrice));
    }

    await entryService.updateEntryById(entry._id, entry);

    res.send(successMessage(MESSAGES.UPDATED, carWithoutPrice));
  }

  async getSentInvoices(req, res) {
    const sentInvoices = await entryService.getSentInvoices();

    res.send(successMessage(MESSAGES.FETCHED, sentInvoices));
  }

  //get all entries in the entry collection/table
  async fetchAllEntries(req, res) {
    const { getEntries } = entryService;
    const errorMessage = "There's no entry please create one";

    const entries = await getEntries();
    if (entries.length < 0) return jsonResponse(res, 404, false, errorMessage);

    entries.map((entry) => (entry.id = entry._id));

    res.send(successMessage(MESSAGES.FETCHED, entries));
  }

  async getEntryById(req, res) {
    const { getEntries } = entryService;
    const { id: entryId, customerId } = req.params;
    const getEntriesArgument = {
      ...(entryId ? { entryId } : { customerId }),
    };

    let entries = await getEntries(getEntriesArgument);
    let customer = undefined;

    if (customerId) {
      const { error, data } = await customerService.getOrSetCustomerOnCache(
        customerId
      );
      if (error)
        return jsonResponse(res, 404, false, error.Fault.Error[0].Detail);
      customer = data;
    }

    if (entryId) entries = entries[0];
    if (!entries) return res.status(404).send(errorMessage("entry"));

    if (customerId && !customer)
      return res.status(404).send(errorMessage("customer"));

    if (entryId) entries.id = entries._id;
    if (customerId) {
      if (Array.isArray(entries) && entries.length < 1) {
        entries = [
          {
            customerId,
            numberOfCarsAdded: 0,
            entryDate: null,
            invoice: {},
            customerName: `${customer.DisplayName}`,
          },
        ];
      }
      entries.map((entry) => (entry.id = entry._id));
    }

    res.send(successMessage(MESSAGES.FETCHED, entries));
  }

  async getCurrentLocation(req, res) {
    const { porterId, locationType } = req.params;

    const [porter] = await userService.getUserByRoleAndId(porterId, "porter");
    if (!porter) return res.status(404).send(errorMessage("porter"));

    const [carWithCurrentLocation] = await entryService.getCurrentLoction(
      porterId,
      locationType
    );

    if (!carWithCurrentLocation)
      return jsonResponse(
        res,
        400,
        false,
        "Can't find current car for the porter"
      );

    const { carDetails } = carWithCurrentLocation;

    res.send(successMessage(MESSAGES.FETCHED, carDetails));
  }

  async getCarsDoneByStaffPerId(req, res) {
    const { entryId, staffId, customerId, porterId } = req.params;

    let [staff, { data: customer, error }, [entry]] = await Promise.all([
      userService.getUserById(staffId || porterId),
      customerId ? customerService.getOrSetCustomerOnCache(customerId) : [],
      entryId ? entryService.getEntries({ entryId }) : [],
    ]);

    if (error)
      return jsonResponse(res, 404, false, error.Fault.Error[0].Detail);

    if (Array.isArray(customer)) customer = customer[0];

    if (entryId && !entry) return res.status(404).send(errorMessage("entry"));
    if (!staff) return res.status(404).send(errorMessage("staff"));

    const filterArguments = getFilterArguments(req);

    let staffEntries = await entryService.getCarsDoneByStaff(
      ...filterArguments
    );

    if (entryId) {
      staffEntries = staffEntries[0];
      if (staffEntries) staffEntries.id = staffEntries._id;
    }

    if (entryId && staffId && customerId) {
      if (!staffEntries)
        return jsonResponse(
          res,
          404,
          false,
          "We are unable to locate any job completed by the staff for the customer in this entry."
        );
    }

    if (!staffEntries) {
      staffEntries = _.cloneDeep(entry);
      staffEntries.invoice.carDetails = [];
      delete staffEntries.invoice.totalPrice;
      delete staffEntries.invoice.paymentDetails;
    }

    if (customerId && Array.isArray(staffEntries)) {
      if (staffEntries.length >= 1)
        staffEntries.map((entry) => (entry.id = entry._id));
    }

    if (Array.isArray(staffEntries) && staffEntries.length < 1) {
      staffEntries =
        req.params.waitingList === undefined
          ? [
              {
                customerId,
                numberOfCarsAdded: 0,
                entryDate: null,
                invoice: {},
                customerName: customer ? `${customer.DisplayName}` : null,
              },
            ]
          : [];
    }

    res.send(successMessage(MESSAGES.FETCHED, staffEntries));
  }

  async getCarsDoneByStaff(req, res) {
    const { monthName, year, date, staffId } = req.params;
    const filterArguments = getFilterArguments(req);

    const [staff] = await userService.getUserByRoleAndId(staffId, "staff");
    if (!staff) return res.status(404).send(errorMessage("staff"));

    let results = await entryService.getStaffEntriesAndAllEntries(
      filterArguments
    );
    let { entries, staffEntries } = results;

    if (date || year || monthName) {
      let result;

      if (date) {
        result = getJobCounts(staffEntries).dayCounts;
      } else if (year && monthName) {
        result = getJobCounts(staffEntries).dayCounts;
      } else if (year) {
        result = getJobCounts(staffEntries).monthCounts;
      }
      return res.send(
        successMessage(MESSAGES.FETCHED, { staffEntries, count: result })
      );
    }

    if (staffEntries && staffEntries.length < 1) {
      staffEntries = _.cloneDeep(entries);
      staffEntries.map((staffEntry) => {
        {
          delete staffEntry.invoice.totalPrice;
          staffEntry.invoice.carDetails = [];
        }
      });
    }

    staffEntries.map((entry) => (entry.id = entry._id));

    res.send(successMessage(MESSAGES.FETCHED, staffEntries));
  }

  async getCarsDoneForCustomer(req, res) {
    const { customerId } = req.params;
    const filterArguments = getFilterArguments(req);

    const carsDoneForCustomer = await entryService.getCarsDoneByStaff(
      ...filterArguments
    );

    res.send(successMessage(MESSAGES.FETCHED, carsDoneForCustomer));
  }

  async sortCarDetailsByPrice(req, res) {
    const { customerId } = req.params;
    const porterId = req.user._id;

    const entry = await entryService.getEntryForCustomerLast24Hours(
      customerId,
      true
    );
    if (!entry)
      return jsonResponse(
        res,
        404,
        false,
        "No entry has been added for the customer today"
      );

    const carDetails = entry.invoice.carDetails.filter((car) => {
      if (car.porterId) {
        return car.porterId.toString() === porterId.toString();
      }
    });

    const carsThatHasNotBeenPickedUp =
      entryService.getCarsThatHasNotBeenPickedUp(carDetails);

    const sortedCarDetailsWithoutPrice = entryServices.sortCarDetailsByPrice(
      carsThatHasNotBeenPickedUp
    );

    return res.send(
      successMessage(MESSAGES.FETCHED, sortedCarDetailsWithoutPrice)
    );
  }

  //Update/edit entry data
  async updateEntry(req, res) {
    const [entry] = await entryService.getEntries({ entryId: req.params.id });

    if (!entry) return res.status(404).send(errorMessage("entry"));

    entry.numberOfVehicles = req.body.numberOfVehicles;

    let updatedEntry = await entryService.updateEntryById(req.params.id, entry);
    updatedEntry.id = updatedEntry._id;

    res.send(successMessage(MESSAGES.UPDATED, updatedEntry));
  }

  async updateCarDoneByStaff(req, res) {
    const { vin } = req.params;
    const { serviceId } = req.body;
    const staffId = req.user._id;

    const [entry, service] = await Promise.all([
      entryService.getEntryByVin(vin),
      serviceService.getServiceById(serviceId),
    ]);

    if (!entry) return res.status(404).send(errorMessage("entry"));
    if (!service) return res.status(404).send(errorMessage("service"));

    const { carIndex, carWithVin } = entryService.getCarByVin({ entry, vin });

    if (Array.isArray(carWithVin) && carWithVin.length < 1)
      return jsonResponse(res, 404, false, "We can't find car with vin");

    if (!carWithVin.serviceIds.includes(serviceId))
      return jsonResponse(
        res,
        403,
        false,
        "The service has either been added by a staff member or has not been added by a porter."
      );

    const isCompleted = carWithVin.isCompleted;
    const waitingList = carWithVin.waitingList;
    const isServiceIdsEmpty = carWithVin.serviceIds.length < 1;

    if (isCompleted || isServiceIdsEmpty || !waitingList)
      return jsonResponse(res, 403, false, "This car has been marked as done");

    const updatedCarWithVIn = await entryService.updateServicesDoneOnCar(
      carWithVin,
      serviceId,
      staffId
    );

    entry.invoice.carDetails[carIndex] = updatedCarWithVIn;

    await entry.save();

    delete carWithVin.price;
    delete carWithVin.priceBreakdown;

    return res.send(successMessage(MESSAGES.UPDATED, carWithVin));
  }

  async getCarByVin(req, res) {
    const { vin } = req.params;

    const entry = await entryService.getEntryByVin(vin, true);
    if (!entry) return res.status(404).send(errorMessage("entry"));

    const { carWithVin } = entryService.getCarByVin({ entry, vin });

    if (Array.isArray(carWithVin) && carWithVin.length < 1)
      return jsonResponse(res, 404, false, "We can't find car with vin");

    if (carWithVin.waitingList === undefined)
      return jsonResponse(res, 400, false, "The car was not added by a porter");

    const { price, priceBreakdown, ...carWithVinWithoutPrice } = carWithVin;
    const serviceIds = carWithVinWithoutPrice.serviceIds;

    for (const serviceId of serviceIds) serviceId.id = serviceId._id;

    return res.send(successMessage(MESSAGES.FETCHED, carWithVinWithoutPrice));
  }

  //Update/edit entry data
  async modifyCarDetails(req, res) {
    const { getMultipleServices } = serviceService;
    const { vin, id } = req.params;

    const [entry] = await entryService.getEntries({ entryId: id });
    if (!entry) return res.status(404).send(errorMessage("entry"));

    const { carIndex, carDoneByStaff } = entryService.getCarDoneByStaff(
      entry,
      req,
      vin
    );

    if (!carDoneByStaff)
      return res
        .status(401)
        .send({ message: MESSAGES.UNAUTHORIZE("update"), succes: false });

    const geoLocations = carDoneByStaff.geoLocations;

    if (geoLocations) {
      for (const geoLocation of geoLocations) {
        if (geoLocation.locationType !== "Scanned") {
          return forbiddenResponse(
            res,
            "Cannot modify a car after it has been picked up"
          );
        }
      }
    }

    if (!entryService.carWasAddedRecently(carDoneByStaff)) {
      return res.status(401).send({
        message:
          "Modifying car details is not allowed beyond 24 hours after adding.",
        succes: false,
      });
    }

    entryService.updateCarProperties(req, carDoneByStaff);

    const services = await getMultipleServices(carDoneByStaff.serviceIds);

    entryService.recalculatePrices(req, entry, services, carDoneByStaff);

    entry.invoice.carDetails[carIndex] = carDoneByStaff;

    await entryService.updateEntryById(id, entry);

    const carWithoutPrice = _.cloneDeep(carDoneByStaff);
    delete carWithoutPrice.price;
    delete carWithoutPrice.priceBreakdown;

    res.send(successMessage(MESSAGES.UPDATED, carWithoutPrice));
  }

  async modifyPrice(req, res) {
    const { serviceId, price, vin } = req.body;

    const [[entry], service] = await Promise.all([
      entryService.getEntries({ entryId: req.params.id }),
      serviceService.getServiceById(serviceId),
    ]);
    if (!entry) return res.status(404).send(errorMessage("entry"));
    if (!service) return res.status(404).send(errorMessage("service"));

    const { carWithVin, carIndex } = entryService.getCarByVin({ entry, vin });
    if (!carWithVin || carIndex < 0)
      return notFoundResponse(res, "Car with VIN number not found in invoice.");

    if (!entry.isActive)
      return jsonResponse(
        res,
        401,
        false,
        "Altering the price of a sent invoice is not allowed."
      );

    if (!entryService.carWasAddedRecently(carWithVin)) {
      return res.status(401).send({
        message:
          "Modifying car details is not allowed beyond 24 hours after adding.",
        succes: false,
      });
    }

    let priceBreakdown = carWithVin.priceBreakdown;

    const { servicePrice, servicePriceIndex } = entryService.getServicePrice(
      priceBreakdown,
      serviceId
    );

    servicePrice.price = parseFloat(price);
    priceBreakdown[servicePriceIndex] = servicePrice;

    carWithVin.price =
      entryService.calculateServicePriceDoneforCar(priceBreakdown);

    entry.invoice.carDetails[carIndex] = carWithVin;

    const totalPrice = entryService.getTotalprice(entry.invoice);
    entry.invoice.totalPrice = totalPrice;

    const updatedEntry = await entryService.updateEntryById(
      req.params.id,
      entry
    );

    res.send(successMessage(MESSAGES.UPDATED, updatedEntry));
  }

  //Delete entry account entirely from the database
  async deleteEntry(req, res) {
    const entry = await entryService.getEntries({ entryId: req.params.id });

    if (!entry) return res.status(404).send(errorMessage("entry"));

    await entryService.deleteEntry(req.params.id);

    res.send(successMessage(MESSAGES.DELETED, entry));
  }
}

module.exports = new EntryController();
