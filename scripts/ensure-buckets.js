const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function ensureBuckets() {
  const buckets = ['templates', 'rams', 'form-submissions'];
  
  for (const bucketName of buckets) {
    console.log(`Checking bucket: ${bucketName}...`);
    const { data: bucket, error: checkError } = await supabase.storage.getBucket(bucketName);
    
    if (checkError && checkError.message.includes('not found')) {
      console.log(`Bucket ${bucketName} not found. Creating...`);
      const { data, error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true,
        allowedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg'],
        fileSizeLimit: 52428800 // 50MB
      });
      
      if (createError) {
        console.error(`Error creating bucket ${bucketName}:`, createError.message);
      } else {
        console.log(`Successfully created bucket: ${bucketName}`);
      }
    } else if (checkError) {
      console.error(`Error checking bucket ${bucketName}:`, checkError.message);
    } else {
      console.log(`Bucket ${bucketName} already exists.`);
    }
  }
}

ensureBuckets();
