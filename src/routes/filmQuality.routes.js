const validateMiddleware = require("../middleware/validate.middleware");
const admin = require("../middleware/admin.middleware");
const auth = require("../middleware/auth.middleware");
const { filmQuality } = require("../model/filmQuality.model");
const express = require("express");
const router = express.Router();
const asyncMiddleware = require("../middleware/async.middleware");
const validateObjectId = require("../middleware/validateObjectId.middleware");
const filmQualityController = require("../controllers/filmQuality.controllers");

const { validate, validatePatch } = filmQuality;

// This is used for registering a new filmQuality.
router.post(
  "/",
  auth,
  validateMiddleware(validate),
  asyncMiddleware(filmQualityController.createFilmQuality)
);

router.get("/", asyncMiddleware(filmQualityController.fetchAllFilmQualities));
router.get(
  "/type/:filmType",
  asyncMiddleware(filmQualityController.getFilmQualitiesByType)
);

router.get(
  "/:id",
  validateObjectId,
  asyncMiddleware(filmQualityController.getFilmQualityById)
);

router.put(
  "/:id",
  validateObjectId,
  // auth is used to make authenticate a filmQuality.
  auth,
  validateMiddleware(validatePatch),
  asyncMiddleware(filmQualityController.updateFilmQuality)
);

router.delete(
  "/:id",
  validateObjectId,
  auth,
  admin,
  asyncMiddleware(filmQualityController.deleteFilmQuality)
);
module.exports = router;
