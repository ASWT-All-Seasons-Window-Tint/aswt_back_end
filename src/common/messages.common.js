const { MESSAGES } = require("./constants.common");

const errorMessage = (resource, resourceId = resource) => {
  return {
    message: MESSAGES.NOT_FOUND(resource, resourceId),
    success: false,
  };
};

const errorMessageUserName = () => {
  return {
    message: "We can't find user with the given userName",
    success: false,
  };
};

const jsonResponse = (res, stastusCode = 200, success = true, message) => {
  return res.status(stastusCode).send({ message, success });
};

const badReqResponse = (res, message) => {
  return res.status(400).send({ message, success: false });
};

const forbiddenResponse = (res, message) => {
  return res.status(403).send({ message, success: false });
};

const notFoundResponse = (res, message) => {
  return res.status(404).send({ message, success: false });
};

const successMessage = (message, data) => {
  return { message, success: true, data };
};

const unAuthMessage = (message) => {
  return { message, success: false };
};

const loginError = () => {
  return { message: MESSAGES.LOGIN_FAILURE, success: false };
};

const loginSuccess = (token, user) => {
  return { message: MESSAGES.SUCCESFUL_LOGIN, success: true, token, user };
};
const logoutSuccess = () => {
  return { message: MESSAGES.SUCCESFUL_LOGOUT, success: true };
};

const SMS = {
  nowBody: (date, time, customerName, serviceName) => `Dear ${customerName},

  Congratulations! Your appointment booking was successful. We are pleased to confirm your reservation for ${serviceName} on ${date} at ${time} CST. Thank you for choosing us, and we look forward to serving you.
  
  Best regards,
  All Seasons Tint & Graphic Designs`,
  reminderBody: (
    date,
    time,
    customerName,
    contactNumber
  ) => `Dear ${customerName}, 

  This is a friendly reminder of your upcoming appointment with All Seasons Tint & Graphic Designs scheduled for ${date} at ${time}. We look forward to assisting you. If you have any questions or need to reschedule, please contact us at ${contactNumber}. 
  
  Thank you for choosing All Seasons Tint & Graphic Designs. 
  
  Best regards,
  All Seasons Tint & Graphic Designs`,
};

exports.errorMessage = errorMessage;
exports.SMS = SMS;
exports.errorMessageUserName = errorMessageUserName;
exports.successMessage = successMessage;
exports.unAuthMessage = unAuthMessage;
exports.loginError = loginError;
exports.loginSuccess = loginSuccess;
exports.logoutSuccess = logoutSuccess;
exports.jsonResponse = jsonResponse;
exports.badReqResponse = badReqResponse;
exports.forbiddenResponse = forbiddenResponse;
exports.notFoundResponse = notFoundResponse;
