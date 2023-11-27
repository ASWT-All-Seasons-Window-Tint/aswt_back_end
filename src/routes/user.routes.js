const validateMiddleware = require("../middleware/validate.middleware");
const admin = require("../middleware/admin.middleware");
const staffMiddleware = require("../middleware/staff.middleware");
const auth = require("../middleware/auth.middleware");
const _ = require("lodash");
const express = require("express");
const router = express.Router();
const asyncMiddleware = require("../middleware/async.middleware");
const validateObjectId = require("../middleware/validateObjectId.middleware");
const userController = require("../controllers/user.controllers");
const managerMiddleware = require("../middleware/manager.middleware");
const roleBaseAuth = require("../middleware/roleBaseAuth.middleware.");
const adminOrManagerMiddleware = require("../middleware/adminOrManager.middleware");
const validateroleMiddleware = require("../middleware/validaterole.middleware");
const { user } = require("../model/user.model");
const validateObjectIdWithXArgMiddleware = require("../middleware/validateObjectIdWithXArg.middleware");
const roleBaseAuthMiddleware = require("../middleware/roleBaseAuth.middleware.");
const addRoleMiddleware = require("../middleware/addRole.middleware");
const validDateParamsMiddleware = require("../middleware/validDateParams.middleware");

const {
  validate,
  validatePatch,
  validateUpdatePassword,
  validateResetPassword,
  validateRequestResetPassword,
} = user;

// This is used for registering a new user.
router.post(
  "/",
  auth,
  roleBaseAuth(["admin", "customer", "gm", "manager"]),
  addRoleMiddleware,
  validateMiddleware(validate),
  asyncMiddleware(userController.register)
);
router.post(
  "/request-reset",
  validateMiddleware(validateRequestResetPassword),
  asyncMiddleware(userController.passwordResetRequest)
);
router.post(
  "/reset-password/:token",
  validateMiddleware(validateResetPassword),
  asyncMiddleware(userController.passwordReset)
);

router.get(
  "/",
  auth,
  adminOrManagerMiddleware,
  asyncMiddleware(userController.fetchAllUsers)
);

router.get(
  "/staffs-not-added-for-manager/:managerId",
  auth,
  adminOrManagerMiddleware,
  asyncMiddleware(userController.getDocumentsExcludingIDs)
);

router.get(
  "/logged-in-users",
  auth,
  adminOrManagerMiddleware,
  asyncMiddleware(userController.getLoggedInStaffs)
);

router.get(
  "/employees",
  auth,
  adminOrManagerMiddleware,
  asyncMiddleware(userController.getEmployees)
);

router.get(
  "/staff",
  auth,
  roleBaseAuth(["porter", "staff"]),
  asyncMiddleware(userController.gethUserById)
);

router.get(
  "/staff-total-earning-per-date/start/:startDate/end/:endDate",
  auth,
  validDateParamsMiddleware,
  roleBaseAuth(["gm", "admin"]),
  asyncMiddleware(userController.getTotalAmountEarnedByStaffInASpecifiedTime)
);

router.get(
  "/staff-total-earning-per-date/start/:startDate/end/:endDate/:staffId",
  auth,
  validateObjectIdWithXArgMiddleware(["staffId"]),
  roleBaseAuth(["gm", "admin"]),
  asyncMiddleware(userController.getTotalAmountEarnedByStaffInASpecifiedTime)
);

router.get(
  "/staffs",
  auth,
  managerMiddleware,
  asyncMiddleware(userController.getStaffsByDepartments)
);

router.get(
  "/role/:role",
  auth,
  validateroleMiddleware,
  asyncMiddleware(userController.getUsersByRole)
);

router.get(
  "/:id",
  auth,
  validateObjectId,
  adminOrManagerMiddleware,
  asyncMiddleware(userController.gethUserById)
);

router.put(
  "/update-password",
  auth,
  validateMiddleware(validateUpdatePassword),
  asyncMiddleware(userController.updateUserPassword)
);

router.put(
  "/update-staff-permission-for-manager/:managerId",
  auth,
  admin,
  validateObjectIdWithXArgMiddleware(["managerId"]),
  validateMiddleware(user.updateManagerPermission),
  asyncMiddleware(userController.updateStaffLocationsVisibleToManager)
);

router.put(
  "/:id",
  validateObjectId,
  // auth is used to make authenticate a user.
  auth,
  roleBaseAuthMiddleware(["admin", "gm", "manager"]),
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
