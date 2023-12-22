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
  const refreshToken = refreshTokenData.data.token;
  let sandbox = env.sandbox;
  if (sandbox == "false") sandbox = false;

  return new QuickBooks(
    env.clientId,
    env.clientSecret,
    accessToken,
    false,
    env.realmId,
    !!sandbox,
    false,
    null,
    "2.0",
    refreshToken
  );
};
