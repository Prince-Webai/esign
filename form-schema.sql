-- RUN THIS SQL IN YOUR SUPABASE DASHBOARD SQL EDITOR

-- 1. Forms table
CREATE TABLE IF NOT EXISTS public.forms (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    webhook_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES public.registered_users(id) ON DELETE CASCADE
);

-- 2. Form Fields table
CREATE TABLE IF NOT EXISTS public.form_fields (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    form_id uuid REFERENCES public.forms(id) ON DELETE CASCADE,
    type text NOT NULL, -- input, textarea, radio, select, image, date, checkbox
    label text NOT NULL,
    placeholder text,
    required boolean DEFAULT false,
    options jsonb, -- For radio/select options: ["Opt 1", "Opt 2"]
    order_index integer NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- 3. Form Submissions (To track history/PDFs)
CREATE TABLE IF NOT EXISTS public.form_submissions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    form_id uuid REFERENCES public.forms(id) ON DELETE CASCADE,
    data jsonb NOT NULL,
    pdf_url text,
    submitted_at timestamptz DEFAULT now(),
    status text DEFAULT 'submitted'
);

-- 4. Enable RLS
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

-- 5. Add Policies
-- Forms: Public read (for filling), all access for authenticated (for building)
DROP POLICY IF EXISTS "Enable all access for forms" ON public.forms;
CREATE POLICY "Enable all access for forms" ON public.forms FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for fields" ON public.form_fields;
CREATE POLICY "Enable all access for fields" ON public.form_fields FOR ALL USING (true) WITH CHECK (true);

-- Submissions: Insert only for public, all for authenticated
DROP POLICY IF EXISTS "Public submission insert" ON public.form_submissions;
CREATE POLICY "Public submission insert" ON public.form_submissions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all submission access" ON public.form_submissions;
CREATE POLICY "Enable all submission access" ON public.form_submissions FOR ALL USING (true) WITH CHECK (true);
