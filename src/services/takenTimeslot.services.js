const { default: mongoose } = require("mongoose");
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

  async createTakenTimeslot(staffId, date, timeslots, forDealership) {
    const takenTimeslot = new TakenTimeslot({
      staffId,
      date,
      timeslots,
      forDealership,
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

  getDealershipUnavailableDatesInTheCalendar = (
    startDate,
    endDate,
    timeOfCompletion,
    assignedStaffs,
    dealershipId
  ) => {
    const numberOfStaffsAvailableForAppointment = assignedStaffs.length;

    const agg = [
      {
        $addFields: {
          dateTime: {
            $toDate: "$date",
          },
          staffIdString: { $toString: "$staffId" },
        },
      },
      {
        $match: {
          $or: [
            {
              forDealership: true,
              staffId: { $in: assignedStaffs },
            },
            {
              staffId: { $in: assignedStaffs },
              clearOutForDealershipId: new mongoose.Types.ObjectId(
                dealershipId
              ),
            },
          ],
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
          staffId: {
            $first: "$staffId",
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
          isAvailable: {
            $push: "$isAvailable",
          },
        },
      },
      {
        $project: {
          _id: "$id",
          id: 1,
          staff: 1,
          isAvailable: {
            $ifNull: ["$isAvailable", []],
          },
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
          clearedOut: {
            $filter: {
              input: "$clearedOut",
              cond: "$$this",
            },
          },
        },
      },
      {
        $project: {
          _id: "$id",
          id: 1,
          staff: 1,
          date: "$date",
          clearedOut: 1,
          dateTime: "$dateTime",
          timeslots: "$timeslots",
          timeslotsAsDecimal: {
            $map: {
              input: {
                $setIntersection: {
                  $reduce: {
                    input: {
                      $range: [
                        0,
                        {
                          $add: [
                            { $size: "$isAvailable" },
                            numberOfStaffsAvailableForAppointment - 1,
                          ],
                        },
                      ],
                    },
                    initialValue: { $first: { $slice: ["$timeslots", 0, 1] } },
                    in: {
                      $setIntersection: [
                        {
                          $first: {
                            $slice: ["$timeslots", { $add: ["$$this", 1] }, 1],
                          },
                        },
                        "$$value",
                      ],
                    },
                  },
                },
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
          staff: 1,
          date: "$date",
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
          staffId: 1,
          clearedOut: {
            $gte: [
              { $size: "$clearedOut" },
              numberOfStaffsAvailableForAppointment,
            ],
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
          takenTime: {
            $map: {
              input: "$takenTime",
              in: {
                $let: {
                  vars: {
                    hours: {
                      $toString: {
                        $cond: [
                          { $lt: [{ $floor: "$$this" }, 10] },
                          {
                            $concat: ["0", { $toString: { $floor: "$$this" } }],
                          },
                          { $toString: { $floor: "$$this" } },
                        ],
                      },
                    },
                    decimalTime: "$$this",
                  },
                  in: {
                    $let: {
                      vars: {
                        hours: "$$hours",
                        minutes: {
                          $round: {
                            $multiply: [
                              {
                                $subtract: [
                                  "$$decimalTime",
                                  { $toLong: "$$hours" },
                                ],
                              },
                              60,
                            ],
                          },
                        },
                      },
                      in: {
                        $let: {
                          vars: {
                            hours: { $toString: "$$hours" },
                            minutes: {
                              $cond: [
                                { $lt: ["$$minutes", 10] },
                                { $concat: ["0", { $toString: "$$minutes" }] },
                                { $toString: "$$minutes" },
                              ],
                            },
                          },
                          in: {
                            $concat: ["$$hours", ":", "$$minutes"],
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
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
    ];

    agg.forEach((a) => {
      if (a.$project) {
        a.$project.staffId = 1;
      }

      if (a.$group) {
        a.$group.staffId = {
          $first: "$staffId",
        };
      }
    });

    return TakenTimeslot.aggregate(agg);
  };

  getAvailabilityForEachStaff(
    takenTimeslots,
    assignedStaffIds,
    dealershipId,
    date,
    timeOfCompletion
  ) {
    const agg = [
      {
        $addFields: {
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
        },
      },
      {
        $addFields: {
          unAvailableTimeslotsDueToCloseOfBus: {
            $map: {
              input: {
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
              in: {
                $let: {
                  vars: {
                    hours: {
                      $toString: {
                        $cond: [
                          { $lt: [{ $floor: "$$this" }, 10] },
                          {
                            $concat: ["0", { $toString: { $floor: "$$this" } }],
                          },
                          { $toString: { $floor: "$$this" } },
                        ],
                      },
                    },
                    decimalTime: "$$this",
                  },
                  in: {
                    $let: {
                      vars: {
                        hours: "$$hours",
                        minutes: {
                          $round: {
                            $multiply: [
                              {
                                $subtract: [
                                  "$$decimalTime",
                                  { $toLong: "$$hours" },
                                ],
                              },
                              60,
                            ],
                          },
                        },
                      },
                      in: {
                        $let: {
                          vars: {
                            hours: { $toString: "$$hours" },
                            minutes: {
                              $cond: [
                                { $lt: ["$$minutes", 10] },
                                { $concat: ["0", { $toString: "$$minutes" }] },
                                { $toString: "$$minutes" },
                              ],
                            },
                          },
                          in: {
                            $concat: ["$$hours", ":", "$$minutes"],
                          },
                        },
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
        $addFields: {
          staffIdString: {
            $toString: "$staffId",
          },
          clearOutForDealershipId: {
            $eq: ["$clearOutForDealershipId", { $toObjectId: dealershipId }],
          },
          isAvailable: {
            $eq: [
              {
                $size: {
                  $ifNull: [
                    {
                      $setIntersection: [
                        takenTimeslots,
                        {
                          $concatArrays: [
                            "$timeslots",
                            "$unAvailableTimeslotsDueToCloseOfBus",
                          ],
                        },
                      ],
                    },
                    [],
                  ],
                },
              },
              0,
            ],
          },
        },
      },
      {
        $addFields: {
          isAvailable: {
            $cond: ["$clearOutForDealershipId", false, "$isAvailable"],
          },
        },
      },
      {
        $match: {
          $and: [
            {
              date,
            },
            {
              $or: [
                {
                  staffId: {
                    $in: assignedStaffIds,
                  },
                  clearOutForDealershipId: new mongoose.Types.ObjectId(
                    dealershipId
                  ),
                },
                {
                  staffId: {
                    $in: assignedStaffIds,
                  },
                },
              ],
            },
          ],
        },
      },
    ];

    return TakenTimeslot.aggregate(agg);
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
        $match: {
          forDealership: undefined,
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
          isAvailable: {
            $push: "$isAvailable",
          },
        },
      },
      {
        $project: {
          _id: "$id",
          id: 1,
          isAvailable: {
            $ifNull: ["$isAvailable", []],
          },
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
          timeslotsAsDecimal: {
            $map: {
              input: {
                $setIntersection: {
                  $reduce: {
                    input: {
                      $range: [
                        0,
                        {
                          $add: [
                            { $size: "$isAvailable" },
                            numberOfStaffsAvailableForAppointment - 1,
                          ],
                        },
                      ],
                    },
                    initialValue: { $first: { $slice: ["$timeslots", 0, 1] } },
                    in: {
                      $setIntersection: [
                        {
                          $first: {
                            $slice: ["$timeslots", { $add: ["$$this", 1] }, 1],
                          },
                        },
                        "$$value",
                      ],
                    },
                  },
                },
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

  getUnavailableDatesInTheCalendarForAStaff(
    staffId,
    startDate,
    endDate,
    dealershipId
  ) {
    return TakenTimeslot.aggregate([
      {
        $match: {
          forDealership: true,
        },
      },
      {
        $addFields: {
          dateTime: {
            $toDate: "$date",
          },
        },
      },
      {
        $addFields: {
          staffString: {
            $toString: "$staffId",
          },
        },
      },
      {
        $match: {
          dateTime: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
        },
      },
      {
        $match: {
          staffString: staffId,
          $or: [
            {
              clearOutForDealershipId: new mongoose.Types.ObjectId(
                dealershipId
              ),
            },
            { isBooked: true },
          ],
        },
      },
      {
        $project: {
          _id: 1,
          date: 1,
          staffId: 1,
          isTaken: { $literal: true },
        },
      },
      {
        $sort: {
          date: -1,
        },
      },
    ]);
  }

  getUnavailableDatesInTheCalendarForADealer(
    staffIds,
    startDate,
    endDate,
    dealershipId
  ) {
    const numberOfStaffAssignedTodealer = staffIds.length;

    return TakenTimeslot.aggregate([
      {
        $match: {
          $or: [
            {
              clearOutForDealershipId: new mongoose.Types.ObjectId(
                dealershipId
              ),
            },
            { isBooked: true },
          ],
        },
      },
      {
        $addFields: {
          dateTime: {
            $toDate: "$date",
          },
        },
      },
      {
        $addFields: {
          staffString: {
            $toString: "$staffId",
          },
        },
      },
      {
        $match: {
          dateTime: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
        },
      },
      {
        $match: {
          staffId: {
            $in: staffIds,
          },
        },
      },
      {
        $group: {
          _id: "$date",
          id: {
            $first: "$_id",
          },
          forDealership: {
            $push: "$forDealership",
          },
        },
      },
      {
        $project: {
          _id: "$id",
          isTaken: {
            $cond: [
              {
                $gte: [
                  {
                    $size: "$forDealership",
                  },
                  numberOfStaffAssignedTodealer,
                ],
              },
              true,
              false,
            ],
          },
          date: "$_id",
        },
      },
      {
        $sort: {
          date: -1,
        },
      },
    ]);
  }

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

  getAvailableStafsIdsForDealership(date, staffIds) {
    return TakenTimeslot.aggregate([
      {
        $match: {
          date,
          forDealership: true,
        },
      },
      {
        $group: {
          _id: "$date",
          allStaffIds: {
            $push: "$staffId",
          },
          id: {
            $first: "$_id",
          },
        },
      },
      {
        $project: {
          availableStaffIds: {
            $setDifference: [staffIds, "$allStaffIds"],
          },
        },
      },
    ]);
  }

  getTakenTimeSlotsByDateAndStaffId({
    date,
    staffId,
    clearOutForDealershipId,
  }) {
    return TakenTimeslot.findOne({ date, staffId, clearOutForDealershipId });
  }

  getTakenTimeslotForDealerAndStaff(customerId, staffId) {
    return TakenTimeslot.find({
      clearOutForDealershipId: customerId,
      staffId,
    }).populate("clearOutForDealershipId", "firstName lastName");
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

  staffBlockOutsADate(
    staffId,
    clearOutForDealershipId,
    date,
    isBooked,
    session,
    clearedOut = true
  ) {
    const takenTimeslot = new TakenTimeslot({
      staffId,
      date,
      clearOutForDealershipId,
      forDealership: true,
      clearedOut,
      isBooked,
    });

    return takenTimeslot.save(session ? { session } : undefined);
  }

  formatDate(date) {
    const dateArray = date.split("-");

    const upd = dateArray.map((time) => {
      if (time.length < 2) time = `0${time}`;

      return time;
    });

    date = upd.join("-");
  }

  getAvailableDealershipStaffIds(dealershipId, staffIds, date) {
    const agg = [
      {
        $match: {
          date,
          clearOutForDealershipId: new mongoose.Types.ObjectId(dealershipId),
        },
      },
      {
        $group: {
          _id: "$date",
          staffIds: {
            $push: "$staffId",
          },
        },
      },
      {
        $project: {
          availableStaffIds: {
            $setDifference: [staffIds, "$staffIds"],
          },
        },
      },
    ];

    return TakenTimeslot.aggregate(agg);
  }

  getTakenTimeSlotDateString(inputDate) {
    inputDate = new Date(inputDate);

    // Check if the input is a valid Date object
    if (!(inputDate instanceof Date) || isNaN(inputDate)) {
      return false;
    }

    // Get year, month, and day from the date
    const year = inputDate.getFullYear();
    const month = String(inputDate.getMonth() + 1).padStart(2, "0"); // Months are zero-based
    const day = String(inputDate.getDate()).padStart(2, "0");

    // Create the formatted date string
    const formattedDate = `${year}-${month}-${day}`;
    return formattedDate;
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

  addTakenTimeslotsForStaff = async (id, timeslots) => {
    return TakenTimeslot.findByIdAndUpdate(id, {
      $push: { timeslots },
    });
  };

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

      try {
        const newTimeslots = await this.createTakenTimeslot(
          staffId,
          date,
          sortedUpdatedTakenTimeslots
        );

        return newTimeslots;
      } catch (error) {
        if (error.code === 11000 && error.name === "MongoServerError") {
          const result = await this.updateTakenTimeslot(
            staffTakenTimeslots,
            date,
            timeslots,
            takenTimes
          );

          return result;
        } else {
          console.log(error);
          throw error;
        }
      }
    } else {
      const result = await this.updateTakenTimeslot(
        staffTakenTimeslots,
        date,
        timeslots,
        takenTimes
      );

      return result;
    }
  };

  updateTakenTimeslot = async (
    staffTakenTimeslots,
    date,
    timeslots,
    takenTimes
  ) => {
    timeslots = staffTakenTimeslots.timeslots;

    const updatedTakenTimeSlots = [...new Set([...timeslots, ...takenTimes])];
    const sortedUpdatedTakenTimeslots = this.sortTimeArray(
      updatedTakenTimeSlots
    );

    staffTakenTimeslots.timeslots = sortedUpdatedTakenTimeslots;

    let retryCount = 0;

    while (retryCount < 3) {
      try {
        // Attempt to update the document
        const result = await staffTakenTimeslots.save();

        // Document updated successfully
        return result;
      } catch (error) {
        // Handle VersionError
        if (error.name === "VersionError") {
          console.warn(
            "VersionError: Document has been modified by another process."
          );

          const updatedDoc = await this.getTakenTimeSlotsByDateAndStaffId({
            staffId,
            date,
          });

          const updatedTimeSlots = updatedDoc.timeslots;

          sortedUpdatedTakenTimeslots.forEach((timeSlot) => {
            if (updatedTimeSlots.includes(timeSlot)) {
              return false;
            }
          });

          retryCount++;
          // Increment the retry count and try again
          console.log(`Retrying update. Retry count: ${retryCount}`);
        } else {
          // Handle other errors
          console.error("Error during update:", error);
          throw error; // Rethrow other errors
        }
      }
    }
  };
}

module.exports = new TakenTimeslotService();
