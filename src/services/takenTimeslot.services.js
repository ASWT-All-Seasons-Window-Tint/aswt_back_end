const { TakenTimeslot } = require("../model/takenTimeslot.model");
const { VALID_TIME_SLOTS } =
  require("../common/constants.common").FREE_TIME_SLOTS;
const freeTimeSlotServices = require("../services/freeTimeSlot.services");
const timeSlotsInDecimal = freeTimeSlotServices.convertTimeArrayToDecimal(
  VALID_TIME_SLOTS()
);

class TakenTimeslotService {
  arraysAreEqual(arr1, arr2) {
    // Check if arrays have the same length
    if (arr1.length !== arr2.length) {
      return false;
    }

    // Sort the arrays
    const sortedArr1 = arr1.slice().sort();
    const sortedArr2 = arr2.slice().sort();

    // Compare the sorted arrays
    for (let i = 0; i < sortedArr1.length; i++) {
      if (sortedArr1[i] !== sortedArr2[i]) {
        return false;
      }
    }

    return true;
  }

  async createTakenTimeslot(staffId, date, timeslots) {
    const takenTimeslot = new TakenTimeslot({
      staffId,
      date,
      timeslots,
    });

    return await takenTimeslot.save();
  }

  findUnavailableTimeSlots(staff, expectedTimeOfCompletion) {
    const staffTimeSlotsInDecimal =
      freeTimeSlotServices.convertTimeArrayToDecimal(staff.timeslots);
    let unAvailableTimeSlot = [];

    for (let i = 0; i <= expectedTimeOfCompletion; i += 0.25) {
      timeSlotsInDecimal.forEach((timeslot) => {
        if (staffTimeSlotsInDecimal.includes(timeslot + i)) {
          unAvailableTimeSlot.push(timeslot);
        }
      });
    }

    return {
      staffId: staff.staffId,
      timeslots: [
        ...new Set(
          freeTimeSlotServices.convertDecimalArrayToTime(unAvailableTimeSlot)
        ),
      ],
    };
  }

  filterAvailableStaffIds(existingTakenTimeslots, staffIds) {
    // Extract staffIds from the existingTakenTimeslots
    const occupiedStaffIds = existingTakenTimeslots.map((timeslot) =>
      timeslot.staffId.toString()
    );

    // Find staffIds that are not in the occupiedStaffIds array
    const availableStaffIds = staffIds.filter(
      (staffId) => !occupiedStaffIds.includes(staffId.toString())
    );

    return availableStaffIds;
  }

  findCommonTimeSlots(staffMembers) {
    // Extract time slots from each staff member
    const staffTimeSlots = staffMembers.map(
      (staff) => new Set(staff.timeslots.map((time) => time.trim()))
    );

    // Find the intersection of time slots among all staff members
    const commonTimeSlots = staffTimeSlots.reduce(
      (intersection, currentSet) => {
        return new Set(
          [...intersection].filter((timeSlot) => currentSet.has(timeSlot))
        );
      },
      staffTimeSlots[0]
    );

    // Convert the Set back to an array
    const commonTimeSlotsArray = [...commonTimeSlots];

    return commonTimeSlotsArray;
  }

  getTakenTimes(timeString, timeOfCompletion) {
    const timeslotsInDecimal = freeTimeSlotServices.convertTimeArrayToDecimal(
      VALID_TIME_SLOTS()
    );

    const timeInDecimal = freeTimeSlotServices.convertTimetoDecimal({
      timeString,
    });

    const estimatedFreeTime = timeInDecimal + timeOfCompletion;

    const takenTimesInDecimal = timeslotsInDecimal.filter(
      (timeslot) => timeslot >= timeInDecimal && timeslot < estimatedFreeTime
    );

    const takenTimes =
      freeTimeSlotServices.convertDecimalArrayToTime(takenTimesInDecimal);

    return takenTimes;
  }

  getTakenTimeSlotsByDate({ date }) {
    return TakenTimeslot.find({ date }).sort({ _id: -1 });
  }

  getTakenTimeSlotsByDateAndStaffId({ date, staffId }) {
    return TakenTimeslot.findOne({ date, staffId });
  }

  getTakenTimeslotForStaff(updatedStaffTimeSlots) {
    const numberOfStaffWithFreeTimeslots = updatedStaffTimeSlots.length;

    const randomNumber = Math.floor(
      Math.random() * numberOfStaffWithFreeTimeslots
    );

    const takenTimeSlotForStaff = updatedStaffTimeSlots[randomNumber];

    return takenTimeSlotForStaff;
  }

  getFreeStaffPerTime(takenTimeslotsDetails, timeString) {
    const { updatedStaffTimeSlots } = takenTimeslotsDetails;

    return updatedStaffTimeSlots.filter(
      (staffTimeslot) => !staffTimeslot.timeslots.includes(timeString)
    );
  }

  getTakenTimeslotsForAllStaffs = (
    existingTakenTimeslots,
    expectedTimeOfCompletion
  ) => {
    const updatedStaffTimeSlots = existingTakenTimeslots.map((staff) =>
      this.findUnavailableTimeSlots(staff, expectedTimeOfCompletion)
    );

    const takenTimeslots = this.findCommonTimeSlots(updatedStaffTimeSlots);
    const uniqueTimeSlots = {
      updatedStaffTimeSlots,
      takenTimeslots,
    };

    return uniqueTimeSlots;
  };

  noTakenTimslot(staffIds) {
    return {
      updatedStaffTimeSlots: staffIds.map((staffId) => {
        return { staffId, timeslots: [] };
      }),
      takenTimeslots: [],
    };
  }

  retriveTakenTimeslots = async (appointment, timeOfCompletion) => {
    const staffId = appointment.staffId;
    const startTime = appointment.startTime;
    const { formattedDate, formattedTime } =
      freeTimeSlotServices.getFormattedDate(startTime);

    const staffTakenTimeSlot = await this.getTakenTimeSlotsByDateAndStaffId({
      date: formattedDate,
      staffId,
    });

    if (!staffTakenTimeSlot) return null;

    const timeTaken = this.getTakenTimes(formattedTime, timeOfCompletion);

    const updatedRetrievedTime = staffTakenTimeSlot.timeslots.filter(
      (timeslot) => !timeTaken.includes(timeslot)
    );

    staffTakenTimeSlot.timeslots = updatedRetrievedTime;

    return staffTakenTimeSlot;
  };

  sortTimeArray(timeArray) {
    // Convert the time strings to a format for easy comparison
    const formattedTimeArray = timeArray.map((time) => {
      // Adding leading zero to single-digit hours for consistency
      const parts = time.split(":");
      const hours = parts[0].length === 1 ? "0" + parts[0] : parts[0];
      return hours + ":" + parts[1];
    });

    // Sort the formatted time array
    return formattedTimeArray.sort();
  }

  updateTakenTimeslotsForStaff = async (
    takenTimeSlotForStaff,
    timeString,
    timeOfCompletion,
    date
  ) => {
    let { timeslots, staffId } = takenTimeSlotForStaff;

    const takenTimes = this.getTakenTimes(timeString, timeOfCompletion);

    const staffTakenTimeslots = await this.getTakenTimeSlotsByDateAndStaffId({
      staffId,
      date,
    });

    if (timeslots.length < 1 && !staffTakenTimeslots) {
      const updatedTakenTimeSlots = [...new Set([...timeslots, ...takenTimes])];
      const sortedUpdatedTakenTimeslots = this.sortTimeArray(
        updatedTakenTimeSlots
      );

      const newTimeslots = await this.createTakenTimeslot(
        staffId,
        date,
        sortedUpdatedTakenTimeslots
      );

      return newTimeslots;
    }

    timeslots = staffTakenTimeslots.timeslots;

    const updatedTakenTimeSlots = [...new Set([...timeslots, ...takenTimes])];
    const sortedUpdatedTakenTimeslots = this.sortTimeArray(
      updatedTakenTimeSlots
    );

    staffTakenTimeslots.timeslots = sortedUpdatedTakenTimeslots;

    return await staffTakenTimeslots.save();
  };
}

module.exports = new TakenTimeslotService();
