const mongoose = require("mongoose");
const Joi = require("joi");
const { User } = require("./user.model").user;
const addVirtualIdUtils = require("../utils/addVirtualId.utils");

const takenTimeslotSchema = new mongoose.Schema(
  {
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: User,
    },
    timeslots: {
      type: [String],
      default: undefined,
    },
    clearedOut: {
      type: Boolean,
      default: false,
    },
    date: {
      type: String,
      required: true,
    },
    forDealership: {
      type: Boolean,
      default: undefined,
    },
    isAvailable: {
      type: Boolean,
      default: undefined,
    },
    clearOutForDealershipId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: User,
    },
    isBooked: {
      type: Boolean,
      default: undefined,
    },
  },
  { toJSON: { virtuals: true } },
  { toObject: { virtuals: true } }
);

addVirtualIdUtils(takenTimeslotSchema);

const TakenTimeslot = mongoose.model("TakenTimeslot", takenTimeslotSchema);

function blockOut(user) {
  const schema = Joi.object({
    dealershipId: Joi.objectId().required(),
  });

  return schema.validate(user);
}

exports.TakenTimeslot = TakenTimeslot;
exports.blockOut = blockOut;
