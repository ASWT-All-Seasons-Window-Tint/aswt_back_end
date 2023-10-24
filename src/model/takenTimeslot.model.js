const mongoose = require("mongoose");
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
  },
  { toJSON: { virtuals: true } },
  { toObject: { virtuals: true } }
);

addVirtualIdUtils(takenTimeslotSchema);

const TakenTimeslot = mongoose.model("TakenTimeslot", takenTimeslotSchema);

exports.TakenTimeslot = TakenTimeslot;
