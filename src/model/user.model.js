const _ = require("lodash");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Joi = require("joi");
const { Department } = require("./department.model");
const addVirtualIdUtils = require("../utils/addVirtualId.utils");
require("dotenv").config();

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
    },
    departments: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: Department,
    },
    isAdmin: {
      type: Boolean,
    },
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
    resetToken: {
      type: String,
    },
    staffDetails: {
      earningRate: {
        type: Number,
        min: 1,
      },
      totalEarning: {
        type: Number,
        default: 0,
      },
      isLoggedIn: Boolean,
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

userSchema.pre("find", function () {
  if (!this.getQuery().role || this.getQuery().role !== "staff") {
    this.select("-signInLocations");
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
      .valid("staff", "manager")
      .insensitive(),
    departments: Joi.array().items(Joi.objectId().required()),
    staffDetails: Joi.object({
      earningRate: Joi.number().min(1).required(),
    }).when("role", {
      is: "staff",
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    }),
  });

  return schema.validate(user);
}

function validatePatch(user) {
  const schema = Joi.object({
    firstName: Joi.string().min(4).max(255),
    lastName: Joi.string().min(4).max(255),
    role: Joi.string().min(4).max(255).valid("staff", "manager").insensitive(),
    departments: Joi.array().items(Joi.objectId().required()).when("role", {
      is: "customer",
      then: Joi.forbidden(),
    }),
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
function validateRequestResetPassword(user) {
  const schema = Joi.object({
    email: Joi.string().email().min(5).max(255).required(),
  });

  return schema.validate(user);
}
exports.validatePatch = validatePatch;
exports.validate = validate;
exports.validateUpdatePassword = validateUpdatePassword;
exports.validateResetPassword = validateResetPassword;
exports.validateRequestResetPassword = validateRequestResetPassword;
exports.User = User;
