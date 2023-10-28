const mongoose = require("mongoose");
const Joi = require("joi");
const { noSpecials } = require("../common/constants.common");
const addVirtualidUtils = require("../utils/addVirtualId.utils");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      minlength: 3,
      maxlength: 50,
      trim: true,
      required: true,
      unique: true,
    },
    description: {
      type: String,
      minlength: 5,
      maxlength: 255,
      trim: true,
    },
    updated: {
      type: Boolean,
      default: false,
    },
  },
  { toJSON: { virtuals: true } },
  { toObject: { virtuals: true } }
);

addVirtualidUtils(categorySchema);

const Category = mongoose.model("Category", categorySchema);

function validate(category) {
  const schema = Joi.object({
    name: Joi.string().regex(noSpecials).min(3).max(50).required(),
    description: Joi.string().min(4).max(255).required(),
    updated: Joi.boolean().required(),
  });

  return schema.validate(category);
}

function validatePatch(category) {
  const schema = Joi.object({
    name: Joi.string().regex(noSpecials).min(3).max(50),
    description: Joi.string().min(4).max(255),
    updated: Joi.boolean(),
  });

  return schema.validate(category);
}

exports.validatePatch = validatePatch;
exports.validate = validate;
exports.Category = Category;
