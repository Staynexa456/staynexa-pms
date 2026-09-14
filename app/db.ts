// app/db.ts
import { supabase } from "./supabase";
import type { Booking, Guest, Payment } from "./types";

export type Room = {
  id: string;
  room_number: string;
  room_type: string;
  base_rate?: number;
  max_occupancy?: number;
  [key: string]: any;
};

// ═══════════════════════════════════════════════════════════
// ROOMS
// ═══════════════════════════════════════════════════════════

export async function fetchRooms(): Promise<Room[]> {
  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .order("room_number", { ascending: true });
  if (error) throw error;
  return data || [];
}

// ═══════════════════════════════════════════════════════════
// BOOKINGS
// ═══════════════════════════════════════════════════════════

export async function fetchBookings(): Promise<Booking[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .order("check_in", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function updateBookingStatus(
  bookingId: string,
  status: string,
  notes?: string
): Promise<void> {
  const update: Record<string, any> = { status };
  if (notes !== undefined) update.notes = notes;

  const { error } = await supabase
    .from("bookings")
    .update(update)
    .eq("id", bookingId);

  if (error) throw error;
}

export async function updateBookingNotes(
  bookingId: string,
  notes: string
): Promise<void> {
  const { error } = await supabase
    .from("bookings")
    .update({ notes })
    .eq("id", bookingId);
  if (error) throw error;
}

export async function updateBookingRoomAndDates(
  bookingId: string,
  roomNumber: string,
  checkIn: string,
  checkOut: string
): Promise<void> {
  const { error } = await supabase
    .from("bookings")
    .update({
      room_number: roomNumber,
      check_in: checkIn,
      check_out: checkOut,
    })
    .eq("id", bookingId);
  if (error) throw error;
}

// ═══════════════════════════════════════════════════════════
// GUESTS
// ═══════════════════════════════════════════════════════════

export async function updateGuest(bookingId: string, guest: Guest): Promise<void> {
  // Step 1: Find the guest_id linked to this booking
  const { data: booking, error: findErr } = await supabase
    .from("bookings")
    .select("primary_guest_id")
    .eq("id", bookingId)
    .single();

  if (findErr) throw findErr;
  if (!booking?.primary_guest_id) throw new Error("No guest linked to this booking");

  // Step 2: Update the guest record
  const { error } = await supabase
    .from("guests")
    .update({
      name: guest.name,
      phone: guest.phone,
      email: guest.email,
      address: guest.address,
      city: guest.city,
      state: guest.state,
      pincode: guest.pincode,
      id_type: guest.idType,
      id_number: guest.idNumber,
    })
    .eq("id", booking.primary_guest_id);

  if (error) throw error;
}

// ═══════════════════════════════════════════════════════════
// PAYMENTS
// ═══════════════════════════════════════════════════════════

export async function addPayment(
  bookingId: string,
  payment: { amount: number; method: string; reference?: string; note?: string }
): Promise<void> {
  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("payments")
    .eq("id", bookingId)
    .single();

  if (fetchError) throw fetchError;

  const existing: Payment[] = booking?.payments || [];
  const newPayment: Payment = {
    id: crypto.randomUUID(),
    amount: payment.amount,
    method: payment.method as Payment["method"],
    date: new Date().toISOString(),
    reference: payment.reference,
    note: payment.note,
  };

  const { error } = await supabase
    .from("bookings")
    .update({ payments: [...existing, newPayment] })
    .eq("id", bookingId);

  if (error) throw error;
}

// ═══════════════════════════════════════════════════════════
// RESERVATIONS
// ═══════════════════════════════════════════════════════════

export async function createReservation(data: {
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
  notes: string;
}): Promise<void> {
  // Step 1: Create the guest
  const { data: guestRow, error: guestErr } = await supabase
    .from("guests")
    .insert({
      name: data.primaryGuest.name,
      phone: data.primaryGuest.phone,
      email: data.primaryGuest.email,
      address: data.primaryGuest.address,
      city: data.primaryGuest.city,
      state: data.primaryGuest.state,
      pincode: data.primaryGuest.pincode,
      id_type: data.primaryGuest.idType,
      id_number: data.primaryGuest.idNumber,
    })
    .select()
    .single();

  if (guestErr) throw guestErr;

  // Step 2: Create the booking
  const { error: bookingErr } = await supabase.from("bookings").insert({
    primary_guest_id: guestRow.id,
    room_number: data.roomNumber,
    check_in: data.checkIn,
    check_out: data.checkOut,
    rate_plan: data.ratePlan,
    source: data.source,
    adults: data.adults,
    children: data.children,
    infants: data.infants,
    amount: data.amount,
    tax: data.tax,
    notes: data.notes,
    status: "CONFIRMED",
    booking_made_on: new Date().toISOString(),
    payments: [],
  });

  if (bookingErr) throw bookingErr;
}

export async function blockRoom(data: {
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  reason: string;
}): Promise<void> {
  const { error } = await supabase.from("bookings").insert({
    primary_guest_id: null,
    room_number: data.roomNumber,
    check_in: data.checkIn,
    check_out: data.checkOut,
    notes: data.reason,
    status: "BLOCKED",
    amount: 0,
    tax: 0,
    adults: 0,
    children: 0,
    infants: 0,
    source: "direct",
    rate_plan: "EP",
    booking_made_on: new Date().toISOString(),
    payments: [],
  });
  if (error) throw error;
}

// ═══════════════════════════════════════════════════════════
// HOLD / RELEASE
// ═══════════════════════════════════════════════════════════

export async function holdBooking(bookingId: string, reason?: string): Promise<void> {
  const { error } = await supabase
    .from("bookings")
    .update({
      status: "ON-HOLD",
      notes: reason ? `On hold: ${reason}` : null,
    })
    .eq("id", bookingId);
  if (error) throw error;
}

export async function releaseHold(bookingId: string): Promise<void> {
  const { error } = await supabase
    .from("bookings")
    .update({ status: "CONFIRMED" })
    .eq("id", bookingId);
  if (error) throw error;
}
// ═══════════════════════════════════════════════════════════
// PASSWORD RESET
// ═══════════════════════════════════════════════════════════

export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}
// ═══════════════════════════════════════════════════════════
// HOTELS (for sidebar property switcher)
// ═══════════════════════════════════════════════════════════

export type Hotel = {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  [key: string]: any;
};

export async function getUserHotels(): Promise<Hotel[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("hotels")
    .select("*")
    .eq("user_id", user.id)
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
}
// ═══════════════════════════════════════════════════════════
// HOTEL CRUD
// ═══════════════════════════════════════════════════════════

export async function createHotel(data: {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  [key: string]: any;
}): Promise<Hotel> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: hotel, error } = await supabase
    .from("hotels")
    .insert({
      user_id: user.id,
      name: data.name,
      address: data.address,
      city: data.city,
      state: data.state,
    })
    .select()
    .single();

  if (error) throw error;
  return hotel;
}

export async function updateHotel(
  hotelId: string,
  data: Partial<Hotel>
): Promise<Hotel> {
  const { data: hotel, error } = await supabase
    .from("hotels")
    .update(data)
    .eq("id", hotelId)
    .select()
    .single();

  if (error) throw error;
  return hotel;
}

export async function deactivateHotel(hotelId: string): Promise<void> {
  const { error } = await supabase
    .from("hotels")
    .update({ active: false })
    .eq("id", hotelId);

  if (error) throw error;
}
// ═══════════════════════════════════════════════════════════
// AUTHENTICATION
// ═══════════════════════════════════════════════════════════

export async function signUp(
  email: string,
  password: string,
  fullName: string
): Promise<{ user: { id: string } | null }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });
  if (error) throw error;
  return { user: data.user ? { id: data.user.id } : null };
}

export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (error) throw error;
}

export async function createHotelForUser(data: {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  [key: string]: any;
}): Promise<Hotel> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: hotel, error } = await supabase
    .from("hotels")
    .insert({
      user_id: user.id,
      name: data.name,
      address: data.address,
      city: data.city,
      state: data.state,
    })
    .select()
    .single();

  if (error) throw error;
  return hotel;
}
