-- Add name field coordinate columns to signers table
ALTER TABLE public.signers 
ADD COLUMN IF NOT EXISTS name_placement_x numeric,
ADD COLUMN IF NOT EXISTS name_placement_y numeric,
ADD COLUMN IF NOT EXISTS name_width numeric,
ADD COLUMN IF NOT EXISTS name_height numeric,
ADD COLUMN IF NOT EXISTS name_page_number integer;
