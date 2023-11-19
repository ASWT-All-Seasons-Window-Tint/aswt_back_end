const mongoose = require("mongoose");
const Joi = require("joi");
const addVirtualIdUtils = require("../utils/addVirtualId.utils");
const { User } = require("./user.model").user;

const jobSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    isReadBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: User,
        required: true,
      },
    ],
    concernedStaffIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: User,
        required: true,
      },
    ],
  },
  { toJSON: { virtuals: true } },
  { toObject: { virtuals: true } }
);

addVirtualIdUtils(jobSchema);

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
