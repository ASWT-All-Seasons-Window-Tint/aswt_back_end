const express = require("express");
const stripeControllers = require("../controllers/stripe.controllers");
const router = express.Router();
const qboAsyncMiddleware = require("../middleware/qboAsync.middleware");
const asyncMiddleware = require("../middleware/async.middleware");
const validateMiddleware = require("../middleware/validate.middleware");

router.post(
  "/appointment-checkout-session",
  validateMiddleware(stripeControllers.validate),
  asyncMiddleware(stripeControllers.stripeCheckoutSession)
);

router.post(
  "/refund-appointment-money",
  validateMiddleware(stripeControllers.validate),
  asyncMiddleware(stripeControllers.initiateRefund)
);

module.exports = router;
