const mongoose = require("mongoose");
const Joi = require("joi");
const addVirtualidUtils = require("../utils/addVirtualId.utils");

const serviceSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      minlength: 5,
      maxlength: 255,
      required: true,
    },
    name: {
      type: String,
      minlength: 5,
      maxlength: 20,
      required: true,
    },
    defaultPrice: {
      suv: { type: Number, min: 1, required: true },
      truck: { type: Number, min: 1, required: true },
      sedan: { type: Number, min: 1, required: true },
    },
    dealershipPrices: [
      {
        custumerId: { type: mongoose.Schema.Types.ObjectId, required: true },
        price: { type: Number, min: 1, required: true },
      },
    ],
  },
  { toJSON: { virtuals: true } },
  { toObject: { virtuals: true } }
);

addVirtualidUtils(serviceSchema);

const Service = mongoose.model("Service", serviceSchema);

function validate(service) {
  const schema = Joi.object({
    name: Joi.string().min(5).max(255).required(),
    type: Joi.string().valid("installation", "removal").required(),
    defaultPrice: Joi.object({
      suv: Joi.number().min(1).required(),
      truck: Joi.number().min(1).required(),
      sedan: Joi.number().min(1).required(),
    }).required(),
  });

  return schema.validate(service);
}

function validatePatch(service) {
  const schema = Joi.object({
    name: Joi.string().min(5).max(255),
    type: Joi.string().valid("installation", "removal"),
    defaultPrice: Joi.object({
      suv: Joi.number().min(1),
      truck: Joi.number().min(1),
      sedan: Joi.number().min(1),
    }),
    dealershipPrice: {
      customerId: Joi.objectId().required(),
      price: Joi.number().min(1).required(),
    },
  });

  return schema.validate(service);
}

exports.validatePatch = validatePatch;
exports.validate = validate;
exports.Service = Service;
