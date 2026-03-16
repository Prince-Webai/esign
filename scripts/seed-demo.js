const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log("Seeding demo RAMS document...");

  // 1. Get a template
  const { data: templates } = await supabase.from('rams_templates').select('id, name').limit(1);
  if (!templates || templates.length === 0) {
    console.error("No templates found. Please create a template first.");
    return;
  }
  const template = templates[0];
  console.log(`Using template: ${template.name}`);

  // 2. Create a document
  const { data: doc, error: docError } = await supabase
    .from('rams_documents')
    .insert([{
      template_id: template.id,
      name: `DEMO: ${template.name} - ${new Date().toLocaleDateString()}`,
      file_path: 'demo_rams.pdf', // Placeholder, but valid path format
      servicem8_job_id: 'DEMO-101',
      status: 'pending'
    }])
    .select()
    .single();

  if (docError) {
    console.error("Error creating document:", docError);
    return;
  }
  console.log(`Created document ID: ${doc.id}`);

  // 3. Get template fields to assign roles
  const { data: fields } = await supabase
    .from('template_signature_fields')
    .select('role_name')
    .eq('template_id', template.id);

  if (!fields || fields.length === 0) {
    console.log("No signature fields found for this template. Please add fields in Template Creator.");
    return;
  }

  // 4. Create signers
  const signers = fields.map(f => ({
    rams_id: doc.id,
    name: `Test ${f.role_name}`,
    email: 'test@example.com',
    role_name: f.role_name,
    status: 'pending'
  }));

  const { data: createdSigners, error: signersError } = await supabase
    .from('signers')
    .insert(signers)
    .select();

  if (signersError) {
    console.error("Error creating signers:", signersError);
    return;
  }

  console.log(`Successfully created ${createdSigners.length} signers.`);
  console.log("\nDEMO LINKS:");
  createdSigners.forEach(s => {
    console.log(`${s.role_name}: http://localhost:3000/sign/${s.token}`);
  });
}

seed();
