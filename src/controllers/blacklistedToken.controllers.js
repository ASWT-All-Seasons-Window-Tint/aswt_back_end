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

    let blacklistedToken = new BlacklistedToken({ token });

    blacklistedToken = await blacklistedTokenService.createBlacklistedToken(
      blacklistedToken
    );

    res.send(logoutSuccess());
  }
}

module.exports = new BlacklistedTokenController();
