import { createClient } from '@supabase/supabase-js';

export const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    // Return a dummy client or throw at runtime, but don't break module evaluation
    return createClient("https://placeholder.supabase.co", "placeholder");
  }
  
  return createClient(url, key);
};

export const supabase = getSupabase();
