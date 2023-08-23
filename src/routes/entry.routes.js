const validateMiddleware = require("../middleware/validate.middleware");
const admin = require("../middleware/admin.middleware");
const auth = require("../middleware/auth.middleware");
const manager = require("../middleware/manager.middleware");
const {
  validate,
  validatePatch,
  validateAddInvoicePatch,
} = require("../model/entry.model");
const express = require("express");
const router = express.Router();
const asyncMiddleware = require("../middleware/async.middleware");
const validateObjectId = require("../middleware/validateObjectId.middleware");
const entryController = require("../controllers/entry.controllers");
const validateObjectIdWithXArgMiddleware = require("../middleware/validateObjectIdWithXArg.middleware");

router.post(
  "/",
  [auth, admin || manager, validateMiddleware(validate)],
  asyncMiddleware(entryController.createEntry)
);

router.get("/", asyncMiddleware(entryController.fetchAllEntries));

router.get(
  "/:id",
  validateObjectId,
  asyncMiddleware(entryController.getEntryById)
);

router.get(
  "/entry/:entryId/staff/:staffId",
  validateObjectIdWithXArgMiddleware(["entryId", "staffId"]),
  asyncMiddleware(entryController.getCarsDoneByStaffPerEntryId)
);

router.get(
  "/staff/:staffId",
  validateObjectIdWithXArgMiddleware(["staffId"]),
  asyncMiddleware(entryController.getCarsDoneByStaff)
);

router.put(
  "/:id",
  [validateObjectId, auth, admin || manager, validateMiddleware(validatePatch)],
  asyncMiddleware(entryController.updateEntry)
);

router.put(
  "/add-car/:id",
  [validateObjectId, auth, validateMiddleware(validateAddInvoicePatch)],
  asyncMiddleware(entryController.addInvoice)
);

router.delete(
  "/:id",
  [validateObjectId, auth, admin],
  asyncMiddleware(entryController.deleteEntry)
);
module.exports = router;
