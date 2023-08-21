const mongoose = require("mongoose");
const Joi = require("joi");

const entrySchema = new mongoose.Schema({
  customerName: {
    type: String,
    minlength: 4,
    maxlength: 50,
    trim: true,
    required: true,
  },
  customerEmail: {
    type: String,
    minlength: 5,
    maxlength: 255,
    trim: true,
  },
  phone: {
    type: String,
    minlength: 5,
    maxlength: 255,
    trim: true,
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
    customerName: Joi.string().min(4).max(255).required(),
    customerEmail: Joi.string().email().min(4).max(255).required(),
    phone: Joi.string().min(4).max(255).required(),
    numberOfVehicles: Joi.number().min(1).max(100000).required(),
    vehiclesLeft: Joi.number(),
  });

  return schema.validate(entry);
}

function validatePatch(entry) {
  const schema = Joi.object({
    customerName: Joi.string().min(4).max(255),
    customerEmail: Joi.string().email().min(4).max(255),
    phone: Joi.string().min(4).max(255),
    numberOfVehicles: Joi.number().min(1).max(100000),
    vehiclesLeft: Joi.number(),
  });

  return schema.validate(entry);
}

exports.validatePatch = validatePatch;
exports.validate = validate;
exports.Entry = Entry;
