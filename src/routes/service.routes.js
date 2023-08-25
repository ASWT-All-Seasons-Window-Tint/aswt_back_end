const validateMiddleware = require("../middleware/validate.middleware");
const admin = require("../middleware/admin.middleware");
const adminOrManager = require("../middleware/adminOrManager.middleware");
const auth = require("../middleware/auth.middleware");
const manager = require("../middleware/manager.middleware");
const { validate, validatePatch } = require("../model/service.model");
const express = require("express");
const router = express.Router();
const asyncMiddleware = require("../middleware/async.middleware");
const validateObjectId = require("../middleware/validateObjectId.middleware");
const serviceController = require("../controllers/service.controllers");

router.post(
  "/",
  [auth, validateMiddleware(validate), adminOrManager],
  asyncMiddleware(serviceController.createService)
);

router.get("/", asyncMiddleware(serviceController.fetchAllServices));

router.get(
  "/:id",
  validateObjectId,
  asyncMiddleware(serviceController.getServiceById)
);

router.put(
  "/:id",
  [validateObjectId, auth, admin || manager, validateMiddleware(validatePatch)],
  asyncMiddleware(serviceController.updateService)
);

// router.put(
//   "/add-car/:id",
//   [validateObjectId, auth, validateMiddleware(validateAddInvoicePatch)],
//   asyncMiddleware(serviceController.addInvoice)
// );

router.delete(
  "/:id",
  [validateObjectId, auth, admin],
  asyncMiddleware(serviceController.deleteService)
);
module.exports = router;
