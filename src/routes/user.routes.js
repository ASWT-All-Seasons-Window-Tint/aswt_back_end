const validateMiddleware = require("../middleware/validate.middleware");
const admin = require("../middleware/admin.middleware");
const auth = require("../middleware/auth.middleware");
const bcrypt = require("bcrypt");
const _ = require("lodash");
const { validate, validatePatch } = require("../model/user.model");
const express = require("express");
const router = express.Router();
const asyncMiddleware = require("../middleware/async.middleware");
const validateObjectId = require("../middleware/validateObjectId.middleware");
const userController = require("../controllers/user.controllers");
const managerMiddleware = require("../middleware/manager.middleware");
const adminOrManagerMiddleware = require("../middleware/adminOrManager.middleware");

// This is used for registering a new user.
router.post(
  "/",
  auth,
  adminOrManagerMiddleware,
  validateMiddleware(validate),
  asyncMiddleware(userController.register)
);
router.post(
  "/request-reset",
  validateMiddleware(validatePatch),
  asyncMiddleware(userController.passwordResetRequest)
);
router.get(
  "/reset-password/:token",

  asyncMiddleware(userController.passwordReset)
);

router.get("/", auth, admin, asyncMiddleware(userController.fetchAllUsers));

router.get(
  "/staffs",
  auth,
  managerMiddleware,
  asyncMiddleware(userController.getStaffsByDepartments)
);

router.get(
  "/:id",
  validateObjectId,
  auth,
  admin,
  asyncMiddleware(userController.gethUserById)
);

router.put(
  "/:id",
  validateObjectId,
  // auth is used to make authenticate a user.
  auth,
  validateMiddleware(validatePatch),
  asyncMiddleware(userController.updateUserProfile)
);

router.delete(
  "/:id",
  validateObjectId,
  auth,
  admin,
  asyncMiddleware(userController.deleteUserAccount)
);
module.exports = router;
