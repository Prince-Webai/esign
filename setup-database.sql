-- RUN THIS SQL IN YOUR SUPABASE DASHBOARD SQL EDITOR

-- 1. Ensure registered_users table exists with proper structure
CREATE TABLE IF NOT EXISTS public.registered_users (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    email text UNIQUE NOT NULL,
    password_hash text NOT NULL, -- This is our security PIN/Pass
    role text DEFAULT 'signer' NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- 2. Add role column if it was somehow missing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='registered_users' AND column_name='role') THEN
        ALTER TABLE public.registered_users ADD COLUMN role text DEFAULT 'signer' NOT NULL;
    END IF;
END $$;

END $$;

-- 3.5. Update rams_documents for finalization
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rams_documents' AND column_name='final_file_path') THEN
        ALTER TABLE public.rams_documents ADD COLUMN final_file_path text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rams_documents' AND column_name='completed_at') THEN
        ALTER TABLE public.rams_documents ADD COLUMN completed_at timestamptz;
    END IF;
END $$;

-- 4. ENABLE RLS & ADD POLICIES
ALTER TABLE public.registered_users ENABLE ROW LEVEL SECURITY;

-- Allow public insertion (needed for the registration feature)
DROP POLICY IF EXISTS "Allow public insert" ON public.registered_users;
CREATE POLICY "Allow public insert" ON public.registered_users FOR INSERT WITH CHECK (true);

-- Allow all users to read (needed for login/validation)
DROP POLICY IF EXISTS "Allow all read" ON public.registered_users;
CREATE POLICY "Allow all read" ON public.registered_users FOR SELECT USING (true);

-- Allow all users to delete (needed for the Management UI)
DROP POLICY IF EXISTS "Allow all delete" ON public.registered_users;
CREATE POLICY "Allow all delete" ON public.registered_users FOR DELETE USING (true);

-- 6. STORAGE POLICIES (Essential for PDF uploads)
-- Create bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('rams', 'rams', true), ('templates', 'templates', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow all operations for authenticated/public for simple setup
-- In production, these should be narrowed to authenticated users
DROP POLICY IF EXISTS "Public Upload" ON storage.objects;
CREATE POLICY "Public Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id IN ('rams', 'templates'));

DROP POLICY IF EXISTS "Public Read" ON storage.objects;
CREATE POLICY "Public Read" ON storage.objects FOR SELECT USING (bucket_id IN ('rams', 'templates'));

DROP POLICY IF EXISTS "Public Update" ON storage.objects;
CREATE POLICY "Public Update" ON storage.objects FOR UPDATE WITH CHECK (bucket_id IN ('rams', 'templates'));

-- 7. RAMS TABLES POLICIES
ALTER TABLE IF EXISTS public.rams_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.signers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.template_signature_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rams_templates ENABLE ROW LEVEL SECURITY;

-- Grant broad access for this implementation (Admin/Public workflow)
DROP POLICY IF EXISTS "Enable all doc access" ON public.rams_documents;
CREATE POLICY "Enable all doc access" ON public.rams_documents FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all signer access" ON public.signers;
CREATE POLICY "Enable all signer access" ON public.signers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all field access" ON public.template_signature_fields;
CREATE POLICY "Enable all field access" ON public.template_signature_fields FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all template access" ON public.rams_templates;
CREATE POLICY "Enable all template access" ON public.rams_templates FOR ALL USING (true) WITH CHECK (true);

-- 8. Signer Token Default (Insurance)
ALTER TABLE public.signers ALTER COLUMN token SET DEFAULT encode(gen_random_bytes(32), 'hex');

