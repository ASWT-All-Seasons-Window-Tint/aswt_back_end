const { BlacklistedToken } = require("../model/blacklistedToken.model");

class BlacklistedTokenService {
  //Create new blacklistedToken
  async createBlacklistedToken(blacklistedToken) {
    return await blacklistedToken.save();
  }

  async getBlacklistedTokenById(blacklistedTokenId) {
    return await BlacklistedToken.findById(blacklistedTokenId);
  }

  async getBlacklistedTokenByToken(tokenHash) {
    return await BlacklistedToken.findOne({ tokenHash });
  }

  async getAllBlacklistedTokens() {
    return await BlacklistedToken.find().sort({ _id: -1 });
  }

  async deleteBlacklistedToken(id) {
    return await BlacklistedToken.findByIdAndRemove(id);
  }
}

module.exports = new BlacklistedTokenService();
