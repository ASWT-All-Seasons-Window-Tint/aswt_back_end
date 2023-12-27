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
const roleBaseAuthMiddleware = require("../middleware/roleBaseAuth.middleware.");
const { ALLOWED_USERS_FOR_MOBILE_APP } = require("../common/constants.common");

const withoutStaff = ALLOWED_USERS_FOR_MOBILE_APP.filter(
  (user) => user !== "staff"
);

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
  [auth, roleBaseAuthMiddleware(["customer"]), validateMiddleware(validate)],
  asyncMiddleware(entryController.createEntry)
);

router.get(
  "/",
  auth,
  roleBaseAuth(["admin", "gm", "receptionist"]),
  asyncMiddleware(entryController.fetchAllEntries)
);

router.get(
  "/vehicles-in-the-shop",
  auth,
  roleBaseAuth(["admin", "gm"]),
  asyncMiddleware(entryController.getAllVehiclesInTheShop)
);

router.get(
  "/driving-speed",
  auth,
  roleBaseAuth(["admin", "gm"]),
  asyncMiddleware(entryController.getDrivingSpeedForPorter)
);

router.get(
  "/:id",
  auth,
  roleBaseAuth(["admin", "gm"]),
  validateObjectId,
  asyncMiddleware(entryController.getEntryById)
);

router.get(
  "/invoice/sent-out-invoices",
  auth,
  roleBaseAuth(["admin", "gm"]),
  asyncMiddleware(entryController.getSentInvoices)
);

router.get(
  "/appointments/all",
  auth,
  asyncMiddleware(entryController.getAllAppointmentEntriesPerCustomerId)
);

router.get(
  "/appointments/:customerId",
  auth,
  asyncMiddleware(entryController.getAllAppointmentEntriesPerCustomerId)
);

router.get(
  "/car-work-in-progress-duration/:vin",
  auth,
  roleBaseAuth(["admin", "gm"]),
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
  roleBaseAuth(withoutStaff),
  validateObjectIdWithXArgMiddleware(["porterId", "entryId"]),
  addWaitingListMiddleware(true),
  qboAsyncMiddleware(entryController.getCarsDoneByStaffPerId)
);

router.get(
  "/customer/:customerId/staff/:staffId",
  auth,
  roleBaseAuth(["admin", "gm", "staff"]),
  validateObjectIdWithXArgMiddleware(["staffId"]),
  qboAsyncMiddleware(entryController.getCarsDoneByStaffPerId)
);

router.get(
  "/customer/:customerId/porter/:porterId",
  auth,
  roleBaseAuth(withoutStaff),
  validateObjectIdWithXArgMiddleware(["porterId"]),
  addWaitingListMiddleware(true),
  qboAsyncMiddleware(entryController.getCarsDoneByStaffPerId)
);

router.get(
  "/pending-drop-off/:porterId",
  auth,
  roleBaseAuth(withoutStaff),
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
  roleBaseAuth(["admin", "gm", "staff"]),
  validateDateParams(7),
  validateMonthYearParamsMiddleware,
  validateObjectIdWithXArgMiddleware(["staffId"]),
  asyncMiddleware(entryController.getCarsDoneByStaff)
);
router.get(
  "/staff/:staffId/year/:year",
  auth,
  roleBaseAuth(["admin", "gm", "staff"]),
  validateMonthYearParamsMiddleware,
  validateObjectIdWithXArgMiddleware(["staffId"]),
  asyncMiddleware(entryController.getCarsDoneByStaff)
);

router.get(
  "/staff/:staffId/month/:monthName/:year",
  auth,
  roleBaseAuth(["admin", "gm", "staff"]),
  validateObjectIdWithXArgMiddleware(["staffId"]),
  validateMonthYearParamsMiddleware,
  asyncMiddleware(entryController.getCarsDoneByStaff)
);

router.get(
  "/porter/:porterId/date/:date",
  auth,
  roleBaseAuth(withoutStaff),
  validateDateParams(7),
  validateMonthYearParamsMiddleware,
  validateObjectIdWithXArgMiddleware(["porterId"]),
  asyncMiddleware(entryController.getCarsDoneByStaff)
);
router.get(
  "/porter/:porterId/year/:year",
  auth,
  roleBaseAuth(withoutStaff),
  validateMonthYearParamsMiddleware,
  validateObjectIdWithXArgMiddleware(["porterId"]),
  asyncMiddleware(entryController.getCarsDoneByStaff)
);

router.get(
  "/porter/:porterId/month/:monthName/:year",
  auth,
  roleBaseAuth(withoutStaff),
  validateObjectIdWithXArgMiddleware(["porterId"]),
  validateMonthYearParamsMiddleware,
  asyncMiddleware(entryController.getCarsDoneByStaff)
);

router.get(
  "/staff/:staffId",
  auth,
  roleBaseAuth(["admin", "gm", "staff", "manager"]),
  validateObjectIdWithXArgMiddleware(["staffId"]),
  asyncMiddleware(entryController.getCarsDoneByStaff)
);

router.get(
  "/porter/:porterId",
  auth,
  roleBaseAuth(withoutStaff),
  validateObjectIdWithXArgMiddleware(["porterId"]),
  asyncMiddleware(entryController.getCarsDoneByStaffPerId)
);

router.get(
  "/completed-trips/:porterId",
  auth,
  roleBaseAuth(withoutStaff),
  validateObjectIdWithXArgMiddleware(["porterId"]),
  addWaitingListMiddleware("completed"),
  asyncMiddleware(entryController.getCarsDoneByStaffPerId)
);

router.put(
  "/modify-car/:id/vin/:vin",
  [
    validateObjectId,
    auth,
    roleBaseAuth(ALLOWED_USERS_FOR_MOBILE_APP),
    validateMiddleware(validateModifyCarDetails),
    validateServiceIdsMiddleware,
  ],
  asyncMiddleware(entryController.modifyCarDetails)
);

router.put(
  "/add/:locationType/location/:vin",
  [
    auth,
    roleBaseAuth(withoutStaff),
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
  [
    auth,
    roleBaseAuth(ALLOWED_USERS_FOR_MOBILE_APP),
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
  validateMiddleware(validateAddVin),
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
  qboAsyncMiddleware(entryController.modifyPrice)
);

router.delete(
  "/:id",
  [auth, roleBaseAuth(["admin", "gm"]), validateObjectId],
  asyncMiddleware(entryController.deleteEntry)
);
module.exports = router;
