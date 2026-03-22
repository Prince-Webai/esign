CREATE INDEX IF NOT EXISTS idx_forms_created_at ON forms(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_form_submissions_form_id ON form_submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_submitted_at ON form_submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_rams_documents_created_at ON rams_documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rams_documents_status ON rams_documents(status);
CREATE INDEX IF NOT EXISTS idx_signers_rams_id ON signers(rams_id);
CREATE INDEX IF NOT EXISTS idx_signers_assigned_user_id ON signers(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_templates_created_at ON templates(created_at DESC);
