const mongoose = require("mongoose");
const Joi = require("joi");
const { User } = require("./user.model").user;
const addVirtualIdUtils = require("../utils/addVirtualId.utils");
const newDate = require("../utils/newDate.utils");

const articleSchema = new mongoose.Schema(
  {
    editorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: User,
      required: true,
    },
    title: {
      type: String,
      minlength: 3,
      maxlength: 128,
      required: true,
    },
    articleDetails: {
      type: String,
      minlength: 3,
      maxlength: 4048,
      required: true,
    },
    date: {
      type: Date,
      default: newDate(),
      required: true,
    },
  },
  { toJSON: { virtuals: true } },
  { toObject: { virtuals: true } }
);

addVirtualIdUtils(articleSchema);

const Article = mongoose.model("Article", articleSchema);

function validate(article) {
  const schema = Joi.object({
    articleDetails: Joi.string().min(3).max(4048).required(),
    title: Joi.string().min(3).max(128).required(),
  });

  return schema.validate(article);
}

function validatePatch(article) {
  const schema = Joi.object({
    articleDetails: Joi.string().min(3).max(4048),
    title: Joi.string().min(3).max(128),
  });

  return schema.validate(article);
}

exports.validatePatch = validatePatch;
exports.validate = validate;
exports.Article = Article;
