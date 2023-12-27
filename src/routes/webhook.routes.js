const express = require("express");
const webhookControllers = require("../controllers/webhook.controllers");
const router = express.Router();
const asyncMiddleware = require("../middleware/async.middleware");
const qboAsyncMiddleware = require("../middleware/qboAsync.middleware");
const entryControllers = require("../controllers/entry.controllers");
const adminMiddleware = require("../middleware/admin.middleware");

router.post("/", asyncMiddleware(webhookControllers.webhook));
router.post(
  "/stripe-acounts",
  express.raw({ type: "application/json" }),
  asyncMiddleware(webhookControllers.stripeWebHook)
);
router.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  qboAsyncMiddleware(webhookControllers.stripeWebHook)
);

router.post(
  "/sendInvoince",
  adminMiddleware,
  qboAsyncMiddleware(entryControllers.scheduleInvoice)
);

module.exports = router;
