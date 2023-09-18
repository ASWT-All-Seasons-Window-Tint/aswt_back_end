const getUpdatedDate = require("../utils/getUpdatedDate.utils");

class TokenService {
  //Create new token
  async createToken({ token, tokenModel, timeInSeconds }) {
    const newToken = new tokenModel({
      token,
      expires: getUpdatedDate(timeInSeconds),
    });

    return await newToken.save();
  }

  async getTokenById({ tokenId, tokenModel }) {
    return await tokenModel.findById(tokenId);
  }

  async getLatestToken(tokenModel) {
    return await tokenModel.findOne().sort({ createdAt: -1 }).limit(1);
  }

  async updateToken({ formerToken, tokenToUpdate, tokenModel, timeInSeconds }) {
    // Find and update query
    const result = await tokenModel.findOneAndUpdate(
      { token: formerToken },
      {
        $set: { expires: getUpdatedDate(timeInSeconds), token: tokenToUpdate },
      },
      { new: true } // Return updated doc
    );
    return result;
  }

  async getTokenByToken({ token, tokenModel }) {
    return await tokenModel.findOne({ token });
  }

  async getAllTokens(tokenModel) {
    return await tokenModel.find().sort({ _id: -1 });
  }

  async deleteToken({ id, tokenModel }) {
    return await tokenModel.findByIdAndRemove(id);
  }
}

module.exports = new TokenService();