const express = require("express");
const validateMiddleware = require("../middleware/validate.middleware");
const auth = require("../middleware/auth.middleware");
const admin = require("../middleware/admin.middleware");
const router = express.Router();
const asyncMiddleware = require("../middleware/async.middleware");
const validateObjectId = require("../middleware/validateObjectId.middleware");
const validateObjectIdWithXArg = require("../middleware/validateObjectIdWithXArg.middleware");
const notificationController = require("../controllers/notification.controllers");
const companyMiddleware = require("../middleware/company.middleware");

router.get(
  "/",
  auth,
  admin,
  asyncMiddleware(notificationController.fetchAllNotifications)
);

router.get(
  "/user/:userId",
  auth,
  validateObjectIdWithXArg(["userId"]),
  asyncMiddleware(notificationController.getNotificationsForStaff)
);

router.get(
  "/vehicle-in-queue/:userId",
  auth,
  validateObjectIdWithXArg(["userId"]),
  asyncMiddleware(notificationController.getVehicleInQueues)
);

router.get(
  "/has-user-read-notification/user/:userId/notification/:notificationId",
  auth,
  admin,
  validateObjectIdWithXArg(["userId", "notificationId"]),
  asyncMiddleware(notificationController.checkIfAUserHasReadANotification)
);

router.get(
  "/latest-notification/:userId",
  auth,
  validateObjectIdWithXArg(["userId"]),
  asyncMiddleware(notificationController.getLatestNotificationForStaff)
);

router.put(
  "/is-read-by/:notificationId",
  validateObjectIdWithXArg(["notificationId"]),
  // auth is used to make authenticate a notification.
  auth,
  asyncMiddleware(notificationController.updateIsReadBy)
);

router.put(
  "/:id",
  validateObjectId,
  // auth is used to make authenticate a notification.
  auth,
  asyncMiddleware(notificationController.updateNotification)
);

router.delete(
  "/:id",
  validateObjectId,
  auth,
  admin,
  asyncMiddleware(notificationController.deleteNotification)
);
module.exports = router;
