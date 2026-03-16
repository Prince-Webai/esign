const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function seedUsers() {
  console.log("Seeding TRE Admin user...");

  const adminUser = {
    name: "TRE Admin",
    email: "info@treenergy.co.uk",
    password_hash: "admin@123",
    role: "admin"
  };

  const { error } = await supabase
    .from('registered_users')
    .upsert(adminUser, { onConflict: 'email' });
  
  if (error) {
    console.error(`Failed to seed ${adminUser.email}:`, error.message);
    console.log("NOTE: This likely failed because the 'role' column is missing. Run setup-database.sql first.");
  } else {
    console.log(`✅ Seeded ${adminUser.email} (Admin)`);
  }
}

seedUsers();
