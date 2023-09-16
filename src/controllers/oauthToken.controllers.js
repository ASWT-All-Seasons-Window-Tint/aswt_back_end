const axios = require("axios");
require("dotenv").config();
const { response } = require("express");
const { successMessage } = require("../common/messages.common");
const { AccessToken } = require("../model/accessToken.model");
const { RefreshToken } = require("../model/refreshToken.model");
const getUpdatedDate = require("../utils/getUpdatedDate.utils");
const { getOrSetCache, updateCache } = require("../utils/getOrSetCache.utils");
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
    const expires = 1800;
    const { getLatestToken } = tokenServices;
    const basicAuth = Buffer.from(clientId + ":" + clientSecret).toString(
      "base64"
    );

    const headers = {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: `Basic ${basicAuth}`,
    };

    try {
      let { data: accessToken, error: accessError } = await getOrSetCache(
        "accessToken",
        expires,
        getLatestToken,
        AccessToken
      );
      if (accessToken) {
        return res.send(
          successMessage(MESSAGES.CREATED, { token: accessToken.token })
        );
      }

      let { data: refreshToken, error: refreshError } = await getOrSetCache(
        "refreshToken",
        expires,
        getLatestToken,
        RefreshToken
      );

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

      const isRefreshTokenTheSame = await tokenServices.getTokenByToken({
        token: newRefreshToken,
        tokenModel: RefreshToken,
      });

      if (!isRefreshTokenTheSame) {
        await tokenServices.updateToken({
          formerToken: refreshToken.token,
          tokenToUpdate: newRefreshToken,
          tokenModel: RefreshToken,
          timeInSeconds: refreshTokenExpiryTime,
        });

        updateCache("refreshToken", expires, newRefreshToken);
        refreshToken = newRefreshToken;
      }
      accessToken = newAccessToken;

      res.send(successMessage(MESSAGES.CREATED, { token: accessToken }));
    } catch (error) {
      console.error(error);
      return res.status(501).send(error.message);
    }
  }
}

module.exports = new OauthTokenController();
