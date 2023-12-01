const mongoose = require("mongoose");
const Joi = require("@hapi/joi");
const addVirtualIdUtils = require("../utils/addVirtualId.utils");
const { User } = require("./user.model").user;

const statusEnums = ["open", "close"];

const ticketSchema = new mongoose.Schema(
  {
    adminResponse: {
      type: String,
      default: "",
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: User,
    },
    imageURL: {
      type: String,
    },
    message: {
      type: String,
      required: true,
    },
    raisedTime: {
      type: Date,
      default: new Date(),
    },
    responseTime: {
      type: Date,
    },
    status: {
      type: String,
      enum: statusEnums,
      default: "open",
    },
    subject: {
      type: String,
      minlength: 4,
      maxlength: 255,
    },
    ticketId: {
      type: String,
      unique: true,
    },
  },
  { toJSON: { virtuals: true } },
  { toObject: { virtuals: true } }
);

addVirtualIdUtils(ticketSchema);

// Middleware to generate a unique ticketId before saving
ticketSchema.pre("save", function (next) {
  // Generate a unique ticketId using timestamp and a random component
  this.ticketId = generateUniqueTicketId();
  next();
});

// Function to generate a unique ticketId
function generateUniqueTicketId() {
  const timestamp = Date.now().toString(36);
  const randomComponent = Math.random().toString(36).substr(2, 5);
  return `TI${timestamp.toUpperCase()}${randomComponent.toUpperCase()}`;
}

const Ticket = mongoose.model("Ticket", ticketSchema);

function validate(ticket) {
  const schema = Joi.object({
    subject: Joi.string().min(4).max(255).required(),
    message: Joi.string().min(4).max(255).required(),
  });

  return schema.validate(ticket);
}

const imageSchema = Joi.object({
  fieldname: Joi.string().required(),
  originalname: Joi.string().required(),
  encoding: Joi.string().required(),
  mimetype: Joi.string()
    .valid("image/jpeg", "image/png", "image/gif")
    .required(),
  size: Joi.number().required(),
  buffer: Joi.required(),
});

exports.ticket = {
  Ticket,
  validate,
  imageSchema,
};
