const axios = require("axios");
require("dotenv").config();
const { response } = require("express");
const { successMessage } = require("../common/messages.common");
const { AccessToken } = require("../model/accessToken.model");
const { RefreshToken } = require("../model/refreshToken.model");
const getUpdatedDate = require("../utils/getUpdatedDate.utils");
const { MESSAGES } = require("../common/constants.common");
const tokenServices = require("../services/token.services");
const { env } = process;

const realmId = env.realmId; // Replace with the realmId from your webhook payload
const paymentId = env.realmId; // Replace with the payment ID from your webhook payload

const apiEndpoint = env.apiEndpoint;

const clientId = env.clientId;
const clientSecret = env.clientSecret;

const tokenEndpoint = env.tokenEndpoint;

// Function to refresh the access token

class OauthTokenController {
  async getNewAccessToken(req, res) {
    const basicAuth = Buffer.from(clientId + ":" + clientSecret).toString(
      "base64"
    );

    const headers = {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: `Basic ${basicAuth}`,
    };

    try {
      const [accessToken, refreshToken] = await Promise.all([
        tokenServices.getLatestToken({ tokenModel: AccessToken }),
        tokenServices.getLatestToken({ tokenModel: RefreshToken }),
      ]);

      if (accessToken)
        return res.send(successMessage(MESSAGES.CREATED, accessToken));

      const data = `grant_type=refresh_token&refresh_token=${refreshToken.token}`;
      const { data: responseData } = await axios.post(tokenEndpoint, data, {
        headers,
      });

      const newAccessToken = responseData.access_token;
      const newRefreshToken = responseData.refresh_token;
      const accessTokenExpiryTime = responseData.expires_in;
      const refreshTokenExpiryTime = responseData.x_refresh_token_expires_in;

      await tokenServices.createToken({
        token: newAccessToken,
        tokenModel: AccessToken,
        timeInSeconds: accessTokenExpiryTime - 80,
      });

      const isRefreshTokenTheSame = tokenServices.getTokenByToken({
        token: newRefreshToken,
        tokenModel: RefreshToken,
      });
      if (!isRefreshTokenTheSame) {
        refreshToken.token = newRefreshToken;
        refreshToken.expires = getUpdatedDate(refreshTokenExpiryTime);

        await refreshToken.save();
      }

      res.send(successMessage(MESSAGES.CREATED, responseData));
    } catch (error) {
      console.error(error);
    }
  }
}

module.exports = new OauthTokenController();
