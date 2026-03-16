import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase environment variables are missing");
  }

  return createClient(supabaseUrl, supabaseServiceKey);
};

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const templateId = formData.get('templateId') as string;
    const documentName = formData.get('documentName') as string;
    const jobId = formData.get('jobId') as string;
    const signersJson = formData.get('signers') as string;
    const signers = JSON.parse(signersJson);

    if (!file) {
      return NextResponse.json({ success: false, error: "File is required" }, { status: 400 });
    }

    // 1. Upload RAMS PDF using Admin client (bypasses RLS)
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('rams')
      .upload(fileName, file);

    if (uploadError) {
      console.error("Storage upload failed:", uploadError);
      throw uploadError;
    }

    // 2. Create Document record
    const { data: docData, error: docError } = await supabaseAdmin
      .from('rams_documents')
      .insert([{
        template_id: templateId,
        name: documentName,
        file_path: uploadData.path,
        servicem8_job_id: jobId,
        status: 'pending'
      }])
      .select()
      .single();

    if (docError) {
      console.error("Document creation failed:", docError);
      throw docError;
    }

    // 3. Create Signers
    const signerData = signers.map((s: any) => ({
      rams_id: docData.id,
      name: s.name,
      email: s.email,
      role_name: s.role_name,
      status: 'pending',
      assigned_user_id: s.assigned_user_id || null
    }));

    const { error: signersError } = await supabaseAdmin
      .from('signers')
      .insert(signerData);

    if (signersError) {
      console.error("Signers insertion failed:", signersError);
      throw signersError;
    }

    // 4. Send Emails (Fetch recently created signers to get their tokens)
    const { data: createdSigners } = await supabaseAdmin
        .from('signers')
        .select('*')
        .eq('rams_id', docData.id);

    if (createdSigners) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      for (const s of createdSigners) {
        // We can just call the existing send-email logic or keep it simple here
        await fetch(`${baseUrl}/api/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: s.email,
            name: s.name,
            documentName: docData.name,
            token: s.token
          })
        });
      }
    }

    return NextResponse.json({ success: true, documentId: docData.id });
  } catch (error: any) {
    console.error('RAMS Launch API Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || "Internal server error" 
    }, { status: 500 });
  }
}
