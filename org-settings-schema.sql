-- Setup Organization Settings Table
CREATE TABLE IF NOT EXISTS public.organization_settings (
    id int PRIMARY KEY DEFAULT 1,
    name text NOT NULL DEFAULT 'TRE Energy',
    logo_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT single_row CHECK (id = 1)
);

-- Insert initial row if not exists
INSERT INTO public.organization_settings (id, name)
VALUES (1, 'TRE Energy')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access (needed for Login page and external signatures)
DROP POLICY IF EXISTS "Allow public read org settings" ON public.organization_settings;
CREATE POLICY "Allow public read org settings" ON public.organization_settings FOR SELECT USING (true);

-- Allow authenticated/public update (for admin settings page)
DROP POLICY IF EXISTS "Allow all update org settings" ON public.organization_settings;
CREATE POLICY "Allow all update org settings" ON public.organization_settings FOR UPDATE USING (true);


-- Create org-assets bucket for the logo
INSERT INTO storage.buckets (id, name, public) 
VALUES ('org-assets', 'org-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage Policies for org-assets
DROP POLICY IF EXISTS "Public Upload Org Assets" ON storage.objects;
CREATE POLICY "Public Upload Org Assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'org-assets');

DROP POLICY IF EXISTS "Public Read Org Assets" ON storage.objects;
CREATE POLICY "Public Read Org Assets" ON storage.objects FOR SELECT USING (bucket_id = 'org-assets');

DROP POLICY IF EXISTS "Public Update Org Assets" ON storage.objects;
CREATE POLICY "Public Update Org Assets" ON storage.objects FOR UPDATE WITH CHECK (bucket_id = 'org-assets');
