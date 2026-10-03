// app/api/notifications/process/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { generateVoucherPDF } from "../../../lib/pdf/voucher";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const RESEND_FROM = process.env.RESEND_FROM_EMAIL || "bookings@staynexa.in";
const WAHA_BASE_URL = (process.env.WAHA_BASE_URL || "").replace(/\/$/, "");
const WAHA_API_KEY = process.env.WAHA_API_KEY!;

export async function POST(req: NextRequest) {
  try {
    const { hotelId } = await req.json();
    if (!hotelId) {
      return NextResponse.json({ error: "hotelId required" }, { status: 400 });
    }

    console.log("[process] Starting for hotel:", hotelId);

    if (!SUPABASE_SERVICE_KEY) {
      console.error("[process] SUPABASE_SERVICE_ROLE_KEY missing");
      return NextResponse.json({ error: "Service key missing" }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: pending, error: fetchErr } = await supabase
      .from("notification_log")
      .select("*")
      .eq("hotel_id", hotelId)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(50);

    if (fetchErr) {
      console.error("[process] fetch error:", fetchErr);
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    console.log(`[process] Found ${pending?.length || 0} pending notifications`);

    if (!pending || pending.length === 0) {
      return NextResponse.json({ success: true, processed: 0 });
    }

    let sent = 0;
    let failed = 0;
    const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

    for (const log of pending) {
      try {
        console.log(`[process] Processing ${log.channel} → ${log.recipient}`);

        // ═══════════════════════════════════════════════
        // GENERATE PDF (if voucherData exists)
        // ═══════════════════════════════════════════════
        let pdfBytes: Uint8Array | null = null;
        let pdfUrl: string | null = null;

        if (log.metadata?.voucherData && log.metadata?.attachPdf !== false) {
          try {
            pdfBytes = await generateVoucherPDF({
              ...log.metadata.voucherData,
              generatedAt: new Date().toLocaleString("en-IN"),
            });
            console.log(`[PDF] Generated for ${log.metadata.voucherData.bookingRef}`);
          } catch (pdfErr) {
            console.error("[PDF] Generation failed:", pdfErr);
          }
        }

        // ═══════════════════════════════════════════════
        // EMAIL — Send with PDF attachment
        // ═══════════════════════════════════════════════
        if (log.channel === "email") {
          if (!resend) throw new Error("RESEND_API_KEY not configured");

          const attachments: any[] = [];
          if (pdfBytes && log.metadata?.voucherData) {
            attachments.push({
              filename: `Voucher-${log.metadata.voucherData.bookingRef}.pdf`,
              content: Buffer.from(pdfBytes),
            });
          }

          const result = await resend.emails.send({
            from: RESEND_FROM,
            to: log.recipient,
            subject: log.subject || "Booking Confirmation",
            html: convertToHTML(log.body || ""),
            attachments: attachments.length > 0 ? attachments : undefined,
          });

          if (result.error) throw new Error(result.error.message);
          console.log(`[Email] Sent to ${log.recipient}`);
        }

        // ═══════════════════════════════════════════════
        // WHATSAPP via WAHA — Send text + PDF
        // ═══════════════════════════════════════════════
        else if (log.channel === "whatsapp") {
          if (!WAHA_BASE_URL || !WAHA_API_KEY) {
            throw new Error("WAHA not configured");
          }

          // ═══════════════════════════════════════════════
          // 🆕 PHONE NUMBER CLEANING (fixes leading 0 issue)
          // ═══════════════════════════════════════════════
          let cleanPhone = log.recipient.replace(/\D/g, "");

          // Remove leading 0 (Indian domestic format)
          if (cleanPhone.startsWith("0")) {
            cleanPhone = "91" + cleanPhone.substring(1);
          }

          // Add 91 if 10-digit number
          if (cleanPhone.length === 10) {
            cleanPhone = "91" + cleanPhone;
          }

          // Remove leading + if any
          if (cleanPhone.startsWith("+")) {
            cleanPhone = cleanPhone.substring(1);
          }

          const chatId = `${cleanPhone}@c.us`;
          console.log(`[WAHA] Original: ${log.recipient} → Cleaned: ${chatId}`);

          // ─── Send text message ───
          const textResp = await fetch(`${WAHA_BASE_URL}/api/sendText`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Api-Key": WAHA_API_KEY,
            },
            body: JSON.stringify({
              session: "default",
              chatId,
              text: log.body || "",
            }),
          });

          const textResultText = await textResp.text();
          console.log(`[WAHA] Text response (${textResp.status}):`, textResultText);

          if (!textResp.ok) {
            throw new Error(`WAHA text failed (${textResp.status}): ${textResultText}`);
          }

          // ─── Send PDF file (if exists) ───
          if (pdfBytes && log.metadata?.voucherData) {
            try {
              const fileName = `vouchers/${log.metadata.voucherData.bookingRef}-${Date.now()}.pdf`;

              const { data: uploadData, error: uploadErr } = await supabase.storage
                .from("vouchers")
                .upload(fileName, pdfBytes, {
                  contentType: "application/pdf",
                  cacheControl: "3600",
                  upsert: false,
                });

              if (uploadErr) {
                console.error("[Storage] Upload failed:", uploadErr);
              } else if (uploadData) {
                const { data: urlData } = supabase.storage
                  .from("vouchers")
                  .getPublicUrl(uploadData.path);

                pdfUrl = urlData.publicUrl;
                console.log(`[WAHA] Sending PDF: ${pdfUrl}`);

                const fileResp = await fetch(`${WAHA_BASE_URL}/api/sendFile`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "X-Api-Key": WAHA_API_KEY,
                  },
                  body: JSON.stringify({
                    session: "default",
                    chatId,
                    file: {
                      url: pdfUrl,
                      mimetype: "application/pdf",
                      filename: `Voucher-${log.metadata.voucherData.bookingRef}.pdf`,
                    },
                  }),
                });

                const fileResultText = await fileResp.text();
                console.log(`[WAHA] File response (${fileResp.status}):`, fileResultText);
              }
            } catch (pdfSendErr) {
              console.error("[WAHA] PDF send failed:", pdfSendErr);
              // Continue — text was sent successfully
            }
          }
        } else {
          throw new Error(`Unsupported channel: ${log.channel}`);
        }

        // ═══════════════════════════════════════════════
        // MARK AS SENT
        // ═══════════════════════════════════════════════
        await supabase
          .from("notification_log")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            error: null,
            metadata: {
              ...log.metadata,
              pdfUrl,
            },
          })
          .eq("id", log.id);

        sent++;
      } catch (err: any) {
        console.error(`[notification ${log.id}] failed:`, err);
        await supabase
          .from("notification_log")
          .update({
            status: "failed",
            error: err.message || "Unknown error",
          })
          .eq("id", log.id);
        failed++;
      }
    }

    console.log(`[process] Done: sent=${sent}, failed=${failed}`);

    return NextResponse.json({
      success: true,
      processed: pending.length,
      sent,
      failed,
    });
  } catch (err: any) {
    console.error("[notifications/process] exception:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════
// CONVERT TEXT TO HTML (for email body)
// ═══════════════════════════════════════════════
function convertToHTML(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const html = escaped
    .split("\n")
    .map(
      (line) =>
        `<p style="margin:6px 0;font-family:system-ui,sans-serif;font-size:14px;color:#1e293b;line-height:1.6;">${line || "&nbsp;"}</p>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:24px;background:#f8fafc;">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;padding:32px;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
    ${html}
  </div>
</body>
</html>
  `.trim();
}
