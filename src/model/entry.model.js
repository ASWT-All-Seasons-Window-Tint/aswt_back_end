const mongoose = require("mongoose");
const Joi = require("joi");
const addVirtualIdUtils = require("../utils/addVirtualId.utils");
const newDate = require("../utils/newDate.utils");
const { Service } = require("./service.model");
const { FilmQuality } = require("./filmQuality.model").filmQuality;

const validLocationType = [
  "Scanned",
  "PickupFromDealership",
  "TakenToShop",
  "TakenFromShop",
  "DropOffCompleted",
];
const carDetails = [
  {
    waitingList: {
      type: Boolean,
    },
    isCompleted: {
      type: Boolean,
    },
    isDroppedOff: {
      type: Boolean,
    },
    vin: { type: String },
    year: { type: Number },
    make: {
      type: String,
      minlength: 3,
      maxlength: 255,
    },
    entryDate: {
      type: Date,
    },
    model: {
      type: String,
      minlength: 1,
      maxlength: 255,
    },
    colour: {
      type: String,
      minlength: 3,
      maxlength: 255,
    },
    serviceIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: Service,
      },
    ],
    servicesDone: [
      {
        serviceId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "service",
        },
        staffId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "user",
        },
      },
    ],
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
    geoLocations: [
      {
        timestamp: {
          type: Date,
        },
        locationType: {
          type: String,
          enum: validLocationType,
          required: true,
        },
        description: {
          type: String,
          minlength: 3,
          maxlength: 255,
        },
        coordinates: {
          latitude: { type: Number, required: true },
          longitude: { type: Number, required: true },
        },
      },
    ],
    customerNote: {
      type: String,
      minlength: 5,
      maxlength: 512,
    },
    note: {
      type: String,
      minlength: 1,
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
    porterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },
    priceBreakdown: [
      {
        filmQuality: String,
        serviceName: String,
        serviceType: String,
        price: Number,
        serviceId: {
          type: mongoose.Schema.Types.ObjectId,
        },
        dealership: {
          type: Boolean,
        },
        qbId: {
          type: String,
        },
        lineId: String,
      },
    ],
  },
];

const entry = {
  customerId: {
    type: String,
    required: true,
  },
  customerName: {
    type: String,
    required: true,
  },
  customerEmail: {
    type: String,
    required: true,
  },
  entryDate: {
    type: Date,
  },
  isFromAppointment: {
    type: Boolean,
    default: undefined,
  },
  isFromDealership: {
    type: Boolean,
    default: undefined,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  numberOfCarsAdded: {
    type: Number,
    default: 0,
  },
  numberOfVehicles: {
    type: Number,
    default: 0,
  },
  invoice: {
    name: {
      type: String,
      minlength: 5,
      maxlength: 255,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: undefined,
    },
    isAutoSentScheduled: {
      type: Boolean,
    },
    carDetails,
    totalPrice: {
      type: Number,
      default: 0,
    },
    qbId: String,
    invoiceNumber: String,
    paymentDetails: {
      paymentDate: {
        default: null,
        type: Date,
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
    },
    sent: {
      type: Boolean,
      default: null,
    },
  },
};

const entrySchema = new mongoose.Schema(
  entry,
  { toJSON: { virtuals: true } },
  { toObject: { virtuals: true } }
);

// Pre-save middleware to generate custom invoice number
entrySchema.pre("save", function (next) {
  const currentDate = new Date();
  const year = currentDate.getFullYear();

  const invoiceNumberPattern = /^\d{6}-\d{1,}$/;
  // Incrementing invoice number - adjust as needed
  const getNextInvoiceNumber = async () => {
    const lastInvoice = await this.constructor.findOne(
      {},
      {},
      { sort: { _id: -1 } }
    );

    if (lastInvoice) {
      const lastInvoiceNumber = lastInvoice.invoice.invoiceNumber;
      if (!invoiceNumberPattern.test(lastInvoice.invoice.invoiceNumber))
        return `124531-1`;

      let [firstString, lastString] = lastInvoiceNumber.split("-");

      let lastNumber = parseInt(lastString, 10);
      let firstNumber = parseInt(firstString, 10);

      let newInvoiceNumber;

      if (lastNumber == 99) {
        lastNumber = 0;
        firstNumber++;
      }

      do {
        lastNumber++;
        newInvoiceNumber = `${firstNumber}-${lastNumber}`;

        // Check if the new invoice number is unique
        const isUnique =
          (await this.constructor.findOne({
            "invoce.invoiceNumber": newInvoiceNumber,
          })) === null;

        if (isUnique) {
          return newInvoiceNumber;
        }
      } while (true);
    }

    return `124531-1`;
  };

  getNextInvoiceNumber()
    .then((invoiceNumber) => {
      if (invoiceNumberPattern.test(this.invoice.invoiceNumber)) {
        next();
      } else {
        this.invoice.invoiceNumber = invoiceNumber;
        next();
      }
    })
    .catch((error) => {
      next(error);
    });
});

addVirtualIdUtils(entrySchema);

entrySchema.statics.getNextInvoiceNumber = async function () {
  // Get the last entry
  const lastEntry = await this.findOne().sort("-entryDate");

  // Start with AWST00001 if no entries
  let nextNum = "00001";

  if (lastEntry) {
    const lastNum = lastEntry.invoice.name.substring(5);
    nextNum = leadingZero(parseInt(lastNum) + 1, 5);
  }

  return "ASWT" + nextNum;
};

function leadingZero(num, size) {
  let s = num + "";
  while (s.length < size) s = "0" + s;
  return s;
}

entrySchema.post("save", function (doc) {
  const entryDate = doc.entryDate;
  const timeoutMs = Math.min(2 * 60 * 1000 + entryDate.getTime(), 2147483647);

  setTimeout(() => {
    doc.isActive = false;
    doc.save();
  }, timeoutMs);
});

const Entry = mongoose.model("Entry", entrySchema);

function validate(entry) {
  const schema = Joi.object({
    // customerId: Joi.string().required(),
    numberOfVehicles: Joi.number().min(1).max(100000).required(),
  });

  return schema.validate(entry);
}

function validateAddVin(entry) {
  const schema = Joi.object({
    carDetails: Joi.array()
      .items(
        Joi.object({
          vin: Joi.string().required(),
          customerNote: Joi.string().min(5).max(255),
        }).required()
      )
      .required(),
  });

  return schema.validate(entry);
}

function validatePatch(entry) {
  const schema = Joi.object({
    numberOfVehicles: Joi.number().min(1).max(100000),
  });

  return schema.validate(entry);
}

function validateModifyCarDetails(entry) {
  const schema = Joi.object({
    year: Joi.number().min(1000),
    colour: Joi.string().min(3),
    serviceIds: Joi.array().items(Joi.objectId().required()),
    make: Joi.string().min(3).max(255),
    model: Joi.string().min(1).max(255),
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
      colour: Joi.string().min(3),
      serviceDetails: Joi.array()
        .items(
          Joi.object({
            serviceId: Joi.objectId().required(),
            filmQualityId: Joi.objectId(),
          }).required()
        )
        .required(),
      make: Joi.string().min(3).max(255).required(),
      model: Joi.string().min(1).max(255).required(),
      note: Joi.string().min(5).max(255),
      geoLocation: Joi.object({
        description: Joi.string().min(1).max(255).required(),
        coordinates: Joi.object({
          latitude: Joi.number().required(),
          longitude: Joi.number().required(),
        }),
      }).required(),
      category: Joi.string()
        .valid("suv", "sedan", "truck")
        .insensitive()
        .required(),
    }).required(),
  });

  return schema.validate(entry);
}

function validateAddCarGeolocation(entry) {
  const schema = Joi.object({
    geoLocation: Joi.object({
      description: Joi.string().required(),
      coordinates: Joi.object({
        longitude: Joi.number().required(),
        latitude: Joi.number().required(),
      }).required(),
    }).required(),
  });

  return schema.validate(entry);
}
function validateModifyPrice(entry) {
  const schema = Joi.object({
    vin: Joi.string(),
    price: Joi.number().required(),
    serviceId: Joi.objectId().required(),
    carId: Joi.objectId().required(),
  });

  return schema.validate(entry);
}

function validateModifyPriceForSentInvoice(entry) {
  const schema = Joi.object({
    carId: Joi.objectId().required(),
    price: Joi.number().required(),
    serviceId: Joi.objectId().required(),
  });

  return schema.validate(entry);
}
function validateModifyServiceDone(entry) {
  const schema = Joi.object({
    note: Joi.string().min(5).max(255),
    serviceId: Joi.objectId().required(),
    vin: Joi.string(),
  });

  return schema.validate(entry);
}

exports.joiValidator = {
  validate,
  validatePatch,
  validateAddVin,
  validateModifyPrice,
  validateAddInvoicePatch,
  validateModifyCarDetails,
  validateModifyServiceDone,
  validateAddCarGeolocation,
  validateModifyPriceForSentInvoice,
  carDetails: carDetails[0],
  carDetailsProperties: Object.keys(carDetails[0]),
  entryProperties: Object.keys(entry),
  invoiceProperties: Object.keys(entry.invoice),
  paymentDetailsProperties: Object.keys(entry.invoice.paymentDetails),
  validLocationType,
};
exports.Entry = Entry;
