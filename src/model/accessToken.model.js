const mongoose = require("mongoose");
const { tokenSchema } = require("../common/constants.common");

const AccessToken = mongoose.model("AccessToken", tokenSchema);

exports.AccessToken = AccessToken;
