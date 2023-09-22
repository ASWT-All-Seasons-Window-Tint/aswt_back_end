const mongoose = require("mongoose");

const Session = mongoose.model(
  "Session",
  new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    isActive: Boolean,
    signInLocation: {
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
    expires: {
      type: Date,
      // Set the 'expires' field as a TTL index
      index: { expireAfterSeconds: 0 }, // 0 means documents expire immediately after 'expires' date
    },
  })
);

exports.Session = Session;
