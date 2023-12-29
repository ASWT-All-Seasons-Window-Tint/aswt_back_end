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

    if (staffIds.length < 1)
      return jsonResponse(
        res,
        400,
        false,
        "No staff is available to take an appointment"
      );

    let takenTimeslots = await takenTimeslotsServices.getTakenTimeSlotsByDate({
      date: formattedDate,
    });

    for (const timeslot of takenTimeslots) {
      if (timeslot.clearedOut && !timeslot.forDealership)
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
    const { serviceIds } = req.body;
    const isUserDealershipStaff = req.user.role === "dealershipStaff";

    const customerId = isUserDealershipStaff
      ? req.user.customerDetails.customerId
      : req.user._id;

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
        res`Services with IDs: [${services.invalidIds}] could not be found`
      );

    const { timeOfCompletion } = services;

    const staffIds = await userService.fetchStaffIdsAssignedToDealership(
      customerId
    );

    if (staffIds.length < 1)
      return notFoundResponse(res, "No staff is assigned to the dealer");

    const unavailableDatesInTheCalendar =
      await takenTimeslotsServices.getDealershipUnavailableDatesInTheCalendar(
        startDate,
        endDate,
        timeOfCompletion,
        staffIds,
        customerId
      );

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

  async getTakenTimeslotForDealerAndStaff(req, res) {
    const { dealershipId, staffId } = req.params;

    const takenTimeslots =
      await takenTimeslotsServices.getTakenTimeslotForDealerAndStaff(
        dealershipId,
        staffId
      );
    const takenTimes = takenTimeslots.map((takenTime) => {
      if (takenTime.blockedOutDate) {
        takenTime.date = takenTime.blockedOutDate;

        takenTime.blockedOutDate = undefined;
      }

      return takenTime;
    });

    return res.send(successMessage(MESSAGES.FETCHED, takenTimes));
  }

  async getUnavailableDatesInTheCalendarForStaff(req, res) {
    const { startDate, endDate, staffId } = req.params;
    const isUserDealershipStaff = req.user.role === "dealershipStaff";

    const customerId = isUserDealershipStaff
      ? req.user.customerDetails.customerId
      : req.user._id;

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
    let { date } = req.params;
    const { _id: staffId } = req.user;

    date = takenTimeslotsServices.formatDate(date);

    const takenTimeslotDate =
      takenTimeslotsServices.getTakenTimeSlotDateString(date);

    const staffCount = await userService.isDealerAssignedToStaff(
      dealershipId,
      staffId
    );

    if (staffCount < 1)
      return notFoundResponse(res, "This staff is not assigned to the dealer");

    const takenTimeslot =
      await takenTimeslotsServices.getTakenTimeSlotsByDateAndStaffId2({
        date: takenTimeslotDate,
        staffId,
        clearOutForDealershipId: dealershipId,
      });

    if (takenTimeslot)
      return badReqResponse(
        res,
        "The date is already blockedout for the dealer"
      );

    // const doesDateExistForStaff =
    //   await takenTimeslotsServices.getTakenTimeSlotByDateAndStaffId({
    //     staffId,
    //     date,
    //   });

    // if (doesDateExistForStaff) {
    //   doesDateExistForStaff.forDealership = true;
    //   doesDateExistForStaff.clearOutForDealershipId = dealershipId;

    //   await doesDateExistForStaff.save();

    //   return res.send(
    //     successMessage(
    //       "Date is successfully blocked out",
    //       doesDateExistForStaff
    //     )
    //   );
    // }

    const blockedDate = await takenTimeslotsServices.staffBlockOutsADate(
      staffId,
      dealershipId,
      date
    );

    blockedDate.date = date;
    blockedDate.blockedOutDate = undefined;

    res.send(successMessage("Date is successfully blocked out", blockedDate));
  }

  async getClearedOutDates(req, res) {
    const clearedOutDates = await takenTimeslotsServices.getClearOutDates();

    return res.send(successMessage(MESSAGES.FETCHED, clearedOutDates));
  }
}

module.exports = new TakenTimeslotControllers();
