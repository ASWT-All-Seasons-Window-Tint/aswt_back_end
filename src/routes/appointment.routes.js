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
const { blockOut } = require("../model/takenTimeslot.model");

const {
  validate,
  validateGetTakenTimeslots,
  validateUpdateQuote,
  unavailableTimeslots,
  validateAppointmentForDealership,
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

router.post(
  "/block-out-date/:date",
  auth,
  validDateParamsMiddleware(30, false),
  validateMiddleware(blockOut),
  roleBaseAuthMiddleware(["staff"]),
  asyncMiddleware(takenTimeslotsControllers.staffBlockOutsADate)
);

router.post(
  "/create-appointment-for-dealership/:qbId",
  auth,
  validateMiddleware(validateAppointmentForDealership),
  validateTimeslotsMiddleware,
  roleBaseAuthMiddleware(["customer", "dealershipStaff"]),
  asyncMiddleware(appointmentControllers.createAppointmentForDealership)
);

router.post(
  "/get-unavailable-dates/start/:startDate/end/:endDate",
  validDateParamsMiddleware(30, true),
  validateMiddleware(unavailableTimeslots),
  asyncMiddleware(takenTimeslotsControllers.getUnavailableDatesInTheCalendar)
);

router.get(
  "/get-blocked-out-dates-for-dealership/:staffId/:dealershipId",
  validateObjectIdWithXargs(["staffId", "dealershipId"]),
  auth,
  roleBaseAuthMiddleware(["staff"]),
  asyncMiddleware(takenTimeslotsControllers.getTakenTimeslotForDealerAndStaff)
);

router.post(
  "/get-unavailable-dates-for-dealer/start/:startDate/end/:endDate",
  auth,
  roleBaseAuthMiddleware(["customer", "dealershipStaff"]),
  validateMiddleware(unavailableTimeslots),
  validDateParamsMiddleware(30, true),
  asyncMiddleware(
    takenTimeslotsControllers.getUnavailableDatesInTheCalendarForDealership
  )
);

router.get(
  "/get-unavailable-dates-for-dealer/start/:startDate/end/:endDate/:staffId",
  auth,
  validateObjectIdWithXargs(["staffId"]),
  roleBaseAuthMiddleware(["customer", "dealershipStaff"]),
  validDateParamsMiddleware(30, true),
  asyncMiddleware(
    takenTimeslotsControllers.getUnavailableDatesInTheCalendarForStaff
  )
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
