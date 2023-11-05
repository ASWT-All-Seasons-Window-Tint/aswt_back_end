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
const roleBaseAuthMiddleware = require("../middleware/roleBaseAuth.middleware.");
const validDateParamsMiddleware = require("../middleware/validDateParams.middleware");

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
  roleBaseAuthMiddleware(["receptionist", "admin"]),
  asyncMiddleware(appointmentControllers.cancelAppointment)
);

router.get(
  "/",
  auth,
  roleBaseAuthMiddleware(["receptionist", "admin"]),
  asyncMiddleware(appointmentControllers.fetchAllAppointments)
);

router.get(
  "/cleared-out-dates",
  auth,
  roleBaseAuthMiddleware(["receptionist", "admin"]),
  asyncMiddleware(takenTimeslotsControllers.getClearedOutDates)
);

router.get(
  "/:date",
  auth,
  roleBaseAuthMiddleware(["receptionist", "admin"]),
  validDateParamsMiddleware,
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
  roleBaseAuthMiddleware(["receptionist", "admin"]),
  asyncMiddleware(takenTimeslotsControllers.clearOutAppointment)
);

router.put(
  "/:id",
  validateObjectId,
  auth,
  roleBaseAuthMiddleware(["receptionist", "admin"]),
  validateMiddleware(validate),
  asyncMiddleware(appointmentControllers.updateAppointment)
);

module.exports = router;
