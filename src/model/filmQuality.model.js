const mongoose = require("mongoose");
const Joi = require("joi");
const addVirtualIdUtils = require("../utils/addVirtualId.utils");

const filmQualitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      minlength: 3,
      maxlength: 255,
      required: true,
    },
    description: {
      type: String,
      minlength: 3,
      maxlength: 255,
      required: true,
    },
  },
  { toJSON: { virtuals: true } },
  { toObject: { virtuals: true } }
);

addVirtualIdUtils(filmQualitySchema);

const FilmQuality = mongoose.model("FilmQuality", filmQualitySchema);

function validate(filmQuality) {
  const schema = Joi.object({
    name: Joi.string().min(3).max(255).required(),
    description: Joi.string().min(3).max(255).required(),
  });

  return schema.validate(filmQuality);
}

function validatePatch(filmQuality) {
  const schema = Joi.object({
    name: Joi.string().min(3).max(255).required(),
    description: Joi.string().min(3).max(255).required(),
  });

  return schema.validate(filmQuality);
}

exports.filmQuality = { validate, validatePatch, FilmQuality };
