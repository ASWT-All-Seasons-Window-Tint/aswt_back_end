require("dotenv").config();
const mongoose = require("mongoose");
const Joi = require("joi");
const { User } = require("./user.model").user;
const { Service } = require("./service.model");
const { FilmQuality } = require("./filmQuality.model").filmQuality;
const addVirtualIdUtils = require("../utils/addVirtualId.utils");
const convertToInchesUtils = require("../utils/calculateSquareFeetutils");

const validCarTypes = [
  "2Or4DoorsCar",
  "4DoorsSuv",
  "6+DoorsSuv",
  "MiniVan",
  "TruckStd.Cab",
  "Truck4Doors",
];

const validUnits = convertToInchesUtils();

const paymentDetailsSchema = new mongoose.Schema({
  paymentDate: {
    default: null,
    type: Date,
  },
  hasPaid: {
    type: Boolean,
    default: false,
  },
  amountPaid: {
    default: 0,
    type: Number,
  },
  amountDue: {
    type: Number,
  },
  currency: {
    type: String,
  },
  paymentIntentId: {
    type: String,
  },
  chargeId: {
    type: String,
  },
});

const refundDetailsSchema = new mongoose.Schema({
  refundDate: {
    default: null,
    type: Date,
  },
  refundAmount: {
    type: Number,
    default: 0,
  },
  refunded: {
    type: Boolean,
    default: false,
  },
  refundId: {
    type: String,
  },
  paymentIntentId: {
    type: String,
  },
});
const residentialDetailsSchema = new mongoose.Schema({
  customerMeasurementAwareness: {
    type: Boolean,
  },
  measurementDetails: {
    unit: {
      type: String,
      enum: validUnits,
    },
    length: {
      type: Number,
    },
    width: {
      type: Number,
    },
    filmQualityId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    quantity: {
      type: Number,
    },
  },
  priceBreakdown: [
    {
      filmQuality: String,
      price: Number,
      serviceName: String,
    },
  ],
  price: Number,
});

const carDetailsSchema = new mongoose.Schema({
  year: {
    type: String,
    minlength: 4,
    maxlength: 4,
  },
  make: {
    type: String,
    minlength: 1,
    maxlength: 255,
  },
  model: {
    type: String,
    minlength: 1,
    maxlength: 255,
  },
  category: {
    type: String,
    enum: [...validCarTypes, "suv", "sedan", "truck"],
  },
  serviceDetails: [
    {
      serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: Service,
        required: true,
      },
      filmQualityId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: FilmQuality,
      },
    },
  ],
  priceBreakdown: [
    {
      filmQuality: String,
      serviceName: String,
      serviceType: String,
      price: Number,
      serviceId: {
        type: mongoose.Schema.Types.ObjectId,
      },
    },
  ],
  price: {
    type: Number,
    default: 0,
  },
});

const appointmentSchema = new mongoose.Schema({
  appointmentType: {
    type: String,
    enum: ["auto", "commercial"],
    required: true,
  },
  customerEmail: {
    type: String,
    ref: User,
    required: true,
  },
  customerName: {
    type: String,
    minlength: 2,
    maxlength: 255,
    ref: User,
    required: true,
  },
  customerNumber: {
    type: String,
    required: true,
  },
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: User,
    required: true,
  },
  startTime: {
    type: Date,
    required: true,
  },
  endTime: {
    type: Date,
    required: true,
  },
  description: {
    type: String,
    minlength: 3,
    maxlength: 255,
  },
  refundDetails: {
    type: refundDetailsSchema,
    default: {},
  },
  paymentDetails: {
    type: paymentDetailsSchema,
    default: {},
  },
  carDetails: {
    type: carDetailsSchema,
    default: undefined,
  },
  residentialDetails: {
    type: residentialDetailsSchema,
    default: undefined,
  },
});

addVirtualIdUtils(appointmentSchema);

appointmentSchema.pre("validate", function (next) {
  if (this.appointmentType === "auto" && !this.carDetails) {
    this.invalidate(
      "carDetails",
      "carDetails is required for auto appointments"
    );
  }
  if (this.appointmentType === "commercial" && !this.residentialDetails) {
    this.invalidate(
      "residentialDetails",
      "Residential details is required for auto appointments"
    );
  }
  next();
});

const Appointment = mongoose.model("Appointment", appointmentSchema);

function validate(appointment) {
  const schema = Joi.object({
    appointmentType: Joi.string()
      .valid("auto", "commercial")
      .insensitive()
      .required(),
    customerEmail: Joi.string().email().required(),
    customerName: Joi.string().min(2).max(255).required(),
    customerNumber: Joi.string().required(),
    startTime: Joi.date().required(),
    description: Joi.string().max(255).min(3),
    carDetails: Joi.object({
      year: Joi.string().min(4).max(4),
      make: Joi.string().min(1).max(255),
      model: Joi.string().min(1).max(255),
      category: Joi.string()
        .min(1)
        .valid(...validCarTypes),
      serviceDetails: Joi.array().items(
        Joi.object({
          serviceId: Joi.objectId().required(),
          filmQualityId: Joi.objectId(),
        })
      ),
    }).when("appointmentType", {
      is: "auto",
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    }),
    residentialDetails: Joi.object({
      customerMeasurementAwareness: Joi.boolean().required(),
      measurementDetails: Joi.object({
        unit: Joi.string()
          .valid(...validUnits)
          .required(),
        length: Joi.number().greater(0).required(),
        width: Joi.number().greater(0).required(),
        quantity: Joi.number().greater(0).required(),
        filmQualityId: Joi.objectId().required(),
      }).when("customerMeasurementAwareness", {
        is: true,
        then: Joi.required(),
        otherwise: Joi.forbidden(),
      }),
    }).when("appointmentType", {
      is: "commercial",
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    }),
  });

  return schema.validate(appointment);
}

function validateGetTakenTimeslots(appointment) {
  const schema = Joi.object({
    date: Joi.date().required(),
    serviceIds: Joi.array().items(Joi.objectId()),
  });

  return schema.validate(appointment);
}

function validatePatch(appointment) {
  const schema = Joi.object({
    startTime: Joi.date().required(),
    description: Joi.string().max(255).min(3),
    carDetails: Joi.object({
      serviceDetails: Joi.array().items(
        Joi.object({
          serviceId: Joi.objectId().required(),
          filmQualityId: Joi.objectId(),
        })
      ),
    }).when("appointmentType", {
      is: "commercial",
      then: Joi.forbidden(),
    }),
  });

  return schema.validate(appointment);
}

exports.joiValidators = {
  validate,
  validatePatch,
  validateGetTakenTimeslots,
};
exports.validate = validate;
exports.validatePatch = validatePatch;
exports.Appointment = Appointment;
