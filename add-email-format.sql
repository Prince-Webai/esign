-- Add email format column to organization_settings
ALTER TABLE organization_settings 
ADD COLUMN IF NOT EXISTS email_template_format TEXT DEFAULT 'text'; -- 'text' or 'html'
