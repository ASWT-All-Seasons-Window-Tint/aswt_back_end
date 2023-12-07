const validateMiddleware = require("../middleware/validate.middleware");
const admin = require("../middleware/admin.middleware");
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
const qboAsyncMiddleware = require("../middleware/qboAsync.middleware");

const {
  addEarningRate,
  validate,
  validatePatch,
  validateAssignDealer,
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
  "/staff-for-dealership",
  auth,
  roleBaseAuth(["customer"]),
  asyncMiddleware(userController.fetchAllDealershipStaffs)
);

router.get(
  "/dealership-for-staff",
  auth,
  roleBaseAuth(["staff"]),
  qboAsyncMiddleware(userController.getDealershipsAssignedToStaff)
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
  "/staff-assigned-to-dealership",
  auth,
  roleBaseAuth(["customer"]),
  asyncMiddleware(userController.fetchStaffsAssignedToDealership)
);

router.get(
  "/staff-assigned-to-dealership/:customerId",
  auth,
  roleBaseAuth(["admin"]),
  asyncMiddleware(userController.fetchStaffsAssignedToDealership)
);

router.get(
  "/staff-total-earning-per-date/start/:startDate/end/:endDate",
  auth,
  validDateParamsMiddleware(7, true),
  roleBaseAuth(["gm", "admin"]),
  asyncMiddleware(userController.getTotalAmountEarnedByStaffInASpecifiedTime)
);

router.get(
  "/staff-total-earning-per-date/start/:startDate/end/:endDate/:staffId",
  auth,
  validDateParamsMiddleware(7, true),
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
  "/update-staff-dealership/:staffId",
  validateObjectIdWithXArgMiddleware(["staffId"]),
  auth,
  admin,
  validateMiddleware(validateAssignDealer),
  asyncMiddleware(userController.assignOrRemoveDealerFromStaff)
);

router.put(
  "/update-staff-earning-rates/:staffId",
  validateObjectIdWithXArgMiddleware(["staffId"]),
  auth,
  roleBaseAuth(["admin", "gm"]),
  validateMiddleware(addEarningRate),
  asyncMiddleware(userController.updateStaffEarningRates)
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
