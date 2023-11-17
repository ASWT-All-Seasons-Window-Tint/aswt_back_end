const mongoose = require("mongoose");
const Joi = require("joi");
const addVirtualIdUtils = require("../utils/addVirtualId.utils");
const { User } = require("./user.model").user;

const incentiveSchema = new mongoose.Schema(
  {
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    numberOfVehiclesThreshold: { type: Number, required: true },
    amountToBePaid: { type: Number, required: true },
    eligibleStaffs: [{ type: mongoose.Schema.Types.ObjectId, ref: User }],
  },
  { toJSON: { virtuals: true } },
  { toObject: { virtuals: true } }
);

addVirtualIdUtils(incentiveSchema);

const Incentive = mongoose.model("Incentive", incentiveSchema);

function validate(incentive) {
  const schema = Joi.object({
    startTime: Joi.date().required(),
    endTime: Joi.date().required(),
    numberOfVehiclesThreshold: Joi.number().min(1).required(),
    amountToBePaid: Joi.number().min(1).required(),
  });

  return schema.validate(incentive);
}

exports.incentive = {
  Incentive,
  validate,
};
