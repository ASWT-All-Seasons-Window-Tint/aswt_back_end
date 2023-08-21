const mongoose = require("mongoose");
const Joi = require("joi");

const entrySchema = new mongoose.Schema({
  customerId: {
    type: String,
    minlength: 5,
    maxlength: 255,
    trim: true,
    ref: "user",
  },
  numberOfVehicles: {
    type: Number,
    trim: true,
  },
  vehiclesLeft: {
    type: Number,
    trim: true,
  },
  entryDate: {
    type: Date,
    required: true,
  },
});

const Entry = mongoose.model("Entry", entrySchema);

function validate(entry) {
  const schema = Joi.object({
    customerId: Joi.string().email().min(4).max(255).required(),
    numberOfVehicles: Joi.number().min(1).max(100000).required(),
    vehiclesLeft: Joi.number(),
  });

  return schema.validate(entry);
}

function validatePatch(entry) {
  const schema = Joi.object({
    customerId: Joi.string().email().min(4).max(255),
    numberOfVehicles: Joi.number().min(1).max(100000),
    vehiclesLeft: Joi.number(),
  });

  return schema.validate(entry);
}

exports.validatePatch = validatePatch;
exports.validate = validate;
exports.Entry = Entry;
