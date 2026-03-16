const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixSchema() {
  console.log("Updating schema for role-based access...");

  const { error: rpcError } = await supabase.rpc('exec_sql', { 
    sql_query: `
      DO $$ 
      BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='registered_users' AND column_name='role') THEN
              ALTER TABLE public.registered_users ADD COLUMN role text DEFAULT 'signer' NOT NULL;
          END IF;
      END $$;
    `
  });

  if (rpcError) {
    console.error("Failed to update schema via RPC:", rpcError.message);
    console.log("PLEASE MANUALLY RUN THIS SQL IN THE SUPABASE DASHBOARD:");
    console.log("ALTER TABLE public.registered_users ADD COLUMN IF NOT EXISTS role text DEFAULT 'signer' NOT NULL;");
  } else {
    console.log("Schema updated successfully.");
  }
}

fixSchema();
