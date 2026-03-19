-- Add custom text column for the name field on signers table
ALTER TABLE public.signers 
ADD COLUMN IF NOT EXISTS name_text text;
