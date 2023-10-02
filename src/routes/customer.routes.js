const validateMiddleware = require("../middleware/validate.middleware");
const admin = require("../middleware/admin.middleware");
const adminOrManager = require("../middleware/adminOrManager.middleware");
const auth = require("../middleware/auth.middleware");
const { validate } = require("../model/customer.model");
const express = require("express");
const router = express.Router();
const asyncMiddleware = require("../middleware/async.middleware");
const customerController = require("../controllers/customer.controllers");
const qboAsyncMiddleware = require("../middleware/qboAsync.middleware");

router.post(
  "/",
  auth,
  admin,
  validateMiddleware(validate),
  qboAsyncMiddleware(customerController.createCustomer)
);

router.get("/", auth, qboAsyncMiddleware(customerController.getCustomers));

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
