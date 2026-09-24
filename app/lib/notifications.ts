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
};

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

export function defaultTemplates(hotelId: string, hotelName: string): Omit<NotificationTemplate, "id">[] {
  return [
    {
      hotel_id: hotelId,
      event_type: "booking_created",
      channel: "email",
      subject: `Booking Confirmed at ${hotelName}`,
      body: `Dear {{guest_name}},

Your booking has been confirmed! 🎉

Booking Reference: {{booking_ref}}
Room: {{room_type}} (Room {{room_number}})
Check-in: {{check_in}}
Check-out: {{check_out}}
Nights: {{nights}}
Total: ₹{{total}}

We look forward to welcoming you at ${hotelName}.

For any queries, contact us at {{hotel_phone}}.

Thank you for choosing us!`,
      is_active: true,
    },
    {
      hotel_id: hotelId,
      event_type: "booking_created",
      channel: "whatsapp",
      body: `🎉 *Booking Confirmed!*

Hi {{guest_name}}, your booking is confirmed.

*Ref:* {{booking_ref}}
*Room:* {{room_type}}
*Check-in:* {{check_in}}
*Check-out:* {{check_out}}
*Total:* ₹{{total}}

Reply STOP to unsubscribe.`,
      is_active: true,
    },
    {
      hotel_id: hotelId,
      event_type: "owner_new_booking",
      channel: "email",
      subject: `🔔 New Booking: {{guest_name}}`,
      body: `New booking received!

Guest: {{guest_name}}
Phone: {{guest_phone}}
Room: {{room_type}} ({{room_number}})
Check-in: {{check_in}}
Check-out: {{check_out}}
Total: ₹{{total}}

Login to your dashboard for details.`,
      is_active: true,
    },
  ];
}

export function renderTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = vars[key];
    return value !== undefined && value !== null ? String(value) : match;
  });
}

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

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("notification_templates").delete().eq("id", id);
  if (error) throw error;
}

export async function triggerBookingNotifications(payload: {
  hotelId: string;
  bookingId: string;
  bookingRef: string;
  guestName: string;
  guestPhone?: string;
  guestEmail?: string;
  roomType: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  total: number;
  hotelName: string;
  hotelPhone?: string;
}): Promise<void> {
  try {
    const templates = await fetchTemplates(payload.hotelId);
    const vars = {
      guest_name: payload.guestName,
      guest_phone: payload.guestPhone || "",
      guest_email: payload.guestEmail || "",
      booking_ref: payload.bookingRef,
      room_type: payload.roomType,
      room_number: payload.roomNumber,
      check_in: payload.checkIn,
      check_out: payload.checkOut,
      nights: payload.nights,
      total: payload.total.toLocaleString("en-IN"),
      hotel_name: payload.hotelName,
      hotel_phone: payload.hotelPhone || "",
    };

    const logsToCreate: Omit<NotificationLog, "id" | "created_at">[] = [];

    for (const tpl of templates.filter((t) => t.event_type === "booking_created" && t.is_active)) {
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
        });
      } else if (tpl.channel === "sms" && payload.guestPhone) {
        logsToCreate.push({
          hotel_id: payload.hotelId,
          booking_id: payload.bookingId,
          event_type: tpl.event_type,
          channel: "sms",
          recipient: payload.guestPhone,
          body: renderTemplate(tpl.body, vars),
          status: "pending",
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