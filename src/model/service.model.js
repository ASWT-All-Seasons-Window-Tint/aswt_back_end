const mongoose = require("mongoose");
const Joi = require("joi");
const addVirtualidUtils = require("../utils/addVirtualId.utils");

const serviceSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      minlength: 5,
      maxlength: 26,
      required: true,
    },
    name: {
      type: String,
      minlength: 3,
      maxlength: 255,
      required: true,
    },
    defaultPrices: [
      {
        category: { type: String, min: 3, required: true },
        price: { type: Number, min: 1, required: true },
      },
    ],
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
    name: Joi.string().min(3).max(255).required(),
    type: Joi.string().valid("installation", "removal").required(),
    defaultPrices: Joi.array()
      .items(
        Joi.object({
          category: Joi.string().required(),
          price: Joi.number().required(),
        }).required()
      )
      .required(),
  });

  return schema.validate(service);
}

function validatePatch(service) {
  const schema = Joi.object({
    name: Joi.string().min(5).max(255),
    type: Joi.string().valid("installation", "removal"),
  });

  return schema.validate(service);
}

exports.validatePatch = validatePatch;
exports.validate = validate;
exports.Service = Service;
