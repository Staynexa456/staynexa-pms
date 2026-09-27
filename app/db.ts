// app/db.ts
import { supabase } from './supabase';
import type { Guest } from './types';

const cache = new Map<string, { data: any; expires: number }>();
function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expires > now) return Promise.resolve(hit.data as T);
  return fn().then((data) => { cache.set(key, { data, expires: now + ttlMs }); return data; });
}
export function invalidateCache(prefix?: string) {
  if (!prefix) { cache.clear(); return; }
  for (const k of Array.from(cache.keys())) { if (k.startsWith(prefix)) cache.delete(k); }
}

export async function fetchBookings(hotelId?: string) {
  const key = `bookings:${hotelId ?? 'all'}`;
  return cached(key, 10_000, async () => {
    let query = supabase.from('bookings').select(`
        *, room:rooms!room_id (id, room_number, room_type, hotel_id, base_price),
        guest:guests!primary_guest_id (*), hotel:hotels!hotel_id (id, name, address, city, state, phone, email, gst_number)
      `).order('check_in', { ascending: true });
    if (hotelId) query = query.eq('hotel_id', hotelId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((b: any) => ({
      ...b, roomNumber: b.room?.room_number ?? null, roomType: b.room?.room_type ?? null, roomBasePrice: b.room?.base_price ?? null,
      primaryGuest: b.guest ?? { name: 'Guest', phone: '', email: '' }, hotelName: b.hotel?.name ?? null, checkIn: b.check_in, checkOut: b.check_out,
    }));
  });
}

export async function updateBooking(id: string, updates: Record<string, any>) {
  const { data, error } = await supabase.from('bookings').update(updates).eq('id', id).select().maybeSingle();
  if (error) throw error;
  invalidateCache('bookings:'); invalidateCache('stats:'); invalidateCache('kpi:');
  return data;
}

export async function updateBookingStatus(id: string, status: string, notes?: string) { return updateBooking(id, { status, ...(notes !== undefined && { notes }) }); }
export async function updateBookingNotes(id: string, notes: string) { return updateBooking(id, { notes }); }
export async function updateBookingRoomAndDates(id: string, roomNumber: string, checkIn: string, checkOut: string, hotelId?: string) {
  let roomQuery = supabase.from('rooms').select('id').eq('room_number', roomNumber);
  if (hotelId) roomQuery = roomQuery.eq('hotel_id', hotelId);
  const { data: roomRow } = await roomQuery.maybeSingle();
  return updateBooking(id, { room_id: roomRow?.id ?? null, check_in: checkIn, check_out: checkOut });
}
export async function modifyReservation(id: string, updates: Record<string, any>) { return updateBooking(id, updates); }

// ═══════════════════════════════════════════════
// CREATE RESERVATION (Auto Room Assignment)
// ═══════════════════════════════════════════════
export async function createReservation(payload: {
  roomType: string; checkIn: string; checkOut: string; ratePlan?: string; source?: string;
  primaryGuest: Guest; adults: number; children: number; infants?: number;
  amount: number; tax: number; discount?: number; promoCode?: string; notes?: string; hotelId?: string;
  selectedAddons?: Array<{ id: string; name: string; price: number }>;
}) {
  if (!payload.hotelId || !payload.roomType) throw new Error('hotelId and roomType required');

  const guestInsert = await supabase.from('guests').insert({
    name: payload.primaryGuest.name, phone: payload.primaryGuest.phone, email: payload.primaryGuest.email,
  }).select().single();
  if (guestInsert.error) throw guestInsert.error;

  const { data: roomsOfType } = await supabase.from('rooms').select('id, room_number').eq('hotel_id', payload.hotelId).eq('room_type', payload.roomType);
  if (!roomsOfType || roomsOfType.length === 0) throw new Error(`${payload.roomType} ক্যাটাগরিতে কোনো রুম নেই।`);

  const { data: conflicts } = await supabase.from('bookings').select('room_id').eq('hotel_id', payload.hotelId)
    .in('status', ['CONFIRMED', 'CHECKED-IN', 'PENDING DEPARTURE', 'BLOCKED'])
    .lt('check_in', payload.checkOut).gt('check_out', payload.checkIn);

  const bookedRoomIds = new Set((conflicts || []).map((b: any) => b.room_id).filter(Boolean));
  const freeRoom = roomsOfType.find(r => !bookedRoomIds.has(r.id));
  if (!freeRoom) throw new Error(`${payload.roomType} এই তারিখে সম্পূর্ণ বুকড।`);

  const bookingRef = `SNB-${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth() + 1).padStart(2, "0")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const { data, error } = await supabase.from('bookings').insert({
    booking_ref: bookingRef, hotel_id: payload.hotelId, room_id: freeRoom.id, primary_guest_id: guestInsert.data.id,
    source: payload.source ?? 'bookingengine', check_in: payload.checkIn, check_out: payload.checkOut,
    adults: payload.adults, children: payload.children, infants: payload.infants ?? 0, status: 'CONFIRMED',
    rate_plan: payload.ratePlan ?? 'EP', notes: payload.notes ?? null, amount: payload.amount, tax: payload.tax,
    discount: payload.discount ?? 0, promo_code: payload.promoCode ?? null, paid: 0,
  }).select().single();

  if (error) throw error;

  if (payload.selectedAddons && payload.selectedAddons.length > 0) {
    await supabase.from('booking_addons').insert(payload.selectedAddons.map(a => ({
      booking_id: data.id, addon_id: a.id, name: a.name, price: a.price, quantity: 1,
    })));
  }
  invalidateCache('bookings:'); invalidateCache('stats:'); invalidateCache('kpi:');
  return data;
}

// ═══════════════════════════════════════════════
// OTHER FUNCTIONS (Must include to prevent export errors)
// ═══════════════════════════════════════════════
export async function fetchRooms(hotelId?: string) {
  const key = `rooms:${hotelId ?? 'all'}`;
  return cached(key, 60_000, async () => {
    let query = supabase.from('rooms').select('*').order('room_number');
    if (hotelId) query = query.eq('hotel_id', hotelId);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  });
}

export async function fetchGuests() {
  const { data, error } = await supabase.from('guests').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function updateGuest(id: string, updates: any) {
  const { error } = await supabase.from("guests").update(updates).eq("id", id);
  if (error) throw error;
  invalidateCache('guests:'); invalidateCache('bookings:');
}

export async function fetchHotels() {
  const { data, error } = await supabase.from('hotels').select('*').order('name');
  if (error) throw error;
  return data ?? [];
}

export async function createHotelForUser(firstArg: any, secondArg?: string) {
  const payload = typeof firstArg === "string" ? { name: secondArg ?? "My Hotel" } : firstArg;
  const { data, error } = await supabase.from('hotels').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function signUp(emailOrPayload: any, password?: string, fullName?: string) {
  const payload = typeof emailOrPayload === "string" ? { email: emailOrPayload, password: password ?? "", fullName } : emailOrPayload;
  const { data, error } = await supabase.auth.signUp({ email: payload.email, password: payload.password });
  if (error) throw error;
  return data;
}

export async function updatePassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
  return data;
}

export async function signOut() { return supabase.auth.signOut(); }
