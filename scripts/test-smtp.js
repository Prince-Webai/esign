const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function testEmail() {
  console.log("Starting SMTP Test...");
  console.log("User:", process.env.SMTP_USER);
  console.log("Host:", process.env.SMTP_HOST);
  console.log("Port:", process.env.SMTP_PORT);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    console.log("Verifying connection...");
    await transporter.verify();
    console.log("Connection verified successfully!");

    console.log("Sending test email...");
    const info = await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'TRE Energy'}" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER, // Send to self
      subject: "SMTP Test - TRE Energy RAMS",
      text: "If you are reading this, your Zoho SMTP settings are working correctly!",
      html: "<b>If you are reading this, your Zoho SMTP settings are working correctly!</b>",
    });

    console.log("Message sent: %s", info.messageId);
  } catch (error) {
    console.error("SMTP Error:", error);
  }
}

testEmail();
