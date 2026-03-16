import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendSigningEmail(to: string, name: string, documentName: string, signingLink: string) {
  const mailOptions = {
    from: `"TRE Energy RAMS" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject: `Signature Required: ${documentName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
        <h2 style="color: #0f172a;">Hello ${name},</h2>
        <p style="color: #475569; line-height: 1.6;">
          You have been requested to sign the following RAMS document: <strong>${documentName}</strong>.
        </p>
        <div style="margin: 32px 0;">
          <a href="${signingLink}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            Sign Document Now
          </a>
        </div>
        <p style="color: #94a3b8; font-size: 12px;">
          This is a live collaboration document. You will see other signatures appear in real-time as they are completed.
        </p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;">
          TRE Energy Today - Powered by Antigravity
        </p>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
}
