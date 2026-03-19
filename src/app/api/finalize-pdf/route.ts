import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import nodemailer from "nodemailer";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
      // 1. Signature
      if (signer.signature_data && signer.page_number) {
        try {
          const page = pages[signer.page_number - 1];
          const { width, height, x: ox, y: oy } = page.getMediaBox();
          
          const fieldWidth = (signer.width / 100) * width;
          const fieldHeight = (signer.height / 100) * height;
          
          const x = ox + (signer.placement_x / 100) * width;
          const y = oy + (height - (signer.placement_y / 100) * height - fieldHeight);

          const signatureImage = await pdfDoc.embedPng(signer.signature_data);
          page.drawImage(signatureImage, {
            x,
            y,
            width: fieldWidth,
            height: fieldHeight,
          });
        } catch (imgErr) {
          console.error(`Error embedding signature for ${signer.role_name}:`, imgErr);
        }
      }

      // 2. Name Text
      const nameToPrint = signer.name_text || signer.name;
      if (nameToPrint && signer.name_placement_x != null && signer.name_page_number) {
        try {
          const page = pages[signer.name_page_number - 1];
          const { width, height, x: ox, y: oy } = page.getMediaBox();
          
          const fieldWidth = (signer.name_width / 100) * width;
          const fieldHeight = (signer.name_height / 100) * height;
          const x = ox + (signer.name_placement_x / 100) * width;
          const y = oy + (height - (signer.name_placement_y / 100) * height - fieldHeight);
          
          const fontSize = 10;
          const textWidth = font.widthOfTextAtSize(nameToPrint, fontSize);
          
          page.drawText(nameToPrint, {
              x: x + (fieldWidth - textWidth) / 2,
              y: y + (fieldHeight - fontSize) / 2 + 2,
              size: fontSize,
              font,
              color: rgb(0, 0, 0)
          });
        } catch (nameErr) {
          console.error(`Error drawing name for ${signer.role_name}:`, nameErr);
        }
      }

      // 3. Date Text
      const dateText = signer.signed_at 
        ? new Date(signer.signed_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, ' ')
        : "";

      if (dateText && signer.date_placement_x != null && signer.date_page_number) {
        try {
          const page = pages[signer.date_page_number - 1];
          const { width, height, x: ox, y: oy } = page.getMediaBox();
          
          const fieldWidth = (signer.date_width / 100) * width;
          const fieldHeight = (signer.date_height / 100) * height;
          const x = ox + (signer.date_placement_x / 100) * width;
          const y = oy + (height - (signer.date_placement_y / 100) * height - fieldHeight);
          
          const fontSize = 10;
          const textWidth = font.widthOfTextAtSize(dateText, fontSize);
          
          page.drawText(dateText, {
              x: x + (fieldWidth - textWidth) / 2,
              y: y + (fieldHeight - fontSize) / 2 + 2,
              size: fontSize,
              font,
              color: rgb(0, 0, 0)
          });
        } catch (dateErr) {
          console.error(`Error drawing date for ${signer.role_name}:`, dateErr);
        }
      }
    }

    const finalizedPdfBytes = await pdfDoc.save();
    const finalFileName = `final/finalized_${ramsId}_${Date.now()}.pdf`;

    await supabase.storage.from("rams").upload(finalFileName, finalizedPdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });

    await supabase.from("rams_documents").update({ 
      status: "completed", 
      final_file_path: finalFileName,
      completed_at: new Date().toISOString()
    }).eq("id", ramsId);

    return NextResponse.json({ success: true, finalPath: finalFileName });

  } catch (error: any) {
    console.error("Finalization error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
