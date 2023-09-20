const getUpdatedDate = require("../utils/getUpdatedDate.utils");
const { AccessToken } = require("../model/accessToken.model");
const { getOrSetCache, updateCache } = require("../utils/getOrSetCache.utils");
const { RefreshToken } = require("../model/refreshToken.model");

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

  updateAccessAndRefreshToken = async (responseData) => {
    const expires = 1800;

    const newAccessToken = responseData.access_token;
    const newRefreshToken = responseData.refresh_token;
    const accessTokenExpiryTime = responseData.expires_in;
    const refreshTokenExpiryTime = responseData.x_refresh_token_expires_in;
    const secondsToOffsetError = 180;

    const updatedAcccesToken = await this.createToken({
      token: newAccessToken,
      tokenModel: AccessToken,
      timeInSeconds: accessTokenExpiryTime - secondsToOffsetError,
    });

    updateCache("accessToken", expires, updatedAcccesToken);

    const isRefreshTokenTheSame = await this.getTokenByToken({
      token: newRefreshToken,
      tokenModel: RefreshToken,
    });

    let refreshToken = await this.getLatestToken(RefreshToken);

    if (!isRefreshTokenTheSame) {
      const updatedRefreshToken = await this.updateToken({
        formerToken: refreshToken.token,
        tokenToUpdate: newRefreshToken,
        tokenModel: RefreshToken,
        timeInSeconds: refreshTokenExpiryTime,
      });

      updateCache("refreshToken", expires, updatedRefreshToken);
    }

    refreshToken = newRefreshToken;

    return newAccessToken;
  };

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
