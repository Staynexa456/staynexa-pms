// app/db.ts

import { supabase } from "./supabase";
import type { Booking, Guest, Payment, BookingStatus } from "./types";

// ═══════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════

export async function signUp(email: string, password: string, fullName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session;
}

// ═══════════════════════════════════════════════════════════
// PASSWORD RESET
// ═══════════════════════════════════════════════════════════

export async function sendPasswordReset(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: "https://https://www.staynexa.in/reset-password,
  });
  if (error) throw error;
  return data;
}

export async function updatePassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
  return data;
}

// ═══════════════════════════════════════════════════════════
// ONBOARDING — Auto-create hotel + rooms for new users
// ═══════════════════════════════════════════════════════════

export async function createHotelForUser(userId: string, hotelName: string) {
  const { data: existing } = await supabase
    .from("hotels")
    .select("id")
    .eq("owner_id", userId)
    .limit(1);

  if (existing && existing.length > 0) return existing[0].id;

  const { data: hotel, error: hotelErr } = await supabase
    .from("hotels")
    .insert({ name: hotelName, owner_id: userId, city: "Not set", state: "Not set" })
    .select()
    .single();

  if (hotelErr || !hotel) throw hotelErr || new Error("Failed to create hotel");

  const defaultRooms = [
    { room_number: "101", room_type: "Standard Room", floor: 1, rate_plan: "EP", base_price: 2500 },
    { room_number: "102", room_type: "Standard Room", floor: 1, rate_plan: "EP", base_price: 2500 },
    { room_number: "201", room_type: "Deluxe Room", floor: 2, rate_plan: "EP", base_price: 3500 },
    { room_number: "202", room_type: "Deluxe Room", floor: 2, rate_plan: "EP", base_price: 3500 },
    { room_number: "301", room_type: "Suite", floor: 3, rate_plan: "EP", base_price: 5000 },
  ];

  const roomsWithHotel = defaultRooms.map((r) => ({
    ...r,
    hotel_id: hotel.id,
    owner_id: userId,
  }));

  const { error: roomErr } = await supabase.from("rooms").insert(roomsWithHotel);
  if (roomErr) console.error("Failed to create rooms:", roomErr);

  return hotel.id;
}

// ═══════════════════════════════════════════════════════════
// HOTEL CONTEXT
// ═══════════════════════════════════════════════════════════

export async function getCurrentHotel() {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data } = await supabase
    .from("hotels")
    .select("*")
    .eq("owner_id", user.id)
    .limit(1)
    .single();
  return data;
}

// ═══════════════════════════════════════════════════════════
// BOOKINGS — filtered by current user
// ═══════════════════════════════════════════════════════════

export async function fetchBookings(): Promise<Booking[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("bookings")
    .select(`
      *,
      rooms (room_number, room_type, rate_plan),
      guests (*),
      payments (*)
    `)
    .eq("owner_id", user.id)
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
  if (error) throw error;
}

export async function addPayment(
  bookingRef: string,
  payment: { amount: number; method: string; reference?: string; note?: string }
): Promise<void> {
  const { data: booking, error: findError } = await supabase
    .from("bookings")
    .select("id")
    .eq("booking_ref", bookingRef)
    .single();

  if (findError || !booking) throw findError || new Error("Booking not found");

  const { error } = await supabase.from("payments").insert({
    booking_id: booking.id,
    amount: payment.amount,
    method: payment.method,
    reference: payment.reference || null,
    note: payment.note || null,
  });
  if (error) throw error;
}

export async function updateBookingNotes(bookingRef: string, notes: string): Promise<void> {
  const { error } = await supabase
    .from("bookings")
    .update({ notes })
    .eq("booking_ref", bookingRef);
  if (error) throw error;
}

export async function updateBookingRoomAndDates(
  bookingRef: string,
  roomNumber: string,
  checkIn: string,
  checkOut: string
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not logged in");

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id")
    .eq("room_number", roomNumber)
    .eq("owner_id", user.id)
    .single();
  if (roomError || !room) throw roomError || new Error("Room not found");

  const { error } = await supabase
    .from("bookings")
    .update({ room_id: room.id, check_in: checkIn, check_out: checkOut })
    .eq("booking_ref", bookingRef);
  if (error) throw error;
}

// ═══════════════════════════════════════════════════════════
// CREATE RESERVATION
// ═══════════════════════════════════════════════════════════

export async function createReservation(params: {
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  ratePlan: string;
  source: string;
  primaryGuest: Guest;
  adults: number;
  children: number;
  infants: number;
  amount: number;
  tax: number;
  notes?: string;
}): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not logged in");

  const { data: hotel } = await supabase
    .from("hotels")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .single();
  if (!hotel) throw new Error("Hotel not found — please refresh the page");

  const { data: guest, error: guestErr } = await supabase
    .from("guests")
    .insert({
      name: params.primaryGuest.name,
      phone: params.primaryGuest.phone,
      email: params.primaryGuest.email,
      address: params.primaryGuest.address,
      city: params.primaryGuest.city,
      state: params.primaryGuest.state,
      pincode: params.primaryGuest.pincode,
      id_type: params.primaryGuest.idType,
      id_number: params.primaryGuest.idNumber,
      owner_id: user.id,
    })
    .select()
    .single();
  if (guestErr || !guest) throw guestErr || new Error("Failed to create guest");

  const { data: room, error: roomErr } = await supabase
    .from("rooms")
    .select("id")
    .eq("room_number", params.roomNumber)
    .eq("owner_id", user.id)
    .single();
  if (roomErr || !room) throw roomErr || new Error("Room not found");

  const bookingRef = `SNBOOKING_${Date.now()}_${Math.floor(Math.random() * 9999)}`;

  const { error: bookErr } = await supabase.from("bookings").insert({
    booking_ref: bookingRef,
    hotel_id: hotel.id,
    room_id: room.id,
    primary_guest_id: guest.id,
    source: params.source,
    check_in: params.checkIn,
    check_out: params.checkOut,
    booking_made_on: new Date().toISOString().slice(0, 10),
    status: "CONFIRMED",
    amount: params.amount,
    tax: params.tax,
    adults: params.adults,
    children: params.children,
    infants: params.infants,
    notes: params.notes || null,
    owner_id: user.id,
  });
  if (bookErr) throw bookErr;

  return bookingRef;
}

export async function blockRoom(params: {
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  reason: string;
}): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not logged in");

  const { data: hotel } = await supabase
    .from("hotels")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .single();
  if (!hotel) throw new Error("Hotel not found");

  const { data: room, error: roomErr } = await supabase
    .from("rooms")
    .select("id")
    .eq("room_number", params.roomNumber)
    .eq("owner_id", user.id)
    .single();
  if (roomErr || !room) throw roomErr || new Error("Room not found");

  const { data: guest, error: guestErr } = await supabase
    .from("guests")
    .insert({
      name: `Blocked — ${params.reason}`,
      phone: "NA",
      email: "",
      address: "",
      city: "",
      state: "",
      pincode: "",
      owner_id: user.id,
    })
    .select()
    .single();
  if (guestErr || !guest) throw guestErr || new Error("Failed to create block guest");

  const bookingRef = `BLK-${Date.now()}-${Math.floor(Math.random() * 999)}`;

  const { error: bookErr } = await supabase.from("bookings").insert({
    booking_ref: bookingRef,
    hotel_id: hotel.id,
    room_id: room.id,
    primary_guest_id: guest.id,
    source: "direct",
    check_in: params.checkIn,
    check_out: params.checkOut,
    booking_made_on: new Date().toISOString().slice(0, 10),
    status: "BLOCKED",
    amount: 0,
    tax: 0,
    adults: 0,
    children: 0,
    infants: 0,
    notes: params.reason,
    owner_id: user.id,
  });
  if (bookErr) throw bookErr;

  return bookingRef;
}
