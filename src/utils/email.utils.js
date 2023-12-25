require("dotenv").config();
var Mailgen = require("mailgen");
const nodemailer = require("nodemailer");

const { emailPass, emailId, emailHost, emailIdSupport, emailPassSupport } =
  process.env;

const transporter = (isCustomer) => {
  return nodemailer.createTransport({
    host: emailHost, // SMTP server host
    port: 587,
    secure: false,
    auth: {
      user: isCustomer ? emailId : emailIdSupport,
      pass: isCustomer ? emailPass : emailPassSupport,
    },
  });
};

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

const intro = "This is a Password reset Mail";
const instructions = "Click this link to reset your password:";
const text = "Reset your password";

const mailSubject = `Your password reset link`;

const mailOptions = ({
  receiversEmail,
  firstName,
  subject = mailSubject,
  emailIntro = intro,
  link,
  buttonInstructions = instructions,
  buttonText = text,
  isDealership,
}) => {
  return {
    from: isDealership ? emailId : emailIdSupport,
    to: receiversEmail,
    subject,
    html: mailGenerator.generate({
      body: {
        name: firstName,
        intro: emailIntro,
        action: {
          instructions: buttonInstructions,
          button: {
            color: "#22BC66", // Optional action button color
            text: buttonText,
            link,
          },
        },
        outro:
          "Need help, or have questions? Just reply to this email, we'd love to help.",
      },
    }),
  };
};

module.exports = { transporter, mailOptions };
