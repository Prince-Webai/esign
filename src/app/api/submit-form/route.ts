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
    const { submissionId, formId, data, isRegeneration } = await req.json();

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

    // Calculate Dynamic Header Height (now centered)
    const headerTitle = 'FORM SUBMISSION';
    const formName = form.name.toUpperCase();
    
    // Embed Logo if exists
    let logoImage: any = null;
    let logoDims: { width: number; height: number } | null = null;
    if (orgLogoUrl) {
      try {
        const logoRes = await fetch(orgLogoUrl);
        const logoBuffer = await logoRes.arrayBuffer();
        const isPng = orgLogoUrl.toLowerCase().includes('.png') || orgLogoUrl.includes('image/png');
        logoImage = isPng ? await pdfDoc.embedPng(logoBuffer) : await pdfDoc.embedJpg(logoBuffer);
        // Slightly larger logo for clarity, still within bounds
        const scale = Math.min(180 / logoImage.width, 70 / logoImage.height);
        logoDims = logoImage.scale(scale);
      } catch (err) { console.error('Failed to embed org logo', err); }
    }

    // First, calculate the height needed for the centered header
    const headerCenteringX = 0; // The drawWrappedText will handle centering within maxWidth
    const headerMaxWidth = width - 100;
    
    let headerTestY = height - 50;
    if (logoDims) headerTestY -= (logoDims.height + 20);
    headerTestY -= 26; // For headerTitle
    const endTitleY = drawWrappedText(page, formName, 50, headerTestY, 12, regularFont, headerMaxWidth, 16, rgb(0.2, 0.2, 0.2), 'center');
    
    const headerBottomBorder = Math.min(height - 160, endTitleY - 30);
    const actualHeaderHeight = height - headerBottomBorder;

    // Draw Background Rectangle
    page.drawRectangle({ x: 0, y: headerBottomBorder, width, height: actualHeaderHeight, color: rgb(0.976, 0.976, 0.976) });

    // Draw Elements Centered
    let currentHeaderY = height - 40;
    
    if (logoImage && logoDims) {
      page.drawImage(logoImage, { 
        x: (width - logoDims.width) / 2, 
        y: currentHeaderY - logoDims.height, 
        width: logoDims.width, 
        height: logoDims.height 
      });
      currentHeaderY -= (logoDims.height + 20);
    }

    const titleWidth = font.widthOfTextAtSize(headerTitle, 20);
    page.drawText(headerTitle, { 
      x: (width - titleWidth) / 2, 
      y: currentHeaderY, 
      size: 20, 
      font, 
      color: rgb(0, 0, 0) 
    });
    currentHeaderY -= 26;

    drawWrappedText(page, formName, 50, currentHeaderY, 12, regularFont, headerMaxWidth, 16, rgb(0.2, 0.2, 0.2), 'center');

    let currentY = headerBottomBorder - 25;
    // Removed Submission ID and Timestamp as requested
    currentY -= 15;

    if (form.description) {
      currentY = drawWrappedText(page, form.description, 50, currentY, 10, regularFont, 500, 14, rgb(0.4, 0.4, 0.4));
      currentY -= 15;
    }
    currentY -= 20;




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
          if (typeof imgVal !== 'string') continue;

          imageEmbedPromises.push(
            (async () => {
              try {
                let imageBytes: Uint8Array;
                let isPng = false;

                if (imgVal.startsWith('http')) {
                  // Fetch from URL (New Storage-based flow)
                  const res = await fetch(imgVal);
                  if (!res.ok) throw new Error(`Failed to fetch image: ${res.statusText}`);
                  const buffer = await res.arrayBuffer();
                  imageBytes = new Uint8Array(buffer);
                  isPng = imgVal.toLowerCase().includes('.png');
                } else if (imgVal.startsWith('data:image')) {
                  // Process from base64 (Old fallback flow)
                  const base64Data = imgVal.split(',')[1];
                  imageBytes = new Uint8Array(Buffer.from(base64Data, 'base64'));
                  isPng = imgVal.includes('image/png');
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
          // Add significant top margin before a new section
          currentY -= 40;
          
          // Ensure enough space for Header Line + Header Text + at least one field label
          checkPage(80);
          
          // Draw Section Line - shifted up for better spacing
          page.drawLine({ 
            start: { x: 50, y: currentY + 20 }, 
            end: { x: 550, y: currentY + 20 }, 
            thickness: 1, 
            color: rgb(0.2, 0.2, 0.2) 
          });

          // Draw Header Text (Wrapped) - slightly smaller for 'less bold' look
          currentY = drawWrappedText(page, field.label.toUpperCase(), 50, currentY, 11, font, 500, 15, rgb(0, 0, 0));
          
          // Add margin after header
          currentY -= 30;
          continue;
        }

        const val = data[field.id];
        if (val === undefined || val === null || val === '') continue;
        
        // Ensure there is space for the label + a bit of value before drawing
        checkPage(50);

        // Draw Label (Wrapped) - using font (Bold) as requested
        currentY = drawWrappedText(page, field.label.toUpperCase(), 50, currentY, 10, font, 500, 14, rgb(0, 0, 0));
        
        // Small gap between label and value
        currentY -= 5;

        if (field.type === 'image') {
          const imageValues = Array.isArray(val) ? val : [val];
          for (let i = 0; i < imageValues.length; i++) {
            const cached = imageCache[`${field.id}_${i}`];
            if (!cached) continue;
            const { image, dims } = cached;
            
            // Proactive page check for image + label/next field
            checkPage(dims.height + 30);
            
            page.drawImage(image, { x: 50, y: currentY - dims.height, width: dims.width, height: dims.height });
            currentY -= dims.height + 25;
          }
        } else {
          // Draw Value (Wrapped)
          const textVal = String(val);
          currentY = drawWrappedText(page, textVal, 70, currentY, 12, regularFont, 480, 16, rgb(0.3, 0.3, 0.3));
        }

        // Standard gap after every field
        currentY -= 12;
      }
    }

    const pdfBytes = await pdfDoc.save();

    // 5. Generate human-readable file name
    let jobNumberText = '';
    if (fields && data) {
      const jobField = fields.find((f: any) => 
        f.type !== 'header' &&
        f.type !== 'image' &&
        f.label && 
        (f.label.toLowerCase().includes('job num') || 
         f.label.toLowerCase().includes('job no') || 
         f.label.toLowerCase() === 'job' ||
         f.label.toLowerCase().includes('reference'))
      );
      if (jobField && data[jobField.id]) {
        jobNumberText = String(data[jobField.id]).trim().replace(/[^a-zA-Z0-9\s-]/g, '');
      }
    }

    const safeFormName = (form.name || form.title || 'Form').trim().replace(/[^a-zA-Z0-9\s-]/g, '');
    let baseFileName = safeFormName;

    if (jobNumberText) {
      baseFileName = `${safeFormName} ${jobNumberText}`.trim();
    }

    // Use submissionId as a folder to guarantee uniqueness, then the clean filename
    const fileName = `submissions/${submissionId}/${baseFileName}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('rams')
      .upload(fileName, pdfBytes, { contentType: 'application/pdf', upsert: true });

    if (uploadError) throw uploadError;

    // Supabase needs URL encoding for spaces in public URLs
    const encodedFileName = `submissions/${submissionId}/${encodeURIComponent(baseFileName)}.pdf`;
    const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/rams/${encodedFileName}`;

    // 6. Update submission record
    await supabase.from('form_submissions').update({ pdf_url: publicUrl, status: 'completed' }).eq('id', submissionId);

    // 7. Trigger Webhook (Skip if this is just a PDF regeneration)
    if (form.webhook_url && !isRegeneration) {

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

function drawWrappedText(page: any, text: string, x: number, y: number, size: number, font: any, maxWidth: number, lineHeight: number, color: any, align: 'left' | 'center' = 'left'): number {
  if (!text) return y;
  const paragraphs = text.split('\n');
  let curY = y;

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine + word + ' ';
      const testWidth = font.widthOfTextAtSize(testLine, size);
      
      if (testWidth > maxWidth && currentLine !== '') {
        const drawX = align === 'center' ? x + (maxWidth - font.widthOfTextAtSize(currentLine.trim(), size)) / 2 : x;
        page.drawText(currentLine.trim(), { x: drawX, y: curY, size, font, color });
        curY -= lineHeight;
        currentLine = word + ' ';
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine.trim()) {
      const drawX = align === 'center' ? x + (maxWidth - font.widthOfTextAtSize(currentLine.trim(), size)) / 2 : x;
      page.drawText(currentLine.trim(), { x: drawX, y: curY, size, font, color });
      curY -= lineHeight;
    }
  }
  return curY;
}



