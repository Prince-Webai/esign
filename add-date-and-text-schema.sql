-- Add date field coordinates and signed_at tracking to signers table
ALTER TABLE public.signers 
ADD COLUMN IF NOT EXISTS name_text text,
ADD COLUMN IF NOT EXISTS signed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS date_placement_x numeric,
ADD COLUMN IF NOT EXISTS date_placement_y numeric,
ADD COLUMN IF NOT EXISTS date_width numeric,
ADD COLUMN IF NOT EXISTS date_height numeric,
ADD COLUMN IF NOT EXISTS date_page_number integer;
