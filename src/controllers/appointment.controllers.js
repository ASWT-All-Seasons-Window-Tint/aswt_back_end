const Queue = require("bull");
const appointmentService = require("../services/appointment.services");
const {
  errorMessage,
  successMessage,
  jsonResponse,
  SMS,
  badReqResponse,
  notFoundResponse,
  serverErrResponse,
} = require("../common/messages.common");
const { MESSAGES } = require("../common/constants.common");
const freeTimeSlotServices = require("../services/freeTimeSlot.services");
const freeTimeSlotControllers = require("./freeTimeSlot.controllers");
const sendTextMessage = require("../utils/sendTextMessage.utils");
const getSmsDateUtils = require("../utils/getSmsDate.utils");
const { VALID_TIME_SLOTS } =
  require("../common/constants.common").FREE_TIME_SLOTS;
const newDateUtils = require("../utils/newDate.utils");
const takenTimeslotsControllers = require("./takenTimeslots.controllers");
const takenTimeslotServices = require("../services/takenTimeslot.services");
const serviceServices = require("../services/service.services");
const { initiateRefund } = require("./stripe.controllers");
const initializeQbUtils = require("../utils/initializeQb.utils");
const customerService = require("../services/customer.service");
const mongoTransactionUtils = require("../utils/mongoTransaction.utils");
const generateRandomIntegerWithinARangeUtils = require("../utils/generateRandomIntegerWithinARange.utils");
const { default: mongoose } = require("mongoose");
const notificationServices = require("../services/notification.services");
const userServices = require("../services/user.services");
const entryServices = require("../services/entry.services");
const getDateAndTimeUtils = require("../utils/getDateAndTime.utils");
const stripeServices = require("../services/stripe.services");
const { updateCache } = require("../utils/getOrSetCache.utils");
const { carDetailsProperties } = require("../model/entry.model").joiValidator;

const redisConnection = { url: process.env.redisUrl };
const appointmentQueue = new Queue("reminders", redisConnection);

class AppointmentController {
  async getStatus(req, res) {
    res.status(200).send({ message: MESSAGES.DEFAULT, success: true });
  }

  //Create a new appointment
  createAppointment = async (req, res) => {
    const qbo = await initializeQbUtils();
    const {
      startTime,
      customerEmail,
      customerName,
      carDetails,
      appointmentType,
      residentialDetails,
    } = req.body;

    let timeOfCompletion = 7;
    let emailService = "measurement enquiry";
    let totalAmount;

    let customer = await customerService.createCustomerForRetailers(
      req.body,
      qbo
    );

    if (Array.isArray(customer)) customer = customer[0];

    if (!customer) return serverErrResponse(res);

    if (!customer.Active)
      customer = await customerService.createCustomerFromAppointmentDetails(
        qbo,
        req.body
      );

    if (Array.isArray(customer)) customer = customer[0];

    req.body.customerId = customer.Id;
    req.body.customerName = customer.DisplayName;

    const customers = await customerService.fetchAllCustomers(qbo);

    updateCache(`customers?Id=${customer.Id}`, 1800, customer);
    updateCache(`customers`, 1800, customers);

    if (appointmentType.toLowerCase() === "auto") {
      const { serviceDetails, category } = carDetails;

      for (const serviceDetail of serviceDetails)
        if (!serviceDetail.serviceId)
          return badReqResponse(res, "Service ID is required");

      if (serviceDetails.length < 1)
        return badReqResponse(res, "Service details array should not be empty");

      const { serviceIds, filmQualityIds } =
        appointmentService.getServiceIdsAndfilmQualityIds(serviceDetails); //Auto

      for (const serviceId of serviceIds)
        if (typeof serviceId !== "string")
          return badReqResponse(res, `${serviceId} is an invalid ID`);

      const [services, missingIds] = await Promise.all([
        serviceServices.getMultipleServices(serviceIds, true),
        serviceServices.validateServiceIds(serviceIds),
      ]); // Auto

      if (missingIds.length > 0)
        return jsonResponse(
          res,
          404,
          false,
          `Services with IDs: [${missingIds}] could not be found`
        ); // Auto

      timeOfCompletion =
        appointmentService.calculateTotalTimeOfCompletion(services); // Auto

      const { priceBreakdownArray, error, price } =
        await appointmentService.getPriceBreakdown({
          serviceDetails,
          categoryName: category,
          type: appointmentType.toLowerCase(),
        }); // Auto

      if (error.message) {
        if (error.code)
          return jsonResponse(res, error.code, false, error.message);

        return badReqResponse(res, error.message);
      }

      emailService = priceBreakdownArray.map((price) => price.serviceName);
      totalAmount = price;

      req.body.carDetails.priceBreakdown = priceBreakdownArray;
      req.body.carDetails.price = price;
      req.body.carDetails.category = carDetails.category;
      req.body.appointmentType = req.body.appointmentType.toLowerCase(); // Auto
    }

    if (appointmentType.toLowerCase() === "commercial") {
      const { priceBreakdownArray, error, price } =
        await appointmentService.getPriceBreakdown({
          residentialDetails,
          type: appointmentType.toLowerCase(),
        });

      if (error.message) {
        if (error.code)
          return jsonResponse(res, error.code, false, error.message);

        return badReqResponse(res, error.message);
      }

      if (residentialDetails.customerMeasurementAwareness)
        emailService = priceBreakdownArray.map((price) => price.serviceName);

      totalAmount = price;

      req.body.residentialDetails.priceBreakdown = priceBreakdownArray;
      req.body.residentialDetails.price = price;
      req.body.appointmentType = req.body.appointmentType.toLowerCase(); // Auto
    }

    let appointment;
    let appointmentDate;
    let appointmentLink;

    if (startTime) {
      const takenTimeSlotForStaff = await this.checkAndUpdateTakenTimeSlot(
        startTime,
        timeOfCompletion,
        res
      );
      if (!takenTimeSlotForStaff) return;

      const endTime = appointmentService.calculateEndTime(
        startTime,
        timeOfCompletion
      );
      req.body.endTime = endTime;

      const _id = new mongoose.Types.ObjectId();
      req.body._id = _id;

      const appointmentTime = new Date(startTime);
      const { date, time } = getDateAndTimeUtils(appointmentTime);
      appointmentDate = `${date} at ${time}`;

      const session = await stripeServices.createStripeSession(
        req.body,
        _id.toString()
      );

      appointment = await appointmentService.createAppointment({
        body: req.body,
        staffId: takenTimeSlotForStaff.staffId,
        sessionId: session.id,
      });

      appointmentLink = session.url;
    } else {
      appointment = await appointmentService.createAppointment({
        body: req.body,
      });
    }

    appointmentService.sendEmailQuotaion(
      customerEmail,
      customerName,
      appointment._id,
      emailService,
      appointmentType.toLowerCase(),
      totalAmount,
      appointmentDate,
      appointmentLink
    );

    if (startTime) appointment.paymentDetails.sessionId = undefined;

    res.send(successMessage(MESSAGES.CREATED, appointment));
  };

  checkAndUpdateTakenTimeSlot = async (startTime, timeOfCompletion, res) => {
    let { formattedDate: date, formattedTime: timeString } =
      freeTimeSlotServices.getFormattedDate(startTime);

    const takenTimeslotsDetails =
      await takenTimeslotsControllers.generateTakenTimeslots({
        date,
        res,
        timeOfCompletion,
      });

    if (takenTimeslotsDetails.statusCode) return;

    const validateTakenTimeslots = this.validateTakenTimeslots(
      res,
      takenTimeslotsDetails,
      timeString
    );
    if (validateTakenTimeslots) return;

    const freeStaffPerTime = takenTimeslotServices.getFreeStaffPerTime(
      takenTimeslotsDetails,
      timeString
    );

    const takenTimeSlotForStaff =
      takenTimeslotServices.getTakenTimeslotForStaff(freeStaffPerTime);

    const results = await takenTimeslotServices.updateTakenTimeslotsForStaff(
      takenTimeSlotForStaff,
      timeString,
      timeOfCompletion,
      date
    );

    if (results === false)
      return badReqResponse(
        res,
        "The time has already been taken, please select another available time"
      );

    return takenTimeSlotForStaff;
  };

  createAppointmentForDealership = async (req, res) => {
    const { qbId, address: customerAddress, email } = req.user.customerDetails;
    const { startTime, isSubscribed, carDetails } = req.body;
    const { serviceDetails } = carDetails;
    const isUserDealershipStaff = req.user.role === "dealershipStaff";

    if (carDetails.vin) {
      const [isVehicleServiceAdded] = await entryServices.isVehicleServiceAdded(
        carDetails.vin
      );
      if (isVehicleServiceAdded) return badReqResponse(res, "Duplicate entry");
    }

    const serviceIds = serviceDetails.map(
      (serviceDetail) => serviceDetail.serviceId
    );

    const [services] = await serviceServices.getTimeOfCompletionAndInvalids(
      serviceIds
    );

    if (!services)
      return notFoundResponse(
        res,
        `We can't find services for the provided serviceIds`
      );
    if (services.invalidIds.length > 0)
      return notFoundResponse(
        res,
        `Services with IDs: [${services.invalidIds}] could not be found`
      );

    const { timeOfCompletion } = services;

    const dealershipId = isUserDealershipStaff
      ? req.user.customerDetails.customerId
      : req.user._id;

    const { data: customer, error } =
      await customerService.getOrSetCustomerOnCache(qbId);

    if (error)
      return jsonResponse(res, 404, false, error.Fault.Error[0].Detail);

    const { customerEmail, customerName, customerNumber } =
      appointmentService.getCustomerDetails(customer);

    const startDate =
      takenTimeslotServices.getTakenTimeSlotDateString(startTime);
    const { formattedDate: date, formattedTime: timeString } =
      freeTimeSlotServices.getFormattedDate(startTime);

    const staffIds = await userServices.fetchStaffIdsAssignedToDealership(
      dealershipId
    );

    if (staffIds.length < 1)
      return badReqResponse(res, "There is no staff asssigned to the dealer");

    // const { errorCode, errorMessage, unavailableDatesInTheCalendar, staffIds } =
    // await takenTimeslotsControllers.generateTakenTimeslotsForDealership(
    //     dealershipId,
    //     startDate,
    //     startDate
    //   );

    // if (errorCode || errorMessage)
    //   return jsonResponse(res, errorCode, false, errorMessage);

    // if (unavailableDatesInTheCalendar.length > 0) {
    //   for (const unavailableDate of unavailableDatesInTheCalendar) {
    //     if (unavailableDate.isTaken) {
    //       return badReqResponse(
    //         res,
    //         "All assigned staffs are engaged for the specied date"
    //       );
    //     }
    //   }
    // }

    // const [availableStafsIdsForDealership] =
    //   await takenTimeslotServices.getAvailableStafsIdsForDealership(
    //     startDate,
    //     staffIds
    //   );

    let staffId;

    // if (
    //   !availableStafsIdsForDealership ||
    //   availableStafsIdsForDealership.availableStaffIds < 1
    // ) {
    //   const endOfRange = staffIds.length;
    //   const index = generateRandomIntegerWithinARangeUtils(endOfRange);
    //   concernedStaffIds = staffIds;

    //   staffId = staffIds[index];
    // } else {
    //   const { availableStaffIds } = availableStafsIdsForDealership;
    //   const endOfRange = availableStaffIds.length;
    //   const index = generateRandomIntegerWithinARangeUtils(endOfRange);
    //   concernedStaffIds = availableStaffIds;

    //   staffId = availableStaffIds[index];
    // }
    const appointmentBody = {
      appointmentType: "dealership",
      isSubscribed,
      isFromDealership: true,
      customerEmail: customerEmail === "N/A" ? email : customerEmail,
      customerName,
      customerName,
      customerNumber,
      customerId: qbId,
      startTime,
      customerAddress,
      carDetails,
    };

    let appointment;
    const mongoSession = await mongoose.startSession();
    const sessionErr = {};

    const results = await mongoTransactionUtils(mongoSession, async () => {
      const entry = await entryServices.createNewEntry(customer);

      const carDetail = {};
      for (const property of carDetailsProperties) {
        if (property === "serviceIds") {
          carDetail[property] = serviceIds;
        } else {
          carDetail[property] = carDetails[property];
        }
      }

      entry.invoice.carDetails = [carDetail];

      entry.numberOfCarsAdded = 1;
      entry.isFromAppointment = true;
      entry.isFromDealership = true;
      entry.invoice.totalPrice = 0;

      const updatedEntry = await entry.save({ session: mongoSession });

      const carId = updatedEntry.invoice.carDetails[0]._id;

      const timeslots = takenTimeslotServices.getTakenTimes(
        timeString,
        timeOfCompletion
      );
      const [availableDealershipStaffIds] =
        await takenTimeslotServices.getAvailableDealershipStaffIds(
          dealershipId,
          staffIds,
          date
        );

      const concernedStaffIds = !availableDealershipStaffIds
        ? staffIds
        : availableDealershipStaffIds.availableStaffIds;

      const availableTimeSlots =
        await takenTimeslotServices.getAvailabilityForEachStaff(
          timeslots,
          staffIds,
          dealershipId,
          date,
          timeOfCompletion
        );

      if (availableTimeSlots.length < 1) {
        staffId = this.getFreeStaffIdBasedOnTimeslots(staffIds);

        const unavailableDueToCloseOfBusiness =
          takenTimeslotServices.getUnvailableTimeDueToCloseOfBusiness(
            timeOfCompletion
          );

        if (unavailableDueToCloseOfBusiness.includes(timeString)) {
          sessionErr.error = true;
          badReqResponse(res, "The selected date is unavailable");
          throw new Error("The selected date is unavailable");
        }

        try {
          await takenTimeslotServices.createTakenTimeslot(
            staffId,
            date,
            timeslots,
            true
          );
        } catch (error) {
          if (error.code === 11000 && error.name === "MongoServerError") {
            console.log(error.name);

            const availableTimeSlots =
              await takenTimeslotServices.getAvailabilityForEachStaff(
                timeslots,
                staffIds,
                dealershipId,
                date,
                timeOfCompletion
              );

            await this.updateStaffTakenTime(
              availableTimeSlots,
              staffIds,
              sessionErr,
              staffId,
              res,
              date,
              timeslots,
              dealershipId,
              timeOfCompletion
            );
          } else {
            sessionErr.error = true;
            console.log(error);
            jsonResponse(res, 500, false, "Something failed");
            throw new Error("Something failed");
          }
        }
      } else {
        await this.updateStaffTakenTime(
          availableTimeSlots,
          staffIds,
          sessionErr,
          staffId,
          res,
          date,
          timeslots,
          dealershipId,
          timeOfCompletion
        );
      }

      appointment = await appointmentService.createAppointment({
        body: appointmentBody,
        staffId,
        session: mongoSession,
      });

      const body = {
        title: `Your Upcoming Appointment with ${customerName}`,
        concernedStaffIds,
        type: `Dealership appointment`,
        appointmentId: appointment._id,
        carId,
        entryId: entry._id,
      };

      await notificationServices.createNotification(body, mongoSession);
    });
    if (sessionErr.error) return;

    if (results) return jsonResponse(res, 500, false, "Something failed");

    res.send(successMessage(MESSAGES.CREATED, appointment));
  };

  updateStaffTakenTime = async (
    availableTimeSlots,
    staffIds,
    sessionErr,
    staffId,
    res,
    date,
    timeslots,
    dealershipId,
    timeOfCompletion
  ) => {
    if (availableTimeSlots.length < staffIds.length) {
      const takenStaffIds = availableTimeSlots.map((time) => time.staffId);
      const availableStaffIds = staffIds.filter(
        (staffId) => !takenStaffIds.includes(staffId)
      );

      staffId = this.getFreeStaffIdBasedOnTimeslots(availableStaffIds);

      try {
        await takenTimeslotServices.createTakenTimeslot(
          staffId,
          date,
          timeslots,
          true
        );
      } catch (error) {
        if (error.code === 11000 && error.name === "MongoServerError") {
          console.log(error.name);

          const availableTimeSlots =
            await takenTimeslotServices.getAvailabilityForEachStaff(
              timeslots,
              staffIds,
              dealershipId,
              date,
              timeOfCompletion
            );

          await this.updateStaffTakenTime(
            availableTimeSlots,
            staffIds,
            sessionErr,
            staffId,
            res,
            date,
            timeslots,
            dealershipId,
            timeOfCompletion
          );
        } else {
          sessionErr.error = true;
          console.log(error);
          jsonResponse(res, 500, false, "Something failed");
          throw new Error("Something failed");
        }
      }
    } else {
      const isDateUnavailable = availableTimeSlots.every(
        (availableTimeSlot) => !availableTimeSlot.isAvailable
      );

      if (isDateUnavailable) {
        sessionErr.error = true;
        badReqResponse(res, "The selected date is unavailable");
        throw new Error("The selected date is unavailable");
      }

      const availableStaffTimeslots = availableTimeSlots.filter(
        (availableTimeSlot) => availableTimeSlot.isAvailable
      );

      const availableStaffTimeslot = this.getFreeStaffIdBasedOnTimeslots(
        availableStaffTimeslots
      );
      const takenTimeslotId = availableStaffTimeslot._id;
      staffId = availableStaffTimeslot.staffId;

      await takenTimeslotServices.addTakenTimeslotsForStaff(
        takenTimeslotId,
        timeslots
      );
    }
  };

  getFreeStaffIdBasedOnTimeslots(staffIdsArray) {
    const endOfRange = staffIdsArray.length;
    const index = generateRandomIntegerWithinARangeUtils(endOfRange);

    return staffIdsArray[index];
  }

  async createCustomerFromAppointmentDetails(req, res) {
    const { appointmentId } = req.params;
    const appointment = await appointmentService.getAppointmentById(
      appointmentId
    );

    const customerReqBody = customerService.convertToDesiredFormat(appointment);
    const qbo = await initializeQbUtils();

    const customer = await customerService.createQuickBooksCustomer(
      qbo,
      customerReqBody
    );

    res.send(successMessage(MESSAGES.FETCHED, customer));
  }

  async updateFreeTimeSlots(timeString, startTimeInDecimal, date) {
    const freeTimeSlots =
      await freeTimeSlotServices.getFreeTimeSlotsBySlotAndDate({
        date,
        timeSlot: timeString,
      });

    const timeSlots = freeTimeSlots.timeSlots;
    const freeTimeSlotId = freeTimeSlots._id;
    const staffId = freeTimeSlots.staffId;

    const timeSlotsInDecimal =
      freeTimeSlotServices.convertTimeArrayToDecimal(timeSlots);
    const freeTimeSlotInDecimal =
      freeTimeSlotServices.updateFreeTimeSlotsInDecimal({
        timeSlotsInDecimal,
        startTimeInDecimal,
      });
    const updatedTimeSlots = freeTimeSlotServices.convertDecimalArrayToTime(
      freeTimeSlotInDecimal
    );

    freeTimeSlots.timeSlots = updatedTimeSlots;

    await freeTimeSlotServices.updateFreeTimeSlotById(
      freeTimeSlotId,
      freeTimeSlots
    );
    return staffId;
  }

  validateTakenTimeslots(res, takenTimeslotsDetails, timeString) {
    const { takenTimeslots } = takenTimeslotsDetails;

    if (takenTimeslots.includes(timeString))
      return jsonResponse(
        res,
        400,
        false,
        "The time you selected has already been taken"
      );
  }

  async getAvailableTimeSlots(req, res) {
    const { staffIds, startTime, endTime } = req.body;

    const overlappingAppointments =
      await appointmentService.getOverlappingAppointments({
        staffIds,
        startTime,
        endTime,
      });

    const allAppointments = await appointmentService.getAllAppointments({
      overlappingAppointments,
    });

    const availableTimeSlots = appointmentService.getAvailableTimeSlots({
      allAppointments,
      startTime,
      endTime,
    });

    res.send(successMessage(MESSAGES.FETCHED, availableTimeSlots));
  }

  //get appointment from the database, using their email
  async getAppointmentById(req, res) {
    const appointment = await appointmentService.getAppointmentById(
      req.params.id
    );
    if (!appointment) return res.status(404).send(errorMessage("appointment"));

    res.send(successMessage(MESSAGES.FETCHED, appointment));
  }

  async getAppointmentByEntryIdAndStaffId(req, res) {
    const { entryId, staffId } = req.body;

    const appointment =
      await appointmentService.getAppointmentByEntryIdAndStaffId(
        entryId,
        staffId
      );
    if (!appointment) return res.status(404).send(errorMessage("appointment"));

    res.send(successMessage(MESSAGES.FETCHED, appointment));
  }

  //get all appointments in the appointment collection/table
  async fetchAllAppointments(req, res) {
    const appointments = await appointmentService.fetchAllAppointments();

    res.send(successMessage(MESSAGES.FETCHED, appointments));
  }

  async getAppointmentsByDate(req, res) {
    const { date } = req.params;

    const appointments = await appointmentService.getAppointmentByDate({
      date,
    });

    res.send(successMessage(MESSAGES.FETCHED, appointments));
  }

  //Update/edit appointment data
  updateAppointment = async (req, res) => {
    const { startTime, serviceDetails } = req.body;
    const appointment = await appointmentService.getAppointmentById(
      req.params.id
    );
    if (!appointment) {
      return res.status(404).send(errorMessage("appointment"));
    }

    if (startTime) {
      if (!appointment.startTime)
        return badReqResponse(res, "There's no start time for this appoitment");

      const { serviceIds } = appointmentService.getServiceIdsAndfilmQualityIds(
        appointment.carDetails.serviceDetails
      );

      let services = await serviceServices.getMultipleServices(
        serviceIds,
        true
      );
      if (serviceDetails) {
        services = await serviceServices.getMultipleServices(
          appointment.carDetails.serviceIds,
          true
        );
      }

      const timeOfCompletion =
        appointmentService.calculateTotalTimeOfCompletion(services);

      const staffTakenTimeSlot =
        await takenTimeslotServices.retriveTakenTimeslots(
          appointment,
          timeOfCompletion
        );

      let { formattedDate: date, formattedTime: timeString } =
        freeTimeSlotServices.getFormattedDate(startTime);
      const takenTimeslotsDetails =
        await takenTimeslotsControllers.generateTakenTimeslots({
          date,
          res,
          timeOfCompletion,
        });

      if (takenTimeslotsDetails.statusCode) return;

      const validateTakenTimeslots = this.validateTakenTimeslots(
        res,
        takenTimeslotsDetails,
        timeString
      );
      if (validateTakenTimeslots) return;

      const freeStaffPerTime = takenTimeslotServices.getFreeStaffPerTime(
        takenTimeslotsDetails,
        timeString
      );

      const takenTimeSlotForStaff =
        takenTimeslotServices.getTakenTimeslotForStaff(freeStaffPerTime);

      if (staffTakenTimeSlot) await staffTakenTimeSlot.save();

      await takenTimeslotServices.updateTakenTimeslotsForStaff(
        takenTimeSlotForStaff,
        timeString,
        timeOfCompletion,
        date
      );
    }

    let updatedAppointment = req.body;
    updatedAppointment = await appointmentService.updateAppointmentById(
      req.params.id,
      updatedAppointment
    );

    res.send(successMessage(MESSAGES.UPDATED, updatedAppointment));
  };

  updateQuote = async (req, res) => {
    const { startTime } = req.body;
    const { appointmentId } = req.params;

    const appointment = await appointmentService.getAppointmentById(
      appointmentId
    );

    if (!appointment) return res.status(404).send(errorMessage("appointment"));

    let timeOfCompletion = 7;

    if (appointment.appointmentType === "auto") {
      const { serviceDetails } = appointment.carDetails;

      const { serviceIds } =
        appointmentService.getServiceIdsAndfilmQualityIds(serviceDetails);

      const services = await serviceServices.getMultipleServices(
        serviceIds,
        true
      );

      timeOfCompletion =
        appointmentService.calculateTotalTimeOfCompletion(services);
    }

    const endTime = appointmentService.calculateEndTime(
      startTime,
      timeOfCompletion
    );

    const takenTimeSlotForStaff = await this.checkAndUpdateTakenTimeSlot(
      startTime,
      timeOfCompletion,
      res
    );

    if (!takenTimeSlotForStaff) return;

    appointment.staffId = takenTimeSlotForStaff.staffId;
    appointment.startTime = startTime;
    appointment.endTime = endTime;

    const updatedAppointment = await appointment.save();

    res.send(successMessage(MESSAGES.UPDATED, updatedAppointment));
  };

  //Delete appointment account entirely from the database
  cancelAppointment = async (req, res) => {
    const appointmentId = req.params.id;
    const appointment = await appointmentService.getAppointmentById(
      appointmentId
    );

    if (!appointment) {
      return res.status(404).send(errorMessage("appointment"));
    }

    const paymentIntentId = appointment.paymentDetails.paymentIntentId;

    if (!paymentIntentId)
      return badReqResponse(
        res,
        "Can't refund client as payment has not been made"
      );

    const isCustomerRefunded = appointment.refundDetails.refunded;

    if (isCustomerRefunded)
      return badReqResponse(res, "Customer has already been refunded.");

    const { error, refund } = await initiateRefund(appointment);
    if (error) {
      if (error.type === "StripeInvalidRequestError")
        return jsonResponse(res, error.raw.statusCode, false, error.raw.code);

      console.log(error);

      return jsonResponse(res, 500, false, "Something failed");
    }

    await this.retrieveTimeSlot(appointment);

    res.send(successMessage(MESSAGES.UPDATED, refund));
  };

  async retrieveTimeSlot(appointment) {
    const { appointmentType } = appointment;

    let timeOfCompletion = 7;

    if (appointmentType === "auto") {
      const { serviceIds } = appointmentService.getServiceIdsAndfilmQualityIds(
        appointment.carDetails.serviceDetails
      );

      const services = await serviceServices.getMultipleServices(
        serviceIds,
        true
      );

      timeOfCompletion =
        appointmentService.calculateTotalTimeOfCompletion(services);
    }

    const staffTakenTimeSlot =
      await takenTimeslotServices.retriveTakenTimeslots(
        appointment,
        timeOfCompletion
      );

    staffTakenTimeSlot.save();

    return staffTakenTimeSlot;
  }

  async getFreeTimeSlotsByDateAndStaffId(appointment) {
    const { staffId, startTime } = appointment;

    const { formattedDate, formattedTime } =
      freeTimeSlotServices.getFormattedDate(startTime);

    const freeTimeSlots =
      await freeTimeSlotServices.fetchFreeTimeSlotsByDateAndStaffId({
        staffId,
        date: formattedDate,
      });

    return { freeTimeSlots, formattedTime, formattedDate };
  }

  async getAppointment(req, res) {
    const appointment = await appointmentService.getAppointmentById(
      req.params.id
    );

    if (!appointment) {
      return res.status(404).send(errorMessage("appointment"));
    }

    return appointment;
  }

  async retriveFreeTimeSlots(freeTimeSlots, formattedTime) {
    const startTimeInDecimal = freeTimeSlotServices.convertTimetoDecimal({
      timeString: formattedTime,
    });

    const timeSlotsInDecimal =
      freeTimeSlotServices.convertTimeArrayToDecimal(VALID_TIME_SLOTS);

    const retrievedTimeSlotsInDecimal =
      freeTimeSlotServices.reverseUpdateFreeTimeSlots(
        startTimeInDecimal,
        timeSlotsInDecimal
      );

    const retrievedTimeSlot = freeTimeSlotServices.convertDecimalArrayToTime(
      retrievedTimeSlotsInDecimal
    );
    const curentFreeTimeSlots = freeTimeSlots.timeSlots;

    const updatedTimeSlots = [
      ...new Set(
        [...retrievedTimeSlot, ...curentFreeTimeSlots].sort((a, b) => a - b)
      ),
    ];

    return updatedTimeSlots;
  }
  getDelay(startTime) {
    const currentDate = newDateUtils();
    const appointmentTime = new Date(startTime);

    //   date.setMinutes(date.getMinutes() + 1);

    const oneHour = 60 * 60 * 1000;

    const delay = appointmentTime.getTime() - currentDate.getTime() - oneHour;

    return delay > 0 ? delay : delay + oneHour;
  }

  exportQueue() {
    return appointmentQueue;
  }
}

module.exports = new AppointmentController();
