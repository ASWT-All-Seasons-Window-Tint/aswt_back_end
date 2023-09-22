const validateMiddleware = require("../middleware/validate.middleware");
const admin = require("../middleware/admin.middleware");
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

router.get("/", qboAsyncMiddleware(customerController.getCustomers));

router.get(
  "/:id",
  auth,
  qboAsyncMiddleware(customerController.getCustomerById)
);

module.exports = router;
