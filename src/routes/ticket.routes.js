const multer = require("multer");
const express = require("express");
const admin = require("../middleware/admin.middleware");
const auth = require("../middleware/auth.middleware");
const asyncMiddleware = require("../middleware/async.middleware");
const ticketController = require("../controllers/ticket.controllers");
const multerCommon = require("../common/multer.common");
const multerErrorMiddleware = require("../middleware/multerError.middleware");
const { validate, imageSchema } = require("../model/ticket.model").ticket;
const validateMiddleware = require("../middleware/validate.middleware");
const validateFileMiddleware = require("../middleware/validateFile.middleware");
const validateObjectId = require("../middleware/validateObjectId.middleware");

const router = express.Router();
const fieldName = "image";
const fileSize = 2;
const upload = multer(multerCommon(multer, fileSize)).single(fieldName);

router.post(
  "/",
  auth,
  multerErrorMiddleware(upload, multer, fileSize, fieldName),
  validateMiddleware(validate),
  validateFileMiddleware("Image", imageSchema, false),
  asyncMiddleware(ticketController.addTicket)
);

router.get("/", asyncMiddleware(ticketController.getAllTickets));

router.get(
  "/:id",
  validateObjectId,
  asyncMiddleware(ticketController.getTicketById)
);

router.get(
  "/user/:id",
  validateObjectId,
  asyncMiddleware(ticketController.getTicketByUserId)
);

router.delete(
  "/:id",
  validateObjectId,
  auth,
  admin,
  asyncMiddleware(ticketController.deleteTicket)
);

module.exports = router;
