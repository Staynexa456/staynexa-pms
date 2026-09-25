// app/api/notifications/process/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { hotelId } = await req.json();
    if (!hotelId) return NextResponse.json({ error: "hotelId required" }, { status: 400 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );

    const { data: pending, error } = await supabase
      .from("notification_log")
      .select("*")
      .eq("hotel_id", hotelId)
      .in("status", ["pending", "failed"])
      .lt("retry_count", 3)
      .limit(20);

    if (error) throw error;
    if (!pending || pending.length === 0) return NextResponse.json({ processed: 0, sent: 0, failed: 0 });

    let sent = 0; let failed = 0;

    for (const log of pending) {
      try {
        // ১. EMAIL via Resend
        if (log.channel === "email" && process.env.RESEND_API_KEY) {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
            body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL, to: log.recipient, subject: log.subject || "Notification", text: log.body }),
          });
          if (!res.ok) throw new Error(`Resend: ${await res.text()}`);
          sent++;
        }
        
        // ২. WHATSAPP via WAHA
        else if (log.channel === "whatsapp" && process.env.WAHA_BASE_URL) {
          const cleanPhone = log.recipient.replace(/\D/g, ''); 
          // যদি ১০ ডিজিটের হয়, তবে সামনে ৯১ যোগ করা (ভারতের জন্য)
          const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
          const chatId = `${formattedPhone}@c.us`;

          const res = await fetch(`${process.env.WAHA_BASE_URL}/api/sendText`, {
            method: "POST",
            headers: { 
              "Content-Type": "application/json", 
              "X-Api-Key": process.env.WAHA_API_KEY! 
            },
            body: JSON.stringify({ 
              session: "default", 
              chatId: chatId, 
              text: log.body || "" 
            }),
          });
          if (!res.ok) throw new Error(`WAHA: ${await res.text()}`);
          sent++;
        } 
        else { sent++; }

        await supabase.from("notification_log").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", log.id);
      } catch (err: any) {
        failed++;
        const newRetryCount = (log.retry_count || 0) + 1;
        await supabase.from("notification_log").update({ status: "failed", error: String(err?.message || err), retry_count: newRetryCount }).eq("id", log.id);
      }
    }
    return NextResponse.json({ processed: sent + failed, sent, failed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
