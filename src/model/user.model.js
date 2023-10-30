const _ = require("lodash");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Joi = require("joi");
const { Department } = require("./department.model");
const addVirtualIdUtils = require("../utils/addVirtualId.utils");
require("dotenv").config();

const validUserRoles = [
  "staff",
  "manager",
  "receptionist",
  "editor",
  "gm",
  "porter",
];

const staffDetailsSchema = new mongoose.Schema({
  signInLocations: [
    {
      timestamp: {
        type: Date,
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
  isAvailableForAppointments: {
    type: Boolean,
    default: false,
  },
  earningRate: {
    type: Number,
    min: 1,
  },
  totalEarning: {
    type: Number,
    default: 0,
  },
  isLoggedIn: Boolean,
  currentTrips: [
    {
      timestamp: {
        type: Date,
      },
      description: {
        type: String,
        minlength: 3,
        maxlength: 255,
      },
      coordinates: {
        latitude: { type: Number },
        longitude: { type: Number },
      },
      locationType: {
        type: String,
        minlength: 3,
        maxlength: 255,
      },
    },
  ],
  currentSignInLocation: {
    timestamp: {
      type: Date,
    },
    description: {
      type: String,
      minlength: 3,
      maxlength: 255,
    },
    coordinates: {
      latitude: { type: Number },
      longitude: { type: Number },
    },
  },
});

const customerDetailsSchema = new mongoose.Schema({
  companyName: {
    type: String,
  },
  qbId: {
    type: String,
  },
});

const managerDetailsSchema = new mongoose.Schema({
  staffLocationsVisibleToManager: {
    type: [mongoose.Schema.Types.ObjectId],
    default: [],
  },
});

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      minlength: 3,
      maxlength: 255,
      trim: true,
      required: true,
    },
    lastName: {
      type: String,
      minlength: 3,
      maxlength: 255,
      trim: true,
      required: true,
    },
    password: {
      type: String,
      minlength: 5,
      maxlength: 1024,
      trim: true,
    },
    email: {
      type: String,
      minlength: 5,
      maxlength: 255,
      trim: true,
      unique: true,
      required: true,
    },
    avatarUrl: {
      type: String,
      required: true,
    },
    avatarImgTag: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      required: true,
      enum: validUserRoles,
    },
    departments: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: Department,
      default: undefined,
    },
    isAdmin: {
      type: Boolean,
    },
    resetToken: {
      type: String,
    },
    managerDetails: {
      type: managerDetailsSchema,
      default: undefined,
    },
    staffDetails: {
      type: staffDetailsSchema,
      default: undefined,
    },
    customerDetails: {
      type: customerDetailsSchema,
      default: undefined,
    },
    isDeleted: {
      type: Boolean,
      default: undefined,
    },
  },
  { toJSON: { virtuals: true } },
  { toObject: { virtuals: true } }
);

addVirtualIdUtils(userSchema);

userSchema.post("find", async function (docs) {
  for (let doc of docs) {
    if (doc.departments && doc.departments.length === 0) {
      doc.departments = undefined;
    }
  }
});
userSchema.methods.generateAuthToken = function () {
  const token = jwt.sign(
    {
      _id: this._id,
      isAdmin: this.isAdmin,
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      role: this.role,
      departments: this.departments,
      staffDetails: this.staffDetails,
      managerDetails: this.managerDetails,
      avatarUrl: this.avatarUrl,
    },
    process.env.jwtPrivateKey
  );
  return token;
};

const User = mongoose.model("User", userSchema);

function validate(user) {
  const schema = Joi.object({
    firstName: Joi.string().min(2).max(255).required(),
    lastName: Joi.string().min(2).max(255).required(),
    password: Joi.string().min(5).max(1024).required(),
    email: Joi.string().email().min(5).max(255).required(),
    role: Joi.string()
      .min(4)
      .max(255)
      .required()
      .valid(...validUserRoles)
      .insensitive(),
    departments: Joi.array()
      .items(Joi.objectId().required())
      .when("role", {
        is: "receptionist",
        then: Joi.forbidden(),
      })
      .when("role", {
        is: Joi.valid("editor", "gm", "receptionist"),
        then: Joi.forbidden(),
        otherwise: Joi.required(),
      }),
    staffDetails: Joi.object({
      earningRate: Joi.number().min(1).required(),
    }).when("role", {
      is: Joi.valid("staff", "porter"),
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    }),
    managerDetails: Joi.object({
      staffLocationsVisibleToManager: Joi.array().items(
        Joi.objectId().required()
      ),
    }).when("role", {
      is: "manager",
      then: Joi.optional(),
      otherwise: Joi.forbidden(),
    }),
  });

  return schema.validate(user);
}

function validatePatch(user) {
  const schema = Joi.object({
    firstName: Joi.string().min(4).max(255),
    lastName: Joi.string().min(4).max(255),
    role: Joi.string()
      .min(4)
      .max(255)
      .valid(...validUserRoles)
      .insensitive(),
    departments: Joi.array()
      .items(Joi.objectId().required())
      .when("role", {
        is: "receptionist",
        then: Joi.forbidden(),
      })
      .when("role", { is: "editor", then: Joi.forbidden() }),
  });

  return schema.validate(user);
}

function validateUpdatePassword(user) {
  const schema = Joi.object({
    currentPassword: Joi.string().min(5).max(1024).required(),
    newPassword: Joi.string().min(5).max(1024).required(),
    confirmPassword: Joi.string().min(5).max(1024).required(),
  });

  return schema.validate(user);
}

function validateResetPassword(user) {
  const schema = Joi.object({
    newPassword: Joi.string().min(5).max(1024).required(),
    confirmPassword: Joi.string().min(5).max(1024).required(),
  });

  return schema.validate(user);
}

function updateManagerPermission(user) {
  const schema = Joi.object({
    idToAdd: Joi.objectId(),
    idToRemove: Joi.objectId(),
  });

  return schema.validate(user);
}
function validateRequestResetPassword(user) {
  const schema = Joi.object({
    email: Joi.string().email().min(5).max(255).required(),
  });

  return schema.validate(user);
}

exports.user = {
  validate,
  validatePatch,
  validateResetPassword,
  validateUpdatePassword,
  validateRequestResetPassword,
  updateManagerPermission,
  User,
};
