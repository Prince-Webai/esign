-- Add email template columns to organization_settings
ALTER TABLE organization_settings 
ADD COLUMN IF NOT EXISTS email_subject TEXT DEFAULT 'E-Signature Required: {{document_name}}',
ADD COLUMN IF NOT EXISTS email_body TEXT DEFAULT 'Hello {{signer_name}},

You have been requested to sign the following document: {{document_name}}

Please click the button in the email to access your signing link.

If you have any questions, please contact us.

Best Regards,
TRE Energy Team';
