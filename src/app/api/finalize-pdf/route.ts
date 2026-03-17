import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
import nodemailer from "nodemailer";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role to bypass RLS for finalization
);

export async function POST(req: NextRequest) {
  try {
    const { ramsId } = await req.json();

    if (!ramsId) {
      return NextResponse.json({ error: "RAMS ID is required" }, { status: 400 });
    }

    // 1. Fetch RAMS document and signers
    const { data: rams, error: ramsError } = await supabase
      .from("rams_documents")
      .select("*, signers(*)")
      .eq("id", ramsId)
      .single();

    if (ramsError || !rams) {
      return NextResponse.json({ error: "RAMS not found" }, { status: 404 });
    }

    // 2. Fetch template fields to know where to place signatures
    const { data: fields, error: fieldsError } = await supabase
      .from("template_signature_fields")
      .select("*")
      .eq("template_id", rams.template_id);

    if (fieldsError) throw fieldsError;

    // 3. Download original PDF
    console.log(`Downloading PDF from path: "${rams.file_path}" in bucket: "rams"`);
    const { data: pdfBlob, error: downloadError } = await supabase.storage
      .from("rams")
      .download(rams.file_path);

    if (downloadError) {
      console.error(`Supabase download error for path "${rams.file_path}":`, downloadError);
      throw downloadError;
    }

    const pdfBytes = await pdfBlob.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // 4. Overlay signatures
    for (const field of fields) {
      const signer = rams.signers.find((s: any) => s.role_name === field.role_name);
      if (signer && signer.signature_data) {
        try {
          // Convert base64 signature to image
          const signatureImageBytes = Buffer.from(
            signer.signature_data.split(",")[1],
            "base64"
          );
          const signatureImage = await pdfDoc.embedPng(signatureImageBytes);

          const pages = pdfDoc.getPages();
          const page = pages[field.page_number - 1];
          const { width, height } = page.getSize();

          // Convert percentage coordinates to PDF points
          // placement_x/y are center points
          const fieldWidth = (field.width / 100) * width;
          const fieldHeight = (field.height / 100) * height;
          const x = (field.placement_x / 100) * width - fieldWidth / 2;
          const y = height - (field.placement_y / 100) * height - fieldHeight / 2;

          page.drawImage(signatureImage, {
            x,
            y,
            width: fieldWidth,
            height: fieldHeight,
          });
        } catch (imgErr) {
          console.error(`Error embedding signature for ${field.role_name}:`, imgErr);
        }
      }
    }

    // 5. Save finalized PDF
    const finalizedPdfBytes = await pdfDoc.save();
    const finalFileName = `final/finalized_${ramsId}_${Date.now()}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("rams")
      .upload(finalFileName, finalizedPdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // 6. Update RAMS status to completed
    try {
      await supabase
        .from("rams_documents")
        .update({ 
          status: "completed", 
          final_file_path: finalFileName,
          completed_at: new Date().toISOString()
        })
        .eq("id", ramsId);
    } catch (updateErr) {
      console.warn("Could not update final_file_path (likely missing column), attempting status-only update:", updateErr);
      await supabase
        .from("rams_documents")
        .update({ status: "completed" })
        .eq("id", ramsId);
    }

    // 7. Notify Admin via Email
    await sendAdminNotification(rams.name);

    // 8. Trigger Webhook (n8n)
    try {
      const base64Pdf = Buffer.from(finalizedPdfBytes).toString('base64');
      await sendWebhookNotification({
        job_number: rams.servicem8_job_id || "N/A",
        document_name: rams.name,
        pdf_base64: base64Pdf,
        rams_id: ramsId
      });
    } catch (webhookErr) {
      console.error("Webhook trigger failed:", webhookErr);
      // Non-blocking error for the user
    }

    return NextResponse.json({ 
      success: true, 
      finalPath: finalFileName 
    });

  } catch (error: any) {
    console.error("Finalization error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function sendWebhookNotification(payload: any) {
  const webhookUrl = "https://n8n.srv990376.hstgr.cloud/webhook/42fcae15-2efc-47af-9099-711ed47335fb";
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook responded with status: ${response.status}`);
    }
    
    console.log("Webhook triggered successfully.");
  } catch (err) {
    console.error("Failed to send webhook notification:", err);
    throw err;
  }
}

async function sendAdminNotification(docName: string) {
  // Use environment variables for SMTP settings
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: `"TRE RAMS System" <${process.env.SMTP_USER}>`,
    to: "info@treenergy.co.uk",
    subject: `Document Completed: ${docName}`,
    text: `Greetings,\n\nThe RAMS document "${docName}" has been fully signed by all parties and is now available for download in the Admin Portal.\n\nBest Regards,\nTRE Energy Team`,
  };

  try {
    if (process.env.SMTP_HOST) {
        await transporter.sendMail(mailOptions);
        console.log("Admin notification email sent.");
    } else {
        console.log("SMTP not configured, skipping email notification.");
    }
  } catch (err) {
    console.error("Failed to send admin notification email:", err);
  }
}
