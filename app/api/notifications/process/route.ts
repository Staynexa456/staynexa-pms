// app/api/notifications/process/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ফোন নাম্বার ফরম্যাট করার হেল্পার ফাংশন (Twilio এর জন্য +91 যোগ করা জরুরি)
function formatPhoneNumber(phone: string): string {
  if (!phone) return "";
  let cleaned = phone.replace(/\D/g, ''); // সব অপ্রয়োজনীয় ক্যারেক্টার মুছে ফেলুন
  
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned; // ভারতের জন্য ৯১ যোগ করুন
  }
  
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  
  return `whatsapp:${cleaned}`;
}

export async function POST(req: Request) {
  try {
    const { hotelId } = await req.json();
    if (!hotelId) {
      return NextResponse.json({ error: "hotelId required" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );

    // pending এবং failed (retry_count < 3) উভয়ই ফেচ করবে
    const { data: pending, error } = await supabase
      .from("notification_log")
      .select("*")
      .eq("hotel_id", hotelId)
      .in("status", ["pending", "failed"])
      .lt("retry_count", 3)
      .limit(20);

    if (error) throw error;
    if (!pending || pending.length === 0) {
      return NextResponse.json({ processed: 0, sent: 0, failed: 0 });
    }

    let sent = 0;
    let failed = 0;
    let retried = 0;

    for (const log of pending) {
      if (log.status === "failed") retried++;

      try {
        // ১. EMAIL via Resend
        if (log.channel === "email" && process.env.RESEND_API_KEY) {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: process.env.RESEND_FROM_EMAIL || "Staynexa <onboarding@resend.dev>",
              to: log.recipient,
              subject: log.subject || "Notification",
              text: log.body,
            }),
          });
          if (!res.ok) throw new Error(`Resend: ${await res.text()}`);
          sent++;
        }
        // ২. WHATSAPP via Twilio
        else if (log.channel === "whatsapp" && process.env.TWILIO_ACCOUNT_SID) {
          const sid = process.env.TWILIO_ACCOUNT_SID;
          const token = process.env.TWILIO_AUTH_TOKEN!;
          const from = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
          
          const to = formatPhoneNumber(log.recipient); // ফরম্যাট করা নাম্বার

          const body = new URLSearchParams({ From: from, To: to, Body: log.body || "" });

          const res = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
              },
              body,
            }
          );
          if (!res.ok) throw new Error(`Twilio: ${await res.text()}`);
          sent++;
        }
        // ৩. SMS via Twilio
        else if (log.channel === "sms" && process.env.TWILIO_ACCOUNT_SID) {
          const sid = process.env.TWILIO_ACCOUNT_SID;
          const token = process.env.TWILIO_AUTH_TOKEN!;
          const from = process.env.TWILIO_SMS_FROM || "";

          const body = new URLSearchParams({ From: from, To: log.recipient, Body: log.body || "" });

          const res = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
              },
              body,
            }
          );
          if (!res.ok) throw new Error(`Twilio SMS: ${await res.text()}`);
          sent++;
        }
        // ৪. কোনো প্রোভাইডার না থাকলে কনসোলে লগ করবে
        else {
          console.log(`[Notification:${log.channel}] To: ${log.recipient}`);
          sent++;
        }

        // সফল হলে: status = 'sent' আপডেট হবে
        await supabase
          .from("notification_log")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", log.id);

      } catch (err: any) {
        console.error("[Notification send failed]", err);
        failed++;
        
        // ফেইল হলে: retry_count ১ বাড়বে
        const newRetryCount = (log.retry_count || 0) + 1;
        await supabase
          .from("notification_log")
          .update({ 
            status: "failed", 
            error: String(err?.message || err),
            retry_count: newRetryCount
          })
          .eq("id", log.id);
      }
    }

    return NextResponse.json({ processed: sent + failed, sent, failed, retried });
  } catch (err: any) {
    console.error("[process notifications]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}