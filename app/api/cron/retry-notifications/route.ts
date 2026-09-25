// app/api/cron/retry-notifications/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  // ১. সিকিউরিটি চেক (যাতে বাইরের কেউ এই API হিট করতে না পারে)
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

    // ২. সব হোটেলের pending এবং failed (retry_count < 3) নোটিফিকেশন খুঁজুন
    const { data: pending, error } = await supabase
      .from("notification_log")
      .select("*")
      .in("status", ["pending", "failed"])
      .lt("retry_count", 3)
      .order("created_at", { ascending: true })
      .limit(50); // একবারে সর্বোচ্চ ৫০টি মেসেজ প্রসেস করবে

    if (error) throw error;
    if (!pending || pending.length === 0) {
      return NextResponse.json({ message: "No pending notifications to process", processed: 0 });
    }

    let sent = 0;
    let failed = 0;

    // ৩. মেসেজ পাঠানোর লজিক (আপনার আগের কোডের মতোই)
    for (const log of pending) {
      try {
        // EMAIL via Resend
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
        // WHATSAPP via Twilio
        else if (log.channel === "whatsapp" && process.env.TWILIO_ACCOUNT_SID) {
          const sid = process.env.TWILIO_ACCOUNT_SID;
          const token = process.env.TWILIO_AUTH_TOKEN!;
          const from = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
          const to = log.recipient.startsWith("whatsapp:") ? log.recipient : `whatsapp:${log.recipient}`;

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
        // SMS via Twilio
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

        // সফল হলে: status = 'sent' আপডেট হবে
        await supabase
          .from("notification_log")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", log.id);

      } catch (err: any) {
        console.error("[Cron Notification send failed]", err);
        failed++;
        
        // ফেইল হলে retry_count ১ বাড়বে
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