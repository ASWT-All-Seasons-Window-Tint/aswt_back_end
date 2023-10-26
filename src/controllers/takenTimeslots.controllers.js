const { jsonResponse, successMessage } = require("../common/messages.common");
const takenTimeslotsServices = require("../services/takenTimeslot.services");
const userService = require("../services/user.services");
const { MESSAGES } = require("../common/constants.common");
const { VALID_TIME_SLOTS } =
  require("../common/constants.common").FREE_TIME_SLOTS;
const freeTimeSlotServices = require("../services/freeTimeSlot.services");
const serviceServices = require("../services/service.services");
const appointmentServices = require("../services/appointment.services");

class TakenTimeslotControllers {
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

    if (takenTimeslots.length < 1) {
      const freeTimeSlots = takenTimeslotsServices.noTakenTimslot(staffIds);
      return freeTimeSlots;
    }

    const availableStaffIds = takenTimeslotsServices.filterAvailableStaffIds(
      takenTimeslots,
      staffIds
    );

    if (takenTimeslots[0].clearedOut)
      return jsonResponse(
        res,
        400,
        false,
        "No free time slot for the specified date"
      );

    if (availableStaffIds.length > 0) {
      const freeTimeSlots =
        takenTimeslotsServices.noTakenTimslot(availableStaffIds);
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
}

module.exports = new TakenTimeslotControllers();
