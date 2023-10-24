const mongoose = require("mongoose");
const Joi = require("joi");
const addVirtualidUtils = require("../utils/addVirtualId.utils");
const { VALID_TIME_SLOTS } = require("../common/constants.common");

const freeTimeSlotSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
    },
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    timeSlots: {
      type: [String],
      required: true,
    },
  },
  { toJSON: { virtuals: true } },
  { toObject: { virtuals: true } }
);

addVirtualidUtils(freeTimeSlotSchema);

const FreeTimeSlot = mongoose.model("FreeTimeSlot", freeTimeSlotSchema);

function validate(freeTimeSlot) {
  const schema = Joi.object({
    staffId: Joi.string().regex(noSpecials).min(4).max(50).required(),
    timeSlots: Joi.array().items(
      Joi.string()
        .required()
        .valid(...VALID_TIME_SLOTS())
    ),
  });

  return schema.validate(freeTimeSlot);
}

function validatePatch(freeTimeSlot) {
  const schema = Joi.object({
    name: Joi.string().regex(noSpecials).min(4).max(50),
    description: Joi.string().min(4).max(255),
  });

  return schema.validate(freeTimeSlot);
}

exports.validatePatch = validatePatch;
exports.validate = validate;
exports.FreeTimeSlot = FreeTimeSlot;
