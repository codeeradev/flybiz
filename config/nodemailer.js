const nodemailer = require("nodemailer");
const transporter = nodemailer.createTransport({
  host: "smtp.hostinger.com", // Or use the server IP if given: 172.93.223.239
  port: 465, // Use 465 for SSL (recommended)
  secure: true, // true for port 465, false for 587
  auth: {
    user: "goutam@codeeratech.in", // Your no-reply email
    pass: "Goutam@2025!",
  },
//   tls: {
//     rejectUnauthorized: false,
//   },
});

const sendVerificationEmail = async (
  to,
  subject,
  html,
  attachmentPath = null,
) => {
  const mail = {
    from: "Bizyro <goutam@codeeratech.in>",
    to,
    subject,
    html,
  };

  if (attachmentPath) {
    mail.attachments = [
      {
        filename: "Signed-MOU.pdf",
        path: attachmentPath,
      },
    ];
  }

  await transporter.sendMail(mail);
};

module.exports = {
  sendVerificationEmail,
};