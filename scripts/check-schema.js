const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  console.log("Checking tables...");
  
  const tables = ['rams_templates', 'rams_documents', 'signers', 'template_signature_fields', 'registered_users'];
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`❌ Table '${table}' error: ${error.message} (${error.code})`);
    } else {
      console.log(`✅ Table '${table}' exists.`);
    }
  }
}

checkSchema();
