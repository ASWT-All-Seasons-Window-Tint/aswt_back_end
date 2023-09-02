const { BlacklistedToken } = require("../model/blacklistedToken.model");
const blacklistedTokenService = require("../services/blacklistedToken.services");
const { errorMessage, successMessage } = require("../common/messages.common");
const { MESSAGES, errorAlreadyExists } = require("../common/constants.common");

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

    res.send(successMessage(MESSAGES.CREATED, blacklistedToken));
  }
}

module.exports = new BlacklistedTokenController();
