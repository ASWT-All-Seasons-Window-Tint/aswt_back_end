const { Notification } = require("../model/notification.model").notification;
const mongoose = require("mongoose");
const entryUtils = require("../utils/entry.utils");
const { Service } = require("../model/service.model");
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
    const notification = new Notification({ ...notificationBody });

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
        $project: {
          _id: 1,
          title: 1,
          type: 1,
          entryId: 1,
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
                  else: this.entryCompletedBody(),
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
                  else: NOTIFICATIONS.DESCRIPTIONS.WAITING_LIST_COMPLETED,
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
                serviceNames: entryUtils.serviceNames,
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
            ",\n\nI trust this message finds you well. We would like to inform you that you have been assigned a vehicle to work on as part of your responsibilities. The assigned vehicle details are as follows:\n\nVIN: ",
            "$$vin",
            "\nYou can commence working on this vehicle at your earliest convenience. To streamline the process, we have integrated a VIN scanning feature within the application. Please utilize the scanning options available in the application to scan the VIN of the assigned vehicle. This will enable you to access all pertinent details and initiate the necessary tasks seamlessly.\n\nYour prompt attention to this assignment is highly appreciated. Should you encounter any issues or have inquiries, feel free to reach out to ",
            "$$serviceManager",
            " for assistance.\n\nThank you for your dedication and commitment to ensuring the efficiency of our operations.\n\nBest regards,\n\nASWT</p>",
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
            "$$vin",
            "</li>",
            "<li><strong>Service Details:</strong> ",
            {
              $reduce: {
                input: "$services",
                initialValue: "",
                in: {
                  $concat: ["$$value", "<br>", "$$this.name"],
                },
              },
            },
            "</li>",
            "</ul>",
            "<p>You may now proceed to collect the vehicle from its current location and return it to the customer slot. We appreciate your prompt attention to this matter, and we are confident that your efficiency will contribute to the overall satisfaction of our valued customers.</p>",
            "<p>If you have any questions or require further assistance, please do not hesitate to contact ",
            "$$serviceManager",
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
            "$$firstName",
            " ",
            "$$lastName",
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
                        "<br>",
                        "VIN: ",
                        "$$this.vin",
                        "<br>",
                        "Service Details: <br>",
                        {
                          $reduce: {
                            input: "$$this.serviceNames",
                            initialValue: "",
                            in: {
                              $concat: ["$$value", "$$this", "<br>"],
                            },
                          },
                        },
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
            "$$serviceManager",
            ".</p>",
            "<p>Thank you for your continued commitment to ensuring our customers' satisfaction.</p>",
            "<p>Best regards,<br>ASWT</p>",
          ],
        },
      },
    };
  }

  checkIfAUserHasReadANotification(staffId, notificationId) {
    return Notification.findOne({
      isReadBy: { $in: [staffId] },
      _id: notificationId,
    }).select("-concernedStaffIds -isReadBy");
  }

  getLatestNotificationForStaff(staffId) {
    return Notification.findOne({ concernedStaffIds: { $in: [staffId] } })
      .select("-concernedStaffIds -isReadBy")
      .sort({ _id: -1 });
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
