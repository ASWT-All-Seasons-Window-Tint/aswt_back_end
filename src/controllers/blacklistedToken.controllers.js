const { BlacklistedToken } = require("../model/blacklistedToken.model");
const blacklistedTokenService = require("../services/blacklistedToken.services");
const { logoutSuccess } = require("../common/messages.common");
const { MESSAGES } = require("../common/constants.common");
const userServices = require("../services/user.services");
const crypto = require("crypto");

class BlacklistedTokenController {
  async getStatus(req, res) {
    res.status(200).send({ message: MESSAGES.DEFAULT, success: true });
  }

  //Create a new blacklistedToken
  addTokenToBlacklist = async (req, res) => {
    this.blackListAToken(req);

    return res.send(logoutSuccess());
  };

  async blackListAToken(req) {
    const token = req.header("x-auth-token");
    const email = req.user.email;

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    let blacklistedToken = new BlacklistedToken({ tokenHash });

    await Promise.all([
      blacklistedTokenService.createBlacklistedToken(blacklistedToken),
      userServices.signOutStaff(email),
    ]);
  }
}

module.exports = new BlacklistedTokenController();
