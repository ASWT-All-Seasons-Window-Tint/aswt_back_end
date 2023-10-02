const mongoose = require("mongoose");
const Joi = require("joi");
const { noSpecials } = require("../common/constants.common");
const addVirtualidUtils = require("../utils/addVirtualId.utils");

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      minlength: 4,
      maxlength: 50,
      trim: true,
      required: true,
    },
    description: {
      type: String,
      minlength: 5,
      maxlength: 255,
      trim: true,
    },
  },
  { toJSON: { virtuals: true } },
  { toObject: { virtuals: true } }
);

addVirtualidUtils(departmentSchema);

const Department = mongoose.model("Department", departmentSchema);

function validate(department) {
  const schema = Joi.object({
    name: Joi.string().regex(noSpecials).min(4).max(50).required(),
    description: Joi.string().min(4).max(255).required(),
  });

  return schema.validate(department);
}

function validatePatch(department) {
  const schema = Joi.object({
    name: Joi.string().regex(noSpecials).min(4).max(50),
    description: Joi.string().min(4).max(255),
  });

  return schema.validate(department);
}

exports.validatePatch = validatePatch;
exports.validate = validate;
exports.Department = Department;
