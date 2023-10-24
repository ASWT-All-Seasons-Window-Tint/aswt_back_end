const mongoose = require("mongoose");
const Joi = require("joi");
const { FilmQuality } = require("./filmQuality.model").filmQuality;
const { Service } = require("./service.model");
const addVirtualIdUtils = require("../utils/addVirtualId.utils");

const priceListSchema = new mongoose.Schema(
  {
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: Service,
      required: true,
    },
    filmQualityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: FilmQuality,
      required: true,
    },
    price: {
      type: Number,
      min: 1,
      required: true,
    },
  },
  { toJSON: { virtuals: true } },
  { toObject: { virtuals: true } }
);

addVirtualIdUtils(priceListSchema);

const PriceList = mongoose.model("PriceList", priceListSchema);

function validate(priceList) {
  const schema = Joi.object({
    serviceId: Joi.objectId().required(),
    filmQualityId: Joi.objectId().required(),
    price: Joi.number().min(1).required(),
  });

  return schema.validate(priceList);
}

function validatePatch(priceList) {
  const schema = Joi.object({
    serviceId: Joi.objectId().required(),
    filmQualityId: Joi.objectId().required(),
    price: Joi.number().min(1).required(),
  });

  return schema.validate(priceList);
}

exports.priceList = { validate, validatePatch, PriceList };
