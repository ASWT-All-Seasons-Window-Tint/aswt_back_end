const express = require("express");
const webhookControllers = require("../controllers/webhook.controllers");
const router = express.Router();
const qboAsyncMiddleware = require("../middleware/qboAsync.middleware");

router.post("/", qboAsyncMiddleware(webhookControllers.webhook));

module.exports = router;
