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
const addLocationTypeMiddleware = require("../middleware/addLocationType.middleware");
const addWaitingListMiddleware = require("../middleware/addWaitingList.middleware");

const {
  validate,
  validatePatch,
  validateAddVin,
  validateAddInvoicePatch,
  validateModifyPrice,
  validateModifyCarDetails,
  validateModifyServiceDone,
  validateAddCarGeolocation,
} = joiValidator;

router.post(
  "/",
  [auth, adminOrManagerMiddleware, validateMiddleware(validate)],
  asyncMiddleware(entryController.createEntry)
);

router.get("/", auth, asyncMiddleware(entryController.fetchAllEntries));

router.get(
  "/vehicles-in-the-shop",
  auth,
  admin,
  asyncMiddleware(entryController.getAllVehiclesInTheShop)
);

router.get(
  "/:id",
  auth,
  validateObjectId,
  asyncMiddleware(entryController.getEntryById)
);

router.get(
  "/invoice/sent-out-invoices",
  auth,
  admin,
  asyncMiddleware(entryController.getSentInvoices)
);

router.get(
  "/appointments/:customerId",
  auth,
  asyncMiddleware(entryController.getAllAppointmentEntriesPerCustomerId)
);

router.get(
  "/car-work-in-progress-duration/:vin",
  auth,
  admin,
  asyncMiddleware(entryController.getCarThatIsStillInShopByVin)
);

router.get(
  "/vin/:vin",
  auth,
  //validateObjectIdWithXArgMiddleware(["customerId"]),
  qboAsyncMiddleware(entryController.getCarByVin)
);
router.get(
  "/current/:locationType/location/:porterId",
  // auth,
  addLocationTypeMiddleware(),
  validateObjectIdWithXArgMiddleware(["porterId"]),
  qboAsyncMiddleware(entryController.getCurrentLocation)
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
  "/highest-to-lowest-roi/:customerId",
  auth,
  //validateObjectIdWithXArgMiddleware(["customerId"]),
  asyncMiddleware(entryController.sortCarDetailsByPrice)
);

router.get(
  "/entry/:entryId/customer/:customerId/staff/:staffId",
  auth,
  validateObjectIdWithXArgMiddleware(["staffId"]),
  qboAsyncMiddleware(entryController.getCarsDoneByStaffPerId)
);

router.get(
  "/entry/:entryId/customer/:customerId/porterId/:porterId",
  auth,
  validateObjectIdWithXArgMiddleware(["porterId", "entryId"]),
  addWaitingListMiddleware(true),
  qboAsyncMiddleware(entryController.getCarsDoneByStaffPerId)
);

router.get(
  "/customer/:customerId/staff/:staffId",
  auth,
  validateObjectIdWithXArgMiddleware(["staffId"]),
  qboAsyncMiddleware(entryController.getCarsDoneByStaffPerId)
);

router.get(
  "/customer/:customerId/porter/:porterId",
  auth,
  validateObjectIdWithXArgMiddleware(["porterId"]),
  addWaitingListMiddleware(true),
  qboAsyncMiddleware(entryController.getCarsDoneByStaffPerId)
);

router.get(
  "/pending-drop-off/:porterId",
  auth,
  validateObjectIdWithXArgMiddleware(["porterId"]),
  addWaitingListMiddleware(false),
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
  "/porter/:porterId/date/:date",
  auth,
  validateDateParams,
  validateMonthYearParamsMiddleware,
  validateObjectIdWithXArgMiddleware(["porterId"]),
  asyncMiddleware(entryController.getCarsDoneByStaff)
);
router.get(
  "/porter/:porterId/year/:year",
  auth,
  validateMonthYearParamsMiddleware,
  validateObjectIdWithXArgMiddleware(["porterId"]),
  asyncMiddleware(entryController.getCarsDoneByStaff)
);

router.get(
  "/porter/:porterId/month/:monthName/:year",
  auth,
  validateObjectIdWithXArgMiddleware(["porterId"]),
  validateMonthYearParamsMiddleware,
  asyncMiddleware(entryController.getCarsDoneByStaff)
);

router.get(
  "/staff/:staffId",
  auth,
  validateObjectIdWithXArgMiddleware(["staffId"]),
  asyncMiddleware(entryController.getCarsDoneByStaff)
);

router.get(
  "/porter/:porterId",
  auth,
  validateObjectIdWithXArgMiddleware(["porterId"]),
  asyncMiddleware(entryController.getCarsDoneByStaffPerId)
);

router.get(
  "/completed-trips/:porterId",
  auth,
  validateObjectIdWithXArgMiddleware(["porterId"]),
  addWaitingListMiddleware("completed"),
  asyncMiddleware(entryController.getCarsDoneByStaffPerId)
);

router.put(
  "/modify-car/:id/vin/:vin",
  [
    validateObjectId,
    auth,
    validateMiddleware(validateModifyCarDetails),
    validateServiceIdsMiddleware,
  ],
  asyncMiddleware(entryController.modifyCarDetails)
);

router.put(
  "/add/:locationType/location/:vin",
  [
    auth,
    validateMiddleware(validateAddCarGeolocation),
    addLocationTypeMiddleware(),
  ],
  asyncMiddleware(entryController.addCarGeoLocation)
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
  [auth, validateMiddleware(validateAddInvoicePatch)],
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
  "/update-car-service-by-car-id/:carId",
  [
    auth,
    roleBaseAuth(["staff"]),
    validateObjectIdWithXArgMiddleware(["carId"]),
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
    roleBaseAuth(["admin", "gm"]),
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
