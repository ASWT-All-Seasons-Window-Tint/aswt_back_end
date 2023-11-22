const Queue = require("bull");
const appointmentService = require("../services/appointment.services");
const {
  errorMessage,
  successMessage,
  jsonResponse,
  SMS,
  badReqResponse,
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

const redisConnection = { url: process.env.redisUrl };
const appointmentQueue = new Queue("reminders", redisConnection);

class AppointmentController {
  async getStatus(req, res) {
    res.status(200).send({ message: MESSAGES.DEFAULT, success: true });
  }

  //Create a new appointment
  createAppointment = async (req, res) => {
    const {
      startTime,
      customerEmail,
      customerName,
      carDetails,
      appointmentType,
      residentialDetails,
    } = req.body;

    let timeOfCompletion = 8;
    let emailService = "measurement enquiry";
    let totalAmount;

    if (appointmentType.toLowerCase() === "auto") {
      const { serviceDetails, category } = carDetails;

      const { serviceIds, filmQualityIds } =
        appointmentService.getServiceIdsAndfilmQualityIds(serviceDetails); //Auto

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

      appointment = await appointmentService.createAppointment({
        body: req.body,
        staffId: takenTimeSlotForStaff.staffId,
      });
    }

    appointment = await appointmentService.createAppointment({
      body: req.body,
    });

    appointmentService.sendEmailQuotaion(
      customerEmail,
      customerName,
      appointment._id,
      emailService,
      appointmentType.toLowerCase(),
      totalAmount
    );

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

    await takenTimeslotServices.updateTakenTimeslotsForStaff(
      takenTimeSlotForStaff,
      timeString,
      timeOfCompletion,
      date
    );
    return takenTimeSlotForStaff;
  };

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

    let timeOfCompletion = 8;

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

    let timeOfCompletion = 8;

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
