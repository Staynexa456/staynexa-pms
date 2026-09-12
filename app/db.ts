// app/db.ts

import { supabase } from "./supabase";
import type { Booking, Guest, Payment, BookingStatus } from "./types";

// ═══════════════════════════════════════════════════════════
// FETCH ALL BOOKINGS (with joined room + guest + payments)
// ═══════════════════════════════════════════════════════════
export async function fetchBookings(): Promise<Booking[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select(`
      *,
      rooms (room_number, room_type, rate_plan),
      guests (*),
      payments (*)
    `)
    .order("check_in", { ascending: true });

  if (error) {
    console.error("fetchBookings error:", error);
    throw error;
  }

  return (data || []).map((row: Record<string, unknown>) => {
    const rooms = row.rooms as { room_number?: string; room_type?: string; rate_plan?: string } | null;
    const guestRow = row.guests as Record<string, unknown> | null;
    const payments = (row.payments as Array<Record<string, unknown>>) || [];

    const primaryGuest: Guest = {
      name: (guestRow?.name as string) || "Unknown",
      phone: (guestRow?.phone as string) || "",
      email: (guestRow?.email as string) || "",
      address: (guestRow?.address as string) || "",
      city: (guestRow?.city as string) || "",
      state: (guestRow?.state as string) || "",
      pincode: (guestRow?.pincode as string) || "",
      idType: guestRow?.id_type as Guest["idType"],
      idNumber: (guestRow?.id_number as string) || "",
    };

    return {
      id: row.booking_ref as string,
      otaId: (row.ota_id as string) || undefined,
      otaPin: (row.ota_pin as string) || undefined,
      primaryGuest,
      additionalGuests: [],
      source: row.source as Booking["source"],
      roomNumber: rooms?.room_number || "—",
      roomType: rooms?.room_type || "—",
      ratePlan: rooms?.rate_plan || "EP",
      checkIn: row.check_in as string,
      checkOut: row.check_out as string,
      bookingMadeOn: row.booking_made_on as string,
      status: row.status as BookingStatus,
      amount: Number(row.amount) || 0,
      tax: Number(row.tax) || 0,
      payments: payments.map((p) => ({
        id: p.id as string,
        amount: Number(p.amount),
        method: p.method as Payment["method"],
        date: p.paid_at ? (p.paid_at as string).slice(0, 10) : "",
        reference: (p.reference as string) || undefined,
        note: (p.note as string) || undefined,
      })),
      adults: Number(row.adults) || 0,
      children: Number(row.children) || 0,
      infants: Number(row.infants) || 0,
      notes: (row.notes as string) || "",
    };
  });
}

// ═══════════════════════════════════════════════════════════
// UPDATE BOOKING STATUS (check-in / check-out / cancel)
// ═══════════════════════════════════════════════════════════
export async function updateBookingStatus(
  bookingRef: string,
  status: BookingStatus,
  notes?: string
): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (notes !== undefined) patch.notes = notes;

  const { error } = await supabase
    .from("bookings")
    .update(patch)
    .eq("booking_ref", bookingRef);

  if (error) {
    console.error("updateBookingStatus error:", error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════
// ADD PAYMENT
// ═══════════════════════════════════════════════════════════
export async function addPayment(
  bookingRef: string,
  payment: { amount: number; method: string; reference?: string; note?: string }
): Promise<void> {
  const { data: booking, error: findError } = await supabase
    .from("bookings")
    .select("id")
    .eq("booking_ref", bookingRef)
    .single();

  if (findError || !booking) {
    console.error("addPayment find booking error:", findError);
    throw findError || new Error("Booking not found");
  }

  const { error } = await supabase.from("payments").insert({
    booking_id: booking.id,
    amount: payment.amount,
    method: payment.method,
    reference: payment.reference || null,
    note: payment.note || null,
  });

  if (error) {
    console.error("addPayment insert error:", error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════
// UPDATE NOTES
// ═══════════════════════════════════════════════════════════
export async function updateBookingNotes(
  bookingRef: string,
  notes: string
): Promise<void> {
  const { error } = await supabase
    .from("bookings")
    .update({ notes })
    .eq("booking_ref", bookingRef);

  if (error) {
    console.error("updateBookingNotes error:", error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════
// UPDATE ROOM / DATES (drag-drop move)
// ═══════════════════════════════════════════════════════════
export async function updateBookingRoomAndDates(
  bookingRef: string,
  roomNumber: string,
  checkIn: string,
  checkOut: string
): Promise<void> {
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id")
    .eq("room_number", roomNumber)
    .single();

  if (roomError || !room) {
    console.error("room lookup error:", roomError);
    throw roomError || new Error("Room not found");
  }

  const { error } = await supabase
    .from("bookings")
    .update({
      room_id: room.id,
      check_in: checkIn,
      check_out: checkOut,
    })
    .eq("booking_ref", bookingRef);

  if (error) {
    console.error("updateBookingRoomAndDates error:", error);
    throw error;
  }
}
