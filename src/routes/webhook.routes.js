const express = require("express");
const webhookControllers = require("../controllers/webhook.controllers");
const router = express.Router();

router.post("/", webhookControllers.webhook);

module.exports = router;
