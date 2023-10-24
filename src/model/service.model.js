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
    qbId: {
      type: String,
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
        customerId: { type: String, required: true },
        price: { type: Number, min: 1, required: true },
      },
    ],
    timeOfCompletion: {
      type: Number,
      required: true,
    },
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
    timeOfCompletion: Joi.number().min(0.25).max(9).required(),
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

function validateWithObj(service) {
  const schema = Joi.object({
    name: Joi.string().min(3).max(255).required(),
    type: Joi.string().valid("installation", "removal").required(),
    timeOfCompletion: Joi.number().min(0.25).max(9).required(),
    defaultPrices: Joi.object({
      suv: Joi.number().min(1).required(),
      sedan: Joi.number().min(1).required(),
      truck: Joi.number().min(1).required(),
    }),
  });

  return schema.validate(service);
}

function validatePatch(service) {
  const schema = Joi.object({
    name: Joi.string().min(5).max(255),
    type: Joi.string().valid("installation", "removal"),
    timeOfCompletion: Joi.number().min(0.25).max(9),
  });

  return schema.validate(service);
}

function validateAddDealershipPrice(service) {
  const schema = Joi.object({
    customerId: Joi.string().required(),
    price: Joi.number().min(1).required(),
  });

  return schema.validate(service);
}
function validateUpdateDealershipPrice(service) {
  const schema = Joi.object({
    price: Joi.number().min(1).required(),
  });

  return schema.validate(service);
}

exports.validate = validate;
exports.validateWithObj = validateWithObj;
exports.validatePatch = validatePatch;
exports.validateAddDealershipPrice = validateAddDealershipPrice;
exports.validateUpdateDealershipPrice = validateUpdateDealershipPrice;
exports.Service = Service;
