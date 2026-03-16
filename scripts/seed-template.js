const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function seedTemplate() {
  const filePath = path.resolve(__dirname, '../Blank Method Statement.pdf');
  const fileBuffer = fs.readFileSync(filePath);

  console.log("Uploading PDF to storage...");
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('templates')
    .upload('standard_rams.pdf', fileBuffer, {
      contentType: 'application/pdf',
      upsert: true
    });

  if (uploadError) {
    console.error("Upload error:", uploadError);
    // Continue anyway if it exists
  }

  console.log("Checking for existing template...");
  const { data: existing } = await supabase
    .from('rams_templates')
    .select('id')
    .eq('name', 'Standard Method Statement (Seeded)')
    .maybeSingle();

  let templateId;
  if (existing) {
    console.log("Template already exists. Updating fields...");
    templateId = existing.id;
  } else {
    console.log("Inserting new template into database...");
    const { data: templateData, error: templateError } = await supabase
      .from('rams_templates')
      .insert({
        name: 'Standard Method Statement (Seeded)',
        preview_url: 'standard_rams.pdf'
      })
      .select()
      .single();

    if (templateError) {
      console.error("Template error:", templateError);
      return;
    }
    templateId = templateData.id;
  }

  console.log("Inserting/Updating signature fields for Page 20...");
  // Clear old fields for this specific template to avoid duplicates
  await supabase.from('template_signature_fields').delete().eq('template_id', templateId);

  const fields = [
    {
      template_id: templateId,
      role_name: 'Site Manager',
      page_number: 20,
      placement_x: 50,
      placement_y: 60,
      width: 15,
      height: 5
    },
    {
      template_id: templateId,
      role_name: 'Project Manager',
      page_number: 20,
      placement_x: 50,
      placement_y: 64,
      width: 15,
      height: 5
    }
  ];

  const { error: fieldsError } = await supabase
    .from('template_signature_fields')
    .insert(fields);

  if (fieldsError) {
    console.error("Fields error:", fieldsError);
  } else {
    console.log("Successfully seeded template and signature fields!");
  }
}

seedTemplate();
