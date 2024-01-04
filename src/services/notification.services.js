const { Notification } = require("../model/notification.model").notification;
const mongoose = require("mongoose");
const entryUtils = require("../utils/entry.utils");
const { Service } = require("../model/service.model");
const { days, validMonthNames, DATE } = require("../common/constants.common");
const { NOTIFICATIONS } = require("../common/constants.common");

class NotificationService {
  updateIsReadBy(userId, notificationId) {
    return Notification.findOneAndUpdate(
      { _id: notificationId },
      {
        $push: { isReadBy: userId },
      }
    );
  }

  //Create new notification
  async createNotification(notificationBody, session) {
    const date = new Date();

    const notification = new Notification({
      ...notificationBody,
      notificationTime: date,
    });

    return notification.save(session ? { session } : undefined);
  }

  async getNotificationById(notificationId) {
    return await Notification.findById(notificationId);
  }

  getNotificationsForStaff(staffId) {
    return Notification.find({ concernedStaffIds: { $in: [staffId] } }).select(
      "-concernedStaffIds -isReadBy"
    );
  }

  getAllNotificationsForUser = ({ userId, vehicleQueue, isUserStaff }) => {
    const match = {
      $and: [{ concernedStaffIds: new mongoose.Types.ObjectId(userId) }],
    };

    if (isUserStaff) match.$and.push({ isDeleted: undefined });

    const notificationPipeLine = [
      {
        $unwind: "$concernedStaffIds",
      },
      {
        $match: {
          $and: [
            { concernedStaffIds: new mongoose.Types.ObjectId(userId) },
            { isDeleted: undefined },
          ],
        },
      },
      {
        $lookup: {
          from: "entries",
          let: {
            carId: "$carId",
          },
          pipeline: [
            {
              $unwind: "$invoice.carDetails",
            },
            {
              $match: {
                $expr: {
                  $eq: ["$invoice.carDetails._id", "$$carId"],
                },
              },
            },
            {
              $replaceRoot: {
                newRoot: "$invoice.carDetails",
              },
            },
          ],
          as: "carDetails",
        },
      },
      {
        $group: {
          _id: "$_id",
          title: {
            $first: "$title",
          },
          notificationTime: { $first: "$notificationTime" },
          type: {
            $first: "$type",
          },
          body: {
            $first: "$body",
          },
          carId: {
            $first: "$carId",
          },
          entryId: {
            $first: "$entryId",
          },
          concernedStaffIds: {
            $first: "$concernedStaffIds",
          },
          carDetails: {
            $first: "$carDetails",
          },
          appointmentId: {
            $first: "$appointmentId",
          },
        },
      },
      {
        $lookup: {
          from: "services",
          localField: "carDetails.serviceIds",
          foreignField: "_id",
          as: "services",
        },
      },
      {
        $addFields: {
          "carDetails.serviceDoneIds": {
            $first: {
              $map: {
                input: "$carDetails.servicesDone",
                as: "serviceDone",
                in: "$$serviceDone.serviceId",
              },
            },
          },
        },
      },
      {
        $lookup: {
          from: "services",
          localField: "carDetails.serviceDoneIds",
          foreignField: "_id",
          as: "servicesDone",
        },
      },
      {
        $lookup: {
          from: "entries",
          let: {
            carId: "$carId",
          },
          pipeline: [
            {
              $unwind: "$invoice.carDetails",
            },
            {
              $match: {
                $expr: {
                  $eq: ["$invoice.carDetails._id", "$$carId"],
                },
              },
            },
          ],
          as: "carEntry",
        },
      },
      {
        $lookup: {
          from: "entries",
          let: {
            entryId: "$entryId",
          },
          pipeline: [
            {
              $unwind: "$invoice.carDetails",
            },
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$entryId"],
                },
              },
            },
            {
              $addFields: {
                "invoice.carDetails.serviceDoneIds": {
                  $map: {
                    input: "$invoice.carDetails.servicesDone",
                    as: "serviceDone",
                    in: "$$serviceDone.serviceId",
                  },
                },
              },
            },
            {
              $lookup: {
                from: "services",
                localField: "invoice.carDetails.serviceDoneIds",
                foreignField: "_id",
                as: "services",
              },
            },
            {
              $addFields: {
                "invoice.carDetails.serviceNames": {
                  $map: {
                    input: "$services",
                    as: "service",
                    in: "$$service.name",
                  },
                },
              },
            },
            {
              $group: {
                _id: "$_id",
                customerName: { $first: "$customerName" },
                customerId: { $first: "$customerId" },
                carDetails: { $push: "$invoice.carDetails" },
              },
            },
          ],
          as: "entry",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "concernedStaffIds",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $lookup: {
          from: "users",
          pipeline: [
            {
              $match: {
                role: "gm",
              },
            },
          ],
          as: "GM",
        },
      },
      {
        $lookup: {
          from: "appointments",
          localField: "appointmentId",
          foreignField: "_id",
          pipeline: [
            {
              $addFields: {
                convertedDate: {
                  $concat: [
                    {
                      $arrayElemAt: [
                        validMonthNames,
                        { $subtract: [{ $month: "$startTime" }, 1] },
                      ],
                    },
                    " ",
                    { $toString: { $dayOfMonth: "$startTime" } },
                    ", ",
                    {
                      $toString: {
                        $year: "$startTime",
                      },
                    },
                  ],
                },
              },
            },
            {
              $addFields: {
                // Extract the time components
                hours: { $hour: "$startTime" },
                minutes: { $minute: "$startTime" },
                seconds: { $second: "$startTime" },
                // Determine AM or PM
                ampm: {
                  $cond: {
                    if: { $gte: ["$hours", 12] },
                    then: "PM",
                    else: "AM",
                  },
                },
                // Adjust hours for 12-hour format
              },
            },
            {
              $addFields: {
                minutes: {
                  $cond: [
                    { $gt: ["$minutes", 10] },
                    { $toString: "$minutes" },
                    { $concat: ["0", { $toString: "$minutes" }] },
                  ],
                },
                ampm: {
                  $cond: {
                    if: { $gte: ["$hours", 12] },
                    then: "PM",
                    else: "AM",
                  },
                },
                hours12: {
                  $cond: {
                    if: { $eq: ["$hours", 0] },
                    then: 12,
                    else: {
                      $cond: {
                        if: { $lte: ["$hours", 12] },
                        then: "$hours",
                        else: { $subtract: ["$hours", 12] },
                      },
                    },
                  },
                },
              },
            },
            {
              $addFields: {
                timeOfApp: {
                  $concat: [
                    { $toString: "$hours12" },
                    ":",
                    "$minutes",
                    " ",
                    "$ampm",
                  ],
                },
              },
            },
            {
              $project: {
                hours: 0,
                minutes: 0,
                ampm: 0,
                seconds: 0,
                hours12: 0,
              },
            },
            {
              $lookup: {
                from: "services",
                localField: "carDetails.serviceDetails.serviceId",
                foreignField: "_id",
                as: "appointmentServices",
              },
            },
          ],
          as: "appointment",
        },
      },
      {
        $lookup: {
          from: "services",
          localField: "carDetails.serviceDetails.serviceId",
          foreignField: "_id",
          as: "qServices",
        },
      },
      {
        $lookup: {
          from: "filmqualities",
          localField: "carDetails.serviceDetails.filmQualityId",
          foreignField: "_id",
          as: "qFilmQualities",
        },
      },
      {
        $lookup: {
          from: "notifications",
          localField: "_id",
          foreignField: "_id",
          pipeline: [
            {
              $project: {
                isReadBy: 1,
              },
            },
          ],
          as: "notification",
        },
      },
      {
        $project: {
          _id: 1,
          id: "$_id",
          title: 1,
          type: 1,
          entryId: 1,
          notificationTime: 1,
          isRead: {
            $cond: [
              {
                $in: [
                  new mongoose.Types.ObjectId(userId),
                  { $first: "$notification.isReadBy" },
                ],
              },
              true,
              false,
            ],
          },
          body: {
            $cond: {
              if: { $eq: ["$title", NOTIFICATIONS.TITLES.TAKEN_TO_SHOP] },
              then: this.takenToShopBody(),
              else: {
                $cond: {
                  if: {
                    $eq: ["$title", NOTIFICATIONS.TITLES.VEHICLE_COMPLETED],
                  },
                  then: this.vehicleCompletedBody(),
                  else: {
                    $cond: {
                      if: { $eq: ["$type", "Dealership appointment"] },
                      then: this.appointmentBody(),
                      else: this.entryCompletedBody(),
                    },
                  },
                },
              },
            },
          },
          description: {
            $cond: {
              if: { $eq: ["$title", NOTIFICATIONS.TITLES.TAKEN_TO_SHOP] },
              then: NOTIFICATIONS.DESCRIPTIONS.TAKEN_TO_SHOP,
              else: {
                $cond: {
                  if: {
                    $eq: ["$title", NOTIFICATIONS.TITLES.VEHICLE_COMPLETED],
                  },
                  then: NOTIFICATIONS.DESCRIPTIONS.VEHICLE_COMPLETED,
                  else: {
                    $cond: {
                      if: { $eq: ["$type", "Dealership appointment"] },
                      then: this.appointmentDescription(),
                      else: NOTIFICATIONS.DESCRIPTIONS.WAITING_LIST_COMPLETED,
                    },
                  },
                },
              },
            },
          },
          carId: 1,
          concernedStaffIds: 1,
          carDetails: {
            $map: {
              input: "$carDetails",
              as: "car",
              in: {
                ...entryUtils.getCarDetailsField("$$car"),
                serviceDetails: {
                  $map: {
                    input: "$$car.serviceDetails",
                    as: "serviceDetail",
                    in: {
                      serviceId: "$$serviceDetail.serviceId",
                      filmQualityId: "$$serviceDetail.filmQualityId",
                      filmQualityName: {
                        $first: {
                          $map: {
                            input: {
                              $filter: {
                                input: "$qFilmQualities",
                                cond: {
                                  $eq: [
                                    "$$serviceDetail.filmQualityId",
                                    "$$this._id",
                                  ],
                                },
                              },
                            },
                            in: "$$this.name",
                          },
                        },
                      },
                      serviceName: {
                        $first: {
                          $map: {
                            input: {
                              $filter: {
                                input: "$qServices",
                                cond: {
                                  $eq: [
                                    "$$serviceDetail.serviceId",
                                    "$$this._id",
                                  ],
                                },
                              },
                            },
                            in: "$$this.name",
                          },
                        },
                      },
                    },
                  },
                },
                serviceNames: entryUtils.serviceNames,
                serviceDoneIds: { $first: "$carDetails.serviceDoneIds" },
                customerId: { $first: "$carEntry.customerId" },
                customerName: { $first: "$carEntry.customerName" },
              },
            },
          },
        },
      },
      {
        $sort: { _id: -1 },
      },
    ];

    const vehicleQueuesPipeLine = [
      {
        $match: {
          carDetails: {
            $ne: [], // Remove documents where carDetails array is empty
          },
        },
      },
      {
        $unwind: "$carDetails",
      },
      {
        $group: {
          _id: "id",
          concernedStaffIds: { $first: "$concernedStaffIds" },
          carDetails: { $push: "$carDetails" },
        },
      },
    ];

    if (vehicleQueue) notificationPipeLine.push(...vehicleQueuesPipeLine);

    return Notification.aggregate(notificationPipeLine);
  };

  bodyVars = {
    firstName: { $first: "$user.firstName" },
    lastName: { $first: "$user.lastName" },
    vin: { $first: "$carDetails.vin" },
    serviceManager: {
      $concat: [{ $first: "$GM.firstName" }, " ", { $first: "$GM.lastName" }],
    },
  };

  takenToShopBody = () => {
    return {
      $let: {
        vars: this.bodyVars,
        in: {
          $concat: [
            "<p>Dear ",
            "$$firstName",
            " ",
            "$$lastName",
            ",<br><br>I trust this message finds you well. We would like to inform you that you have been assigned a vehicle to work on as part of your responsibilities. The assigned vehicle details are as follows:<br><br>",
            "<strong>",
            "VIN: ",
            "$$vin",
            "</strong>",
            "<br>You can commence working on this vehicle at your earliest convenience. To streamline the process, we have integrated a VIN scanning feature within the application. Please utilize the scanning options available in the application to scan the VIN of the assigned vehicle. This will enable you to access all pertinent details and initiate the necessary tasks seamlessly.<br><br>Your prompt attention to this assignment is highly appreciated. Should you encounter any issues or have inquiries, feel free to reach out to ",
            "<strong>",
            "$$serviceManager",
            "</strong>",
            " for assistance.<br><br>Thank you for your dedication and commitment to ensuring the efficiency of our operations.<br><br>Best regards,<br><br>ASWT</p>",
          ],
        },
      },
    };
  };

  vehicleCompletedBody() {
    return {
      $let: {
        vars: this.bodyVars,
        in: {
          $concat: [
            "<p>Dear ",
            "$$firstName",
            " ",
            "$$lastName",
            ",</p>",
            "<p>I hope this message finds you well. We are pleased to inform you that the vehicle you were waiting for has been successfully serviced by our dedicated staff and is now ready for pickup. The completed vehicle details are as follows:</p>",
            "<ul>",
            "<li><strong>VIN:</strong> ",
            "<strong>",
            "$$vin",
            "</strong>",
            "</li>",
            "<li><strong>Service Details:</strong> ",
            {
              $reduce: {
                input: "$servicesDone",
                initialValue: "",
                in: {
                  $concat: [
                    "$$value",
                    "<br>",
                    "<strong>",
                    "$$this.name",
                    "</strong>",
                  ],
                },
              },
            },
            "</li>",
            "</ul>",
            "<p>You may now proceed to collect the vehicle from its current location and return it to the customer slot. We appreciate your prompt attention to this matter, and we are confident that your efficiency will contribute to the overall satisfaction of our valued customers.</p>",
            "<p>If you have any questions or require further assistance, please do not hesitate to contact ",
            "<strong>",
            "$$serviceManager",
            "</strong>",
            ".</p>",
            "<p>Thank you for your continued commitment to providing excellent service.</p>",
            "<p>Best regards,<br>ASWT</p>",
          ],
        },
      },
    };
  }

  entryCompletedBody() {
    return {
      $let: {
        vars: this.bodyVars,
        in: {
          $concat: [
            "<p>Dear",
            " ",
            "$$firstName",
            " ",
            "$$lastName",
            ",",
            "</p>",
            "<p>I trust this message finds you well. We are pleased to inform you that all the vehicles on your waiting list have been successfully serviced by our dedicated staff. The completed vehicles' details are as follows:</p>",
            "<ol>",
            {
              $let: {
                vars: {
                  index: 0,
                },
                in: {
                  $reduce: {
                    input: { $first: "$entry.carDetails" },
                    initialValue: "",
                    in: {
                      $concat: [
                        "$$value",
                        "<strong>",
                        "Vehicle ",
                        {
                          $toString: {
                            $add: [
                              {
                                $indexOfArray: [
                                  { $first: "$entry.carDetails" },
                                  "$$this",
                                ],
                              },
                              1,
                            ],
                          },
                        },
                        "</strong>",
                        "<br>",
                        "<br>",
                        "VIN: ",
                        "$$this.vin",
                        "<br>",
                        "Service Details: ",
                        "[",
                        {
                          $reduce: {
                            input: "$$this.serviceNames",
                            initialValue: "",
                            in: {
                              $concat: [
                                "$$value",
                                { $cond: [{ $eq: ["$$value", ""] }, "", ", "] },
                                "$$this",
                              ],
                            },
                          },
                        },
                        "]",
                        "<br>",
                      ],
                    },
                  },
                },
              },
            },
            "</ol>",
            "<p>You may now proceed to collect these vehicles from their respective locations and ensure they are returned to the customer slots promptly. Your efficiency and dedication to timely service delivery are highly commendable.</p>",
            "<p>If you have any questions or require further assistance, please do not hesitate to contact",
            " ",
            "<strong>",
            "$$serviceManager",
            "</strong>",
            ".</p>",
            "<p>Thank you for your continued commitment to ensuring our customers' satisfaction.</p>",
            "<p>Best regards,<br>ASWT</p>",
          ],
        },
      },
    };
  }

  appointmentBody() {
    const startTime = { $first: "$appointment.startTime" };
    const priceBreakdownArr = {
      $first: "$appointment.appointmentServices",
    };
    const priceBreakdownArrLength = { $size: priceBreakdownArr };
    const currentIndex = { $indexOfArray: [priceBreakdownArr, "$$this"] };
    const nextIndexNumber = { $add: [currentIndex, 2] };

    return {
      $let: {
        vars: this.bodyVars,
        in: {
          $concat: [
            "<p>Dear",
            " ",
            "$$firstName",
            " ",
            "$$lastName",
            ",",
            "</p>",
            "<p>I trust this message finds you well. We are pleased to inform you that a client has successfully booked an",
            " appointment with our dealership, ",
            { $first: "$appointment.customerName" },
            ", for the date and time specified below:</p>",
            "<ul>",
            "<li><strong>Date: </strong>",
            { $first: "$appointment.convertedDate" },
            "</li>",
            "<li><strong>Time:</strong> ",
            { $first: "$appointment.timeOfApp" },
            "</li>",
            "<li><strong>Service Details: </strong> ",
            "(",
            {
              $reduce: {
                input: priceBreakdownArr,
                initialValue: "",
                in: {
                  $concat: [
                    "$$value",
                    "$$this.name",
                    {
                      $cond: [
                        { $lte: [nextIndexNumber, priceBreakdownArrLength] },
                        ", ",
                        "",
                      ],
                    },
                  ],
                },
              },
            },
            ")",
            "</li>",
            "</ul>",
            "<p>Your expertise and assistance are crucial in ensuring a seamless and successful appointment experience for our",
            " valued customer. Please proceed to ",
            { $first: "$appointment.customerName" },
            "'s store located at ",
            { $first: "$appointment.customerAddress" },
            " at least 15 minutes prior",
            " to the scheduled appointment time.</p>",
            "<p>Your responsibilities during the appointment include:</p>",
            "<ol>",
            "<li><strong>Warm Welcome:</strong> Greet the customer with a warm and friendly demeanor, introducing yourself",
            " and affirming your readiness to assist.</li>",
            "<li><strong>Appointment Verification:</strong> Confirm the customer's identity and the details of their",
            " appointment. Cross-check the information with our system to ensure accuracy.</li>",
            "<li><strong>Service Overview:</strong> Provide a brief overview of the services or tasks that will be performed",
            " during the appointment. Address any queries or concerns the customer may have.</li>",
            "<li><strong>Documentation:</strong> Ensure all necessary documents and materials are prepared and readily",
            " available for the appointment.</li>",
            "<li><strong>Professionalism:</strong> Maintain a professional and courteous attitude throughout the",
            " appointment. Address any issues or challenges promptly and efficiently.</li>",
            "</ol>",
            "<p>Please make sure to represent ASWT in the best possible manner, and if you encounter any unexpected issues,",
            " kindly report them to your immediate supervisor.</p>",
            "<p>Thank you for your dedication to delivering exceptional customer service. We appreciate your commitment to",
            " ensuring our customers have a positive experience with ASWT.</p>",
            "<p>Best regards,<br>ASWT</p>",
          ],
        },
      },
    };
  }

  appointmentDescription() {
    return {
      $concat: [
        "This is to inform you that an appointment has been successfully booked with Dealer ",
        "(",
        { $first: "$appointment.customerName" },
        ")",
        ". Your presence is required at the dealership store to facilitate the scheduled appointment. Please ensure that you are prepared and have all necessary materials for the appointment. Thank you for your prompt attention to this matter.",
      ],
    };
  }

  checkIfAUserHasReadANotification(staffId, notificationId) {
    return Notification.findOne({
      isReadBy: { $in: [staffId] },
      _id: notificationId,
    }).select("-concernedStaffIds -isReadBy");
  }

  getLatestNotificationForStaff(staffId) {
    return Notification.aggregate([
      {
        $unwind: "$concernedStaffIds",
      },
      {
        $addFields: {
          isRead: {
            $in: [new mongoose.Types.ObjectId(staffId), "$isReadBy"],
          },
          id: "$_id",
        },
      },
      {
        $match: {
          concernedStaffIds: new mongoose.Types.ObjectId(staffId),
          isRead: false,
          isDeleted: undefined,
        },
      },
      {
        $project: {
          isReadBy: 0,
        },
      },
      {
        $sort: {
          _id: -1,
        },
      },
    ]);
  }

  getAllNotifications() {
    return Notification.find().sort({ _id: -1 });
  }

  async updateNotificationById(id, notification) {
    return await Notification.findByIdAndUpdate(
      id,
      {
        $set: notification,
      },
      { new: true }
    );
  }

  removeNotificationForStaff(carId, session) {
    return Notification.findOneAndUpdate(
      { carId },
      { $set: { isDeleted: true } },
      { session }
    );
  }

  async deleteNotification(id) {
    return await Notification.findByIdAndRemove(id);
  }
}

module.exports = new NotificationService();
