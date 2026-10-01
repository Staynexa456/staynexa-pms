// app/api/emails/send/route.ts
import { NextResponse } from "next/server";
import { sendEmail, EmailTemplates } from "../../../lib/email-service";

export async function POST(req: Request) {
  try {
    const { type, to, data } = await req.json();
    if (!to || !type || !data) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    let template: { subject: string; html: string } | null = null;

    switch (type) {
      case "paymentSubmitted":
        template = EmailTemplates.paymentSubmitted(data);
        break;
      case "subscriptionActivated":
        template = EmailTemplates.subscriptionActivated(data);
        break;
      case "addonPurchased":
        template = EmailTemplates.addonPurchased(data);
        break;
      case "newPropertyCreated":
        template = EmailTemplates.newPropertyCreated(data);
        break;
      case "adminNewPayment":
        template = EmailTemplates.adminNewPayment(data);
        break;
      default:
        return NextResponse.json({ error: "Unknown template" }, { status: 400 });
    }

    const result = await sendEmail({ to, subject: template.subject, html: template.html });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
