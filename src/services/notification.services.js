const { Notification } = require("../model/notification.model").notification;
const mongoose = require("mongoose");
const entryUtils = require("../utils/entry.utils");

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

  getAllNotificationsForUser = ({ userId, vehicleQueue }) => {
    console.log(userId);
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
          body: {
            $first: "$body",
          },
          carId: {
            $first: "$carId",
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
        $project: {
          _id: 1,
          title: 1,
          body: 1,
          carId: 1,
          concernedStaffIds: 1,
          carDetails: {
            $map: {
              input: "$carDetails",
              as: "car",
              in: {
                ...entryUtils.getCarDetailsField("$$car"),
                serviceNames: entryUtils.serviceNames,
              },
            },
          },
        },
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
