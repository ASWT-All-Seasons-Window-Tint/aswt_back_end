const mongoose = require("mongoose");
const Joi = require("joi");
const addVirtualIdUtils = require("../utils/addVirtualId.utils");
const { User } = require("./user.model").user;

const notificationSchema = new mongoose.Schema(
  {
    body: {
      type: String,
    },
    carId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    concernedStaffIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: User,
      required: true,
    },
    entryId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    isDeleted: {
      type: Boolean,
      default: undefined,
    },
    appointmentId: mongoose.Schema.Types.ObjectId,
    isReadBy: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: User,
    },
    notificationTime: {
      type: Date,
      default: new Date(),
    },
    title: {
      type: String,
      required: true,
    },
    type: {
      type: String,
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
