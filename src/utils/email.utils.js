require("dotenv").config();
var Mailgen = require("mailgen");
const nodemailer = require("nodemailer");

const { emailPass, emailId } = process.env;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: emailId,
    pass: emailPass,
  },
});

// Configure mailgen by setting a theme and your product info
const mailGenerator = new Mailgen({
  theme: "default",
  product: {
    // Appears in header & footer of e-mails
    name: "ASWT",
    link: "https://mailgen.js/",
    // Optional product logo
    // logo: 'https://mailgen.js/img/logo.png'
  },
});

const email = (firstName, token) => {
  return {
    body: {
      name: firstName,
      intro: "This is a Password reset Mail",
      action: {
        instructions: "Click this link to reset your password:",
        button: {
          color: "#22BC66", // Optional action button color
          text: "Reset your password",
          link: `http://localhost:3000/api/v1/users/reset-password/${token}/12345879`,
        },
      },
      outro:
        "Need help, or have questions? Just reply to this email, we'd love to help.",
    },
  };
};

const emailBody = (firstName, token) =>
  mailGenerator.generate(email(firstName, token));

const mailOptions = (receiversEmail, firstName, token) => {
  return {
    from: emailId,
    to: receiversEmail,
    subject: `Your password reset link`,
    html: emailBody(firstName, token),
  };
};

module.exports = { transporter, mailOptions };
