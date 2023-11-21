const { Notification } = require("../model/notification.model").notification;

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
  async createNotification(notificationBody) {
    const notification = new Notification({ ...notificationBody });

    return notification.save();
  }

  async getNotificationById(notificationId) {
    return await Notification.findById(notificationId);
  }

  getNotificationsForStaff(staffId) {
    return Notification.find({ concernedStaffIds: { $in: [staffId] } }).select(
      "-concernedStaffIds -isReadBy"
    );
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

  async getAllNotifications() {
    return await Notification.find().sort({ _id: -1 });
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

  async deleteNotification(id) {
    return await Notification.findByIdAndRemove(id);
  }
}

module.exports = new NotificationService();
