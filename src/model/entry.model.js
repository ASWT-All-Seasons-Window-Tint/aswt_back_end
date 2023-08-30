const mongoose = require("mongoose");
const Joi = require("joi");
const addVirtualIdUtils = require("../utils/addVirtualId.utils");

const entrySchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    numberOfVehicles: {
      type: Number,
      trim: true,
      required: true,
    },
    vehiclesLeft: {
      type: Number,
      trim: true,
      required: true,
    },
    entryDate: {
      type: Date,
      required: true,
    },
    invoice: {
      name: {
        type: String,
        minlength: 5,
        maxlength: 255,
      },
      carDetails: [
        {
          vin: String,
          year: Number,
          make: {
            type: String,
            minlength: 5,
            maxlength: 255,
          },
          colour: {
            type: String,
            minlength: 5,
            maxlength: 255,
          },
          serviceIds: [
            {
              type: mongoose.Schema.Types.ObjectId,
              ref: "service",
            },
          ],
          note: {
            type: String,
            minlength: 5,
            maxlength: 512,
          },
          price: {
            type: Number,
            default: 0,
          },
          category: {
            type: String,
            minlength: 3,
            maxlength: 10,
          },
          staffId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            default: null,
          },
          priceBreakdown: [
            {
              serviceName: String,
              serviceType: String,
              price: Number,
            },
          ],
        },
      ],
      totalPrice: {
        type: Number,
        default: 0,
      },
    },
  },
  { toJSON: { virtuals: true } },
  { toObject: { virtuals: true } }
);

addVirtualIdUtils(entrySchema, "entryId");

entrySchema.statics.getNextInvoiceNumber = async function () {
  // Get the last entry
  const lastEntry = await this.findOne().sort("-entryDate");

  // Start with AWST0001 if no entries
  let nextNum = "00001";

  if (lastEntry) {
    const lastNum = lastEntry.invoice.name.substring(4);
    nextNum = leadingZero(parseInt(lastNum) + 1, 4);
  }

  return "AWST" + nextNum;
};

function leadingZero(num, size) {
  let s = num + "";
  while (s.length < size) s = "0" + s;
  return s;
}

const Entry = mongoose.model("Entry", entrySchema);

function validate(entry) {
  const schema = Joi.object({
    customerId: Joi.objectId().required(),
    numberOfVehicles: Joi.number().min(1).max(100000).required(),
    vehiclesLeft: Joi.number(),
  });

  return schema.validate(entry);
}

function validatePatch(entry) {
  const schema = Joi.object({
    customerId: Joi.string().email().min(4).max(255),
    numberOfVehicles: Joi.number().min(1).max(100000),
  });

  return schema.validate(entry);
}

function validateModifyCarDetails(entry) {
  const schema = Joi.object({
    year: Joi.number().min(1000),
    colour: Joi.string().min(3),
    serviceIds: Joi.array().items(Joi.objectId()),
    make: Joi.string().min(3).max(255),
    note: Joi.string().min(5).max(255),
    category: Joi.string().valid("suv", "sedan", "truck").insensitive(),
  });

  return schema.validate(entry);
}

function validateAddInvoicePatch(entry) {
  const schema = Joi.object({
    carDetails: Joi.object({
      vin: Joi.string().required(),
      year: Joi.number().min(1000).required(),
      colour: Joi.string().min(3).required(),
      serviceIds: Joi.array().items(Joi.objectId().required()),
      make: Joi.string().min(3).max(255).required(),
      note: Joi.string().min(5).max(255),
      category: Joi.string()
        .valid("suv", "sedan", "truck")
        .insensitive()
        .required(),
    }).required(),
  });

  return schema.validate(entry);
}

function validateModifyPrice(entry) {
  const schema = Joi.object({
    vin: Joi.string().required(),
    price: Joi.number().required(),
    serviceId: Joi.objectId(),
  });

  return schema.validate(entry);
}

exports.validate = validate;
exports.validatePatch = validatePatch;
exports.validateModifyPrice = validateModifyPrice;
exports.validateAddInvoicePatch = validateAddInvoicePatch;
exports.validateModifyCarDetails = validateModifyCarDetails;
exports.Entry = Entry;
