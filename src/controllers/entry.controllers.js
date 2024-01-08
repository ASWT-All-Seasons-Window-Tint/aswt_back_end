const _ = require("lodash");
const Queue = require("bull");
const { DistanceThreshold } = require("../model/distanceThreshold.model");
const entryService = require("../services/entry.services");
const userService = require("../services/user.services");
const notificationService = require("../services/notification.services");
const customerService = require("../services/customer.service");
const serviceService = require("../services/service.services");
const { MESSAGES, NOTIFICATIONS } = require("../common/constants.common");
const { getJobCounts, getFilterArguments } = require("../utils/entry.utils");

const {
  errorMessage,
  successMessage,
  jsonResponse,
  notFoundResponse,
  badReqResponse,
  forbiddenResponse,
  serverErrResponse,
} = require("../common/messages.common");
const { default: mongoose } = require("mongoose");
const mongoTransactionUtils = require("../utils/mongoTransaction.utils");
const entryServices = require("../services/entry.services");
const invoiceControllers = require("./invoice.controllers");
const userServices = require("../services/user.services");
const axiosRequestUtils = require("../utils/axiosRequest.utils");

class EntryController {
  async getStatus(req, res) {
    res.status(200).send({ message: MESSAGES.DEFAULT, success: true });
  }

  //Create a new entry
  async createEntry(req, res) {
    const { numberOfVehicles } = req.body;
    const { qbId: customerId } = req.user.customerDetails;

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
    const date = new Date();
    const vinsArray = carDetails.map((car) => {
      if (car.vin && typeof car.vin === "string")
        car.vin = car.vin.toUpperCase();

      car.entryDate = date;

      return car.vin;
    });

    const hasDuplicates = entryService.hasDuplicateVins(vinsArray);
    if (hasDuplicates) return badReqResponse(res, "Duplicate VINs found.");

    const customerOnDb = userService.findCustomerByQbId(customerId);
    if (!customerOnDb) return res.status(404).send(errorMessage("customer"));

    const { data: customer, error } =
      await customerService.getOrSetCustomerOnCache(customerId);
    if (error)
      return jsonResponse(res, 404, false, error.Fault.Error[0].Detail);

    let [entry, isVinAdded] = await Promise.all([
      (await entryService.getEntryForCustomerLast24Hours(customerId))
        ? entryService.getEntryForCustomerLast24Hours(customerId)
        : entryService.createNewEntry(customer),
      entryService.checkDuplicateEntryForMultipleVins(customerId, vinsArray),
    ]);

    if (isVinAdded.length > 0) return badReqResponse(res, "Duplicate Entry");

    entry = await entryService.addCarDetail(entry._id, carDetails);

    res.send(successMessage(MESSAGES.CREATED, entry));
  }

  addInvoice = async (req, res) => {
    const { id: customerId } = req.params;
    const { carDetails } = req.body;
    let { category, serviceDetails, vin } = carDetails;
    const role = req.user.role;
    const dateOfCreation = new Date();

    if (vin && typeof vin === "string") {
      carDetails.vin = vin.toUpperCase();
      vin = vin.toUpperCase();
    }

    const serviceIds = serviceDetails.map((service) => service.serviceId);

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

    if (role !== "staff") {
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
        entryService.isVehicleServiceAdded(vin),
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

    let lineId = entryService.sumPriceBreakdownLength(entry);

    const { price, priceBreakdown, checkErr } =
      await entryService.getPriceForService(
        carDetails.serviceIds,
        entry.customerId,
        category,
        lineId,
        serviceDetails
      );

    if (checkErr.message) return badReqResponse(res, checkErr.message);

    const checkDealershipPrice = this.checkDealershipPrice(res, priceBreakdown);
    if (checkDealershipPrice) return;

    const updateCarDetailsResult = entryService.updateCarDetails(
      entry,
      carDetails,
      price,
      priceBreakdown,
      staffId,
      carExist,
      porterId,
      dateOfCreation
    );

    if (!updateCarDetailsResult)
      return forbiddenResponse(res, "Services has already been added");

    if (staffId && !entry.invoice.createdBy) entry.invoice.createdBy = staffId;

    const mongoSession = await mongoose.startSession();
    const resultsError = {};

    entryService.addLineId(entry);

    const results = await mongoTransactionUtils(mongoSession, async () => {
      if (staffId) {
        const [servicesWithoutEarningRateAndTotalEarnings] =
          await userService.getServicesWithoutEarningRateAndTotalEarnings(
            [...new Set(serviceIds)],
            staffId
          );

        if (!servicesWithoutEarningRateAndTotalEarnings) {
          resultsError.message = "We can't find staff with given ID";
          resultsError.code = 404;

          return resultsError;
        }

        const { servicesWithoutEarningRate, totalEarnings } =
          servicesWithoutEarningRateAndTotalEarnings;

        if (servicesWithoutEarningRate.length > 0) {
          resultsError.message = `You do not have a rate for the following services (${servicesWithoutEarningRate.join(
            ", "
          )})`;
          resultsError.code = 400;
          return resultsError;
        }

        const updatedStaffEarningByIncentives =
          await userService.updateStaffTotalEarningsBasedOnInCentives(
            mongoSession,
            staffId,
            req.user,
            totalEarnings,
            1,
            dateOfCreation
          );
        if (!updatedStaffEarningByIncentives)
          await userService.updateStaffTotalEarnings(
            req.user,
            mongoSession,
            totalEarnings,
            dateOfCreation
          );
      }

      const id = entry._id;

      // if (!entry.invoice.isAutoSentScheduled) {
      //   const token = await userServices.getToken();
      //   const delay = this.getDelay();
      //   const entryId = entry._id;

      //   const params = { token, delay, entryId };

      //   await axiosRequestUtils(params, "invoice");

      //   entry.invoice.isAutoSentScheduled = true;
      // }

      const updatedEntry = await entryService.updateEntryById(
        id,
        entry,
        mongoSession
      );
      if (staffId) {
        await userService.signInStaff(
          req.user.email,
          carDetails.geoLocation,
          mongoSession
        );
      }

      updatedEntry.id = updatedEntry._id;
    });
    if (resultsError.message)
      return jsonResponse(res, resultsError.code, false, resultsError.message);

    if (results) return jsonResponse(res, 500, false, "Something failed");

    delete carDetails.priceBreakdown;
    delete carDetails.price;

    res.send(successMessage(MESSAGES.UPDATED, carDetails));
  };

  checkDealershipPrice(res, priceBreakdown) {
    if (priceBreakdown.length < 1) return serverErrResponse(res);

    const servicesWithoutDealershipPrice = priceBreakdown.filter(
      (price) => !price.dealership
    );
    if (servicesWithoutDealershipPrice.length > 0) {
      const serviceNames = servicesWithoutDealershipPrice.map(
        (service) => service.serviceName
      );

      return notFoundResponse(
        res,
        `There is no dealership price for these services: (${serviceNames.join(
          ", "
        )})`
      );
    }
  }

  getDelay() {
    const currentDate = new Date();

    // Set the next 24 hours to 11:59 PM CST
    const next24Hours = new Date();
    next24Hours.setHours(23, 59, 0, 0); // Set hours to 23 (11 PM), minutes to 59, seconds to 0, and milliseconds to 0

    const delay = next24Hours.getTime() - currentDate.getTime();

    return delay;
  }

  async addCarGeoLocation(req, res) {
    let { vin, locationType } = req.params;

    if (vin && typeof vin === "string") vin = vin.toUpperCase();

    req.body.geoLocation.locationType = locationType;

    const { geoLocation } = req.body;

    const pickupLocationType = ["PickupFromDealership", "TakenToShop"].includes(
      locationType
    );

    geoLocation.timestamp = new Date();

    const entry = pickupLocationType
      ? await entryService.getEntryByVin(vin, true, true)
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
        if (req.user.role === "porter") {
          await userService.signInStaff(
            req.user.email,
            geoLocation,
            mongoSession
          );
        }

        const id = entry._id;
        await entryService.updateEntryById(id, entry, mongoSession);
      });
      if (results) return jsonResponse(res, 500, false, "Something failed");

      return res.send(successMessage(MESSAGES.UPDATED, carWithoutPrice));
    }

    if (locationType === "TakenToShop") {
      const activeStaffQueue =
        await userService.fetchIdsOfStaffsWhoCanTakeAppointments();
      // const numberOfStaffInQueue = activeStaffQueue.length;
      // const numberOfServices = carWithVin.serviceIds.length;
      const concernedStaffIds = activeStaffQueue;

      const body = {
        title: NOTIFICATIONS.TITLES.TAKEN_TO_SHOP,
        concernedStaffIds,
        type: locationType,
        carId: carWithVin._id,
      };

      await notificationService.createNotification(body);
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
    if (customerId && req.user.role !== "customer") {
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

    const porter = await userService.getUserById(porterId);
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

    const vin = carWithCurrentLocation.carDetails.vin;
    const entry = await entryService.getRecentEntryWithVin(vin);
    const { carWithVin } = entryService.getCarByVin({ entry, vin });
    const currentLocations = carWithVin.geoLocations;

    const locationTypeToCheck =
      locationType === "PickupFromDealership"
        ? "TakenToShop"
        : "DropOffCompleted";

    const locationErrorMessage = entryService.checkLocationType(
      locationType,
      currentLocations,
      locationTypeToCheck
    );

    if (locationErrorMessage)
      return jsonResponse(res, 404, false, locationErrorMessage);

    const { carDetails } = carWithCurrentLocation;

    res.send(successMessage(MESSAGES.FETCHED, carDetails));
  }

  async getDrivingSpeedForPorter(req, res) {
    const entries = await entryService.getDrivingSpeedForPorter();

    res.send(successMessage(MESSAGES.FETCHED, entries));
  }

  async getAllAppointmentEntriesPerCustomerId(req, res) {
    req.params.isFromAppointment = true;

    const filterArguments = getFilterArguments(req);

    const entries = await entryService.getCarsDoneByStaff(...filterArguments);

    res.send(successMessage(MESSAGES.FETCHED, entries));
  }

  async getCarThatIsStillInShopByVin(req, res) {
    let { vin } = req.params;
    if (vin && typeof vin === "string") vin = vin.toUpperCase();

    const [entryWithVin, [carThatIsStillInShop]] = await Promise.all([
      entryService.getEntryByVin(vin, undefined, true),
      entryServices.getCarThatIsStillInShopByVin(vin),
    ]);

    if (!entryWithVin)
      return jsonResponse(res, 404, false, "We can't find vehicle with vin");

    if (!carThatIsStillInShop)
      return jsonResponse(
        res,
        404,
        false,
        "The car is has been taken to the delership slot or has not been marked as has not been brought to shop "
      );

    const geoLocations = carThatIsStillInShop.vehicle[0].geoLocations;

    const takenToShopLocation = geoLocations.find(
      (location) => location.locationType === "TakenToShop"
    );

    const timeVehicleWasTakenToShop = takenToShopLocation.timestamp;

    const carWorkInProgressDuration = entryService.getDateDifference(
      timeVehicleWasTakenToShop
    );

    res.send(
      successMessage(MESSAGES.FETCHED, {
        vehicleDetails: carThatIsStillInShop,
        carWorkInProgressDuration,
      })
    );
  }

  async getAllVehiclesInTheShop(req, res) {
    const vehiclesIntheShop = await entryService.getAllVehiclesInTheShop();

    res.send(successMessage(MESSAGES.FETCHED, vehiclesIntheShop));
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
    const { monthName, year, date, staffId, porterId } = req.params;
    const filterArguments = getFilterArguments(req);
    const reqRole = req.user.role;

    const [user] = staffId
      ? await userService.getUserByRoleAndId(staffId, "staff")
      : await userService.getUserByRoleAndId(porterId, reqRole);

    if (!user) return res.status(404).send(errorMessage("user"));

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

  updateCarDoneByStaff = async (req, res) => {
    let { vin, carId } = req.params;
    let { serviceId, vin: reqBodyVin } = req.body;
    if (vin && typeof vin === "string") vin = vin.toUpperCase();
    if (reqBodyVin && typeof reqBodyVin === "string")
      reqBodyVin = reqBodyVin.toUpperCase();

    const staffId = req.user._id;
    const vinTocheck = vin ? vin : reqBodyVin;

    const [entry, service] = await Promise.all([
      entryService.getEntryByCarId(carId),
      serviceService.getServiceById(serviceId),
    ]);

    if (!entry) return res.status(404).send(errorMessage("entry"));
    if (!service) return res.status(404).send(errorMessage("service"));

    const { carIndex, carWithVin } = entryService.getCarByVin({
      entry,
      carId,
    });

    if (reqBodyVin && !carWithVin.vin) carWithVin.vin = reqBodyVin;

    if (carWithVin.vin !== vinTocheck)
      return badReqResponse(
        res,
        "The VIN provided is not linked to the vehicle you are currently scanning."
      );

    if (carWithVin)
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

    if (isCompleted || isServiceIdsEmpty) {
      if (req.params.vin && !waitingList)
        return jsonResponse(
          res,
          403,
          false,
          "This car has been marked as done"
        );

      return jsonResponse(res, 403, false, "This car has been marked as done");
    }

    const serviceDetails = carWithVin.serviceDetails
      ? carWithVin.serviceDetails
      : carWithVin.serviceIds.map((serviceId) => {
          return {
            serviceId,
          };
        });

    let lineId = entryService.sumPriceBreakdownLength(entry);

    const { priceBreakdown: newPriceBreakdown, checkErr } =
      entry.isFromAppointment && !entry.isFromDealership
        ? { priceBreakdown: [], checkErr: {} }
        : await entryService.getPriceForService(
            [serviceId],
            entry.customerId,
            carWithVin.category,
            lineId,
            serviceDetails
          );

    const priceBreakdown = carWithVin.priceBreakdown;
    const totalPriceBreakdown = [...priceBreakdown, ...newPriceBreakdown];

    if (entry.isFromDealership) {
      const checkDealershipPrice = this.checkDealershipPrice(
        res,
        newPriceBreakdown
      );
      if (checkDealershipPrice) return;

      carWithVin.price =
        entryService.calculateServicePriceDoneforCar(totalPriceBreakdown);

      const totalPrice = entryService.getTotalprice(entry.invoice);
      entry.invoice.totalPrice = totalPrice;
    }

    //if (checkErr.message) return badReqResponse(res, checkErr.message);

    carWithVin.priceBreakdown = totalPriceBreakdown;

    const updatedCarWithVIn = await entryService.updateServicesDoneOnCar(
      carWithVin,
      serviceId,
      staffId
    );

    if (!entry.invoice.createdBy) entry.invoice.createdBy = staffId;

    entry.invoice.carDetails[carIndex] = updatedCarWithVIn;

    if (!carWithVin.entryDate) carWithVin.entryDate = new Date();

    const mongoSession = await mongoose.startSession();

    const resultsError = {};

    const results = await mongoTransactionUtils(mongoSession, async () => {
      const [servicesWithoutEarningRateAndTotalEarnings] =
        await userService.getServicesWithoutEarningRateAndTotalEarnings(
          [serviceId],
          staffId
        );

      if (!servicesWithoutEarningRateAndTotalEarnings) {
        resultsError.message = "We can't find staff with given ID";
        resultsError.code = 404;

        return resultsError;
      }

      const { servicesWithoutEarningRate, totalEarnings } =
        servicesWithoutEarningRateAndTotalEarnings;

      if (servicesWithoutEarningRate.length > 0) {
        resultsError.message = `You do not have a rate for the following services (${servicesWithoutEarningRate.join(
          ", "
        )})`;
        resultsError.code = 400;
        return resultsError;
      }

      const isTheCarWorkedOnByTheStaff =
        await entryService.getCarAddedByStaffOnPremise(staffId, vin, carId);

      const numberOfVehicleToAdd =
        isTheCarWorkedOnByTheStaff.length < 1 ? 1 : 0;

      const updatedStaffEarningByIncentives =
        await userService.updateStaffTotalEarningsBasedOnInCentives(
          mongoSession,
          staffId,
          req.user,
          totalEarnings,
          numberOfVehicleToAdd
        );

      if (!updatedStaffEarningByIncentives)
        await userService.updateStaffTotalEarnings(
          req.user,
          mongoSession,
          totalEarnings
        );

      const entryId = entry._id;

      if (updatedCarWithVIn.isCompleted) {
        const concernedStaffIds = [carWithVin.porterId];
        const vin = carWithVin.vin;
        const carId = carWithVin._id;

        const body = {
          title: NOTIFICATIONS.TITLES.VEHICLE_COMPLETED,
          concernedStaffIds,
          type: `Completed service`,
          carId,
        };

        await Promise.all([
          notificationService.createNotification(body, mongoSession),
          notificationService.removeNotificationForStaff(carId, mongoSession),
        ]);
      }

      const carDetails = entry.invoice.carDetails;
      const isAllServiceCompleted = carDetails.every((car) => car.isCompleted);

      if (isAllServiceCompleted) {
        const concernedStaffIds = [carWithVin.porterId];

        const body = {
          title: NOTIFICATIONS.TITLES.WAITING_LIST_COMPLETED,
          concernedStaffIds,
          type: `Completed waiting list`,
          entryId,
        };

        let invoice;
        if (entry.isFromAppointment && !entry.isFromDealership) {
          if (!entry.invoice.sent) {
            invoice = await invoiceControllers.createAndSendInvoice(
              entry,
              true
            );

            entry.invoice.sent = true;
            entry.isActive = false;
            entry.invoice.qbId = invoice.Id;
          } else {
            await invoiceControllers.sendInvoiceWithoutCreating(entry);
          }
        }
        // if (entry.invoice.sent) {
        //   await invoiceControllers.sendInvoiceWithoutCreating(entry);
        // }

        if (entry.isFromAppointment) {
          entryService.addLineId(entry);

          if (entry.invoice.sent && !invoice) {
            const { statusCode, message } =
              await invoiceControllers.updateInvoiceById(undefined, entry);

            if (message && statusCode) {
              resultsError.message = message;
              resultsError.code = statusCode;

              throw new Error(message);
            }
          }
        }

        await notificationService.createNotification(body, mongoSession);
      }

      // if (!entry.invoice.isAutoSentScheduled) {
      //   const delay = this.getDelay();
      //   const token = await userServices.getToken();
      //   const params = { token, delay, entryId };

      //   const response = await axiosRequestUtils(params, "invoice");

      //   entry.invoice.isAutoSentScheduled = true;
      // }

      await entryService.updateEntryById(entryId, entry, mongoSession);
    });
    if (resultsError.message)
      return jsonResponse(res, resultsError.code, false, resultsError.message);

    if (results) return jsonResponse(res, 500, false, "Something failed");

    carWithVin.price = undefined;
    carWithVin.priceBreakdown = undefined;

    return res.send(successMessage(MESSAGES.UPDATED, carWithVin));
  };

  async getCarByVin(req, res) {
    let { vin } = req.params;
    if (vin && typeof vin === "string") vin = vin.toUpperCase();

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
  modifyCarDetails = async (req, res) => {
    let { vin, id } = req.params;
    if (vin && typeof vin === "string") vin = vin.toUpperCase();
    const dateOfCreation = new Date();
    let staff;

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

    if (req.body.serviceIds) {
      if (entry.isFromAppointment)
        return badReqResponse(
          res,
          "You are not allowed to modify the service for appointment entry"
        );

      const serviceDetails = req.body.serviceIds.map((serviceId) => {
        return { serviceId };
      });

      const { price, priceBreakdown, checkErr } =
        await entryService.getPriceForService(
          req.body.serviceIds,
          entry.customerId,
          req.body.category,
          undefined,
          serviceDetails
        );

      if (carDoneByStaff.servicesDone.length > 0) {
        const { code, message, totalEarnings } =
          await userService.getTotalEarningRatesForStaff(
            req.body.serviceIds,
            req.user._id
          );

        if (message) return jsonResponse(res, code, false, message);

        if (req.user.role === "staff") {
          carDoneByStaff.servicesDone = req.body.serviceIds.map((serviceId) => {
            return {
              serviceId,
              staffId: req.user._id,
            };
          });

          staff = await userService.getUserById(req.user._id);
          if (!staff)
            return notFoundResponse(
              res,
              "We can't locate staff with the given ID"
            );

          if (
            staff.staffDetails &&
            staff.staffDetails.earningHistory &&
            staff.staffDetails.earningHistory.length > 0
          ) {
            const staffIndex = staff.staffDetails.earningHistory.findIndex(
              (hist) =>
                hist.timestamp.toString() ===
                carDoneByStaff.entryDate.toString()
            );

            if (staffIndex > -1) {
              const { amountEarned } =
                staff.staffDetails.earningHistory[staffIndex];

              staff.staffDetails.totalEarning =
                staff.staffDetails.totalEarning - amountEarned;

              staff.staffDetails.totalEarning =
                staff.staffDetails.totalEarning + totalEarnings;

              staff.staffDetails.earningHistory[staffIndex] = {
                timestamp: dateOfCreation,
                amountEarned: totalEarnings,
              };
            }
          }
        }
      }

      const checkDealershipPrice = this.checkDealershipPrice(
        res,
        priceBreakdown
      );
      if (checkDealershipPrice) return;

      carDoneByStaff.price = price;

      if (req.user.role === "staff")
        carDoneByStaff.priceBreakdown = priceBreakdown;

      entry.invoice.totalPrice = entryService.getTotalprice(entry.invoice);
    }

    carDoneByStaff.entryDate = dateOfCreation;

    entry.invoice.carDetails[carIndex] = carDoneByStaff;

    const mongoSession = await mongoose.startSession();

    const results = await mongoTransactionUtils(mongoSession, async () => {
      if (staff) {
        await userService.updateUserByIdFromMod(
          req.user._id,
          staff,
          mongoSession
        );
      }

      await entryService.updateEntryById(id, entry, mongoSession);
    });

    if (results) return jsonResponse(res, 500, false, "Something failed");

    const carWithoutPrice = _.cloneDeep(carDoneByStaff);
    delete carWithoutPrice.price;
    delete carWithoutPrice.priceBreakdown;

    res.send(successMessage(MESSAGES.UPDATED, carWithoutPrice));
  };

  async modifyPrice(req, res) {
    let { serviceId, price, vin, carId } = req.body;
    if (vin && typeof vin === "string") vin = vin.toUpperCase();

    if ([serviceId, price, carId].includes(undefined) && !fromInvoice)
      return badReqResponse(
        res,
        "All of [serviceId, price, carId] are required"
      );

    const [[entry], service] = await Promise.all([
      entryService.getEntries({ entryId: req.params.id }),
      serviceService.getServiceById(serviceId),
    ]);
    if (!entry) return res.status(404).send(errorMessage("entry"));
    if (!service) return res.status(404).send(errorMessage("service"));

    const { carWithVin, carIndex } = entryService.getCarByVin({
      entry,
      carId,
    });
    if (!carWithVin || carIndex < 0) {
      const errorResponse = vin
        ? "Car with VIN number not found in invoice."
        : "Car with ID not found in invoice.";
      return notFoundResponse(res, errorResponse);
    }

    if (!carWithVin.priceBreakdown[0].lineId) {
      entryService.addLineId(entry);
    }

    const validServiceIds = entryService.getCompleteServiceIds(carWithVin);

    if (!validServiceIds.includes(serviceId)) {
      return badReqResponse(
        res,
        `Service with serviceId: ${serviceId} was not done for the car`
      );
    }

    if (!entryService.carWasAddedRecently(carWithVin) && !entry.invoice.sent) {
      return res.status(401).send({
        message:
          "Modifying car details is not allowed beyond 24 hours after adding.",
        succes: false,
      });
    }

    const servicePrice = entryService.modifyCarWithVinPrice(
      carWithVin,
      serviceId,
      price
    );

    if (entry.invoice.sent) {
      const { statusCode, message } =
        await invoiceControllers.updateInvoiceById(
          price,
          entry,
          servicePrice.lineId
        );

      if (statusCode) return jsonResponse(res, statusCode, false, message);
    }

    entry.invoice.carDetails[carIndex] = carWithVin;

    const totalPrice = entryService.getTotalprice(entry.invoice);
    entry.invoice.totalPrice = totalPrice;

    const updatedEntry = await entryService.updateEntryById(
      req.params.id,
      entry,
      undefined,
      true
    );

    return res.send(successMessage(MESSAGES.UPDATED, updatedEntry));
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
