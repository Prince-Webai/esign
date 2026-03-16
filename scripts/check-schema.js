const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function check() {
  console.log("Checking rams_documents schema...");
  const { data: rams, error: ramsError } = await supabase.from('rams_documents').select('*').limit(1);
  if (rams?.[0]) {
    console.log("Columns in rams_documents:", Object.keys(rams[0]));
    const sample = rams[0];
    console.log("Sample file_path:", sample.file_path);
    
    console.log("Checking if file exists in storage...");
    const { data: file, error: fileError } = await supabase.storage.from('rams').list('', { search: sample.file_path });
    console.log("File in storage:", file);
    if (fileError) console.error("Storage error:", fileError);
  } else {
    console.log("No rams_documents found.");
  }

  console.log("\nChecking template_signature_fields...");
  const { data: fields } = await supabase.from('template_signature_fields').select('*').limit(1);
  if (fields?.[0]) {
    console.log("Columns in template_signature_fields:", Object.keys(fields[0]));
  } else {
    console.log("No fields found.");
  }
}

check();
