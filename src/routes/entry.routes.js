const validateMiddleware = require("../middleware/validate.middleware");
const admin = require("../middleware/admin.middleware");
const auth = require("../middleware/auth.middleware");
const manager = require("../middleware/manager.middleware");
const express = require("express");
const router = express.Router();
const asyncMiddleware = require("../middleware/async.middleware");
const validateObjectId = require("../middleware/validateObjectId.middleware");
const entryController = require("../controllers/entry.controllers");
const validateObjectIdWithXArgMiddleware = require("../middleware/validateObjectIdWithXArg.middleware");
const adminOrManagerMiddleware = require("../middleware/adminOrManager.middleware");
const staffMiddleware = require("../middleware/staff.middleware");
const {
  validate,
  validatePatch,
  validateAddInvoicePatch,
  validateModifyPrice,
  validateModifyCarDetails,
} = require("../model/entry.model");
const validateServiceIdsMiddleware = require("../middleware/validateServiceIds.middleware");

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
  "/entry/:entryId/staff/:staffId",
  auth,
  validateObjectIdWithXArgMiddleware(["entryId", "staffId"]),
  asyncMiddleware(entryController.getCarsDoneByStaffPerEntryId)
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
    validateObjectId,
    auth,
    staffMiddleware,
    validateMiddleware(validateAddInvoicePatch),
  ],
  asyncMiddleware(entryController.addInvoice)
);

router.put(
  "/modify-price/:id",
  [validateObjectId, auth, admin, validateMiddleware(validateModifyPrice)],
  asyncMiddleware(entryController.modifyPrice)
);

router.delete(
  "/:id",
  [auth, admin, validateObjectId],
  asyncMiddleware(entryController.deleteEntry)
);
module.exports = router;
