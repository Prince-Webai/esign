import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase config missing");
  return createClient(url, key);
};

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { ramsId } = await req.json();

    // 1. Fetch Document + Signers + Template Fields
    const { data: document, error: docError } = await supabase
      .from('rams_documents')
      .select('*, signers(*)')
      .eq('id', ramsId)
      .single();

    if (docError || !document) throw new Error('Document not found');

    const { data: fields, error: fieldsError } = await supabase
      .from('template_signature_fields')
      .select('*')
      .eq('template_id', document.template_id);

    if (fieldsError) throw fieldsError;

    // 2. Fetch Original PDF from Storage
    const { data: pdfBlob, error: downloadError } = await supabase.storage
      .from('rams')
      .download(document.file_path);

    if (downloadError) throw downloadError;

    const originalPdfBytes = await pdfBlob.arrayBuffer();
    const pdfDoc = await PDFDocument.load(originalPdfBytes);

    // 3. For each signer that has signed, embed the signature
    for (const signer of document.signers) {
      if (!signer.signature_data) continue;

      const field = fields.find(f => f.role_name === signer.role_name);
      if (!field) continue;

      const signatureImage = await pdfDoc.embedPng(signer.signature_data);
      const pages = pdfDoc.getPages();
      const page = pages[field.page_number - 1]; // 0-indexed

      const { width, height } = page.getSize();
      
      // Convert % coordinates to PDF points (1 pt = 1/72 inch)
      const xPos = (field.placement_x / 100) * width;
      const yPos = height - ((field.placement_y / 100) * height); // PDF y starts from bottom

      const sigWidth = (field.width / 100) * width || 100;
      const sigHeight = (field.height / 100) * height || 40;

      // Inject Signature Image
      page.drawImage(signatureImage, {
        x: xPos - (sigWidth / 2),
        y: yPos - (sigHeight / 2),
        width: sigWidth,
        height: sigHeight,
      });

      // If it's a grid cell (like page 20), also inject Name and Date in adjacent columns
      if (field.is_grid_cell) {
        // "PRINT NAME" is usually to the left, "DATE" to the right of SIGNATURE
        // We'll offset based on the signature position
        const textY = yPos - 5; // Slight vertical adjustment
        const fontSize = 10;

        // Draw Name (offset left)
        page.drawText(signer.name, {
          x: xPos - (sigWidth * 1.5),
          y: textY,
          size: fontSize,
        });

        // Draw Date (offset right)
        const dateStr = new Date(signer.signed_at).toLocaleDateString();
        page.drawText(dateStr, {
          x: xPos + (sigWidth * 0.8),
          y: textY,
          size: fontSize,
        });
      }
    }

    // 4. Save Final PDF
    const finalPdfBytes = await pdfDoc.save();
    const finalFileName = `final_${document.file_path}`;

    const { error: uploadError } = await supabase.storage
      .from('rams')
      .upload(finalFileName, finalPdfBytes, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) throw uploadError;

    // 5. Update Document Status
    await supabase
      .from('rams_documents')
      .update({ 
        status: 'completed',
        final_file_path: finalFileName 
      })
      .eq('id', ramsId);

    return NextResponse.json({ success: true, filePath: finalFileName });

  } catch (error: any) {
    console.error('Finalize Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
