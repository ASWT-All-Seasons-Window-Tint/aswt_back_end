const express = require("express");
const { joiValidator } = require("../model/entry.model");
const invoiceController = require("../controllers/invoice.controllers");
const adminOrManager = require("../middleware/adminOrManager.middleware");
const auth = require("../middleware/auth.middleware");
const asyncMiddleware = require("../middleware/async.middleware");
const validateObjectId = require("../middleware/validateObjectId.middleware");
const qboAsyncMiddleware = require("../middleware/qboAsync.middleware");
const validateMiddleware = require("../middleware/validate.middleware");

const router = express.Router();
const { validateModifyPriceForSentInvoice } = joiValidator;

router.get(
  "/:invoiceId",
  auth,
  adminOrManager,
  qboAsyncMiddleware(invoiceController.getInvoiceById)
);

router.put(
  "/:id",
  validateObjectId,
  auth,
  adminOrManager,
  validateMiddleware(validateModifyPriceForSentInvoice),
  qboAsyncMiddleware(invoiceController.updateInvoiceById)
);

router.post(
  "/:id",
  validateObjectId,
  auth,
  adminOrManager,
  qboAsyncMiddleware(invoiceController.sendInvoice)
);

// router.post(
//   "/estimate/:id",
//   validateObjectId,
//   auth,
//   adminOrManager,
//   qboAsyncMiddleware(invoiceController.createEstimate)
// );

module.exports = router;
