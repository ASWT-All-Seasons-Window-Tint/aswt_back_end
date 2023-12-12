require("dotenv").config();

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

const EMAIL = {
  appointmentIntro: (service) =>
    `I trust this email finds you well. We appreciate the opportunity to provide you with a quotation for ${service}.`,
  buttonInstructions: `Please find the quotation button below, where you can view the detailed quotation:`,
  buttonText: `Click to view quotation`,
  mailOptions: (
    customerEmail,
    customerNeeds,
    selectedServices,
    totalAmount,
    customerURL,
    customerName
  ) => {
    const aswtDetails = JSON.parse(process.env.aswtDetails);

    return {
      from: process.env.emailId,
      to: customerEmail,
      subject: "Quotation and Booking Confirmation",
      html: `
      <p>Dear ${customerName},</p>
      
      <p>I trust this email finds you well. Thank you for considering our services for your ${customerNeeds}. It is our pleasure to provide you with a detailed quotation based on the services you have selected.</p>
  
      <p><b>Quotation Details:</b></p>
  
      <p>Service Package: ${selectedServices}</p>
  
      <p>Total Amount: $${totalAmount}</p>
  
      <p>Please find attached a comprehensive breakdown of the costs associated with the selected services. We believe that our offerings align perfectly with your requirements, and we are eager to be of service to you.</p>
  
      <p><b>Booking Appointment:</b></p>
      
      <p>To streamline the scheduling process and ensure your preferred time slot, we have created a unique URL for you to book your appointment. Please click on the following link: <a href="${customerURL}">${customerURL}</a></p>
  
      <p><b>Payment Details:</b></p>
  
      <p>To confirm and secure your appointment, a 30% down payment of the total quoted amount is required. Kindly note that payments are to be made exclusively through our official website. For your convenience and security, please use the following link to process your payment: <a href="${customerURL}">${customerURL}</a></p>
  
      <p><b>Important Dates:</b></p>
  
      <p>- Down Payment Due Date: At the time of booking the appointment online</p>
  
      <p>- Total Payment Deadline: The remaining balance is due at the time when the service is completed at our shop</p>
  
      <p><b>Cancellation Policy:</b></p>
  
      <p>We understand that circumstances may change. Should you need to reschedule or cancel your appointment, please notify us at least 24 hours in advance to avoid any cancellation fees.</p>
      <p><b>Next Steps:</b></p>
      
      <ol>
        <li>Review the attached quotation thoroughly.</li>
        <li>Click on the unique URL to book your appointment.</li>  
        <li>Process the 30% down payment through our official website.</li>
      </ol>
  
      <p>If you have any questions or require further clarification, feel free to reach out to us at ${aswtDetails.ContactInformation}.</p>
  
      <p>Thank you for choosing ${aswtDetails.CompanyName}. We look forward to serving you and ensuring your experience exceeds expectations.</p>
  
      <p>Best regards,</p>
  
      <p>${aswtDetails.FullName}</p>
      <p>${aswtDetails.Position}</p>
      <p>${aswtDetails.CompanyName}</p>
      <p>${aswtDetails.ContactInformation}</p>
    `,
    };
  },

  invintationLinkBody: (
    customerEmail,
    dealershipName,
    signUpLink,
    dealershipStaffName
  ) => {
    const aswtDetails = JSON.parse(process.env.aswtDetails);

    return {
      from: process.env.emailId,
      to: customerEmail,
      subject: `Invitation to Access All Seasons Tint & Graphic Designs ${dealershipName} Account`,
      html: `<!DOCTYPE html>
      <html lang="en">
      
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>[Dealer's Name] All Seasons Tint & Graphic Designs - Invitation</title>
          <style>
              .invitation-button {
                  display: inline-block;
                  padding: 10px 20px;
                  font-size: 16px;
                  text-align: center;
                  text-decoration: none;
                  cursor: pointer;
                  background-color: #4CAF50;
                  color: #ffffff;
                  border: none;
                  border-radius: 5px;
              }
          </style>
      </head>
      
      <body>
        <p>Dear ${dealershipStaffName},</p>

        <p>Congratulations! You have been invited to access the ${dealershipName} All Seasons Tint & Graphic Designs
            dealership account. Your contribution is valued, and we look forward to your collaboration.</p>
    
            <p>To get started, please click the button below:</p>
    
        <a href="${signUpLink}" class="invitation-button">Accept Invitation</a>
    
        <p>If you have any questions or encounter any issues during the process, feel free to reach out to our support team
            at <a href="mailto:${aswtDetails.supportEmail}">${aswtDetails.supportEmail}</a>.</p>
    
        <p>Thank you for joining the All Seasons Tint community.</p>
    
        <p>Best regards,<br>
            All Seasons Tint & Graphic Designs Support Team</p>
      </body>

      </html>
            `,
    };
  },

  sendRegistrationEmail: (
    customerEmail,
    loginURL,
    password,
    customerName,
    isUserStaffOrPorter
  ) => {
    const aswtDetails = JSON.parse(process.env.aswtDetails);

    return {
      from: process.env.emailId,
      to: customerEmail,
      subject: isUserStaffOrPorter
        ? "All Seasons Tint & Graphic Designs Mobile App Access Granted"
        : "Account Credentials for  All Seasons Tint & Graphic Designs Dealer Access",
      html: isUserStaffOrPorter
        ? `<p>Dear ${customerName},</p>

      <p>We are pleased to inform you that your All Seasons Tint & Graphic Designs Mobile App account has been
          successfully created. Here are your login credentials:</p>
  
      <ul>
          <li><strong>Username:</strong> ${customerEmail}</li>
          <li><strong>Password:</strong> ${password}</li>
      </ul>
  
      <p>You can download the mobile app from the App Store or Google Play Store. Upon login, you will be prompted to
          change your password for security purposes.</p>
  
      <p>If you have any questions or require assistance, please do not hesitate to contact our support team at <a
              href="mailto:${aswtDetails.supportEmail}">${aswtDetails.supportEmail}</a>.</p>
  
      <p>Thank you for being a valuable part of the All Seasons Tint team.</p>
  
      <p>Best regards,<br>
          All Seasons Tint & Graphic Designs Support Team</p>`
        : `
      <p>Dear ${customerName},</p>

      <p>We are pleased to inform you that your All Seasons Tint & Graphic Designs dealer account has been successfully
          created. Below are your login credentials:</p>
  
      <ul>
          <li><strong>Username:</strong> ${customerEmail}</li>
          <li><strong>Password:</strong> ${password}</li>
      </ul>
  
      <p>Please use the following URL to access your account: <a href="${loginURL}">${loginURL}</a></p>
  
      <p>We recommend changing your password upon first login for security purposes. If you encounter any issues or have
          questions, feel free to contact our support team at <a href="mailto:${aswtDetails.supportEmail}">${aswtDetails.supportEmail}</a>.</p>
  
      <p>We appreciate your partnership with All Seasons Tint & Graphic Designs and look forward to a successful
          collaboration.</p>
  
      <p>Best regards,<br>
        All Seasons Tint & Graphic Designs Support Team</p>
    `,
    };
  },
};

const SMS = {
  nowBody: (date, time, customerName, serviceName) => `Dear ${customerName},

  Congratulations on securing your appointment with All Seasons Tint & Graphic Designs for ${serviceName} on ${date} at ${time} CST. To cancel or for inquiries, ${process.env.customerAddress}.


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
exports.EMAIL = EMAIL;
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
