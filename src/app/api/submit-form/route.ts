import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export async function POST(req: NextRequest) {
  try {
    const { submissionId, formId, data } = await req.json();

    // 1. Fetch form config for webhook
    const { data: form } = await supabase
      .from('forms')
      .select('*')
      .eq('id', formId)
      .single();

    if (!form) throw new Error('Form configuration not found');

    // 2. Generate PDF
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([600, 800]);
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Header
    page.drawRectangle({
      x: 0,
      y: height - 100,
      width,
      height: 100,
      color: rgb(0.05, 0.05, 0.1),
    });

    page.drawText('FORM SUBMISSION REPORT', {
      x: 50,
      y: height - 50,
      size: 24,
      font,
      color: rgb(1, 1, 1),
    });

    page.drawText(form.name.toUpperCase(), {
      x: 50,
      y: height - 75,
      size: 14,
      font: regularFont,
      color: rgb(0.5, 0.5, 0.6),
    });

    let currentY = height - 150;

    // Submission Metadata
    page.drawText(`Submission ID: ${submissionId}`, { x: 50, y: currentY, size: 10, font: regularFont, color: rgb(0.4, 0.4, 0.4) });
    currentY -= 15;
    page.drawText(`Timestamp: ${new Date().toLocaleString()}`, { x: 50, y: currentY, size: 10, font: regularFont, color: rgb(0.4, 0.4, 0.4) });
    currentY -= 40;

    // Draw Form Data
    const { data: fields } = await supabase
      .from('form_fields')
      .select('*')
      .eq('form_id', formId)
      .order('order_index', { ascending: true });

    if (fields) {
      for (const field of fields) {
        const val = data[field.id];
        if (val === undefined || val === null) continue;

        // Label
        page.drawText(field.label.toUpperCase(), {
          x: 50,
          y: currentY,
          size: 10,
          font,
          color: rgb(0, 0, 0),
        });
        currentY -= 20;

        if (field.type === 'image' && typeof val === 'string' && val.startsWith('data:image')) {
            try {
                const imageBytes = Uint8Array.from(atob(val.split(',')[1]), c => c.charCodeAt(0));
                let image;
                if (val.includes('image/png')) {
                    image = await pdfDoc.embedPng(imageBytes);
                } else {
                    image = await pdfDoc.embedJpg(imageBytes);
                }
                
                const dims = image.scale(0.5);
                // Check if image fits on page, else add new page
                if (currentY - dims.height < 50) {
                    page = pdfDoc.addPage([600, 800]);
                    currentY = 750;
                }

                page.drawImage(image, {
                    x: 50,
                    y: currentY - dims.height,
                    width: dims.width,
                    height: dims.height,
                });
                currentY -= dims.height + 30;
            } catch (e) {
                page.drawText("[Image processing failed]", { x: 70, y: currentY, size: 10, font: regularFont, color: rgb(0.8, 0, 0) });
                currentY -= 20;
            }
        } else {
            // Text values
            const textLines = String(val).split('\n');
            for (const line of textLines) {
                // Check page height
                if (currentY < 50) {
                    page = pdfDoc.addPage([600, 800]);
                    currentY = 750;
                }
                page.drawText(line, {
                    x: 70,
                    y: currentY,
                    size: 12,
                    font: regularFont,
                    color: rgb(0.2, 0.2, 0.2),
                });
                currentY -= 18;
            }
            currentY -= 15;
        }

        // Final sanity check for page capacity
        if (currentY < 100) {
            page = pdfDoc.addPage([600, 800]);
            currentY = 750;
        }
      }
    }

    const pdfBytes = await pdfDoc.save();
    
    // 3. Upload PDF to Supabase Storage
    const fileName = `submissions/${submissionId}.pdf`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('rams')
      .upload(fileName, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) throw uploadError;

    const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/rams/${fileName}`;

    // 4. Update submission with PDF URL
    await supabase
      .from('form_submissions')
      .update({ pdf_url: publicUrl, status: 'completed' })
      .eq('id', submissionId);

    // 5. Trigger Webhook
    if (form.webhook_url) {
      console.log(`Payload ready for webhook: ${form.webhook_url}`);
      try {
        await fetch(form.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'form_submission',
            formId: formId,
            formName: form.name,
            submissionId: submissionId,
            data: data,
            pdfUrl: publicUrl
          })
        });
      } catch (webhookErr) {
        console.error("Webhook triggers failed:", webhookErr);
      }
    }

    return NextResponse.json({ success: true, pdfUrl: publicUrl });
  } catch (error: any) {
    console.error("Submission processing error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
