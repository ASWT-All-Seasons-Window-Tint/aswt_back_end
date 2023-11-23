require("dotenv").config();
const axios = require("axios");
const fs = require("fs");
const { promisify } = require("util");
const { Buffer } = require("buffer");
const { getNewAccessToken } = require("./getNewAccessToken.utils");

module.exports = async function (estimateNumber) {
  const accessToken = await getNewAccessToken();
  const companyID = process.env.realmId;

  axios({
    method: "GET",
    url: `https://sandbox-quickbooks.api.intuit.com/v3/company/${companyID}/estimate/${estimateNumber}/pdf`,
    headers: {
      "Content-Type": "application/pdf",
      Accept: "application/pdf",
      Authorization: `Bearer ${accessToken}`,
    },
    responseType: "arraybuffer", // Ensure response is treated as a binary buffer
  })
    .then(async (response) => {
      // Handle the PDF content
      const pdfBuffer = Buffer.from(response.data, "binary");
      // Now you can do something with the pdfBuffer, such as saving it to a file or sending it in a response.

      await savePdfToFile(pdfBuffer);
      // Save the PDF buffer to a file
      return pdfBuffer;
    })
    .catch((error) => {
      // Handle errors
      console.error("Error:", error);
    });
};

// Save the PDF buffer to a file
const savePdfToFile = async (pdfBuffer) => {
  const writeFileAsync = promisify(fs.writeFile);

  try {
    await writeFileAsync("./attachment.pdf", pdfBuffer);
    console.log("PDF saved successfully.");
  } catch (error) {
    console.error("Error saving PDF:", error);
    return error;
  }
};
