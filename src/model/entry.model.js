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
        serviceId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "service",
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
        category: {
          type: String,
          minlength: 3,
          maxlength: 10,
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
    invoice: Joi.object({
      name: Joi.string().min(4).max(255),
      carDetails: Joi.array().items(
        Joi.object({
          vin: Joi.number(),
          year: Joi.number().min(1000),
          colour: Joi.string().min(3),
          serviceId: Joi.objectId(),
          category: Joi.string().valid("suv", "sedan", "truck").insensitive(),
        })
      ),
    }),
  });

  return schema.validate(entry);
}

function validateAddInvoicePatch(entry) {
  const schema = Joi.object({
    invoice: Joi.object({
      name: Joi.string().min(4).max(255).required(),
      carDetails: Joi.object({
        vin: Joi.number().required(),
        year: Joi.number().min(1000).required(),
        colour: Joi.string().min(3).required(),
        serviceId: Joi.objectId().required(),
        make: Joi.string().min(3).max(255).required(),
        note: Joi.string().min(5).max(255),
        category: Joi.string()
          .valid("suv", "sedan", "truck")
          .insensitive()
          .required(),
      }).required(),
    }).required(),
  });

  return schema.validate(entry);
}

exports.validateAddInvoicePatch = validateAddInvoicePatch;
exports.validatePatch = validatePatch;
exports.validate = validate;
exports.Entry = Entry;
