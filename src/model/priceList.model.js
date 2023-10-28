const mongoose = require("mongoose");
const Joi = require("joi");
const { FilmQuality } = require("./filmQuality.model").filmQuality;
const { Service } = require("./service.model");
const { Category } = require("./category.model");
const addVirtualIdUtils = require("../utils/addVirtualId.utils");

const validCarTypes = [
  "2 Or 4 Doors Car",
  "4 Doors Suv",
  "6+ Doors Suv",
  "Mini Van",
  "Truck Std. Cab",
  "Truck 4 Doors",
];

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
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: Category,
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
    filmQualityId: Joi.objectId(),
    price: Joi.number().min(1).required(),
    categoryName: Joi.string()
      .valid(...validCarTypes)
      .insensitive(),
  });

  return schema.validate(priceList);
}

function validatePatch(priceList) {
  const schema = Joi.object({
    serviceId: Joi.objectId(),
    filmQualityId: Joi.objectId(),
    price: Joi.number().min(1),
    categoryName: Joi.string()
      .valid(...validCarTypes)
      .insensitive(),
  });

  return schema.validate(priceList);
}

exports.priceList = { validate, validatePatch, PriceList };
