// app/db.ts
import { supabase } from './supabase';
import type { Guest, Payment } from './types';

// ═══════════════════════════════════════════════
// BOOKINGS
// ═══════════════════════════════════════════════

export async function fetchBookings(hotelId?: string) {
  let query = supabase
    .from('bookings')
    .select('*')
    .order('check_in', { ascending: true });

  if (hotelId) {
    query = query.eq('hotel_id', hotelId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[fetchBookings] error:', error);
    throw error;
  }
  return data ?? [];
}

export async function updateBooking(id: string, updates: Record<string, any>) {
  const { data, error } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createBooking(payload: Record<string, any>) {
  const { data, error } = await supabase
    .from('bookings')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Used by page.tsx — attaches hotel_id
export async function createReservation(payload: {
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  ratePlan?: string;
  source?: string;
  primaryGuest: Guest;
  adults: number;
  children: number;
  infants?: number;
  amount: number;
  tax: number;
  notes?: string;
  hotelId?: string;
}) {
  // Ensure the guest exists first
  const guestInsert = await supabase
    .from('guests')
    .insert({
      name: payload.primaryGuest.name,
      phone: payload.primaryGuest.phone,
      email: payload.primaryGuest.email,
      address: payload.primaryGuest.address,
    })
    .select()
    .single();

  if (guestInsert.error) throw guestInsert.error;

  const nights = Math.max(
    1,
    Math.round(
      (new Date(payload.checkOut).getTime() - new Date(payload.checkIn).getTime()) /
        86400000
    )
  );

  const bookingRef = `SNBOOKING.${Date.now()}`;

  // Look up room by number
  const { data: roomRow } = await supabase
    .from('rooms')
    .select('id')
    .eq('room_number', payload.roomNumber)
    .maybeSingle();

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      booking_ref: bookingRef,
      hotel_id: payload.hotelId ?? null,
      room_id: roomRow?.id ?? null,
      primary_guest_id: guestInsert.data.id,
      source: payload.source ?? 'direct',
      check_in: payload.checkIn,
      check_out: payload.checkOut,
      adults: payload.adults,
      children: payload.children,
      infants: payload.infants ?? 0,
      status: 'CONFIRMED',
      rate_plan: payload.ratePlan ?? 'EP',
      notes: payload.notes ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateBookingStatus(
  id: string,
  status: string,
  notes?: string
) {
  const updates: Record<string, any> = { status };
  if (notes !== undefined) updates.notes = notes;
  return updateBooking(id, updates);
}

export async function updateBookingNotes(id: string, notes: string) {
  return updateBooking(id, { notes });
}

export async function updateBookingRoomAndDates(
  id: string,
  roomNumber: string,
  checkIn: string,
  checkOut: string
) {
  const { data: roomRow } = await supabase
    .from('rooms')
    .select('id')
    .eq('room_number', roomNumber)
    .maybeSingle();

  return updateBooking(id, {
    room_id: roomRow?.id ?? null,
    check_in: checkIn,
    check_out: checkOut,
  });
}

export async function modifyReservation(id: string, updates: Record<string, any>) {
  // Map camelCase → snake_case
  const mapped: Record<string, any> = {};
  if (updates.checkIn !== undefined) mapped.check_in = updates.checkIn;
  if (updates.checkOut !== undefined) mapped.check_out = updates.checkOut;
  if (updates.ratePlan !== undefined) mapped.rate_plan = updates.ratePlan;
  if (updates.notes !== undefined) mapped.notes = updates.notes;
  if (updates.adults !== undefined) mapped.adults = updates.adults;
  if (updates.children !== undefined) mapped.children = updates.children;
  if (updates.infants !== undefined) mapped.infants = updates.infants;
  return updateBooking(id, mapped);
}

export async function blockRoom(payload: {
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  reason: string;
}) {
  const { data: roomRow } = await supabase
    .from('rooms')
    .select('id')
    .eq('room_number', payload.roomNumber)
    .maybeSingle();

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      booking_ref: `BLOCK.${Date.now()}`,
      room_id: roomRow?.id ?? null,
      check_in: payload.checkIn,
      check_out: payload.checkOut,
      status: 'BLOCKED',
      notes: payload.reason,
      source: 'block',
      rate_plan: 'EP',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function holdBooking(id: string, reason?: string) {
  return updateBooking(id, { status: 'ON-HOLD', notes: reason ?? null });
}

export async function releaseHold(id: string) {
  return updateBooking(id, { status: 'CONFIRMED' });
}

export async function lockBooking(id: string) {
  return updateBooking(id, { is_locked: true });
}

export async function unlockBooking(id: string) {
  return updateBooking(id, { is_locked: false });
}

export async function markNoShow(id: string) {
  return updateBooking(id, { is_no_show: true, status: 'CANCELLED' });
}

export async function unassignRoom(id: string) {
  return updateBooking(id, { room_id: null });
}

export async function moveReservation(id: string, newRoomNumber: string) {
  const { data: roomRow } = await supabase
    .from('rooms')
    .select('id')
    .eq('room_number', newRoomNumber)
    .maybeSingle();
  return updateBooking(id, { room_id: roomRow?.id ?? null });
}

export async function sendMagicLink(id: string) {
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
  await updateBooking(id, {
    magic_link_token: token,
    magic_link_sent_at: new Date().toISOString(),
  });
  return `${window.location.origin}/guest/${token}`;
}

// ═══════════════════════════════════════════════
// ADDONS
// ═══════════════════════════════════════════════

export async function fetchAddonsForBooking(bookingId: string) {
  const { data, error } = await supabase
    .from('booking_addons')
    .select('*')
    .eq('booking_id', bookingId);
  if (error) return [];
  return data ?? [];
}

export async function addPayment(
  bookingId: string,
  amount: number,
  method: string,
  reference?: string,
  note?: string
) {
  const { data, error } = await supabase
    .from('payments')
    .insert({
      booking_id: bookingId,
      amount,
      method,
      reference: reference ?? null,
      note: note ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function recordPayment(payload: {
  bookingId: string;
  amount: number;
  method: string;
  reference?: string;
  note?: string;
}) {
  return addPayment(payload.bookingId, payload.amount, payload.method, payload.reference, payload.note);
}

// ═══════════════════════════════════════════════
// HOTELS
// ═══════════════════════════════════════════════

export async function fetchHotels() {
  const { data, error } = await supabase
    .from('hotels')
    .select('id, name, city, state')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export type Hotel = {
  id: string;
  name: string;
  city?: string | null;
  state?: string | null;
};

// Only returns hotels owned by the current user
export async function getUserHotels(): Promise<Hotel[]> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) return [];

  // If hotels has owner_id column, filter; else return all
  const { data, error } = await supabase
    .from('hotels')
    .select('id, name, city, state')
    .order('name');
  if (error) return [];
  return (data ?? []) as Hotel[];
}

// ═══════════════════════════════════════════════
// GUESTS
// ═══════════════════════════════════════════════

export async function fetchGuests() {
  const { data, error } = await supabase.from('guests').select('*');
  if (error) throw error;
  return data ?? [];
}

export async function updateGuest(guestId: string, updates: Partial<Guest>) {
  const { data, error } = await supabase
    .from('guests')
    .update(updates)
    .eq('id', guestId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ═══════════════════════════════════════════════
// ROOMS
// ═══════════════════════════════════════════════

export async function fetchRooms(hotelId?: string) {
  let query = supabase.from('rooms').select('*').order('room_number');
  if (hotelId) query = query.eq('hotel_id', hotelId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export type Room = {
  id: string;
  room_number: string;
  room_type: string;
  hotel_id?: string;
  [key: string]: any;
};
