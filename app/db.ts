// app/db.ts
import { supabase } from './supabase';
import type { Guest } from './types';

// ═══════════════════════════════════════════════
// IN-MEMORY CACHE
// ═══════════════════════════════════════════════
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
function requireHotelId(hotelId?: string) { if (!hotelId) console.warn('[db] hotelId missing'); return hotelId; }

// ═══════════════════════════════════════════════
// BOOKINGS
// ═══════════════════════════════════════════════
export async function fetchBookings(hotelId?: string) {
  const key = `bookings:${hotelId ?? 'all'}`;
  return cached(key, 10_000, async () => {
    let query = supabase.from('bookings').select(`
        *,
        room:rooms!room_id (id, room_number, room_type, hotel_id, base_price),
        guest:guests!primary_guest_id (*),
        hotel:hotels!hotel_id (id, name, address, city, state, phone, email, gst_number)
      `).order('check_in', { ascending: true });
    if (hotelId) query = query.eq('hotel_id', hotelId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((b: any) => ({
      ...b, roomNumber: b.room?.room_number ?? null, roomType: b.room?.room_type ?? null, roomBasePrice: b.room?.base_price ?? null,
      primaryGuest: b.guest ?? { name: 'Guest', phone: '', email: '' }, hotelName: b.hotel?.name ?? null, hotelEmail: b.hotel?.email ?? null,
      hotelAddress: b.hotel?.address ?? null, hotelCity: b.hotel?.city ?? null, hotelState: b.hotel?.state ?? null, hotelPhone: b.hotel?.phone ?? null,
      hotelGst: b.hotel?.gst_number ?? null, checkIn: b.check_in, checkOut: b.check_out,
    }));
  });
}

export async function updateBooking(id: string, updates: Record<string, any>) {
  if (!id || Object.keys(updates).length === 0) throw new Error("Invalid update");
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
export async function modifyReservation(id: string, updates: Record<string, any>) {
  const mapped: any = {};
  if (updates.checkIn) mapped.check_in = updates.checkIn; if (updates.checkOut) mapped.check_out = updates.checkOut;
  if (updates.ratePlan) mapped.rate_plan = updates.ratePlan; if (updates.notes) mapped.notes = updates.notes;
  if (updates.adults) mapped.adults = updates.adults; if (updates.children) mapped.children = updates.children;
  if (updates.infants) mapped.infants = updates.infants; if (updates.amount) mapped.amount = updates.amount; if (updates.tax) mapped.tax = updates.tax;
  return updateBooking(id, mapped);
}

export async function createReservation(payload: {
  roomType: string; checkIn: string; checkOut: string; ratePlan?: string; source?: string;
  primaryGuest: Guest; adults: number; children: number; infants?: number;
  amount: number; tax: number; discount?: number; promoCode?: string; notes?: string; hotelId?: string;
  selectedAddons?: Array<{ id: string; name: string; price: number }>;
}) {
  if (!payload.hotelId) throw new Error('hotelId is required');
  if (!payload.roomType) throw new Error('roomType is required');

  // ১. গেস্ট তৈরি
  const guestInsert = await supabase.from('guests').insert({
    name: payload.primaryGuest.name, phone: payload.primaryGuest.phone, email: payload.primaryGuest.email,
  }).select().single();
  if (guestInsert.error) throw guestInsert.error;

  // ২. ঐ টাইপের রুম নিন
  const { data: roomsOfType } = await supabase.from('rooms').select('id, room_number').eq('hotel_id', payload.hotelId).eq('room_type', payload.roomType);
  if (!roomsOfType || roomsOfType.length === 0) throw new Error(`${payload.roomType} ক্যাটাগরিতে কোনো রুম নেই।`);

  // ৩. কনফ্লিক্ট চেক
  const { data: conflicts } = await supabase.from('bookings').select('room_id').eq('hotel_id', payload.hotelId)
    .in('status', ['CONFIRMED', 'CHECKED-IN', 'PENDING DEPARTURE', 'BLOCKED'])
    .lt('check_in', payload.checkOut).gt('check_out', payload.checkIn);

  const bookedRoomIds = new Set((conflicts || []).map((b: any) => b.room_id).filter(Boolean));
  const freeRoom = roomsOfType.find(r => !bookedRoomIds.has(r.id));

  if (!freeRoom) throw new Error(`${payload.roomType} এই তারিখে সম্পূর্ণ বুকড।`);

  // ৪. বুকিং তৈরি
  const bookingRef = `SNB-${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth() + 1).padStart(2, "0")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const { data, error } = await supabase.from('bookings').insert({
    booking_ref: bookingRef, hotel_id: payload.hotelId, room_id: freeRoom.id, primary_guest_id: guestInsert.data.id,
    source: payload.source ?? 'bookingengine', check_in: payload.checkIn, check_out: payload.checkOut,
    adults: payload.adults, children: payload.children, infants: payload.infants ?? 0, status: 'CONFIRMED',
    rate_plan: payload.ratePlan ?? 'EP', notes: payload.notes ?? null, amount: payload.amount, tax: payload.tax,
    discount: payload.discount ?? 0, promo_code: payload.promoCode ?? null, paid: 0,
  }).select().single();

  if (error) {
    if (error.message.includes('ইতিমধ্যে')) throw new Error('দুঃখিত! এই রুমটি এইমাত্র বুক হয়ে গেছে।');
    throw error;
  }

  // ৫. অ্যাড-অনস
  if (payload.selectedAddons && payload.selectedAddons.length > 0) {
    await supabase.from('booking_addons').insert(payload.selectedAddons.map(a => ({
      booking_id: data.id, addon_id: a.id, name: a.name, price: a.price, quantity: 1,
    })));
  }

  invalidateCache('bookings:'); invalidateCache('stats:'); invalidateCache('kpi:');
  return data;
}

// (বাকি সব ফাংশন আগের মতোই থাকবে: blockRoom, holdBooking, fetchDashboardStatsForDate, fetchRooms, fetchGuests, fetchHotels, createHotelForUser, signUp, updatePassword, etc.)
// ... [আগের রিপ্লাই থেকে বাকি ফাংশনগুলো এখানে বসান] ...
export async function blockRoom(payload: any) { /* ... */ }
export async function holdBooking(id: string, reason?: string) { return updateBooking(id, { status: 'ON-HOLD', notes: reason ?? null }); }
export async function releaseHold(id: string) { return updateBooking(id, { status: 'CONFIRMED' }); }
export async function lockBooking(id: string) { return updateBooking(id, { is_locked: true }); }
export async function unlockBooking(id: string) { return updateBooking(id, { is_locked: false }); }
export async function markNoShow(id: string) { return updateBooking(id, { is_no_show: true, status: 'NO-SHOW' }); }
export async function unassignRoom(id: string) { return updateBooking(id, { room_id: null }); }
export async function deleteBooking(id: string) { await supabase.from('bookings').delete().eq('id', id); invalidateCache('bookings:'); }
export async function moveReservation(id: string, newRoomNumber: string, hotelId?: string) { /* ... */ }
export async function sendMagicLink(id: string) { /* ... */ }
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
export async function fetchGuests() { /* ... */ }
export async function updateGuest(id: string, updates: any) { /* ... */ }
export async function fetchHotels() { /* ... */ }
export async function createHotelForUser(firstArg: any, secondArg?: string) { /* ... */ }
export async function signUp(emailOrPayload: any, password?: string, fullName?: string) { /* ... */ }
export async function resetPassword(email: string) { /* ... */ }
export async function updatePassword(newPassword: string) { /* ... */ }
export async function signOut() { return supabase.auth.signOut(); }
