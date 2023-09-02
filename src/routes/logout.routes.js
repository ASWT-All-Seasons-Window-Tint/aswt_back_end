const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const blacklistedTokenController = require("../controllers/blacklistedToken.controllers");

// This is used for authenticating the user
router.post("/", auth, blacklistedTokenController.addTokenToBlacklist);

module.exports = router;
