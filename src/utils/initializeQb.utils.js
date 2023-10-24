require("dotenv").config();
const QuickBooks = require("../node-quickbooks/index");
const { getOrSetCache } = require("../utils/getOrSetCache.utils");
const { getLatestToken } = require("../services/token.services");
const { getNewAccessToken } = require("../utils/getNewAccessToken.utils");
const { RefreshToken } = require("../model/refreshToken.model");

const { env } = process;
// Function to initialize the QuickBooks SDK
module.exports = async function () {
  const accessToken = await getNewAccessToken();
  const refreshTokenData = await getOrSetCache(
    "refreshToken",
    1800,
    getLatestToken,
    [RefreshToken]
  );
  const refreshToken = refreshTokenData.token;

  return new QuickBooks(
    env.clientId,
    env.clientSecret,
    accessToken,
    false,
    env.realmId,
    true,
    true,
    null,
    "2.0",
    refreshToken
  );
};
