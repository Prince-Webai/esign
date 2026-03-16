const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  console.log("Checking 'signers' table columns...");
  const { data, error } = await supabase.from('signers').select('*').limit(1);
  if (error) {
    console.error("Error fetching signers:", error.message);
  } else {
    console.log("Columns in 'signers':", data.length > 0 ? Object.keys(data[0]) : "No rows to check keys from.");
  }

  console.log("\nChecking 'rams' storage bucket...");
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  if (bucketError) {
    console.error("Error listing buckets:", bucketError.message);
  } else {
    const ramsBucket = buckets.find(b => b.name === 'rams');
    console.log("Buckets found:", buckets.map(b => b.name));
    if (ramsBucket) {
      console.log("✅ 'rams' bucket exists.");
    } else {
      console.log("❌ 'rams' bucket is MISSING.");
    }
  }
}

checkSchema();
