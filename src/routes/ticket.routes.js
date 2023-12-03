const multer = require("multer");
const express = require("express");
const admin = require("../middleware/admin.middleware");
const auth = require("../middleware/auth.middleware");
const asyncMiddleware = require("../middleware/async.middleware");
const ticketController = require("../controllers/ticket.controllers");
const multerCommon = require("../common/multer.common");
const multerErrorMiddleware = require("../middleware/multerError.middleware");
const validateMiddleware = require("../middleware/validate.middleware");
const validateFileMiddleware = require("../middleware/validateFile.middleware");
const validateObjectId = require("../middleware/validateObjectId.middleware");
const roleBaseAuthMiddleware = require("../middleware/roleBaseAuth.middleware.");
const { validate, validatePatch, imageSchema } =
  require("../model/ticket.model").ticket;

const router = express.Router();
const fieldName = "image";
const fileSize = 2;
const upload = multer(multerCommon(multer, fileSize)).single(fieldName);

router.post(
  "/",
  auth,
  roleBaseAuthMiddleware(["customer"]),
  multerErrorMiddleware(upload, multer, fileSize, fieldName),
  validateMiddleware(validate),
  validateFileMiddleware("Image", imageSchema, false),
  asyncMiddleware(ticketController.addTicket)
);

router.get(
  "/",
  auth,
  roleBaseAuthMiddleware(["admin", "gm"]),
  asyncMiddleware(ticketController.getAllTickets)
);

router.get(
  "/ticket/:ticketId",
  auth,
  roleBaseAuthMiddleware(["customer", "admin", "gm"]),
  asyncMiddleware(ticketController.getTicketByTicketId)
);

router.get(
  "/:id",
  auth,
  roleBaseAuthMiddleware(["admin", "gm"]),
  validateObjectId,
  asyncMiddleware(ticketController.getTicketById)
);

router.get(
  "/customer/:id",
  auth,
  roleBaseAuthMiddleware(["customer", "admin", "gm"]),
  validateObjectId,
  asyncMiddleware(ticketController.getTicketByCustomerId)
);

router.delete(
  "/:id",
  validateObjectId,
  auth,
  admin,
  asyncMiddleware(ticketController.deleteTicket)
);

router.put(
  "/:id",
  auth,
  roleBaseAuthMiddleware(["admin", "gm"]),
  validateObjectId,
  validateMiddleware(validatePatch),
  asyncMiddleware(ticketController.updateTicketById)
);

module.exports = router;
