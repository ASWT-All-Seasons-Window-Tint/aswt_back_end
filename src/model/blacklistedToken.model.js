const mongoose = require("mongoose");

const blacklistedTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    minlength: 4,
    maxlength: 4096,
    trim: true,
    required: true,
  },
  blacklistedDate: {
    type: Date,
    default: new Date(),
    required: true,
  },
});

const BlacklistedToken = mongoose.model(
  "BlacklistedToken",
  blacklistedTokenSchema
);

exports.BlacklistedToken = BlacklistedToken;
