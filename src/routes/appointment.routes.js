const express = require("express");
const auth = require("../middleware/auth.middleware");
const appointmentControllers = require("../controllers/appointment.controllers");
const freeTimeSlotControllers = require("../controllers/freeTimeSlot.controllers");
const router = express.Router();
const validateMiddleware = require("../middleware/validate.middleware");
const receptionistMiddleware = require("../middleware/receptionist.middleware");
const { joiValidators } = require("../model/appointment.model");
const validateTimeslotsMiddleware = require("../middleware/validateTimeslots.middleware");
const takenTimeslotsControllers = require("../controllers/takenTimeslots.controllers");
const validateObjectId = require("../middleware/validateObjectId.middleware");
const asyncMiddleware = require("../middleware/async.middleware");

const { validate, validateGetTakenTimeslots } = joiValidators;

router.post(
  "/",
  validateMiddleware(validate),
  validateTimeslotsMiddleware,
  asyncMiddleware(appointmentControllers.createAppointment)
);
router.delete(
  "/:id",
  auth,
  receptionistMiddleware,
  asyncMiddleware(appointmentControllers.cancelAppointment)
);

router.get(
  "/:date",
  auth,
  receptionistMiddleware,
  asyncMiddleware(appointmentControllers.getAppointmentsByDate)
);

router.post(
  "/taken-time-slots",
  validateMiddleware(validateGetTakenTimeslots),
  asyncMiddleware(takenTimeslotsControllers.getTakenTimeSlots)
);
router.put(
  "/clear-out-appointment",
  auth,
  receptionistMiddleware,
  asyncMiddleware(freeTimeSlotControllers.clearOutAppointment)
);

router.put(
  "/:id",
  validateObjectId,
  auth,
  receptionistMiddleware,
  validateMiddleware(validate),
  asyncMiddleware(appointmentControllers.updateAppointment)
);

module.exports = router;
