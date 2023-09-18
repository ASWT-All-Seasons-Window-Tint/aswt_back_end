const validateMiddleware = require("../middleware/validate.middleware");
const admin = require("../middleware/admin.middleware");
const auth = require("../middleware/auth.middleware");
const { validate } = require("../model/customer.model");
const express = require("express");
const router = express.Router();
const asyncMiddleware = require("../middleware/async.middleware");
const validateObjectId = require("../middleware/validateObjectId.middleware");
const categoryController = require("../controllers/category.controllers");
const customerController = require("../controllers/customer.controllers");

router.post(
  "/",
  auth,
  admin,
  validateMiddleware(validate),
  asyncMiddleware(customerController.createCustomer)
);

router.get("/", asyncMiddleware(customerController.getCustomers));

router.get("/:id", auth, asyncMiddleware(customerController.getCustomerById));

module.exports = router;
