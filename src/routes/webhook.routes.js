const express = require("express");
const webhookControllers = require("../controllers/webhook.controllers");
const router = express.Router();
const asyncMiddleware = require("../middleware/async.middleware");
const qboAsyncMiddleware = require("../middleware/qboAsync.middleware");
const entryControllers = require("../controllers/entry.controllers");
const adminMiddleware = require("../middleware/admin.middleware");
const authMiddleware = require("../middleware/auth.middleware");
const schedularComtrollers = require("../controllers/schedular.comtrollers");

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

router.get(
  "/sendInvoice/:entryId/:delay",
  authMiddleware,
  adminMiddleware,
  qboAsyncMiddleware(schedularComtrollers.scheduleInvoice)
);

router.post(
  "/sendSms",
  authMiddleware,
  adminMiddleware,
  qboAsyncMiddleware(schedularComtrollers.scheduleSms)
);

module.exports = router;
