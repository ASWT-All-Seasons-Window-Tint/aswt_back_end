const { BlacklistedToken } = require("../model/blacklistedToken.model");
const blacklistedTokenService = require("../services/blacklistedToken.services");
const { logoutSuccess } = require("../common/messages.common");
const { MESSAGES } = require("../common/constants.common");

class BlacklistedTokenController {
  async getStatus(req, res) {
    res.status(200).send({ message: MESSAGES.DEFAULT, success: true });
  }

  //Create a new blacklistedToken
  async addTokenToBlacklist(req, res) {
    const token = req.header("x-auth-token");

    if (req.user.role === "staff") {
      if (req.session.users) {
        const indexToRemove = req.session.users.findIndex(
          (user) => user._id.toString() === req.user._id.toString()
        );

        // Check if the user was found
        if (indexToRemove !== -1) req.session.users.splice(indexToRemove, 1);
      }
    }

    let blacklistedToken = new BlacklistedToken({ token });

    blacklistedToken = await blacklistedTokenService.createBlacklistedToken(
      blacklistedToken
    );

    res.send(logoutSuccess());
  }
}

module.exports = new BlacklistedTokenController();
