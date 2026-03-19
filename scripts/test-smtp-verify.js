const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const path = require('path');

// Load .env.local from project root
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function testSMTP() {
  console.log('Testing SMTP with settings:');
  console.log('Host:', process.env.SMTP_HOST);
  console.log('Port:', process.env.SMTP_PORT);
  console.log('User:', process.env.SMTP_USER);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    await transporter.verify();
    console.log('✅ SMTP connection is successful!');
  } catch (error) {
    console.error('❌ SMTP connection failed:', error.message);
  }
}

testSMTP();
