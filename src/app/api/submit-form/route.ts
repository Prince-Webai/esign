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

    const { data: orgSettings } = await supabase
      .from('organization_settings')
      .select('*')
      .eq('id', 1)
      .single();
    
    const orgName = orgSettings?.name || 'TRE Energy';
    const orgLogoUrl = orgSettings?.logo_url;

    // 2. Generate PDF
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([600, 800]);
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Header (Emerald 600: #059669 -> rgb(0.02, 0.59, 0.41))
    page.drawRectangle({
      x: 0,
      y: height - 100,
      width,
      height: 100,
      color: rgb(0.02, 0.59, 0.41),
    });

    let logoWidthOffset = 0;
    if (orgLogoUrl) {
      try {
        const logoRes = await fetch(orgLogoUrl);
        const logoBuffer = await logoRes.arrayBuffer();
        let logoImage;
        if (orgLogoUrl.toLowerCase().includes('.png') || orgLogoUrl.includes('image/png')) {
          logoImage = await pdfDoc.embedPng(logoBuffer);
        } else {
          logoImage = await pdfDoc.embedJpg(logoBuffer);
        }
        
        // Scale logo to fit within 150x60
        const scale = Math.min(150 / logoImage.width, 60 / logoImage.height);
        const dims = logoImage.scale(scale);
        
        page.drawImage(logoImage, {
          x: 50,
          y: height - 50 - dims.height / 2,
          width: dims.width,
          height: dims.height,
        });
        
        logoWidthOffset = dims.width + 20;
      } catch (err) {
        console.error("Failed to embed organization logo in PDF", err);
      }
    } else {
      page.drawText(orgName.toUpperCase(), {
        x: 50,
        y: height - 45,
        size: 16,
        font,
        color: rgb(1, 1, 1),
      });
      logoWidthOffset = font.widthOfTextAtSize(orgName.toUpperCase(), 16) + 20;
    }

    page.drawText('FORM SUBMISSION', {
      x: 50 + logoWidthOffset,
      y: height - 42,
      size: 20,
      font,
      color: rgb(1, 1, 1),
    });

    page.drawText(form.name.toUpperCase(), {
      x: 50 + logoWidthOffset,
      y: height - 68,
      size: 14,
      font: regularFont,
      color: rgb(0.8, 0.9, 0.8),
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
        if (field.type === 'header') {
          currentY -= 20;
          if (currentY < 100) { page = pdfDoc.addPage([600, 800]); currentY = 750; }
          page.drawLine({
            start: { x: 50, y: currentY },
            end: { x: 550, y: currentY },
            thickness: 2,
            color: rgb(0.1, 0.1, 0.1),
          });
          currentY -= 25;
          page.drawText(field.label.toUpperCase(), {
            x: 50,
            y: currentY,
            size: 14,
            font,
            color: rgb(0, 0, 0),
          });
          currentY -= 40;
          continue;
        }

        const val = data[field.id];
        if (val === undefined || val === null || val === "") continue;

        if (currentY < 80) {
            page = pdfDoc.addPage([600, 800]);
            currentY = 750;
        }

        // Label
        page.drawText(field.label.toUpperCase(), {
          x: 50,
          y: currentY,
          size: 10,
          font,
          color: rgb(0, 0, 0),
        });
        currentY -= 20;

        if (field.type === 'image') {
            const imageValues = Array.isArray(val) ? val : [val];
            
            for (const imgVal of imageValues) {
                if (typeof imgVal !== 'string' || !imgVal.startsWith('data:image')) continue;
                
                try {
                    const imageBytes = Uint8Array.from(atob(imgVal.split(',')[1]), c => c.charCodeAt(0));
                    let image;
                    if (imgVal.includes('image/png')) {
                        image = await pdfDoc.embedPng(imageBytes);
                    } else {
                        image = await pdfDoc.embedJpg(imageBytes);
                    }
                    
                    const maxWidth = 480;
                    const availableHeight = currentY - 50;

                    let scale = Math.min(maxWidth / image.width, 280 / image.height, 1);
                    let dims = image.scale(scale);

                    if (dims.height > availableHeight && availableHeight > 80) {
                        scale = availableHeight / image.height;
                        if (image.width * scale > maxWidth) scale = maxWidth / image.width;
                        dims = image.scale(scale);
                    }

                    if (availableHeight < 80) {
                        page = pdfDoc.addPage([600, 800]);
                        currentY = 750;
                        dims = image.scale(Math.min(maxWidth / image.width, 280 / image.height, 1));
                    }

                    page.drawImage(image, {
                        x: 50,
                        y: currentY - dims.height,
                        width: dims.width,
                        height: dims.height,
                    });
                    currentY -= dims.height + 20;
                } catch (e) {
                    page.drawText("[Image processing failed]", { x: 70, y: currentY, size: 10, font: regularFont, color: rgb(0.8, 0, 0) });
                    currentY -= 20;
                }
            }
        } else {
            // Text values
            const textLines = String(val).split('\n');
            for (let line of textLines) {
                const words = line.split(' ');
                let currentLine = '';
                for (const word of words) {
                    const testLine = currentLine + word + ' ';
                    const textWidth = regularFont.widthOfTextAtSize(testLine, 12);
                    if (textWidth > 450 && currentLine !== '') {
                        if (currentY < 50) { page = pdfDoc.addPage([600, 800]); currentY = 750; }
                        page.drawText(currentLine, { x: 70, y: currentY, size: 12, font: regularFont, color: rgb(0.2, 0.2, 0.2) });
                        currentY -= 18;
                        currentLine = word + ' ';
                    } else {
                        currentLine = testLine;
                    }
                }
                if (currentLine.trim()) {
                    if (currentY < 50) { page = pdfDoc.addPage([600, 800]); currentY = 750; }
                    page.drawText(currentLine, { x: 70, y: currentY, size: 12, font: regularFont, color: rgb(0.2, 0.2, 0.2) });
                    currentY -= 18;
                }
            }
            currentY -= 15;
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
      
      // Create a human-readable data object for the webhook payload
      const humanReadableData: Record<string, any> = {};
      if (fields) {
        for (const field of fields) {
          if (field.type === 'header' || field.id === 'builtin-description') continue;
          if (data[field.id] !== undefined && data[field.id] !== null) {
            humanReadableData[field.label] = data[field.id];
          }
        }
      }

      try {
        await fetch(form.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'form_submission',
            formId: formId,
            formName: form.name,
            submissionId: submissionId,
            data: humanReadableData,
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
