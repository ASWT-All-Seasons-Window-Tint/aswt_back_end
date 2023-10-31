const mongoose = require("mongoose");
const { days, validMonthNames, DATE } = require("../common/constants.common");
const getTodayAndTomorrowUtils = require("./getTodayAndTomorrow.utils");
const { carDetailsProperties, entryProperties } =
  require("../model/entry.model").joiValidator;

class EntryUtils {
  pipeline = ({
    entryId,
    staffId,
    date,
    startDate,
    endDate,
    customerId,
    vin,
    porterId,
    waitingList,
  }) => {
    const match = {};
    if (entryId) {
      match._id = new mongoose.Types.ObjectId(entryId);
    }
    if (customerId) match.customerId = customerId;

    const pipeline = [
      {
        $match: match,
      },
      {
        $project: {
          ...this.entryUnFilteredProps,
          invoice: 1,
          filteredDetails: {
            $filter: {
              input: "$invoice.carDetails",
              as: "car",
              cond: this.dateFilter({
                staffId,
                date,
                startDate,
                endDate,
                vin,
                porterId,
                waitingList,
              }),
            },
          },
        },
      },

      {
        $lookup: {
          from: "services",
          localField: "filteredDetails.serviceIds",
          foreignField: "_id",
          as: "services",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "invoice.carDetails.staffId",
          foreignField: "_id",
          as: "staff",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "invoice.carDetails.porterId",
          foreignField: "_id",
          as: "porter",
        },
      },
      {
        $project: {
          ...this.entryUnFilteredProps,
          carsDone: {
            $cond: [
              { $ifNull: [staffId || porterId, false] },
              { $size: "$filteredDetails" },
              "$$REMOVE",
            ],
          },

          invoice: this.projectedInvoince(staffId, porterId),
        },
      },
      {
        $match:
          staffId || porterId
            ? {
                "invoice.carDetails": { $ne: [] },
              }
            : {},
      },
    ];
    const addFields = {
      $addFields: {
        "invoice.carDetails": {
          $map: {
            input: "$invoice.carDetails",
            as: "carDetail",
            in: {
              $mergeObjects: [
                "$$carDetail",
                {
                  dayOfWeek: {
                    $arrayElemAt: [
                      days,
                      {
                        $subtract: [{ $dayOfWeek: "$$carDetail.entryDate" }, 1],
                      },
                    ],
                  },
                },
                {
                  month: {
                    $arrayElemAt: [
                      validMonthNames,
                      {
                        $subtract: [{ $month: "$$carDetail.entryDate" }, 1],
                      },
                    ],
                  },
                },
              ],
            },
          },
        },
      },
    };

    if (date || startDate) pipeline.push(addFields);

    return pipeline;
  };

  entryUnFilteredProps = {
    customerId: 1,
    customerName: 1,
    customerEmail: 1,
    isActive: 1,
    numberOfCarsAdded: 1,
    entryDate: 1,
  };

  serviceNames = {
    $map: {
      input: "$$car.serviceIds",
      as: "serviceId",
      in: {
        $first: {
          $filter: {
            input: {
              $map: {
                input: "$services",
                as: "service",
                in: {
                  $cond: [
                    {
                      $eq: ["$$service._id", { $toObjectId: "$$serviceId" }],
                    },
                    "$$service.name",
                    false,
                  ],
                },
              },
            },
            as: "item",
            cond: { $ne: ["$$item", false] },
          },
        },
      },
    },
  };

  projectedInvoince(staffId, porterId) {
    let invoice = {
      name: 1,
      carDetails: {
        $map: {
          input: "$filteredDetails",
          as: "car",
          in: {
            _id: "$$car._id",
            vin: "$$car.vin",
            year: "$$car.year",
            make: "$$car.make",
            entryDate: "$$car.entryDate",
            model: "$$car.model",
            note: "$$car.note",
            colour: "$$car.colour",
            staffId: "$$car.staffId",
            porterId: "$$car.porterId",
            serviceIds: "$$car.serviceIds",
            category: "$$car.category",
            serviceNames: this.serviceNames,
            waitingList: "$$car.waitingList",
            geoLocations: "$$car.geoLocations",
          },
        },
      },
    };

    if (!staffId && !porterId) {
      invoice = {
        name: "$invoice.name",
        sent: 1,
        qbId: 1,
        paymentDetails: 1,
        carDetails: {
          $map: {
            input: "$invoice.carDetails",
            as: "car",
            in: {
              $mergeObjects: [
                {
                  $arrayToObject: {
                    $filter: {
                      input: { $objectToArray: "$$car" },
                      as: "item",
                      cond: { $ne: ["$$item.k", "serviceId"] },
                    },
                  },
                },
                {
                  serviceNames: this.serviceNames,
                },
                {
                  staffName: {
                    $first: {
                      $filter: {
                        input: {
                          $map: {
                            input: "$staff",
                            as: "staff",
                            in: {
                              $cond: [
                                {
                                  $eq: [
                                    "$$staff._id",
                                    { $toObjectId: "$$car.staffId" },
                                  ],
                                },
                                {
                                  $concat: [
                                    "$$staff.firstName",
                                    " ",
                                    "$$staff.lastName",
                                  ],
                                },
                                null,
                              ],
                            },
                          },
                        },
                        as: "item",
                        cond: {
                          $ne: ["$$item", null],
                        },
                      },
                    },
                  },
                },
                // {
                //   porterName: {
                //     $first: {
                //       $filter: {
                //         input: {
                //           $map: {
                //             input: "$porter",
                //             as: "porter",
                //             in: {
                //               $cond: [
                //                 {
                //                   $eq: [
                //                     "$$porter._id",
                //                     { $toObjectId: "$$car.porterId" },
                //                   ],
                //                 },
                //                 {
                //                   $concat: [
                //                     "$$porter.firstName",
                //                     " ",
                //                     "$$porter.lastName",
                //                   ],
                //                 },
                //                 null,
                //               ],
                //             },
                //           },
                //         },
                //         as: "item",
                //         cond: {
                //           $ne: ["$$item", null],
                //         },
                //       },
                //     },
                //   },
                // },
                { serviceId: "$$car.serviceId" },
              ],
            },
          },
        },
        totalPrice: {
          $sum: "$invoice.carDetails.price",
        },
      };
    }

    return invoice;
  }

  pipelineForCustomerIdAndVin = ({ customerId, vin }) => {
    const pipeline = [
      {
        $match: {
          customerId: customerId,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "invoice.carDetails.staffId",
          foreignField: "_id",
          as: "staff",
        },
      },
      {
        $project: {
          ...this.entryUnFilteredProps,
          invoice: {
            name: 1,
            "invoice.carDetails": {
              $filter: {
                input: "$invoice.carDetails",
                as: "car",
                cond: {
                  $eq: ["$$car.vin", vin],
                },
              },
            },
          },
        },
      },
      {
        $match: {
          "invoice.carDetails": { $ne: [] }, // filter out entries with empty carDetails array
        },
      },
    ];

    return pipeline;
  };

  filteredDetails = ({
    staffId,
    date,
    startDate,
    endDate,
    vin,
    waitingList,
  }) => {
    return {
      $filter: {
        input: "$invoice.carDetails",
        as: "car",
        cond: this.dateFilter({
          staffId,
          date,
          startDate,
          endDate,
          vin,
          waitingList,
        }),
      },
    };
  };

  dateFilter({
    staffId,
    date,
    startDate,
    endDate,
    vin,
    waitingList,
    porterId,
  }) {
    const { today, tomorrow } = getTodayAndTomorrowUtils();

    const staffFilter = {
      $eq: ["$$car.staffId", new mongoose.Types.ObjectId(staffId)],
    };
    const porterFilter = {
      $eq: ["$$car.porterId", new mongoose.Types.ObjectId(porterId)],
    };
    const waitingListFilter = {
      $and: [
        {
          $gte: ["$entryDate", today],
        },
        {
          $lt: ["$entryDate", tomorrow],
        },
        {
          $eq: ["$$car.waitingList", waitingList],
        },
        {
          $eq: ["$$car.porterId", new mongoose.Types.ObjectId(porterId)],
        },
      ],
    };

    const pendingDropOffFilter = {
      $and: [
        {
          $eq: ["$$car.waitingList", waitingList],
        },
        {
          $eq: ["$$car.porterId", new mongoose.Types.ObjectId(porterId)],
        },
        {
          $not: {
            $or: [
              {
                $or: [
                  { $not: { $ifNull: ["$$car.geoLocations", ""] } }, // Checking if car.geoLocations is not null or empty
                  { $eq: ["$$car.geoLocations", []] },
                ],
              },
              {
                $in: ["TakenFromShop", "$$car.geoLocations.locationType"],
              },
              {
                $in: ["DropOffCompleted", "$$car.geoLocations.locationType"],
              },
            ],
          },
        },
      ],
    };

    const completedTripFilter = {
      $and: [
        {
          $eq: ["$$car.waitingList", waitingList.value],
        },
        {
          $eq: ["$$car.porterId", new mongoose.Types.ObjectId(porterId)],
        },
        {
          $or: [
            {
              $or: [
                { $not: { $ifNull: ["$$car.geoLocations", ""] } }, // Checking if car.geoLocations is not null or empty
                { $eq: ["$$car.geoLocations", []] },
              ],
            },
            {
              $in: ["DropOffCompleted", "$$car.geoLocations.locationType"],
            },
          ],
        },
      ],
    };

    const vinFilter = (id) => {
      return {
        $and: [
          {
            $gte: ["$entryDate", DATE.yesterday],
          },
          {
            $eq: ["$$car.vin", vin],
          },
          {
            $ne: [{ $ifNull: [`$$car.${id}`, null] }, null],
          },
        ],
      };
    };

    const results = { $and: [] };

    if (staffId && vin) {
      results.$and.push(vinFilter("staffId"));
    } else if (porterId && vin) {
      results.$and.push(vinFilter("porterId"));
    } else if (porterId && waitingList.value === false) {
      results.$and.push(completedTripFilter);
    } else if (porterId && waitingList) {
      results.$and.push(waitingListFilter);
    } else if (porterId && waitingList === false) {
      results.$and.push(pendingDropOffFilter);
    } else if (staffId) {
      results.$and.push(staffFilter);
    } else if (porterId) {
      results.$and.push(porterFilter);
    }

    if (date === "today") {
      results.$and.push({
        $eq: [
          {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$$car.entryDate",
            },
          },
          {
            $dateToString: { format: "%Y-%m-%d", date: new Date() },
          },
        ],
      });
    }
    if (startDate && endDate) {
      results.$and.push({
        $and: [
          {
            $gte: ["$$car.entryDate", new Date(startDate)],
          },
          {
            $lte: ["$$car.entryDate", new Date(endDate)],
          },
        ],
      });
    }

    return results;
  }
  getFilterArguments = (req) => {
    const {
      staffId,
      date,
      customerId,
      entryId,
      monthName,
      year,
      vin,
      porterId,
      waitingList,
    } = req.params;
    const filterArguments = [entryId, staffId, customerId, date];

    let range;

    if (monthName && year) {
      range = this.getDateRange({ type: "month", month: monthName, year });
    } else if (year) {
      range = this.getDateRange({ type: "year", year });
    } else if (date) {
      range = this.getDateRange({ type: "week", date: date });
    }

    if (range) {
      const { startDate, endDate } = range;
      filterArguments.push(startDate, endDate, vin);
    } else {
      filterArguments.push(undefined, undefined, vin);
    }

    return [...filterArguments, porterId, waitingList];
  };
  getDateRange({ type, year, month, date }) {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let startDate, endDate;

    switch (type) {
      case "month":
        const monthIndex = validMonthNames.indexOf(month);
        startDate = new Date(Date.UTC(year, monthIndex, 1));
        endDate = new Date(Date.UTC(year, monthIndex + 1, 0));
        break;

      case "year":
        startDate = new Date(Date.UTC(year, 0, 1));
        endDate = new Date(Date.UTC(year, 12, 0));
        break;

      case "day":
        startDate = new Date(date);
        endDate = new Date(date);
        endDate.setHours(24, 59, 59, 999);
        break;

      case "week":
        startDate = new Date(date);
        endDate = new Date(date);
        endDate.setDate(endDate.getDate() + 6); // Assuming a week is 7 days
        endDate.setHours(23, 59, 59, 999);
        break;

      default:
        throw new Error("Invalid date range type");
    }

    // Set the time zone for the Date objects
    startDate.setTimezoneOffset = endDate.setTimezoneOffset = timeZone;

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  }

  getJobCounts = (entries) => {
    const dayCounts = days.reduce((acc, day) => {
      acc[day] = 0;
      return acc;
    }, {});

    const monthCounts = validMonthNames.reduce((acc, month) => {
      acc[month] = 0;
      return acc;
    }, {});

    this.getJobCount(entries, monthCounts, "month");
    this.getJobCount(entries, dayCounts, "dayOfWeek");

    return { dayCounts, monthCounts };
  };

  getJobCount(entries, counts, period) {
    entries.forEach((entry) => {
      entry.invoice.carDetails.forEach(function (car) {
        counts[car[period]]++;
      });
    });
  }

  test = ({ staffId, entryId, customerId }) => {
    const match = {};
    if (entryId) {
      match._id = new mongoose.Types.ObjectId(entryId);
    }
    if (customerId) match.customerId = customerId;

    return [
      {
        $match: match,
      },
      {
        $unwind: "$invoice.carDetails",
      },
      {
        $match: {
          "invoice.carDetails.servicesDone.staffId":
            new mongoose.Types.ObjectId(staffId),
        },
      },
      {
        $group: {
          _id: "$_id", // Group by entry _id
          ...this.getGroupEntryField(),
          invoice: { $first: "$invoice" },
          carDetails: { $push: "$invoice.carDetails" },
          // Reconstruct carDetails array
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "carDetails.servicesDone.staffId",
          foreignField: "_id",
          as: "staffDetails",
        },
      },
      {
        $unwind: "$staffDetails",
      },
      {
        $addFields: {
          "carDetails.servicesDone.staffName": {
            $concat: ["$staffDetails.firstName", " ", "$staffDetails.lastName"],
          },
        },
      },
      {
        $project: {
          ...this.getEntryField(),
          invoice: {
            name: "$invoice.name",
            carDetails: {
              $map: {
                input: "$carDetails",
                as: "carDetail",
                in: this.getCarDetailsField("$$carDetail"),
              },
            },
          },
        },
      },
      {
        $project: {
          ...this.getEntryField(),
          invoice: {
            name: "$invoice.name",
            carDetails: {
              $map: {
                input: "$invoice.carDetails",
                as: "carDetail",
                in: {
                  $mergeObjects: [
                    "$$carDetail",
                    {
                      servicesDone: {
                        $filter: {
                          input: "$$carDetail.servicesDone",
                          as: "serviceDone",
                          cond: {
                            $eq: [
                              "$$serviceDone.staffId",
                              new mongoose.Types.ObjectId(staffId),
                            ],
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
      {
        $lookup: {
          from: "services",
          localField: "invoice.carDetails.servicesDone.serviceId",
          foreignField: "_id",
          as: "service",
        },
      },
      {
        $project: {
          ...this.getEntryField(),
          invoice: {
            name: "$invoice.name",
            carDetails: {
              $map: {
                input: "$invoice.carDetails",
                as: "carDetail",
                in: {
                  $mergeObjects: [
                    "$$carDetail",
                    {
                      servicesDone: {
                        $map: {
                          input: "$$carDetail.servicesDone",
                          as: "serviceDone",
                          in: {
                            $mergeObjects: [
                              "$$serviceDone",

                              {
                                serviceName: {
                                  $let: {
                                    vars: {
                                      serviceId: "$$serviceDone.serviceId",
                                    },
                                    in: {
                                      $first: {
                                        $filter: {
                                          input: {
                                            $map: {
                                              input: "$service",
                                              as: "service",
                                              in: {
                                                $cond: [
                                                  {
                                                    $eq: [
                                                      "$$service._id",
                                                      {
                                                        $toObjectId:
                                                          "$$serviceId",
                                                      },
                                                    ],
                                                  },
                                                  "$$service.name",
                                                  null,
                                                ],
                                              },
                                            },
                                          },
                                          as: "item",
                                          cond: {
                                            $ne: ["$$item", null],
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            ],
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    ];
  };
  getCarDetailsField(field) {
    const carDetailsField = carDetailsProperties.reduce((result, property) => {
      if (property !== "price" && property !== "priceBreakdown")
        result[property] = `${field}.${property}`;

      return result;
    }, {});

    return carDetailsField;
  }
  getEntryField() {
    const entryField = entryProperties.reduce((result, property) => {
      if (property !== "invoice") result[property] = 1;

      return result;
    }, {});

    return entryField;
  }
  getGroupEntryField() {
    const entryField = entryProperties.reduce((result, property) => {
      if (property !== "invoice") result[property] = { $first: `$${property}` };

      return result;
    }, {});

    return entryField;
  }
}

module.exports = new EntryUtils();
