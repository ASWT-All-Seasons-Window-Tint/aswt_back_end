const express = require("express");
const auth = require("../middleware/auth.middleware");
const appointmentControllers = require("../controllers/appointment.controllers");
const router = express.Router();
const validateMiddleware = require("../middleware/validate.middleware");
const { joiValidators } = require("../model/appointment.model");
const validateTimeslotsMiddleware = require("../middleware/validateTimeslots.middleware");
const takenTimeslotsControllers = require("../controllers/takenTimeslots.controllers");
const validateObjectId = require("../middleware/validateObjectId.middleware");
const asyncMiddleware = require("../middleware/async.middleware");
const roleBaseAuthMiddleware = require("../middleware/roleBaseAuth.middleware.");
const validDateParamsMiddleware = require("../middleware/validDateParams.middleware");
const validateObjectIdWithXargs = require("../middleware/validateObjectIdWithXArg.middleware");

const {
  validate,
  validateGetTakenTimeslots,
  validateUpdateQuote,
  unavailableTimeslots,
} = joiValidators;

router.post(
  "/",
  validateMiddleware(validate),
  validateTimeslotsMiddleware,
  asyncMiddleware(appointmentControllers.createAppointment)
);

// router.post(
//   "/:appointmentId",
//   asyncMiddleware(appointmentControllers.createCustomerFromAppointmentDetails)
// );

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
  "/appointmentId/:id",
  validateObjectId,
  asyncMiddleware(appointmentControllers.getAppointmentById)
);

router.get(
  "/cleared-out-dates",
  auth,
  roleBaseAuthMiddleware(["receptionist", "admin"]),
  asyncMiddleware(takenTimeslotsControllers.getClearedOutDates)
);

router.get(
  "/get-unavailable-dates/start/:startDate/end/:endDate",
  auth,
  validDateParamsMiddleware(30, false),
  roleBaseAuthMiddleware(["gm", "admin"]),
  validateMiddleware(unavailableTimeslots),
  asyncMiddleware(takenTimeslotsControllers.getUnavailableDatesInTheCalendar)
);

router.get(
  "/:date",
  auth,
  roleBaseAuthMiddleware(["receptionist", "admin"]),
  validDateParamsMiddleware(30, false),
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
  "/quote/:appointmentId",
  validateObjectIdWithXargs(["appointmentId"]),
  validateMiddleware(validateUpdateQuote),
  validateTimeslotsMiddleware,
  asyncMiddleware(appointmentControllers.updateQuote)
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
