const express = require("express");
const stripeControllers = require("../controllers/stripe.controllers");
const router = express.Router();
const qboAsyncMiddleware = require("../middleware/qboAsync.middleware");
const asyncMiddleware = require("../middleware/async.middleware");
const validateMiddleware = require("../middleware/validate.middleware");
const authMiddleware = require("../middleware/auth.middleware");
const adminMiddleware = require("../middleware/admin.middleware");
const roleBaseAuthMiddleware = require("../middleware/roleBaseAuth.middleware.");

router.post(
  "/appointment-checkout-session",
  validateMiddleware(stripeControllers.validate),
  asyncMiddleware(stripeControllers.stripeCheckoutSession)
);

router.post(
  "/promo-code",
  authMiddleware,
  adminMiddleware,
  validateMiddleware(stripeControllers.validatePromoCode),
  asyncMiddleware(stripeControllers.createPromoCode)
);

router.get(
  "/promo-code",
  authMiddleware,
  adminMiddleware,
  asyncMiddleware(stripeControllers.getAllPromoCodes)
);

router.post(
  "/refund-appointment-money",
  roleBaseAuthMiddleware(["receptionist", "admin", "gm"]),
  validateMiddleware(stripeControllers.validate),
  asyncMiddleware(stripeControllers.initiateRefund)
);

module.exports = router;
