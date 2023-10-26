const validateMiddleware = require("../middleware/validate.middleware");
const admin = require("../middleware/admin.middleware");
const auth = require("../middleware/auth.middleware");
const { validate, validatePatch } = require("../model/distanceThreshold.model");
const express = require("express");
const router = express.Router();
const asyncMiddleware = require("../middleware/async.middleware");
const validateObjectId = require("../middleware/validateObjectId.middleware");
const distanceThresholdController = require("../controllers/distanceThreshold.controllers");
const { getCustomers } = require("../controllers/customer.controllers");

router.post(
  "/",
  auth,
  admin,
  validateMiddleware(validate),
  asyncMiddleware(distanceThresholdController.createDistanceThreshold)
);

// router.get("/", asyncMiddleware(distanceThresholdController.fetchAllCategories));
router.get(
  "/",
  asyncMiddleware(distanceThresholdController.getDistanceThreshold)
);

router.put(
  "/",
  // auth is used to make authenticate a distanceThreshold.
  auth,
  admin,
  validateMiddleware(validatePatch),
  asyncMiddleware(distanceThresholdController.updateDistanceThreshold)
);

module.exports = router;
