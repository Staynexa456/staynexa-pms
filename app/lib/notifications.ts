// app/lib/notifications.ts
import { supabase } from "../supabase";

export type NotificationEvent =
  | "booking_created"
  | "booking_cancelled"
  | "checkin_reminder"
  | "checkout_reminder"
  | "payment_received"
  | "owner_new_booking";

export type NotificationChannel = "email" | "whatsapp" | "sms";

export type NotificationTemplate = {
  id?: string;
  hotel_id: string;
  event_type: NotificationEvent;
  channel: NotificationChannel;
  subject?: string;
  body: string;
  is_active: boolean;
};

export type NotificationLog = {
  id?: string;
  hotel_id: string;
  booking_id?: string;
  event_type: NotificationEvent;
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  body?: string;
  status: "pending" | "sent" | "failed";
  error?: string;
  sent_at?: string;
  created_at?: string;
  metadata?: any;
};

// ═══════════════════════════════════════════════
// EVENT LABELS
// ═══════════════════════════════════════════════
export const EVENT_LABELS: Record<NotificationEvent, { label: string; icon: string; desc: string }> = {
  booking_created: { label: "Booking Confirmation", icon: "✅", desc: "Sent to guest when booking is created" },
  booking_cancelled: { label: "Booking Cancelled", icon: "❌", desc: "Sent when booking is cancelled" },
  checkin_reminder: { label: "Check-in Reminder", icon: "📅", desc: "24 hours before check-in" },
  checkout_reminder: { label: "Check-out Reminder", icon: "🚪", desc: "On departure day" },
  payment_received: { label: "Payment Receipt", icon: "💰", desc: "When payment is recorded" },
  owner_new_booking: { label: "Owner Alert", icon: "🔔", desc: "Notify hotel owner of new booking" },
};

export const CHANNEL_LABELS: Record<NotificationChannel, { label: string; icon: string }> = {
  email: { label: "Email", icon: "📧" },
  whatsapp: { label: "WhatsApp", icon: "💬" },
  sms: { label: "SMS", icon: "📱" },
};

// ═══════════════════════════════════════════════
// DEFAULT TEMPLATES
// ═══════════════════════════════════════════════
export function defaultTemplates(hotelId: string, hotelName: string): Omit<NotificationTemplate, "id">[] {
  return [
    {
      hotel_id: hotelId,
      event_type: "booking_created",
      channel: "email",
      subject: `Booking Confirmed - {{booking_ref}} at ${hotelName}`,
      body: `Dear {{guest_name}},

Your booking has been confirmed! 🎉

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 BOOKING VOUCHER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔖 Reference: {{booking_ref}}
👤 Guest: {{guest_name}}
📞 Phone: {{guest_phone}}

🏨 Rooms ({{rooms_count}}):
{{rooms_summary}}

📅 Check-in: {{check_in}}
📅 Check-out: {{check_out}}
🌙 Nights: {{nights}}
👥 Guests: {{adults}} Adults{{children_text}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 PAYMENT SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Subtotal: ₹{{subtotal}}
{{tax_lines}}

Total Amount: ₹{{total}}
{{payment_summary}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

We look forward to welcoming you at ${hotelName}.

For any queries, contact us at {{hotel_phone}}.

Thank you for choosing us!`,
      is_active: true,
    },
    {
      hotel_id: hotelId,
      event_type: "booking_created",
      channel: "whatsapp",
      body: `🎉 *BOOKING CONFIRMED*

━━━━━━━━━━━━━━━━━
📋 *BOOKING VOUCHER*
━━━━━━━━━━━━━━━━━

👤 *Guest:* {{guest_name}}
🔖 *Ref:* {{booking_ref}}

🏨 *Rooms ({{rooms_count}}):*
{{rooms_summary}}

📅 *Check-in:* {{check_in}}
📅 *Check-out:* {{check_out}}
🌙 *Nights:* {{nights}}

━━━━━━━━━━━━━━━━━
💰 *PAYMENT SUMMARY*
━━━━━━━━━━━━━━━━━

Subtotal: ₹{{subtotal}}
{{tax_lines}}

*Total: ₹{{total}}*
{{payment_summary}}

━━━━━━━━━━━━━━━━━

Thank you for choosing us!
For queries: {{hotel_phone}}`,
      is_active: true,
    },
    {
      hotel_id: hotelId,
      event_type: "owner_new_booking",
      channel: "email",
      subject: `🔔 New Booking: {{guest_name}} - ₹{{total}}`,
      body: `New booking received!

🔖 Ref: {{booking_ref}}
Guest: {{guest_name}}
Phone: {{guest_phone}}
Rooms ({{rooms_count}}):
{{rooms_summary}}
Check-in: {{check_in}}
Check-out: {{check_out}}
Nights: {{nights}}
Total: ₹{{total}}
{{payment_summary}}

Login to your dashboard for details.`,
      is_active: true,
    },
  ];
}

// ═══════════════════════════════════════════════
// RENDER TEMPLATE
// ═══════════════════════════════════════════════
export function renderTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = vars[key];
    return value !== undefined && value !== null ? String(value) : match;
  });
}

// ═══════════════════════════════════════════════
// FETCH TEMPLATES
// ═══════════════════════════════════════════════
export async function fetchTemplates(hotelId: string): Promise<NotificationTemplate[]> {
  if (!hotelId) return [];
  const { data, error } = await supabase
    .from("notification_templates")
    .select("*")
    .eq("hotel_id", hotelId)
    .order("created_at");

  if (error) {
    console.error("[fetchTemplates]", error);
    return [];
  }
  return (data || []) as NotificationTemplate[];
}

// ═══════════════════════════════════════════════
// FETCH LOG
// ═══════════════════════════════════════════════
export async function fetchNotificationLog(hotelId: string, limit = 50): Promise<NotificationLog[]> {
  if (!hotelId) return [];
  const { data, error } = await supabase
    .from("notification_log")
    .select("*")
    .eq("hotel_id", hotelId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[fetchNotificationLog]", error);
    return [];
  }
  return (data || []) as NotificationLog[];
}

// ═══════════════════════════════════════════════
// UPSERT TEMPLATE
// ═══════════════════════════════════════════════
export async function upsertTemplate(
  hotelId: string,
  template: Partial<NotificationTemplate> & { event_type: NotificationEvent; channel: NotificationChannel }
): Promise<void> {
  const payload = {
    ...template,
    hotel_id: hotelId,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("notification_templates")
    .upsert(payload, { onConflict: "hotel_id,event_type,channel" });

  if (error) throw error;
}

// ═══════════════════════════════════════════════
// DELETE TEMPLATE
// ═══════════════════════════════════════════════
export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("notification_templates").delete().eq("id", id);
  if (error) throw error;
}

// ═══════════════════════════════════════════════
// PAYMENT SUMMARY BUILDER
// ═══════════════════════════════════════════════
function buildPaymentSummary(opts: {
  paymentType: "full" | "partial" | "pay_at_property";
  total: number;
  amountPaid: number;
  amountPending: number;
  partialPct: number;
}): string {
  const { paymentType, total, amountPaid, amountPending, partialPct } = opts;
  const fmt = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

  if (paymentType === "full" || amountPending <= 0) {
    return `✅ *Paid in Full:* ${fmt(total)}\nPending: ₹0`;
  }
  if (paymentType === "partial") {
    return `✅ *Advance Paid (${partialPct}%):* ${fmt(amountPaid)}\n⏳ *Pending (at check-in):* ${fmt(amountPending)}`;
  }
  return `💵 *Payment:* Pay at Hotel\n⏳ *Pending:* ${fmt(amountPending)}`;
}

// ═══════════════════════════════════════════════
// TRIGGER NOTIFICATIONS (with voucherData)
// ═══════════════════════════════════════════════
export async function triggerBookingNotifications(payload: {
  hotelId: string;
  bookingId: string;
  bookingRef: string;
  guestName: string;
  guestPhone?: string;
  guestEmail?: string;
  roomType: string;
  roomNumber: string;
  roomsSummary?: string;
  roomsCount?: number;
  checkIn: string;
  checkOut: string;
  nights: number;
  subtotal?: number;
  taxLines?: string;
  total: number;
  hotelName: string;
  hotelPhone?: string;
  hotelEmail?: string;
  hotelAddress?: string;
  adults?: number;
  children?: number;
  paymentType?: "full" | "partial" | "pay_at_property";
  amountPaid?: number;
  amountPending?: number;
  partialPct?: number;
  voucherData?: {
    rooms: Array<{
      roomType: string;
      roomNumber: string;
      adults: number;
      children: number;
      price: number;
    }>;
    taxLines: Array<{ label: string; amount: number }>;
  };
}): Promise<void> {
  try {
    let templates = await fetchTemplates(payload.hotelId);

    if (templates.length === 0) {
      const defaults = defaultTemplates(payload.hotelId, payload.hotelName);
      await supabase.from("notification_templates").insert(defaults);
      templates = await fetchTemplates(payload.hotelId);
    }

    const paymentType = payload.paymentType || "full";
    const amountPaid = payload.amountPaid ?? 0;
    const amountPending = payload.amountPending ?? 0;
    const partialPct = payload.partialPct ?? 50;

    const paymentSummary = buildPaymentSummary({
      paymentType,
      total: payload.total,
      amountPaid,
      amountPending,
      partialPct,
    });

    const childrenText =
      payload.children && payload.children > 0
        ? `, ${payload.children} Child${payload.children > 1 ? "ren" : ""}`
        : "";

    const roomsSummaryText =
      payload.roomsSummary || `${payload.roomType} (Room ${payload.roomNumber})`;
    const roomsCount = payload.roomsCount || 1;

    const vars = {
      guest_name: payload.guestName,
      guest_phone: payload.guestPhone || "",
      guest_email: payload.guestEmail || "",
      booking_ref: payload.bookingRef,
      room_type: payload.roomType,
      room_number: payload.roomNumber,
      rooms_summary: roomsSummaryText,
      rooms_count: roomsCount,
      check_in: payload.checkIn,
      check_out: payload.checkOut,
      nights: payload.nights,
      subtotal: Math.round(payload.subtotal || 0).toLocaleString("en-IN"),
      tax_lines: payload.taxLines || "",
      total: Math.round(payload.total).toLocaleString("en-IN"),
      hotel_name: payload.hotelName,
      hotel_phone: payload.hotelPhone || "",
      adults: payload.adults || 2,
      children: payload.children || 0,
      children_text: childrenText,
      payment_summary: paymentSummary,
      amount_paid: Math.round(amountPaid).toLocaleString("en-IN"),
      amount_pending: Math.round(amountPending).toLocaleString("en-IN"),
    };

    const voucherMetadata = {
      voucherData: {
        hotelName: payload.hotelName,
        hotelPhone: payload.hotelPhone,
        hotelEmail: payload.hotelEmail,
        hotelAddress: payload.hotelAddress,
        bookingRef: payload.bookingRef,
        guestName: payload.guestName,
        guestPhone: payload.guestPhone || "",
        guestEmail: payload.guestEmail,
        rooms: payload.voucherData?.rooms || [
          {
            roomType: payload.roomType,
            roomNumber: payload.roomNumber,
            adults: payload.adults || 2,
            children: payload.children || 0,
            price: payload.subtotal || payload.total,
          },
        ],
        checkIn: payload.checkIn,
        checkOut: payload.checkOut,
        nights: payload.nights,
        subtotal: payload.subtotal || payload.total,
        taxLines: payload.voucherData?.taxLines || [],
        total: payload.total,
        paymentStatus:
          paymentType === "full"
            ? "paid"
            : paymentType === "partial"
            ? "partial"
            : "pending",
        amountPaid,
        amountPending,
      },
      attachPdf: true,
    };

    const logsToCreate: any[] = [];

    for (const tpl of templates.filter(
      (t) => t.event_type === "booking_created" && t.is_active
    )) {
      if (tpl.channel === "email" && payload.guestEmail) {
        logsToCreate.push({
          hotel_id: payload.hotelId,
          booking_id: payload.bookingId,
          event_type: tpl.event_type,
          channel: "email",
          recipient: payload.guestEmail,
          subject: tpl.subject ? renderTemplate(tpl.subject, vars) : undefined,
          body: renderTemplate(tpl.body, vars),
          status: "pending",
          metadata: voucherMetadata,
        });
      } else if (tpl.channel === "whatsapp" && payload.guestPhone) {
        logsToCreate.push({
          hotel_id: payload.hotelId,
          booking_id: payload.bookingId,
          event_type: tpl.event_type,
          channel: "whatsapp",
          recipient: payload.guestPhone,
          body: renderTemplate(tpl.body, vars),
          status: "pending",
          metadata: { attachPdf: false },
        });
      }
    }

    if (logsToCreate.length === 0) return;

    const { error } = await supabase.from("notification_log").insert(logsToCreate);
    if (error) console.error("[triggerBookingNotifications] insert failed:", error);

    try {
      await fetch("/api/notifications/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hotelId: payload.hotelId }),
      });
    } catch (err) {
      console.error("[triggerBookingNotifications] process API failed:", err);
    }
  } catch (err) {
    console.error("[triggerBookingNotifications] exception:", err);
  }
}
