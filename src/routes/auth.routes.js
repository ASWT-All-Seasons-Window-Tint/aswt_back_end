const validateMiddleware = require("../middleware/validate.middleware");
const authController = require("../controllers/auth.controllers");
const express = require("express");
const router = express.Router();
const Joi = require("joi");
const authValidateMiddleware = require("../middleware/authValidate.middleware");

// This is used for authenticating the user
router.post("/", authValidateMiddleware(validate), authController.logIn);

// for validating the body of the request
function validate(req) {
  const schema = Joi.object({
    password: Joi.string().min(5).max(1024).required(),
    email: Joi.string().email().min(5).max(255).required(),
    role: Joi.string(),
    signInLocations: Joi.object({
      description: Joi.string().min(5).max(255).required(),
      coordinates: Joi.object({
        latitude: Joi.number().required(),
        longitude: Joi.number().required(),
      }).required(),
    }).when("role", {
      is: "staff",
      then: Joi.required(),
    }),
  });

  return schema.validate(req);
}

module.exports = router;
