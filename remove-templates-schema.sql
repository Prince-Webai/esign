-- 1. Remove template dependency from rams_documents
ALTER TABLE public.rams_documents ALTER COLUMN template_id DROP NOT NULL;

-- 2. Add signature coordinate fields directly to the signers table
ALTER TABLE public.signers 
ADD COLUMN IF NOT EXISTS placement_x numeric,
ADD COLUMN IF NOT EXISTS placement_y numeric,
ADD COLUMN IF NOT EXISTS width numeric,
ADD COLUMN IF NOT EXISTS height numeric,
ADD COLUMN IF NOT EXISTS page_number integer;
