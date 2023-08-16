const _ = require("lodash");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Joi = require("joi");
require("dotenv").config();

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    minlength: 4,
    maxlength: 255,
    trim: true,
    required: true,
  },
  lastName: {
    type: String,
    minlength: 4,
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
    ref: "department",
  },
  isAdmin: {
    type: Boolean,
  },
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
      avatarUrl: this.avatarUrl,
    },
    process.env.jwtPrivateKey
  );
  return token;
};

const User = mongoose.model("User", userSchema);

function validate(user) {
  const schema = Joi.object({
    firstName: Joi.string().min(4).max(255).required(),
    lastName: Joi.string().min(4).max(255).required(),
    password: Joi.string().min(5).max(1024).when("role", {
      is: "customer",
      then: Joi.optional(),
      otherwise: Joi.required(),
    }),
    email: Joi.string().email().min(5).max(255).required(),
    role: Joi.string()
      .min(4)
      .max(255)
      .required()
      .valid("staff", "manager", "customer")
      .insensitive(),
    departments: Joi.array().items(Joi.objectId().required()).when("role", {
      is: "customer",
      then: Joi.forbidden(),
      otherwise: Joi.required(),
    }),
  });

  return schema.validate(user);
}

function validatePatch(user) {
  const schema = Joi.object({
    firstName: Joi.string().min(4).max(255),
    lastName: Joi.string().min(4).max(255),
    password: Joi.string().min(5).max(1024),
    email: Joi.string().email().min(5).max(255),
    role: Joi.string()
      .min(4)
      .max(255)
      .required()
      .valid("staff", "manager", "customer")
      .insensitive(),
    departments: Joi.array().items(Joi.objectId().required()).when("role", {
      is: "customer",
      then: Joi.forbidden(),
    }),
  });

  return schema.validate(user);
}

exports.validatePatch = validatePatch;
exports.validate = validate;
exports.User = User;
