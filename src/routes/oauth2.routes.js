const express = require("express");
const router = express.Router();
const asyncMiddleware = require("../middleware/async.middleware");
const ouath2Controller = require("../controllers/oauth2.controllers");

router.get("/", asyncMiddleware(ouath2Controller.start));
router.get("/requestToken", asyncMiddleware(ouath2Controller.requestToken));
router.get("/callback", asyncMiddleware(ouath2Controller.callback));

router.get("/start", asyncMiddleware(ouath2Controller.startStripe));
router.get("/stripe", asyncMiddleware(ouath2Controller.stripeAuthorize));
router.get(
  "/callback/stripe",
  asyncMiddleware(ouath2Controller.stripeCallback)
);

module.exports = router;
