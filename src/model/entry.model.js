const mongoose = require("mongoose");
const Joi = require("joi");

const entrySchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
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
  invoice: {
    name: {
      type: String,
      minlength: 5,
      maxlength: 255,
    },
    carDetails: [
      {
        vin: Number,
        year: Number,
        make: {
          type: String,
          minlength: 5,
          maxlength: 255,
        },
        colour: {
          type: String,
          minlength: 5,
          maxlength: 255,
        },
        serviceDone: {
          type: String,
          minlength: 5,
          maxlength: 255,
        },
        note: {
          type: String,
          minlength: 5,
          maxlength: 512,
        },
        price: {
          type: Number,
          default: 0,
        },
      },
    ],
    totalPrice: {
      type: Number,
      default: 0,
    },
  },
});

const Entry = mongoose.model("Entry", entrySchema);

function validate(entry) {
  const schema = Joi.object({
    customerId: Joi.objectId().required(),
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
