import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, PDFPage, StandardFonts, rgb } from "pdf-lib";
import nodemailer from "nodemailer";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Returns the visible bounding box of a page.
 *
 * react-pdf (pdfjs-dist) renders the CropBox area, not the full MediaBox.
 * pdf-lib draws in the MediaBox coordinate system.
 *
 * So to correctly map a percentage drawn on-screen to PDF coordinates:
 *   1. Use CropBox.width / CropBox.height to scale percentages → points
 *   2. Add CropBox.x / CropBox.y as the PDF-space origin offset
 *
 * `page.getCropBox()` in pdf-lib returns the CropBox if it exists,
 * otherwise falls back to the MediaBox — exactly what we want.
 */
function getVisibleBox(page: PDFPage) {
  return page.getCropBox(); // { x, y, width, height }
}

export async function POST(req: NextRequest) {
  try {
    const { ramsId } = await req.json();
    if (!ramsId) return NextResponse.json({ error: "RAMS ID required" }, { status: 400 });

    const { data: rams, error: ramsErr } = await supabase
      .from("rams_documents")
      .select("*, signers(*)")
      .eq("id", ramsId)
      .single();

    if (ramsErr || !rams) return NextResponse.json({ error: "RAMS not found" }, { status: 404 });

    const { data: blob, error: dlErr } = await supabase.storage.from("rams").download(rams.file_path);
    if (dlErr) throw dlErr;

    const pdfBytes = await blob.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();

    for (const signer of rams.signers) {
      // ── 1. Signature image ──────────────────────────────────────────────────
      if (signer.signature_data && signer.page_number) {
        try {
          const page = pages[signer.page_number - 1];
          const box = getVisibleBox(page);   // the area react-pdf renders

          const fw = (signer.width / 100) * box.width;
          const fh = (signer.height / 100) * box.height;

          // placement_x / placement_y are top-left percentages of the visible area
          const x = box.x + (signer.placement_x / 100) * box.width;
          const y = box.y + box.height - (signer.placement_y / 100) * box.height - fh;

          const img = await pdfDoc.embedPng(signer.signature_data);
          page.drawImage(img, { x, y, width: fw, height: fh });
        } catch (e) {
          console.error("Sig error:", e);
        }
      }

      // ── 2. Name text ────────────────────────────────────────────────────────
      const nameToPrint = signer.name_text || signer.name;
      if (nameToPrint && signer.name_placement_x != null && signer.name_page_number) {
        try {
          const page = pages[signer.name_page_number - 1];
          const box = getVisibleBox(page);

          const fw = (signer.name_width / 100) * box.width;
          const fh = (signer.name_height / 100) * box.height;
          const x = box.x + (signer.name_placement_x / 100) * box.width;
          const y = box.y + box.height - (signer.name_placement_y / 100) * box.height - fh;

          const sz = 10;
          const tw = font.widthOfTextAtSize(nameToPrint, sz);
          page.drawText(nameToPrint, {
            x: x + (fw - tw) / 2,
            y: y + (fh - sz) / 2 + 2,
            size: sz, font, color: rgb(0, 0, 0),
          });
        } catch (e) {
          console.error("Name error:", e);
        }
      }

      // ── 3. Date text ────────────────────────────────────────────────────────
      const dateText = signer.signed_at
        ? new Date(signer.signed_at)
            .toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" })
            .replace(/\//g, " ")
        : "";

      if (dateText && signer.date_placement_x != null && signer.date_page_number) {
        try {
          const page = pages[signer.date_page_number - 1];
          const box = getVisibleBox(page);

          const fw = (signer.date_width / 100) * box.width;
          const fh = (signer.date_height / 100) * box.height;
          const x = box.x + (signer.date_placement_x / 100) * box.width;
          const y = box.y + box.height - (signer.date_placement_y / 100) * box.height - fh;

          const sz = 10;
          const tw = font.widthOfTextAtSize(dateText, sz);
          page.drawText(dateText, {
            x: x + (fw - tw) / 2,
            y: y + (fh - sz) / 2 + 2,
            size: sz, font, color: rgb(0, 0, 0),
          });
        } catch (e) {
          console.error("Date error:", e);
        }
      }
    }

    const finalBytes = await pdfDoc.save();
    const finalName = `final/finalized_${ramsId}_${Date.now()}.pdf`;

    await supabase.storage.from("rams").upload(finalName, finalBytes, {
      contentType: "application/pdf",
      upsert: true,
    });

    try {
      await supabase.from("rams_documents")
        .update({ status: "completed", final_file_path: finalName, completed_at: new Date().toISOString() })
        .eq("id", ramsId);
    } catch {
      await supabase.from("rams_documents").update({ status: "completed" }).eq("id", ramsId);
    }

    await sendAdminNotification(rams.name).catch(console.error);

    try {
      await fetch("https://n8n.srv990376.hstgr.cloud/webhook/42fcae15-2efc-47af-9099-711ed47335fb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_number: rams.servicem8_job_id || "N/A",
          document_name: rams.name,
          pdf_base64: Buffer.from(finalBytes).toString("base64"),
          rams_id: ramsId,
        }),
      });
    } catch (e) {
      console.error("Webhook error:", e);
    }

    return NextResponse.json({ success: true, finalPath: finalName });
  } catch (err: any) {
    console.error("Finalization error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function sendAdminNotification(docName: string) {
  if (!process.env.SMTP_HOST) return;
  const t = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await t.sendMail({
    from: `"TRE RAMS System" <${process.env.SMTP_USER}>`,
    to: "info@treenergy.co.uk",
    subject: `Document Completed: ${docName}`,
    text: `The RAMS document "${docName}" has been fully signed and is available in the Admin Portal.`,
  });
}
