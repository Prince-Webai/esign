import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

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

const DEFAULT_SUBJECT = "E-Signature Required: {{document_name}}";
const DEFAULT_BODY = `Hello {{signer_name}},

You have been requested to sign the following document: {{document_name}}

Please use the signing link below to complete your digital signature.

Best Regards,
TRE Energy Team`;

/**
 * Fetches the email template from the organization_settings table.
 * Falls back to defaults if not set or table doesn't have the columns yet.
 */
async function getEmailTemplate(): Promise<{ subject: string; body: string }> {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data } = await supabaseAdmin
      .from("organization_settings")
      .select("email_subject, email_body")
      .eq("id", 1)
      .single();

    return {
      subject: data?.email_subject || DEFAULT_SUBJECT,
      body: data?.email_body || DEFAULT_BODY,
    };
  } catch {
    return { subject: DEFAULT_SUBJECT, body: DEFAULT_BODY };
  }
}

/**
 * Replaces template variables with actual values.
 * Supported variables: {{signer_name}}, {{document_name}}, {{signing_link}}
 */
function applyTemplate(template: string, vars: Record<string, string>): string {
  return template
    .replace(/\{\{signer_name\}\}/g, vars.signer_name || "")
    .replace(/\{\{document_name\}\}/g, vars.document_name || "")
    .replace(/\{\{signing_link\}\}/g, vars.signing_link || "");
}

export async function sendAdminNotification(docName: string) {
  const transporter = getTransporter();

  try {
    if (!process.env.SMTP_HOST) return;
    await transporter.sendMail({
      from: `"TRE Energy" <${process.env.SMTP_USER}>`,
      to: "info@treenergy.co.uk",
      subject: `Document Completed: ${docName}`,
      text: `Greetings,\n\nThe RAMS document "${docName}" has been fully signed by all parties and is now available for download in the Admin Portal.\n\nBest Regards,\nTRE Energy Team`,
    });
    console.log("Admin notification email sent.");
  } catch (err) {
    console.error("Failed to send admin notification email:", err);
  }
}

export async function sendSigningEmail(
  email: string,
  name: string,
  documentName: string,
  signingLink: string
) {
  const transporter = getTransporter();

  // Fetch customized template from DB
  const template = await getEmailTemplate();

  const vars = {
    signer_name: name,
    document_name: documentName,
    signing_link: signingLink,
  };

  const subject = applyTemplate(template.subject, vars);
  const bodyText = applyTemplate(template.body, vars);

  // Convert plain text body to HTML (preserve line breaks)
  const bodyHtml = bodyText
    .split("\n")
    .map(line => `<p style="margin:0 0 8px 0;">${line || "&nbsp;"}</p>`)
    .join("");

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      ${bodyHtml}
      <div style="margin: 32px 0;">
        <a href="${signingLink}" style="background-color: #22c55e; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
          ✍️ Sign Document Now
        </a>
      </div>
      <p style="color: #666; font-size: 12px;">Or copy this link into your browser:<br/>${signingLink}</p>
      <hr style="margin-top: 40px; border: 0; border-top: 1px solid #eee;" />
      <p style="color: #999; font-size: 11px;">TOMORROW'S ENERGY TODAY</p>
    </div>
  `;

  try {
    if (!process.env.SMTP_HOST) {
      console.log("SMTP not configured, skipping signing email.");
      return;
    }
    await transporter.sendMail({
      from: `"TRE Energy" <${process.env.SMTP_USER}>`,
      to: email,
      subject,
      html,
    });
    console.log("Signing email sent successfully.");
  } catch (err) {
    console.error("Failed to send signing email:", err);
    throw err;
  }
}
