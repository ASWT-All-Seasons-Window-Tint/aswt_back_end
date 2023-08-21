const validateMiddleware = require("../middleware/validate.middleware");
const admin = require("../middleware/admin.middleware");
const auth = require("../middleware/auth.middleware");
const manager = require("../middleware/manager.middleware");
const { validate, validatePatch } = require("../model/entry.model");
const express = require("express");
const router = express.Router();
const asyncMiddleware = require("../middleware/async.middleware");
const validateObjectId = require("../middleware/validateObjectId.middleware");
const entryController = require("../controllers/entry.controllers");

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

router.put(
  "/:id",
  [validateObjectId, auth, admin || manager, validateMiddleware(validatePatch)],
  asyncMiddleware(entryController.updateEntry)
);

router.delete(
  "/:id",
  [validateObjectId, auth, admin],
  asyncMiddleware(entryController.deleteEntry)
);
module.exports = router;