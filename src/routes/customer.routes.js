const validateMiddleware = require("../middleware/validate.middleware");
const admin = require("../middleware/admin.middleware");
const adminOrManager = require("../middleware/adminOrManager.middleware");
const auth = require("../middleware/auth.middleware");
const express = require("express");
const router = express.Router();
const asyncMiddleware = require("../middleware/async.middleware");
const customerController = require("../controllers/customer.controllers");
const qboAsyncMiddleware = require("../middleware/qboAsync.middleware");
const newCustomerMiddleware = require("../middleware/newCustomer.middleware");
const {
  validate,
  validatePatch,
  validateInvitationEmail,
} = require("../model/customer.model");

router.post(
  "/",
  auth,
  admin,
  validateMiddleware(validate),
  qboAsyncMiddleware(customerController.createCustomer)
);

router.post(
  "/get-customers-by-ids",
  auth,
  admin,
  qboAsyncMiddleware(customerController.getCustomersByIds)
);
router.post(
  "/send-invitation-link",
  auth,
  admin,
  validateMiddleware(validateInvitationEmail),
  qboAsyncMiddleware(customerController.sendRegistrationLink)
);

router.post(
  "/:token",
  newCustomerMiddleware,
  validateMiddleware(validate),
  asyncMiddleware(customerController.createCustomer)
);

router.put(
  "/:id",
  auth,
  admin,
  validateMiddleware(validatePatch),
  qboAsyncMiddleware(customerController.updateCustomerById)
);

router.delete(
  "/:id",
  auth,
  admin,
  qboAsyncMiddleware(customerController.deleteUserAccount)
);

router.get("/", auth, qboAsyncMiddleware(customerController.getCustomers));

router.get(
  "/email/:customerEmail",
  [auth, adminOrManager],
  qboAsyncMiddleware(customerController.fetchCustomersByPage)
);
router.get(
  "/name/:customerName",
  [auth, adminOrManager],
  qboAsyncMiddleware(customerController.fetchCustomersByPage)
);
router.get(
  "/page/:pageNumber",
  [auth, adminOrManager],
  qboAsyncMiddleware(customerController.fetchCustomersByPage)
);

router.get(
  "/:id",
  auth,
  qboAsyncMiddleware(customerController.getCustomerById)
);

module.exports = router;
