// app/lib/notifications.ts
import { supabase } from "../supabase";

export type NotificationEvent = "booking_created" | "booking_cancelled" | "checkin_reminder" | "checkout_reminder" | "payment_received" | "owner_new_booking";
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

export function renderTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = vars[key];
    return value !== undefined && value !== null ? String(value) : match;
  });
}

export async function fetchTemplates(hotelId: string): Promise<NotificationTemplate[]> {
  if (!hotelId) return [];
  const { data, error } = await supabase.from("notification_templates").select("*").eq("hotel_id", hotelId).order("created_at");
  if (error) { console.error("[fetchTemplates]", error); return []; }
  return (data || []) as NotificationTemplate[];
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
      booking_ref: payload.bookingRef, // 👈 PK
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
        logsToCreate.push({ hotel_id: payload.hotelId, booking_id: payload.bookingId, event_type: tpl.event_type, channel: "email", recipient: payload.guestEmail, subject: tpl.subject ? renderTemplate(tpl.subject, vars) : undefined, body: renderTemplate(tpl.body, vars), status: "pending" });
      } else if (tpl.channel === "whatsapp" && payload.guestPhone) {
        logsToCreate.push({ hotel_id: payload.hotelId, booking_id: payload.bookingId, event_type: tpl.event_type, channel: "whatsapp", recipient: payload.guestPhone, body: renderTemplate(tpl.body, vars), status: "pending" });
      } else if (tpl.channel === "sms" && payload.guestPhone) {
        logsToCreate.push({ hotel_id: payload.hotelId, booking_id: payload.bookingId, event_type: tpl.event_type, channel: "sms", recipient: payload.guestPhone, body: renderTemplate(tpl.body, vars), status: "pending" });
      }
    }

    if (logsToCreate.length === 0) return;

    const { error } = await supabase.from("notification_log").insert(logsToCreate);
    if (error) console.error("[triggerBookingNotifications] insert failed:", error);

    try {
      await fetch("/api/notifications/process", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hotelId: payload.hotelId }) });
    } catch (err) {
      console.error("[triggerBookingNotifications] process API failed:", err);
    }
  } catch (err) {
    console.error("[triggerBookingNotifications] exception:", err);
  }
}
