import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import nodemailer from "nodemailer";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Get the "visible" bounding box for a page.
 * react-pdf renders using the CropBox if present, otherwise the MediaBox.
 * pdf-lib's page.getSize() does the same, so we use that for dimensions,
 * but we need getMediaBox() for the origin offset.
 *
 * Correct formula:
 *   - Use page.getSize() for width & height (respects CropBox)
 *   - For the PDF coordinate origin, check if CropBox exists;
 *     if so its x/y offsets are relative to MediaBox origin.
 */
function getPageBox(page: any) {
  // pdf-lib: page.getSize() returns CropBox dimensions if present, else MediaBox
  const { width, height } = page.getSize();
  
  // Try to get CropBox first (what react-pdf uses for rendering)
  let ox = 0, oy = 0;
  try {
    const cropBox = page.getCropBox();
    ox = cropBox.x;
    oy = cropBox.y;
  } catch {
    // If no CropBox, fall back to MediaBox origin
    try {
      const mediaBox = page.getMediaBox();
      ox = mediaBox.x;
      oy = mediaBox.y;
    } catch {
      // Default to 0,0
    }
  }

  return { width, height, ox, oy };
}

export async function POST(req: NextRequest) {
  try {
    const { ramsId } = await req.json();

    if (!ramsId) {
      return NextResponse.json({ error: "RAMS ID is required" }, { status: 400 });
    }

    const { data: rams, error: ramsError } = await supabase
      .from("rams_documents")
      .select("*, signers(*)")
      .eq("id", ramsId)
      .single();

    if (ramsError || !rams) {
      return NextResponse.json({ error: "RAMS not found" }, { status: 404 });
    }

    const { data: pdfBlob, error: downloadError } = await supabase.storage
      .from("rams")
      .download(rams.file_path);

    if (downloadError) throw downloadError;

    const pdfBytes = await pdfBlob.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();

    for (const signer of rams.signers) {
      // 1. Signature image
      if (signer.signature_data && signer.page_number) {
        try {
          const page = pages[signer.page_number - 1];
          const { width, height, ox, oy } = getPageBox(page);

          const fieldWidth = (signer.width / 100) * width;
          const fieldHeight = (signer.height / 100) * height;
          // placement_x/y are top-left percentages from react-pdf's rendering
          // Map to pdf-lib coordinates (bottom-left origin)
          const x = ox + (signer.placement_x / 100) * width;
          const y = oy + height - (signer.placement_y / 100) * height - fieldHeight;

          const signatureImage = await pdfDoc.embedPng(signer.signature_data);
          page.drawImage(signatureImage, { x, y, width: fieldWidth, height: fieldHeight });
        } catch (imgErr) {
          console.error(`Signature error for ${signer.role_name}:`, imgErr);
        }
      }

      // 2. Name Text
      const nameToPrint = signer.name_text || signer.name;
      if (nameToPrint && signer.name_placement_x != null && signer.name_page_number) {
        try {
          const page = pages[signer.name_page_number - 1];
          const { width, height, ox, oy } = getPageBox(page);

          const fieldWidth = (signer.name_width / 100) * width;
          const fieldHeight = (signer.name_height / 100) * height;
          const x = ox + (signer.name_placement_x / 100) * width;
          const y = oy + height - (signer.name_placement_y / 100) * height - fieldHeight;

          const fontSize = 10;
          const textWidth = font.widthOfTextAtSize(nameToPrint, fontSize);
          page.drawText(nameToPrint, {
            x: x + (fieldWidth - textWidth) / 2,
            y: y + (fieldHeight - fontSize) / 2 + 2,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
          });
        } catch (nameErr) {
          console.error(`Name error for ${signer.role_name}:`, nameErr);
        }
      }

      // 3. Date Text
      const dateText = signer.signed_at
        ? new Date(signer.signed_at)
            .toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" })
            .replace(/\//g, " ")
        : "";

      if (dateText && signer.date_placement_x != null && signer.date_page_number) {
        try {
          const page = pages[signer.date_page_number - 1];
          const { width, height, ox, oy } = getPageBox(page);

          const fieldWidth = (signer.date_width / 100) * width;
          const fieldHeight = (signer.date_height / 100) * height;
          const x = ox + (signer.date_placement_x / 100) * width;
          const y = oy + height - (signer.date_placement_y / 100) * height - fieldHeight;

          const fontSize = 10;
          const textWidth = font.widthOfTextAtSize(dateText, fontSize);
          page.drawText(dateText, {
            x: x + (fieldWidth - textWidth) / 2,
            y: y + (fieldHeight - fontSize) / 2 + 2,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
          });
        } catch (dateErr) {
          console.error(`Date error for ${signer.role_name}:`, dateErr);
        }
      }
    }

    const finalizedPdfBytes = await pdfDoc.save();
    const finalFileName = `final/finalized_${ramsId}_${Date.now()}.pdf`;

    await supabase.storage.from("rams").upload(finalFileName, finalizedPdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });

    try {
      await supabase
        .from("rams_documents")
        .update({
          status: "completed",
          final_file_path: finalFileName,
          completed_at: new Date().toISOString(),
        })
        .eq("id", ramsId);
    } catch {
      await supabase
        .from("rams_documents")
        .update({ status: "completed" })
        .eq("id", ramsId);
    }

    // Notify admin
    await sendAdminNotification(rams.name);

    // Trigger Webhook
    try {
      await sendWebhookNotification({
        job_number: rams.servicem8_job_id || "N/A",
        document_name: rams.name,
        pdf_base64: Buffer.from(finalizedPdfBytes).toString("base64"),
        rams_id: ramsId,
      });
    } catch (webhookErr) {
      console.error("Webhook error:", webhookErr);
    }

    return NextResponse.json({ success: true, finalPath: finalFileName });
  } catch (error: any) {
    console.error("Finalization error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function sendWebhookNotification(payload: any) {
  const webhookUrl = "https://n8n.srv990376.hstgr.cloud/webhook/42fcae15-2efc-47af-9099-711ed47335fb";
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Webhook status: ${response.status}`);
}

async function sendAdminNotification(docName: string) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  if (!process.env.SMTP_HOST) return;

  await transporter.sendMail({
    from: `"TRE RAMS System" <${process.env.SMTP_USER}>`,
    to: "info@treenergy.co.uk",
    subject: `Document Completed: ${docName}`,
    text: `The RAMS document "${docName}" has been fully signed and is available for download in the Admin Portal.`,
  });
}
