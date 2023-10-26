const mongoose = require("mongoose");
const Joi = require("joi");
const addVirtualIdUtils = require("../utils/addVirtualId.utils");
const { validLocationType } = require("./entry.model").joiValidator;

const schema = {};
for (location of validLocationType) {
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

const Job = mongoose.model("Job", jobSchema);

function validate(job) {
  const schema = Joi.object({
    staffId: Joi.objectId().require(),
    entryId: Joi.objectId().require(),
    serviceId: Joi.objectId().require(),
  });

  return schema.validate(job);
}

function validatePatch(job) {
  const schema = Joi.object({
    staffId: Joi.objectId().require(),
    entryId: Joi.objectId().require(),
    serviceId: Joi.objectId().require(),
  });

  return schema.validate(job);
}

exports.validatePatch = validatePatch;
exports.validate = validate;
exports.Job = Job;
