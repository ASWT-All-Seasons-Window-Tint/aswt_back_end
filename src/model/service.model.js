const mongoose = require("mongoose");
const Joi = require("joi");

const serviceSchema = new mongoose.Schema({
  type: {
    type: String,
    minlength: 5,
    maxlength: 255,
    required: true,
  },
  category: {
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
});

const Service = mongoose.model("Service", serviceSchema);

function validate(service) {
  const schema = Joi.object({
    type: Joi.string().min(5).max(255).required(),
    category: Joi.string().valid("installation", "removal").required(),
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
    type: Joi.string().min(5).max(255),
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
