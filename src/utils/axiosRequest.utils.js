require("dotenv").config();
const axios = require("axios");

module.exports = async function (token, entryId) {
  const url = `${process.env.apiUrl}${process.env.localEndpoint}/webhook/sendInvoince`; // Replace with the actual URL you want to send the request to
  const authToken = token; // Replace with your actual token

  // Data to be sent in the POST request body (if needed)
  const postData = {
    entryId,
  };

  // Configuring the headers
  const headers = {
    "Content-Type": "application/json", // Adjust the content type based on your API requirements
    "x-auth-token": authToken,
  };

  const response = await axios.post(url, postData, { headers });
  return response;
};
