// app/api/cron/retry-notifications/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ফোন নাম্বার ফরম্যাট করার হেল্পার ফাংশন
function formatPhoneNumber(phone: string): string {
  if (!phone) return "";
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  return `whatsapp:${cleaned}`;
}

export async function GET(req: Request) {
  // ১. সিকিউরিটি চেক
  const authHeader = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );

    // ২. সব হোটেলের pending এবং failed নোটিফিকেশন খুঁজুন
    const { data: pending, error } = await supabase
      .from("notification_log")
      .select("*")
      .in("status", ["pending", "failed"])
      .lt("retry_count", 3)
      .order("created_at", { ascending: true })
      .limit(50);

    if (error) throw error;
    if (!pending || pending.length === 0) {
      return NextResponse.json({ message: "No pending notifications", processed: 0 });
    }

    let sent = 0;
    let failed = 0;

    for (const log of pending) {
      try {
        // ইমেইল
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
        // হোয়াটসঅ্যাপ
        else if (log.channel === "whatsapp" && process.env.TWILIO_ACCOUNT_SID) {
          const sid = process.env.TWILIO_ACCOUNT_SID;
          const token = process.env.TWILIO_AUTH_TOKEN!;
          const from = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
          const to = formatPhoneNumber(log.recipient);

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
        // এসএমএস
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

        // সফল হলে আপডেট
        await supabase
          .from("notification_log")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", log.id);

      } catch (err: any) {
        console.error("[Cron Notification failed]", err);
        failed++;
        
        // ফেইল হলে retry_count বাড়ান
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

    return NextResponse.json({ processed: sent + failed, sent, failed });
  } catch (err: any) {
    console.error("[Cron process notifications]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}