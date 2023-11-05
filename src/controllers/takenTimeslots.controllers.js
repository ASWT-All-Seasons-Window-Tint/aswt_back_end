const { jsonResponse, successMessage } = require("../common/messages.common");
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

  getTakenTimeSlots = async (req, res) => {
    const { date, serviceIds } = req.body;

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
      appointmentServices.calculateTotalTimeOfCompletion(services);

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

  findStaffsWithoutGivenTime(data, givenTime) {
    const staffWithoutGivenTime = data.filter(
      (staff) => !staff.timeslots.includes(givenTime)
    );
    return staffWithoutGivenTime;
  }

  async updateTakenTimeslots() {}

  async getClearedOutDates(req, res) {
    const clearedOutDates = await takenTimeslotsServices.getClearOutDates();

    return res.send(successMessage(MESSAGES.FETCHED, clearedOutDates));
  }
}

module.exports = new TakenTimeslotControllers();
