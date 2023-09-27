const axios = require("axios");

module.exports = async function (apiEndpoint, getNewAccessToken) {
  const accessToken = await getNewAccessToken();
  const tokenConfig = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };

  const response = await axios.get(apiEndpoint, tokenConfig);

  return response.data;
};
