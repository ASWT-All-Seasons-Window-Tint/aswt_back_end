const express = require("express");
const validateMiddleware = require("../middleware/validate.middleware");
const admin = require("../middleware/admin.middleware");
const auth = require("../middleware/auth.middleware");
const roleBaseAuth = require("../middleware/roleBaseAuth.middleware.");
const { validate } = require("../model/incentive.model").incentive;
const asyncMiddleware = require("../middleware/async.middleware");
const validateObjectId = require("../middleware/validateObjectId.middleware");
const incentiveController = require("../controllers/incentive.controllers");

const router = express.Router();

// This is used for registering a new incentive.
router.post(
  "/",
  auth,
  roleBaseAuth(["admin", "gm"]),
  validateMiddleware(validate),
  asyncMiddleware(incentiveController.createIncentive)
);

router.get("/", asyncMiddleware(incentiveController.fetchIncentives));

router.get(
  "/:id",
  validateObjectId,
  asyncMiddleware(incentiveController.getIncentiveById)
);

router.put(
  "/:id",
  validateObjectId,
  // auth is used to make authenticate a incentive.
  auth,
  validateMiddleware(validate),
  asyncMiddleware(incentiveController.updateIncentive)
);

router.delete(
  "/:id",
  validateObjectId,
  auth,
  admin,
  asyncMiddleware(incentiveController.deleteIncentive)
);
module.exports = router;
