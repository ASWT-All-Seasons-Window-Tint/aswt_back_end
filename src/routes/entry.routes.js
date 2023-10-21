const validateMiddleware = require("../middleware/validate.middleware");
const { joiValidator } = require("../model/entry.model");
const admin = require("../middleware/admin.middleware");
const auth = require("../middleware/auth.middleware");
const manager = require("../middleware/manager.middleware");
const express = require("express");
const router = express.Router();
const asyncMiddleware = require("../middleware/async.middleware");
const qboAsyncMiddleware = require("../middleware/qboAsync.middleware");
const validateObjectId = require("../middleware/validateObjectId.middleware");
const entryController = require("../controllers/entry.controllers");
const validateObjectIdWithXArgMiddleware = require("../middleware/validateObjectIdWithXArg.middleware");
const adminOrManagerMiddleware = require("../middleware/adminOrManager.middleware");
const staffMiddleware = require("../middleware/staff.middleware");
const validateServiceIdsMiddleware = require("../middleware/validateServiceIds.middleware");
const validateMonthYearParamsMiddleware = require("../middleware/validateMonthYearParams.middleware");
const validateDateParams = require("../middleware/validDateParams.middleware");
const roleBaseAuth = require("../middleware/roleBaseAuth.middleware.");

const {
  validate,
  validatePatch,
  validateAddVin,
  validateAddInvoicePatch,
  validateModifyPrice,
  validateModifyCarDetails,
  validateModifyServiceDone,
} = joiValidator;

router.post(
  "/",
  [auth, adminOrManagerMiddleware, validateMiddleware(validate)],
  asyncMiddleware(entryController.createEntry)
);

router.get("/", auth, asyncMiddleware(entryController.fetchAllEntries));

router.get(
  "/:id",
  auth,
  validateObjectId,
  asyncMiddleware(entryController.getEntryById)
);

router.get(
  "/vin/:vin",
  // auth,
  //validateObjectIdWithXArgMiddleware(["customerId"]),
  qboAsyncMiddleware(entryController.getCarByVin)
);
router.get(
  "/customer/vin/:customerId/:vin",
  // auth,
  //validateObjectIdWithXArgMiddleware(["customerId"]),
  qboAsyncMiddleware(entryController.getCarsDoneForCustomer)
);
router.get(
  "/customer/:customerId",
  auth,
  //validateObjectIdWithXArgMiddleware(["customerId"]),
  qboAsyncMiddleware(entryController.getEntryById)
);

router.get(
  "/entry/:entryId/customer/:customerId/staff/:staffId",
  auth,
  validateObjectIdWithXArgMiddleware(["staffId"]),
  qboAsyncMiddleware(entryController.getCarsDoneByStaffPerId)
);

router.get(
  "/customer/:customerId/staff/:staffId",
  auth,
  validateObjectIdWithXArgMiddleware(["staffId"]),
  qboAsyncMiddleware(entryController.getCarsDoneByStaffPerId)
);

router.get(
  "/customer/:customerId/porter/:staffId",
  auth,
  validateObjectIdWithXArgMiddleware(["staffId"]),
  qboAsyncMiddleware(entryController.getCarsDoneByStaffPerId)
);

router.get(
  "/entry/:entryId/staff/:staffId",
  auth,
  validateObjectIdWithXArgMiddleware(["entryId", "staffId"]),
  asyncMiddleware(entryController.getCarsDoneByStaffPerId)
);

router.get(
  "/staff/:staffId/date/:date",
  auth,
  validateDateParams,
  validateMonthYearParamsMiddleware,
  validateObjectIdWithXArgMiddleware(["staffId"]),
  asyncMiddleware(entryController.getCarsDoneByStaff)
);
router.get(
  "/staff/:staffId/year/:year",
  auth,
  validateMonthYearParamsMiddleware,
  validateObjectIdWithXArgMiddleware(["staffId"]),
  asyncMiddleware(entryController.getCarsDoneByStaff)
);

router.get(
  "/staff/:staffId/month/:monthName/:year",
  auth,
  validateObjectIdWithXArgMiddleware(["staffId"]),
  validateMonthYearParamsMiddleware,
  asyncMiddleware(entryController.getCarsDoneByStaff)
);

router.get(
  "/staff/:staffId",
  auth,
  validateObjectIdWithXArgMiddleware(["staffId"]),
  asyncMiddleware(entryController.getCarsDoneByStaff)
);

router.put(
  "/modify-car/:id/vin/:vin",
  [
    validateObjectId,
    auth,
    staffMiddleware,
    validateMiddleware(validateModifyCarDetails),
    validateServiceIdsMiddleware,
  ],
  asyncMiddleware(entryController.modifyCarDetails)
);

router.put(
  "/:id",
  [
    validateObjectId,
    auth,
    adminOrManagerMiddleware,
    validateMiddleware(validatePatch),
  ],
  asyncMiddleware(entryController.updateEntry)
);

router.put(
  "/add-car/:id",
  [
    auth,
    roleBaseAuth(["porter", "staff"]),
    validateMiddleware(validateAddInvoicePatch),
  ],
  qboAsyncMiddleware(entryController.addInvoice)
);

router.put(
  "/update-car-service/:vin",
  [
    auth,
    roleBaseAuth(["staff"]),
    validateMiddleware(validateModifyServiceDone),
  ],
  qboAsyncMiddleware(entryController.updateCarDoneByStaff)
);

router.put(
  "/add-vin/:id",
  auth,
  roleBaseAuth(["customer"]),
  [validateMiddleware(validateAddVin)],
  qboAsyncMiddleware(entryController.addVin)
);

router.put(
  "/modify-price/:id",
  [
    validateObjectId,
    auth,
    adminOrManagerMiddleware,
    validateMiddleware(validateModifyPrice),
  ],
  asyncMiddleware(entryController.modifyPrice)
);

router.delete(
  "/:id",
  [auth, admin, validateObjectId],
  asyncMiddleware(entryController.deleteEntry)
);
module.exports = router;
