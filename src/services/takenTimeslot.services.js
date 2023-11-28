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

  async clearOutAppointment(date) {
    return TakenTimeslot.updateMany({ date }, { $set: { clearedOut: true } });
  }

  async getClearOutDates() {
    return TakenTimeslot.find({ clearedOut: true });
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

  getUnavailableDatesInTheCalendar = (
    startDate,
    endDate,
    timeOfCompletion,
    numberOfStaffsAvailableForAppointment
  ) => {
    return TakenTimeslot.aggregate([
      {
        $addFields: {
          dateTime: {
            $toDate: "$date",
          },
        },
      },
      {
        $group: {
          _id: "$date",
          id: {
            $first: "$id",
          },
          date: {
            $first: "$date",
          },
          dateTime: {
            $first: "$dateTime",
          },
          clearedOut: {
            $push: "$clearedOut",
          },
          timeslots: {
            $push: "$timeslots",
          },
        },
      },
      {
        $project: {
          _id: "$id",
          id: 1,
          date: "$date",
          dateTime: "$dateTime",
          timeslots: {
            $map: {
              input: "$timeslots",
              as: "timeslot",
              in: {
                $map: {
                  input: "$$timeslot",
                  as: "time",
                  in: {
                    $concat: ["$date", "T", "$$time"],
                  },
                },
              },
            },
          },
          clearedOut: 1,
        },
      },
      {
        $project: {
          _id: "$id",
          id: 1,
          date: "$date",
          clearedOut: 1,
          dateTime: "$dateTime",
          timeslots: "$timeslots",
          testsIntersection: {
            $setIntersection: [
              {
                $arrayElemAt: ["$tests", 0],
              },
              {
                $arrayElemAt: ["$tests", 1],
              },
            ],
          },
          timeslotsAsDecimal: {
            $map: {
              input: {
                $setIntersection: [
                  {
                    $arrayElemAt: ["$timeslots", 0],
                  },
                  {
                    $arrayElemAt: ["$timeslots", 1],
                  },
                ],
              },
              as: "timeString",
              in: {
                $sum: [
                  {
                    $hour: {
                      $toDate: "$$timeString",
                    },
                  },
                  {
                    $divide: [
                      {
                        $minute: {
                          $toDate: "$$timeString",
                        },
                      },
                      60,
                    ],
                  },
                ],
              },
            },
          },
        },
      },
      {
        $project: {
          _id: "$id",
          clearedOut: 1,
          date: "$date",
          dateTime: "$dateTime",
          timeslots: "$timeslots",
          timeslotsAsDecimal: {
            $map: {
              input: {
                $setIntersection: [
                  {
                    $arrayElemAt: ["$timeslots", 0],
                  },
                  {
                    $arrayElemAt: ["$timeslots", 1],
                  },
                ],
              },
              as: "timeString",
              in: {
                $sum: [
                  {
                    $hour: {
                      $toDate: "$$timeString",
                    },
                  },
                  {
                    $divide: [
                      {
                        $minute: {
                          $toDate: "$$timeString",
                        },
                      },
                      60,
                    ],
                  },
                ],
              },
            },
          },
          timeslotsInDecimal: {
            $map: {
              input: {
                $range: [
                  36,
                  {
                    $multiply: [17.25, 4],
                  },
                ],
              },
              in: {
                $divide: ["$$this", 4],
              },
            },
          },
          takenTime: {
            $let: {
              vars: {
                workingDuration: {
                  $map: {
                    input: {
                      $range: [
                        0,
                        {
                          $multiply: [timeOfCompletion + 0.25, 4],
                        },
                      ],
                    },
                    in: {
                      $divide: ["$$this", 4],
                    },
                  },
                },
                timeslotsInDecimal: {
                  $map: {
                    input: {
                      $range: [
                        36,
                        {
                          $multiply: [17.25, 4],
                        },
                      ],
                    },
                    in: {
                      $divide: ["$$this", 4],
                    },
                  },
                },
                unAvailableTimeSlot: [],
                timeslotsAsDecimal: {
                  $ifNull: ["$timeslotsAsDecimal", []],
                },
              },
              in: {
                $map: {
                  input: "$$workingDuration",
                  as: "time",
                  in: {
                    $map: {
                      input: "$$timeslotsInDecimal",
                      as: "timeslot",
                      in: {
                        $cond: [
                          {
                            $in: [
                              {
                                $add: ["$$timeslot", "$$time"],
                              },
                              "$$timeslotsAsDecimal",
                            ],
                          },
                          {
                            $first: {
                              $concatArrays: [
                                "$$unAvailableTimeSlot",
                                ["$$timeslot"],
                              ],
                            },
                          },
                          null,
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      {
        $project: {
          _id: "$id",
          date: "$date",
          clearedOut: {
            $first: {
              $filter: {
                input: "$clearedOut",
                as: "cleared",
                cond: {
                  $eq: ["$$cleared", true],
                },
              },
            },
          },
          dateTime: "$dateTime",
          timeslots: "$timeslots",
          timeslotsInDecimal: {
            $map: {
              input: {
                $range: [
                  36,
                  {
                    $multiply: [17.25, 4],
                  },
                ],
              },
              in: {
                $divide: ["$$this", 4],
              },
            },
          },
          timeslotsAsDecimal: {
            $map: {
              input: {
                $setIntersection: this.getIntersectionArr(
                  numberOfStaffsAvailableForAppointment
                ),
              },
              as: "timeString",
              in: {
                $sum: [
                  {
                    $hour: {
                      $toDate: "$$timeString",
                    },
                  },
                  {
                    $divide: [
                      {
                        $minute: {
                          $toDate: "$$timeString",
                        },
                      },
                      60,
                    ],
                  },
                ],
              },
            },
          },
          takenTime: {
            $concatArrays: [
              {
                $map: {
                  input: "$takenTime",
                  as: "takenTime",
                  in: {
                    $filter: {
                      input: "$$takenTime",
                      as: "eachTime",
                      cond: {
                        $ne: ["$$eachTime", null],
                      },
                    },
                  },
                },
              },
              {
                $let: {
                  vars: {
                    closingTime: {
                      $add: [
                        {
                          $max: "$timeslotsInDecimal",
                        },
                        0.25,
                      ],
                    },
                    latestTimeForTheJob: {
                      $subtract: [
                        {
                          $max: "$timeslotsInDecimal",
                        },
                        timeOfCompletion,
                      ],
                    },
                  },
                  in: {
                    $map: {
                      input: {
                        $range: [
                          {
                            $multiply: ["$$latestTimeForTheJob", 4],
                          },
                          {
                            $multiply: ["$$closingTime", 4],
                          },
                        ],
                      },
                      in: {
                        $divide: ["$$this", 4],
                      },
                    },
                  },
                },
              },
            ],
          },
        },
      },
      {
        $unwind: {
          path: "$takenTime",
          includeArrayIndex: "string",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $unwind: {
          path: "$takenTime",
          includeArrayIndex: "string",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: "$date",
          date: {
            $first: "$date",
          },
          id: {
            $first: "$id",
          },
          dateTime: {
            $first: "$dateTime",
          },
          timeslots: {
            $first: "$timeslots",
          },
          takenTime: {
            $addToSet: "$takenTime",
          },
          clearedOut: {
            $first: "$clearedOut",
          },
          timeslotsAsDecimal: {
            $first: "$timeslotsAsDecimal",
          },
          timeslotsInDecimal: {
            $first: "$timeslotsInDecimal",
          },
        },
      },
      {
        $project: {
          id: 1,
          date: 1,
          dateTime: 1,
          timeslots: 1,
          takenTime: 1,
          timeslotsAsDecimal: 1,
          timeslotsInDecimal: 1,
          clearedOut: 1,
          arraysAreEqual: {
            $setEquals: ["$takenTime", "$timeslotsInDecimal"],
          },
        },
      },
      {
        $project: {
          _id: 0,
          date: 1,
          dateTime: 1,
          clearedOut: 1,
          isTaken: {
            $cond: [
              {
                $or: ["$clearedOut", "$arraysAreEqual"],
              },
              true,
              false,
            ],
          },
        },
      },
      {
        $match: {
          $and: [
            {
              dateTime: {
                $gte: new Date(startDate),
              },
            },
            {
              dateTime: {
                $lte: new Date(endDate),
              },
            },
          ],
        },
      },
      {
        $sort: {
          dateTime: 1,
        },
      },
    ]);
  };

  getIntersectionArr(numberOfStaffsAvailableForAppointment) {
    const intersectionArr = [];

    for (let i = 0; i < numberOfStaffsAvailableForAppointment; i++) {
      intersectionArr.push({
        $first: {
          $slice: ["$timeslots", i, 1],
        },
      });
    }

    return intersectionArr;
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

  getUnvailableTimeDueToCloseOfBusiness(timeOfCompletion) {
    const closeOfBusinessHour = Math.max(...timeSlotsInDecimal);
    const latestestTimeForTheJob = closeOfBusinessHour - timeOfCompletion;

    const unavailableDueToCloseOfBusiness = timeSlotsInDecimal.filter(
      (decimalTime) => decimalTime > latestestTimeForTheJob
    );

    return freeTimeSlotServices.convertDecimalArrayToTime(
      unavailableDueToCloseOfBusiness
    );
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

    const takenTimeslotsBeforeCloseOfBus = this.findCommonTimeSlots(
      updatedStaffTimeSlots
    );
    const takenTimeslotsDueCloseOfBus =
      this.getUnvailableTimeDueToCloseOfBusiness(expectedTimeOfCompletion);

    const takenTimeslots = [
      ...new Set([
        ...takenTimeslotsBeforeCloseOfBus,
        ...takenTimeslotsDueCloseOfBus,
      ]),
    ].sort();

    const uniqueTimeSlots = {
      updatedStaffTimeSlots,
      takenTimeslots,
    };

    return uniqueTimeSlots;
  };

  noTakenTimslot = (staffIds, timeOfCompletion) => {
    const takenTimeslots =
      this.getUnvailableTimeDueToCloseOfBusiness(timeOfCompletion);

    return {
      updatedStaffTimeSlots: staffIds.map((staffId) => {
        return { staffId, timeslots: [] };
      }),
      takenTimeslots,
    };
  };

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
