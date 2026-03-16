import nodemailer from "nodemailer";

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendAdminNotification(docName: string) {
  const transporter = getTransporter();

  const mailOptions = {
    from: `"TRE Energy" <${process.env.SMTP_USER}>`,
    to: "info@treenergy.co.uk",
    subject: `Document Completed: ${docName}`,
    text: `Greetings,\n\nThe RAMS document "${docName}" has been fully signed by all parties and is now available for download in the Admin Portal.\n\nBest Regards,\nTRE Energy Team`,
  };

  try {
    if (process.env.SMTP_HOST) {
      await transporter.sendMail(mailOptions);
      console.log("Admin notification email sent.");
    } else {
      console.log("SMTP not configured, skipping email notification.");
    }
  } catch (err) {
    console.error("Failed to send admin notification email:", err);
  }
}

export async function sendSigningEmail(email: string, name: string, documentName: string, signingLink: string) {
  const transporter = getTransporter();

  const mailOptions = {
    from: `"TRE Energy" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `E-Signature Required: ${documentName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hello ${name},</h2>
        <p>You have been requested to sign the following document: <strong>${documentName}</strong></p>
        <div style="margin: 30px 0;">
          <a href="${signingLink}" style="background-color: #f59e0b; color: black; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Sign Document Now
          </a>
        </div>
        <p>Alternatively, copy and paste this link into your browser:</p>
        <p style="color: #666; font-size: 12px;">${signingLink}</p>
        <hr style="margin-top: 50px; border: 0; border-top: 1px solid #eee;" />
        <p style="color: #999; font-size: 12px;">TOMORROW'S ENERGY TODAY</p>
      </div>
    `,
  };

  try {
    if (process.env.SMTP_HOST) {
      await transporter.sendMail(mailOptions);
      console.log("Signing email sent successfully.");
    } else {
      console.log("SMTP not configured, skipping signing email.");
    }
  } catch (err) {
    console.error("Failed to send signing email:", err);
    throw err;
  }
}
