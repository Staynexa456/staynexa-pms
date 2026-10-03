// app/lib/email-service.ts
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
const APP_NAME = "Staynexa PMS";
const APP_URL = "https://www.staynexa.in";

async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY missing — skipping:", subject, "→", to);
    return { success: false, error: "API key missing" };
  }
  try {
    const result = await resend.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to,
      subject,
      html,
    });
    console.log("[Email] Sent:", subject, "→", to);
    return { success: true, id: result.data?.id };
  } catch (err: any) {
    console.error("[Email] Failed:", err);
    return { success: false, error: err.message };
  }
}

function layout(content: string) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;font-family:'Helvetica Neue',Arial,sans-serif;background:#f8fafc;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:30px 24px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">${APP_NAME}</h1>
      <p style="color:#c9a227;margin:4px 0 0;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Hotel Management Platform</p>
    </div>
    <div style="padding:32px 24px;">${content}</div>
    <div style="background:#f1f5f9;padding:20px;text-align:center;font-size:11px;color:#64748b;">
      <p style="margin:0 0 8px;">© 2026 ${APP_NAME} · Built for modern hoteliers</p>
      <p style="margin:0;"><a href="${APP_URL}" style="color:#0d9488;text-decoration:none;">Visit Dashboard</a></p>
    </div>
  </div>
</body>
</html>`;
}

function button(text: string, url: string) {
  return `<a href="${url}" style="display:inline-block;background:#0d9488;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin:8px 0;">${text}</a>`;
}

export const EmailTemplates = {
  paymentSubmitted: (data: { hotelName: string; planName: string; amount: number; utrNumber: string }) => ({
    subject: `⏳ Payment Received — ${data.hotelName}`,
    html: layout(`
      <h2 style="color:#0f172a;margin:0 0 12px;">Hello! 👋</h2>
      <p style="color:#475569;font-size:14px;line-height:1.7;">We received your payment for <strong>${data.hotelName}</strong>. Our team is verifying it now.</p>
      <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:12px;padding:16px;margin:20px 0;">
        <p style="margin:0 0 6px;color:#92400e;font-size:12px;font-weight:700;text-transform:uppercase;">Payment Details</p>
        <p style="margin:4px 0;color:#78350f;font-size:14px;"><strong>Plan:</strong> ${data.planName}</p>
        <p style="margin:4px 0;color:#78350f;font-size:14px;"><strong>Amount:</strong> ₹${data.amount}</p>
        <p style="margin:4px 0;color:#78350f;font-size:14px;"><strong>UTR:</strong> ${data.utrNumber}</p>
      </div>
      <p style="color:#475569;font-size:14px;line-height:1.7;">We'll activate your account shortly (usually within a few hours). You'll receive another email once approved.</p>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px;">— Team Staynexa</p>
    `),
  }),

  subscriptionActivated: (data: { hotelName: string; planName: string; amount: number }) => ({
    subject: `🎉 Subscription Activated — ${data.hotelName}`,
    html: layout(`
      <h2 style="color:#0f172a;margin:0 0 12px;">Welcome aboard! 🎉</h2>
      <p style="color:#475569;font-size:14px;line-height:1.7;">Your subscription for <strong>${data.hotelName}</strong> is now <strong style="color:#059669;">ACTIVE</strong>.</p>
      <div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:12px;padding:16px;margin:20px 0;">
        <p style="margin:0 0 6px;color:#065f46;font-size:12px;font-weight:700;text-transform:uppercase;">Subscription Details</p>
        <p style="margin:4px 0;color:#065f46;font-size:14px;"><strong>Plan:</strong> ${data.planName}</p>
        <p style="margin:4px 0;color:#065f46;font-size:14px;"><strong>Amount Paid:</strong> ₹${data.amount}</p>
      </div>
      <p style="color:#475569;font-size:14px;line-height:1.7;">You can now log in and start managing your hotel.</p>
      <div style="text-align:center;margin:24px 0;">${button("Open Dashboard →", `${APP_URL}/login`)}</div>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px;">— Team Staynexa</p>
    `),
  }),

  addonPurchased: (data: { hotelName: string; addonName: string; amount: number }) => ({
    subject: `✨ Add-on Activated — ${data.addonName}`,
    html: layout(`
      <h2 style="color:#0f172a;margin:0 0 12px;">Great choice! ✨</h2>
      <p style="color:#475569;font-size:14px;line-height:1.7;">The add-on <strong>${data.addonName}</strong> has been activated for <strong>${data.hotelName}</strong>.</p>
      <div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:12px;padding:16px;margin:20px 0;">
        <p style="margin:4px 0;color:#1e40af;font-size:14px;"><strong>Add-on:</strong> ${data.addonName}</p>
        <p style="margin:4px 0;color:#1e40af;font-size:14px;"><strong>Amount:</strong> ₹${data.amount}</p>
      </div>
      <div style="text-align:center;margin:24px 0;">${button("Use It Now →", `${APP_URL}/`)}</div>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px;">— Team Staynexa</p>
    `),
  }),

  newPropertyCreated: (data: { propertyName: string; city?: string }) => ({
    subject: `🏨 New Property Added — ${data.propertyName}`,
    html: layout(`
      <h2 style="color:#0f172a;margin:0 0 12px;">New Property Added 🏨</h2>
      <p style="color:#475569;font-size:14px;line-height:1.7;">Your new property <strong>${data.propertyName}</strong>${data.city ? ` (${data.city})` : ""} has been created successfully.</p>
      <p style="color:#475569;font-size:14px;line-height:1.7;">You can now switch to it from the property dropdown and start adding rooms, rates, and bookings.</p>
      <div style="text-align:center;margin:24px 0;">${button("Open Properties →", `${APP_URL}/properties`)}</div>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px;">— Team Staynexa</p>
    `),
  }),

  adminNewPayment: (data: { hotelName: string; planName: string; amount: number; utrNumber: string }) => ({
    subject: `🔔 New Payment Awaiting Approval — ${data.hotelName}`,
    html: layout(`
      <h2 style="color:#0f172a;margin:0 0 12px;">New Payment to Verify 🔔</h2>
      <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:12px;padding:16px;margin:20px 0;">
        <p style="margin:4px 0;color:#78350f;font-size:14px;"><strong>Hotel:</strong> ${data.hotelName}</p>
        <p style="margin:4px 0;color:#78350f;font-size:14px;"><strong>Plan:</strong> ${data.planName}</p>
        <p style="margin:4px 0;color:#78350f;font-size:14px;"><strong>Amount:</strong> ₹${data.amount}</p>
        <p style="margin:4px 0;color:#78350f;font-size:14px;"><strong>UTR:</strong> ${data.utrNumber}</p>
      </div>
      <p style="color:#475569;font-size:14px;">Verify the UTR with your bank statement and approve.</p>
      <div style="text-align:center;margin:24px 0;">${button("Review Payment →", `${APP_URL}/admin/pending-hotels`)}</div>
    `),
  }),

  invoiceGenerated: (data: {
    hotelName: string;
    invoiceNumber: string;
    amount: number;
    planName: string;
    invoiceDate: string;
    type: "subscription" | "addon";
  }) => ({
    subject: `📄 Invoice #${data.invoiceNumber} — ${data.type === "subscription" ? "Subscription" : "Add-on"}`,
    html: layout(`
      <h2 style="color:#0f172a;margin:0 0 12px;">Invoice Generated 📄</h2>
      <p style="color:#475569;font-size:14px;line-height:1.7;">Dear <strong>${data.hotelName}</strong>,</p>
      <p style="color:#475569;font-size:14px;line-height:1.7;">Your invoice has been generated successfully. Here are the details:</p>
      
      <div style="background:#f0fdfa;border:1px solid #5eead4;border-radius:12px;padding:20px;margin:20px 0;">
        <table style="width:100%;font-size:14px;color:#334155;">
          <tr>
            <td style="padding:6px 0;"><strong>Invoice #:</strong></td>
            <td style="text-align:right;font-family:monospace;">${data.invoiceNumber}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;"><strong>Date:</strong></td>
            <td style="text-align:right;">${data.invoiceDate}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;"><strong>Plan/Add-on:</strong></td>
            <td style="text-align:right;">${data.planName}</td>
          </tr>
          <tr style="border-top:1px solid #cbd5e1;">
            <td style="padding:10px 0 0;"><strong style="font-size:16px;">Amount Paid:</strong></td>
            <td style="text-align:right;padding:10px 0 0;font-size:16px;font-weight:700;color:#0d9488;">₹${data.amount.toLocaleString("en-IN")}</td>
          </tr>
        </table>
      </div>
      
      <p style="color:#475569;font-size:14px;line-height:1.7;">You can download the full PDF invoice anytime from your dashboard:</p>
      
      <div style="text-align:center;margin:24px 0;">
        ${button("📄 View Invoices →", `${APP_URL}/properties/invoices`)}
      </div>
      
      <p style="color:#94a3b8;font-size:12px;margin-top:24px;">— Team Staynexa</p>
    `),
  }),
};

export { sendEmail };
