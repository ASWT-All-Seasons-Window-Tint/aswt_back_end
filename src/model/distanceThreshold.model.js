const mongoose = require("mongoose");
const Joi = require("joi");
const addVirtualIdUtils = require("../utils/addVirtualId.utils");
const { validLocationType } = require("./entry.model").joiValidator;

const distanceThresholdLocationType = validLocationType.filter(
  (location) => location !== "Scanned"
);

const schema = {};
for (location of distanceThresholdLocationType) {
  schema[location] = {
    type: Number,
    required: true,
  };
}

const distanceThresholdSchema = new mongoose.Schema(
  schema,
  { toJSON: { virtuals: true } },
  { toObject: { virtuals: true } }
);

addVirtualIdUtils(distanceThresholdSchema);

const DistanceThreshold = mongoose.model(
  "DistanceThreshold",
  distanceThresholdSchema
);

const joiValidate = {};

for (location of distanceThresholdLocationType) {
  joiValidate[location] = Joi.number();
}

function validate(distanceThreshold) {
  const schema = Joi.object(joiValidate);

  return schema.validate(distanceThreshold);
}

function validatePatch(distanceThreshold) {
  const schema = Joi.object(joiValidate);

  return schema.validate(distanceThreshold);
}

exports.validatePatch = validatePatch;
exports.validate = validate;
exports.DistanceThreshold = DistanceThreshold;
