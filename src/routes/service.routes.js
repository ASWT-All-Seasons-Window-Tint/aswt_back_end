const validateMiddleware = require("../middleware/validate.middleware");
const admin = require("../middleware/admin.middleware");
const adminOrManager = require("../middleware/adminOrManager.middleware");
const auth = require("../middleware/auth.middleware");
const manager = require("../middleware/manager.middleware");
const express = require("express");
const router = express.Router();
const asyncMiddleware = require("../middleware/async.middleware");
const validateObjectId = require("../middleware/validateObjectId.middleware");
const serviceController = require("../controllers/service.controllers");
const {
  validate,
  validatePatch,
  validateAddDealershipPrice,
} = require("../model/service.model");

router.post(
  "/",
  [auth, validateMiddleware(validate), adminOrManager],
  asyncMiddleware(serviceController.createService)
);

router.get("/", asyncMiddleware(serviceController.fetchAllServices));
router.get("/multiple", asyncMiddleware(serviceController.getMultipleServices));

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

router.put(
  "/add-dealership-price/:id",
  [
    validateObjectId,
    auth,
    adminOrManager,
    validateMiddleware(validateAddDealershipPrice),
  ],
  asyncMiddleware(serviceController.addDealershipPrice)
);

router.delete(
  "/:id",
  [validateObjectId, auth, admin],
  asyncMiddleware(serviceController.deleteService)
);
module.exports = router;
