-- Enable Row Level Security
ALTER TABLE IF EXISTS public.rams_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.template_signature_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rams_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.signers ENABLE ROW LEVEL SECURITY;

-- 1. RAMS Templates
CREATE TABLE public.rams_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    preview_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Template Signature Fields

-- 3. RAMS Documents
CREATE TABLE public.rams_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES public.rams_templates(id),
    name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, signed, completed
    servicem8_job_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Signers
CREATE TABLE public.signers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

-- RLS Policies (Simplified for now - Admin access)
-- In a real app, these should be more restrictive
CREATE POLICY "Public read for signers with token" ON public.signers
    FOR SELECT USING (true);

CREATE POLICY "Allow update for signers" ON public.signers
    FOR UPDATE USING (true);

CREATE POLICY "Admin full access" ON public.rams_templates FOR ALL USING (true);
CREATE POLICY "Admin full access fields" ON public.template_signature_fields FOR ALL USING (true);
CREATE POLICY "Admin full access docs" ON public.rams_documents FOR ALL USING (true);
CREATE POLICY "Admin full access signers" ON public.signers FOR ALL USING (true);

-- Realtime Configuration
ALTER PUBLICATION supabase_realtime ADD TABLE signers;
