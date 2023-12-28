require("dotenv").config();
const axios = require("axios");

module.exports = function (params, type) {
  if (type === "invoice") {
    const { token, entryId, delay } = params;

    const url = `${process.env.bullUrl}${process.env.localEndpoint}/webhook/sendInvoice/${entryId}/${delay}`; // Replace with the actual URL you want to send the request to
    // Replace with your actual token

    // Configuring the headers
    const headers = {
      "Content-Type": "application/json", // Adjust the content type based on your API requirements
      "x-auth-token": token,
    };

    return axios.get(url, { headers });
  } else {
    const { messageBody, customerNumber, delay, token } = params;

    const url = `${process.env.bullUrl}${process.env.localEndpoint}/webhook/sendSms`;

    const postData = {
      messageBody,
      customerNumber,
      delay,
    };

    // Configuring the headers
    const headers = {
      "Content-Type": "application/json", // Adjust the content type based on your API requirements
      "x-auth-token": token,
    };

    // Making the POST request using axios with async/await
    return axios.post(url, postData, { headers });
  }
};
