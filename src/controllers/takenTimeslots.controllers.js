const {
  jsonResponse,
  successMessage,
  badReqResponse,
  notFoundResponse,
} = require("../common/messages.common");
const takenTimeslotsServices = require("../services/takenTimeslot.services");
const userService = require("../services/user.services");
const { MESSAGES } = require("../common/constants.common");
const { VALID_TIME_SLOTS } =
  require("../common/constants.common").FREE_TIME_SLOTS;
const freeTimeSlotServices = require("../services/freeTimeSlot.services");
const serviceServices = require("../services/service.services");
const appointmentServices = require("../services/appointment.services");
const { TakenTimeslot } = require("../model/takenTimeslot.model");

class TakenTimeslotControllers {
  async clearOutAppointment(req, res) {
    const { date } = req.body;

    const takenTimeslot = await takenTimeslotsServices.getTakenTimeSlotsByDate({
      date,
    });

    if (takenTimeslot.length < 1) {
      const newTakenTimeslot = new TakenTimeslot({
        clearedOut: true,
        date,
      });

      await newTakenTimeslot.save();

      return res.send(successMessage("Successfully cleared out date", null));
    }

    const { err, nModified } = await takenTimeslotsServices.clearOutAppointment(
      date
    );

    if (err) return jsonResponse(res, 500, false, "Something Failed");

    return res.send(successMessage("Successfully cleared out date", null));
  }

  async getAllTakenTimeSlots(req, res) {
    const takenTimeslots = await takenTimeslotsServices.test();

    return res.send(successMessage(MESSAGES.FETCHED, takenTimeslots));
  }

  getTakenTimeSlots = async (req, res) => {
    const { date, serviceIds, appointmentType } = req.body;
    let timeOfCompletion = 7;

    if (appointmentType !== "commercial") {
      if (!serviceIds) return badReqResponse(res, "serviceIds is required");

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

      timeOfCompletion =
        appointmentServices.calculateTotalTimeOfCompletion(services);
    }

    const takenTimeslotsForAllStaffs = await this.generateTakenTimeslots({
      res,
      date,
      timeOfCompletion,
    });

    if (takenTimeslotsForAllStaffs.statusCode) return;

    return res.send(
      successMessage(MESSAGES.FETCHED, takenTimeslotsForAllStaffs)
    );
  };

  async generateTakenTimeslots({ res, date, timeOfCompletion }) {
    const staffIds = await userService.fetchIdsOfStaffsWhoCanTakeAppointments();
    const { formattedDate } = freeTimeSlotServices.getFormattedDate(date);

    let takenTimeslots = await takenTimeslotsServices.getTakenTimeSlotsByDate({
      date: formattedDate,
    });

    for (const timeslot of takenTimeslots) {
      if (timeslot.clearedOut)
        return jsonResponse(
          res,
          400,
          false,
          "No free time slot for the specified date"
        );
    }

    if (takenTimeslots.length < 1) {
      const freeTimeSlots = takenTimeslotsServices.noTakenTimslot(
        staffIds,
        timeOfCompletion
      );
      return freeTimeSlots;
    }

    const availableStaffIds = takenTimeslotsServices.filterAvailableStaffIds(
      takenTimeslots,
      staffIds
    );

    if (availableStaffIds.length > 0) {
      const freeTimeSlots = takenTimeslotsServices.noTakenTimslot(
        availableStaffIds,
        timeOfCompletion
      );
      return freeTimeSlots;
    }

    const takenTimeslotsForAllStaffs =
      takenTimeslotsServices.getTakenTimeslotsForAllStaffs(
        takenTimeslots,
        timeOfCompletion
      );

    const isDateFilledUp = takenTimeslotsServices.arraysAreEqual(
      VALID_TIME_SLOTS(),
      takenTimeslotsForAllStaffs.takenTimeslots
    );

    if (isDateFilledUp)
      return jsonResponse(
        res,
        400,
        false,
        "No free time slot for the specified date"
      );

    return takenTimeslotsForAllStaffs;
  }

  async getUnavailableDatesInTheCalendar(req, res) {
    const { startDate, endDate } = req.params;
    const { serviceIds, appointmentType } = req.body;

    let timeOfCompletion = 7;
    const numberOfStaffsAvailableForAppointment =
      await userService.countStaffsWhoCanTakeAppointments();

    if (appointmentType === "auto") {
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

      timeOfCompletion =
        appointmentServices.calculateTotalTimeOfCompletion(services);
    }

    const unavailableDatesInTheCalendar =
      await takenTimeslotsServices.getUnavailableDatesInTheCalendar(
        startDate,
        endDate,
        timeOfCompletion,
        numberOfStaffsAvailableForAppointment
      );

    return res.send(
      successMessage(MESSAGES.FETCHED, unavailableDatesInTheCalendar)
    );
  }
  getUnavailableDatesInTheCalendarForDealership = async (req, res) => {
    const { startDate, endDate } = req.params;
    const { _id: customerId } = req.user;

    const { unavailableDatesInTheCalendar, errorCode, errorMessage } =
      await this.generateTakenTimeslotsForDealership(
        customerId,
        startDate,
        endDate
      );

    if (errorCode || errorMessage)
      return jsonResponse(res, errorCode, false, errorMessage);

    return res.send(
      successMessage(MESSAGES.FETCHED, unavailableDatesInTheCalendar)
    );
  };

  async generateTakenTimeslotsForDealership(customerId, startDate, endDate) {
    const results = {};

    const staffIds = await userService.fetchStaffIdsAssignedToDealership(
      customerId
    );

    if (staffIds.length < 1) {
      results.errorMessage = "No staff is assigned to the dealer";
      results.errorCode = 404;

      return results;
    }

    const unavailableDatesInTheCalendar =
      await takenTimeslotsServices.getUnavailableDatesInTheCalendarForADealer(
        staffIds,
        startDate,
        endDate,
        customerId
      );

    results.unavailableDatesInTheCalendar = unavailableDatesInTheCalendar;
    results.staffIds = staffIds;

    return results;
  }

  async getUnavailableDatesInTheCalendarForStaff(req, res) {
    const { startDate, endDate, staffId } = req.params;
    const { _id: customerId } = req.user;

    const staffCount = await userService.isDealerAssignedToStaff(
      customerId,
      staffId
    );

    if (staffCount < 1)
      return notFoundResponse(res, "This staff is not assigned to the dealer");

    const unavailableDatesInTheCalendar =
      await takenTimeslotsServices.getUnavailableDatesInTheCalendarForAStaff(
        staffId,
        startDate,
        endDate,
        customerId
      );

    return res.send(
      successMessage(MESSAGES.FETCHED, unavailableDatesInTheCalendar)
    );
  }

  findStaffsWithoutGivenTime(data, givenTime) {
    const staffWithoutGivenTime = data.filter(
      (staff) => !staff.timeslots.includes(givenTime)
    );
    return staffWithoutGivenTime;
  }

  async staffBlockOutsADate(req, res) {
    const { dealershipId } = req.body;
    const { date } = req.params;
    const { _id: staffId } = req.user;

    const takenTimeslotDate =
      takenTimeslotsServices.getTakenTimeSlotDateString(date);

    const staffCount = await userService.isDealerAssignedToStaff(
      dealershipId,
      staffId
    );

    if (staffCount < 1)
      return notFoundResponse(res, "This staff is not assigned to the dealer");

    const takenTimeslot =
      await takenTimeslotsServices.getTakenTimeSlotsByDateAndStaffId({
        date: takenTimeslotDate,
        staffId,
        clearOutForDealershipId: dealershipId,
      });

    if (takenTimeslot)
      return badReqResponse(
        res,
        "You have either blockedout the date or there is appointment with this date"
      );

    const blockedDate = await takenTimeslotsServices.staffBlockOutsADate(
      staffId,
      dealershipId,
      date
    );

    res.send(successMessage("Date is successfully blocked out", blockedDate));
  }

  async getClearedOutDates(req, res) {
    const clearedOutDates = await takenTimeslotsServices.getClearOutDates();

    return res.send(successMessage(MESSAGES.FETCHED, clearedOutDates));
  }
}

module.exports = new TakenTimeslotControllers();
