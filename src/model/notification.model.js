const mongoose = require("mongoose");
const Joi = require("joi");
const addVirtualIdUtils = require("../utils/addVirtualId.utils");
const { User } = require("./user.model").user;

const notificationSchema = new mongoose.Schema(
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
    vin: {
      type: String,
      required: true,
    },
    isReadBy: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: User,
    },
    concernedStaffIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: User,
      required: true,
    },
  },
  { toJSON: { virtuals: true } },
  { toObject: { virtuals: true } }
);

addVirtualIdUtils(notificationSchema);

const Notification = mongoose.model("Notification", notificationSchema);

function validate(notification) {
  const schema = Joi.object({
    body: Joi.string().required(),
    title: Joi.string().required(),
    type: Joi.string().required(),
  });

  return schema.validate(notification);
}

function validatePatch(notification) {
  const schema = Joi.object({
    body: Joi.string().required(),
    title: Joi.string().required(),
    type: Joi.string().required(),
  });

  return schema.validate(notification);
}

exports.notification = { Notification, validate, validatePatch };
