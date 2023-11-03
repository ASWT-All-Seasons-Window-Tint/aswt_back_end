const express = require("express");
const webhookControllers = require("../controllers/webhook.controllers");
const router = express.Router();
const asyncMiddleware = require("../middleware/async.middleware");

router.post("/", asyncMiddleware(webhookControllers.webhook));
router.post(
  "/stripe-acoounts",
  express.raw({ type: "application/json" }),
  asyncMiddleware(webhookControllers.stripeWebHook)
);

module.exports = router;
