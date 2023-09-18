const express = require("express");
const invoiceController = require("../controllers/invoice.controllers");
const adminOrManager = require("../middleware/adminOrManager.middleware");
const auth = require("../middleware/auth.middleware");
const asyncMiddleware = require("../middleware/async.middleware");
const validateObjectId = require("../middleware/validateObjectId.middleware");

const router = express.Router();

router.post(
  "/:id",
  validateObjectId,
  auth,
  adminOrManager,
  asyncMiddleware(invoiceController.sendInvoice)
);

module.exports = router;
