const notificationService = require("../services/notification.services");
const {
  errorMessage,
  successMessage,
  jsonResponse,
  badReqResponse,
  notFoundResponse,
} = require("../common/messages.common");
const { MESSAGES } = require("../common/constants.common");
const { default: mongoose } = require("mongoose");
const userServices = require("../services/user.services");

class NotificationController {
  async getStatus(req, res) {
    res.status(200).send({ message: MESSAGES.DEFAULT, success: true });
  }

  //get notification from the database, using their email
  async getNotificationsForStaff(req, res) {
    const { userId } = req.params;

    const user = await userServices.getUserById(userId);
    if (!user)
      return notFoundResponse(res, "Can't find user with the given ID");

    const isUserStaff = user.role === "staff";

    const notificationsForStaff =
      await notificationService.getAllNotificationsForUser({
        userId,
        isUserStaff,
      });

    res.send(successMessage(MESSAGES.FETCHED, notificationsForStaff));
  }

  async getVehicleInQueues(req, res) {
    const { userId } = req.params;

    const user = await userServices.getUserById(userId);

    if (!user)
      return notFoundResponse(res, "Can't find user with the given ID");

    const isUserStaff = user.role === "staff";

    const vehicleInQueues =
      await notificationService.getAllNotificationsForUser({
        userId,
        vehicleQueue: true,
        isUserStaff,
      });

    res.send(successMessage(MESSAGES.FETCHED, vehicleInQueues));
  }

  async getLatestNotificationForStaff(req, res) {
    const { userId } = req.params;

    const user = await userServices.getUserById(userId);

    if (!user)
      return notFoundResponse(res, "Can't find user with the given ID");

    const isUserStaff = user.role === "staff";

    const [latestNotificationsForStaff] =
      await notificationService.getAllNotificationsForUser({
        userId,
        vehicleQueue: false,
        isUserStaff,
      });

    if (!latestNotificationsForStaff)
      return jsonResponse(res, 404, false, "No notification yet for the user");

    res.send(successMessage(MESSAGES.FETCHED, latestNotificationsForStaff));
  }

  //get all entries in the notification collection/table
  async fetchAllNotifications(req, res) {
    const notifications = await notificationService.getAllNotifications();

    res.send(successMessage(MESSAGES.FETCHED, notifications));
  }

  async updateIsReadBy(req, res) {
    const userId = req.user._id;
    const { notificationId } = req.params;

    const notification = await notificationService.getNotificationById(
      notificationId
    );
    if (!notification)
      return res.status(404).send(errorMessage("notification"));

    const { isReadBy } = notification;

    if (isReadBy.includes(new mongoose.Types.ObjectId(userId)))
      return badReqResponse(res, "The user has already read the message");

    await notificationService.updateIsReadBy(userId, notificationId);

    jsonResponse(
      res,
      200,
      true,
      "The notification has been marked as read for the user"
    );
  }
  //Update/edit notification data
  async updateNotification(req, res) {
    const notification = await notificationService.getNotificationById(
      req.params.id
    );
    if (!notification)
      return res.status(404).send(errorMessage("notification"));

    let updatedNotification = req.body;
    updatedNotification = await notificationService.updateNotificationById(
      req.params.id,
      updatedNotification
    );

    res.send(successMessage(MESSAGES.UPDATED, updatedNotification));
  }

  async checkIfAUserHasReadANotification(req, res) {
    const { notificationId, userId } = req.params;

    const isNotificationRead =
      await notificationService.checkIfAUserHasReadANotification(
        userId,
        notificationId
      );

    if (!isNotificationRead)
      return jsonResponse(
        res,
        404,
        false,
        "The user hasn't read the notification"
      );

    res.send(successMessage(MESSAGES.FETCHED, isNotificationRead));
  }

  //Delete notification account entirely from the database
  async deleteNotification(req, res) {
    const notification = await notificationService.getNotificationById(
      req.params.id
    );
    if (!notification)
      return res.status(404).send(errorMessage("notification"));

    await notificationService.deleteNotification(req.params.id);

    res.send(successMessage(MESSAGES.DELETED, notification));
  }
}

module.exports = new NotificationController();
