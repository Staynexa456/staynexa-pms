// app/api/send-invite/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const RESEND_FROM = process.env.RESEND_FROM_EMAIL || "bookings@staynexa.in";

export async function POST(req: NextRequest) {
  try {
    const { email, name, role, hotelName, inviteUrl } = await req.json();

    if (!email || !inviteUrl) {
      return NextResponse.json({ error: "email and inviteUrl required" }, { status: 400 });
    }

    const resend = new Resend(RESEND_API_KEY);

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:40px 32px;text-align:center;">
      <h1 style="color:white;margin:0;font-size:24px;font-weight:700;">You're Invited! 🎉</h1>
      <p style="color:#94a3b8;margin:8px 0 0;font-size:14px;">Join the ${hotelName} team</p>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 16px;">
        Hi${name ? ` ${name}` : ""},
      </p>
      <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 20px;">
        <strong>${hotelName}</strong> has invited you to join their team as <strong>${role}</strong>.
      </p>

      <div style="background:#f1f5f9;border-radius:12px;padding:20px;margin:20px 0;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:bold;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Your Role</p>
        <p style="margin:0;font-size:16px;font-weight:bold;color:#0f172a;">${role}</p>
      </div>

      <a href="${inviteUrl}" style="display:block;background:#0d9488;color:white;text-align:center;padding:16px;border-radius:12px;text-decoration:none;font-weight:bold;font-size:15px;margin:24px 0;">
        Accept Invitation →
      </a>

      <p style="font-size:12px;color:#64748b;line-height:1.7;margin:16px 0 0;">
        This link expires in <strong>7 days</strong>. If you didn't expect this, you can ignore this email.
      </p>

      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />

      <p style="font-size:11px;color:#94a3b8;text-align:center;margin:0;">
        Or copy this link: <br/>
        <code style="font-size:10px;word-break:break-all;color:#64748b;">${inviteUrl}</code>
      </p>
    </div>
  </div>
</body>
</html>
    `;

    const result = await resend.emails.send({
      from: RESEND_FROM,
      to: email,
      subject: `You're invited to join ${hotelName}`,
      html,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[send-invite]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
