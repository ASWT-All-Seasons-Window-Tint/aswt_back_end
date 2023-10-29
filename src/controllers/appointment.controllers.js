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

const redisConnection = { url: process.env.redisUrl };
const appointmentQueue = new Queue("reminders", redisConnection);

class AppointmentController {
  async getStatus(req, res) {
    res.status(200).send({ message: MESSAGES.DEFAULT, success: true });
  }

  //Create a new appointment
  createAppointment = async (req, res) => {
    const { startTime, customerNumber, carDetails } = req.body;
    let { formattedDate: date, formattedTime: timeString } =
      freeTimeSlotServices.getFormattedDate(startTime);

    const { serviceDetails, category } = carDetails;

    const { serviceIds, filmQualityIds } =
      appointmentService.getServiceIdsAndfilmQualityIds(serviceDetails);

    const smsDate = getSmsDateUtils(startTime);

    const [services, missingIds] = await Promise.all([
      serviceServices.getMultipleServices(serviceIds, true),
      serviceServices.validateServiceIds(serviceIds),
    ]);

    if (missingIds.length > 0)
      return jsonResponse(
        res,
        404,
        false,
        `Services with IDs: [${missingIds}] could not be found`
      );

    const timeOfCompletion =
      appointmentService.calculateTotalTimeOfCompletion(services);

    const { priceBreakdownArray, error, price } =
      await appointmentService.getPriceBreakdown({
        serviceDetails,
        categoryName: category,
      });

    if (error.message) return badReqResponse(res, error.message);

    req.body.carDetails.priceBreakdown = priceBreakdownArray;
    req.body.carDetails.price = price;
    req.body.carDetails.category = carDetails.category;
    req.body.appointmentType = req.body.appointmentType.toLowerCase();

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

    const endTime = appointmentService.calculateEndTime(
      startTime,
      timeOfCompletion
    );
    req.body.endTime = endTime;

    const appointment = await appointmentService.createAppointment({
      body: req.body,
      staffId: takenTimeSlotForStaff.staffId,
    });

    // const delay = this.getDelay(startTime);
    // const { nowBody, reminderBody } = SMS;

    // sendTextMessage(customerNumber, nowBody(smsDate));

    // appointmentQueue.add(
    //   {
    //     customerNumber,
    //     body: reminderBody(smsDate),
    //   },
    //   {
    //     delay,
    //   }
    // );

    res.send(successMessage(MESSAGES.CREATED, appointment));
  };

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

  //Delete appointment account entirely from the database
  cancelAppointment = async (req, res) => {
    const appointmentId = req.params.id;
    const appointment = await appointmentService.getAppointmentById(
      appointmentId
    );

    if (!appointment) {
      return res.status(404).send(errorMessage("appointment"));
    }

    const staffTakenTimeSlot =
      await takenTimeslotServices.retriveTakenTimeslots(appointment);

    const { error, refund } = await initiateRefund(appointment);
    if (error) {
      if (error.type === "StripeInvalidRequestError")
        return jsonResponse(res, error.raw.statusCode, false, error.raw.code);
    }

    await staffTakenTimeSlot.save();

    res.send(successMessage(MESSAGES.UPDATED, refund));
  };

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
