import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// Use service role to bypass RLS for heavy operations
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  try {
    const { submissionId, formId, data } = await req.json();
    const supabase = getAdminClient();

    // 1. Fetch form config
    const { data: form } = await supabase.from('forms').select('*').eq('id', formId).single();
    if (!form) throw new Error('Form configuration not found');

    const { data: orgSettings } = await supabase.from('organization_settings').select('*').eq('id', 1).single();
    const orgName = orgSettings?.name || 'TRE Energy';
    const orgLogoUrl = orgSettings?.logo_url;

    // 2. Fetch form fields
    const { data: fields } = await supabase
      .from('form_fields')
      .select('*')
      .eq('form_id', formId)
      .order('order_index', { ascending: true });

    // 3. Generate PDF
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([600, 800]);
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Header
    page.drawRectangle({ x: 0, y: height - 100, width, height: 100, color: rgb(0.02, 0.59, 0.41) });

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
        const scale = Math.min(150 / logoImage.width, 60 / logoImage.height);
        const dims = logoImage.scale(scale);
        page.drawImage(logoImage, { x: 50, y: height - 50 - dims.height / 2, width: dims.width, height: dims.height });
        logoWidthOffset = dims.width + 20;
      } catch (err) {
        console.error('Failed to embed org logo', err);
      }
    } else {
      page.drawText(orgName.toUpperCase(), { x: 50, y: height - 45, size: 16, font, color: rgb(1, 1, 1) });
      logoWidthOffset = font.widthOfTextAtSize(orgName.toUpperCase(), 16) + 20;
    }

    page.drawText('FORM SUBMISSION', { x: 50 + logoWidthOffset, y: height - 42, size: 20, font, color: rgb(1, 1, 1) });
    page.drawText(form.name.toUpperCase(), { x: 50 + logoWidthOffset, y: height - 68, size: 14, font: regularFont, color: rgb(0.8, 0.9, 0.8) });

    let currentY = height - 150;
    page.drawText(`Submission ID: ${submissionId}`, { x: 50, y: currentY, size: 10, font: regularFont, color: rgb(0.4, 0.4, 0.4) });
    currentY -= 15;
    page.drawText(`Timestamp: ${new Date().toLocaleString()}`, { x: 50, y: currentY, size: 10, font: regularFont, color: rgb(0.4, 0.4, 0.4) });
    currentY -= 40;

    // 4. Draw form fields — images processed in parallel first
    if (fields) {
      // Pre-fetch all images in parallel to avoid sequential await delays
      const imageCache: Record<string, { image: any; dims: { width: number; height: number } } | null> = {};

      const imageEmbedPromises: Promise<void>[] = [];
      for (const field of fields) {
        if (field.type !== 'image') continue;
        const val = data[field.id];
        if (!val) continue;
        const imageValues = Array.isArray(val) ? val : [val];

        for (let i = 0; i < imageValues.length; i++) {
          const imgVal = imageValues[i];
          const cacheKey = `${field.id}_${i}`;
          if (typeof imgVal !== 'string' || !imgVal.startsWith('data:image')) continue;

          imageEmbedPromises.push(
            (async () => {
              try {
                let imageBytes: Uint8Array;
                let isPng = false;

                if (typeof imgVal === 'string' && imgVal.startsWith('http')) {
                  // Fetch from URL (New Storage-based flow)
                  const res = await fetch(imgVal);
                  const buffer = await res.arrayBuffer();
                  imageBytes = new Uint8Array(buffer);
                  isPng = imgVal.toLowerCase().includes('.png');
                } else if (typeof imgVal === 'string' && imgVal.startsWith('data:image')) {
                  // Process from base64 (Old fallback flow)
                  const compressed = await compressBase64Image(imgVal, 800, 0.7);
                  imageBytes = Uint8Array.from(atob(compressed.split(',')[1]), c => c.charCodeAt(0));
                  isPng = compressed.includes('image/png');
                } else {
                  return;
                }

                const image = isPng
                  ? await pdfDoc.embedPng(imageBytes)
                  : await pdfDoc.embedJpg(imageBytes);
                
                const maxWidth = 480;
                const scale = Math.min(maxWidth / image.width, 260 / image.height, 1);
                imageCache[cacheKey] = { image, dims: image.scale(scale) };
              } catch (err) {
                console.error(`Failed to embed image ${cacheKey}:`, err);
                imageCache[cacheKey] = null;
              }
            })()
          );

        }
      }

      // Wait for all images to be embedded in parallel
      await Promise.all(imageEmbedPromises);

      // Helper to check for enough vertical space and add a page if needed
      const checkPage = (needed: number) => {
        if (currentY - needed < 50) {
          page = pdfDoc.addPage([600, 800]);
          currentY = 750;
          return true;
        }
        return false;
      };

      // Now draw everything in order
      for (const field of fields) {
        if (field.type === 'header') {
          currentY -= 30;
          checkPage(40);
          page.drawLine({ start: { x: 50, y: currentY + 10 }, end: { x: 550, y: currentY + 10 }, thickness: 2, color: rgb(0.1, 0.1, 0.1) });
          currentY = drawWrappedText(page, field.label.toUpperCase(), 50, currentY, 14, font, 500, 18, rgb(0, 0, 0));
          currentY -= 20;
          continue;
        }

        const val = data[field.id];
        if (val === undefined || val === null || val === '') continue;
        
        // Ensure there is space for the label before drawing it
        checkPage(40);
        currentY = drawWrappedText(page, field.label.toUpperCase(), 50, currentY, 10, font, 500, 14, rgb(0, 0, 0));
        currentY -= 8;

        if (field.type === 'image') {
          const imageValues = Array.isArray(val) ? val : [val];
          for (let i = 0; i < imageValues.length; i++) {
            const cached = imageCache[`${field.id}_${i}`];
            if (!cached) continue;
            const { image, dims } = cached;
            checkPage(dims.height + 20);
            page.drawImage(image, { x: 50, y: currentY - dims.height, width: dims.width, height: dims.height });
            currentY -= dims.height + 20;
          }
        } else {
          // Draw Value (Wrapped)
          const textVal = String(val);
          currentY = drawWrappedText(page, textVal, 70, currentY, 12, regularFont, 480, 16, rgb(0.2, 0.2, 0.2));
          currentY -= 15;
        }
      }
    }

    const pdfBytes = await pdfDoc.save();

    // 5. Upload PDF
    const fileName = `submissions/${submissionId}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('rams')
      .upload(fileName, pdfBytes, { contentType: 'application/pdf', upsert: true });

    if (uploadError) throw uploadError;

    const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/rams/${fileName}`;

    // 6. Update submission record
    await supabase.from('form_submissions').update({ pdf_url: publicUrl, status: 'completed' }).eq('id', submissionId);

    // 7. Trigger Webhook
    if (form.webhook_url) {
      const humanReadableData: Record<string, any> = {};
      if (fields) {
        for (const field of fields) {
          if (field.type === 'header') continue;
          if (data[field.id] !== undefined && data[field.id] !== null) {
            // Don't send base64 images in webhook — too big
            humanReadableData[field.label] = field.type === 'image' ? '[Image attached in PDF]' : data[field.id];
          }
        }
      }
      try {
        await fetch(form.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'form_submission', formId, formName: form.name, submissionId, data: humanReadableData, pdfUrl: publicUrl }),
        });
      } catch (webhookErr) {
        console.error('Webhook error:', webhookErr);
      }
    }

    return NextResponse.json({ success: true, pdfUrl: publicUrl });
  } catch (error: any) {
    console.error('Submission processing error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * Compress a base64 image to a max width and JPEG quality using the Canvas API.
 * Falls back to the original if canvas is not available (server environment).
 */
async function compressBase64Image(base64: string, maxWidth: number, quality: number): Promise<string> {
  try {
    // Node.js environment — no canvas by default, but we can shrink the payload
    // by re-encoding. Skip if it's already small enough.
    const sizeKb = (base64.length * 3) / 4 / 1024;
    if (sizeKb < 300) return base64; // already small enough
    // Can't use Canvas in Node without native module — return as-is
    // This function is here so we can add canvas compression later if needed
    return base64;
  } catch {
    return base64;
  }
}

function drawWrappedText(page: any, text: string, x: number, y: number, size: number, font: any, maxWidth: number, lineHeight: number, color: any): number {
  if (!text) return y;
  const words = text.split(' ');
  let currentLine = '';
  let curY = y;

  for (const word of words) {
    const testLine = currentLine + word + ' ';
    const testWidth = font.widthOfTextAtSize(testLine, size);
    if (testWidth > maxWidth && currentLine !== '') {
      page.drawText(currentLine.trim(), { x, y: curY, size, font, color });
      curY -= lineHeight;
      currentLine = word + ' ';
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine.trim()) {
    page.drawText(currentLine.trim(), { x, y: curY, size, font, color });
    curY -= lineHeight;
  }
  return curY;
}

