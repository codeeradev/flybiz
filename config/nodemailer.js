const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.hostinger.com",
  port: 465,
  secure: true,
  auth: {
    user: "goutam@codeeratech.in",
    pass: "Goutam@2025!",
  },
});

const sendEmailOtp = async (to, otp) => {
  const mail = {
    from: `Bizyro <goutam@codeeratech.in>`,
    to,
    subject: "Your Bizyro OTP Code",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto;">
        <h2>Bizyro Verification</h2>

        <p>Your verification code is:</p>

        <h1 style="letter-spacing: 6px;">
          ${otp}
        </h1>

        <p>This OTP is valid for 5 minutes.</p>

        <p>If you did not request this code, please ignore this email.</p>

        <p>Bizyro Team</p>
      </div>
    `,
  };

  await transporter.sendMail(mail);
};

module.exports = {
  sendEmailOtp,
};