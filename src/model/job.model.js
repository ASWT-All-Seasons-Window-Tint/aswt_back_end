const mongoose = require("mongoose");
const Joi = require("joi");

const jobSchema = new mongoose.Schema({
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: true,
  },
  entryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "entry",
    required: true,
  },
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "service",
    required: true,
  },
  date: {
    type: String,
    minlength: 5,
    maxlength: 255,
    trim: true,
  },
});

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
