const mongoose = require("mongoose");
const { tokenSchema } = require("../common/constants.common");

const RefreshToken = mongoose.model("RefreshToken", tokenSchema);

exports.RefreshToken = RefreshToken;
