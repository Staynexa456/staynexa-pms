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
  if (hit && hit.expires > now) {
    return Promise.resolve(hit.data as T);
  }
  return fn().then((data) => {
    cache.set(key, { data, expires: now + ttlMs });
    return data;
  });
}

export function invalidateCache(prefix?: string) {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const k of Array.from(cache.keys())) {
    if (k.startsWith(prefix)) cache.delete(k);
  }
}

// ═══════════════════════════════════════════════
// TENANT SAFETY
// ═══════════════════════════════════════════════
function requireHotelId(hotelId?: string) {
  if (!hotelId) {
    console.warn('[db] hotelId missing — querying all tenants');
  }
  return hotelId;
}

// ═══════════════════════════════════════════════
// BOOKINGS
// ═══════════════════════════════════════════════
export async function fetchBookings(hotelId?: string) {
  const key = `bookings:${hotelId ?? 'all'}`;
  return cached(key, 10_000, async () => {
    let query = supabase
      .from('bookings')
      .select(`
        *,
        room:rooms!room_id (id, room_number, room_type, hotel_id, base_price),
        guest:guests!primary_guest_id (*),
        hotel:hotels!hotel_id (id, name, address, city, state, phone, email, gst_number)
      `)
      .order('check_in', { ascending: true });

    if (hotelId) query = query.eq('hotel_id', hotelId);
    else requireHotelId(hotelId);

    const { data, error } = await query;
    if (error) {
      console.error('[fetchBookings] error:', error);
      throw error;
    }

    return (data ?? []).map((b: any) => ({
      ...b,
      roomNumber: b.room?.room_number ?? null,
      roomType: b.room?.room_type ?? null,
      roomBasePrice: b.room?.base_price ?? null,
      primaryGuest: b.guest ?? { name: 'Guest', phone: '', email: '' },
      hotelName: b.hotel?.name ?? null,
      hotelEmail: b.hotel?.email ?? null,
      hotelAddress: b.hotel?.address ?? null,
      hotelCity: b.hotel?.city ?? null,
      hotelState: b.hotel?.state ?? null,
      hotelPhone: b.hotel?.phone ?? null,
      hotelGst: b.hotel?.gst_number ?? null,
      checkIn: b.check_in,
      checkOut: b.check_out,
    }));
  });
}

export async function updateBooking(id: string, updates: Record<string, any>) {
  if (!id) throw new Error("updateBooking: id is required");
  if (!updates || Object.keys(updates).length === 0) {
    throw new Error("updateBooking: no fields to update");
  }
  const { data, error } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Booking ${id} not found`);

  invalidateCache('bookings:');
  invalidateCache('stats:');
  invalidateCache('kpi:');
  return data;
}

export async function updateBookingStatus(id: string, status: string, notes?: string) {
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
  checkOut: string,
  hotelId?: string
) {
  let roomQuery = supabase.from('rooms').select('id').eq('room_number', roomNumber);
  if (hotelId) roomQuery = roomQuery.eq('hotel_id', hotelId);
  const { data: roomRow } = await roomQuery.maybeSingle();

  return updateBooking(id, {
    room_id: roomRow?.id ?? null,
    check_in: checkIn,
    check_out: checkOut,
  });
}

export async function modifyReservation(id: string, updates: Record<string, any>) {
  const mapped: Record<string, any> = {};
  if (updates.checkIn !== undefined) mapped.check_in = updates.checkIn;
  if (updates.checkOut !== undefined) mapped.check_out = updates.checkOut;
  if (updates.ratePlan !== undefined) mapped.rate_plan = updates.ratePlan;
  if (updates.notes !== undefined) mapped.notes = updates.notes;
  if (updates.adults !== undefined) mapped.adults = updates.adults;
  if (updates.children !== undefined) mapped.children = updates.children;
  if (updates.infants !== undefined) mapped.infants = updates.infants;
  if (updates.amount !== undefined) mapped.amount = updates.amount;
  if (updates.tax !== undefined) mapped.tax = updates.tax;

  if (Object.keys(mapped).length === 0) {
    throw new Error("Nothing to update — check the fields you sent");
  }
  return updateBooking(id, mapped);
}

// app/db.ts (শুধু createReservation ফাংশনটি রিপ্লেস করুন)

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
  discount?: number; // 👈 নতুন
  promoCode?: string; // 👈 নতুন
  notes?: string;
  hotelId?: string;
  selectedAddons?: Array<{ id: string; name: string; price: number }>;
}) {
  if (!payload.hotelId) throw new Error('hotelId is required to create a booking');

  // ═══ 1. Insert guest ═══
  const guestInsert = await supabase.from('guests').insert({ name: payload.primaryGuest.name, phone: payload.primaryGuest.phone, email: payload.primaryGuest.email }).select().single();
  if (guestInsert.error) throw guestInsert.error;

  // ═══ 2. Find room by number ═══
  const { data: roomRow } = await supabase.from('rooms').select('id').eq('room_number', payload.roomNumber).eq('hotel_id', payload.hotelId).maybeSingle();
  if (!roomRow) throw new Error(`Room ${payload.roomNumber} not found in this hotel.`);

  // ═══ 3. FINAL CONFLICT CHECK ═══
  const { data: conflicts } = await supabase.from('bookings').select('id, booking_ref').eq('room_id', roomRow.id).in('status', ['CONFIRMED', 'CHECKED-IN', 'PENDING DEPARTURE', 'BLOCKED']).lt('check_in', payload.checkOut).gt('check_out', payload.checkIn);
  if (conflicts && conflicts.length > 0) throw new Error(`Room ${payload.roomNumber} is already booked for these dates.`);

  // ═══ 4. Create booking ═══
  const { data, error } = await supabase.from('bookings').insert({
      booking_ref: `SNB-${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth() + 1).padStart(2, "0")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      hotel_id: payload.hotelId,
      room_id: roomRow.id,
      primary_guest_id: guestInsert.data.id,
      source: payload.source ?? 'walk-in',
      check_in: payload.checkIn,
      check_out: payload.checkOut,
      adults: payload.adults,
      children: payload.children,
      infants: payload.infants ?? 0,
      status: 'CONFIRMED',
      rate_plan: payload.ratePlan ?? 'EP',
      notes: payload.notes ?? null,
      amount: payload.amount,
      tax: payload.tax,
      discount: payload.discount ?? 0, // 👈 সেভ করা হচ্ছে
      promo_code: payload.promoCode ?? null, // 👈 সেভ করা হচ্ছে
      paid: 0,
    }).select().single();
  if (error) throw error;

  // ═══ 5. Insert Add-ons ═══
  if (payload.selectedAddons && payload.selectedAddons.length > 0) {
    const addonsToInsert = payload.selectedAddons.map((addon) => ({
      booking_id: data.id, addon_id: addon.id, name: addon.name, price: addon.price, quantity: 1,
    }));
    const { error: addonError } = await supabase.from('booking_addons').insert(addonsToInsert);
    if (addonError) console.error("[createReservation] Add-ons insert failed:", addonError);
  }

  invalidateCache('bookings:'); invalidateCache('stats:'); invalidateCache('kpi:'); invalidateCache('room-availability:');
  return data;
}

// ... (বাকি সব ফাংশন আগের মতোই থাকবে, যেমন fetchDashboardStatsForDate, fetchRooms, ইত্যাদি) ...
// *নোট: জায়গা বাঁচানোর জন্য আমি শুধু পরিবর্তিত অংশগুলো দেখাচ্ছি। আপনি আপনার আগের db.ts ফাইলের বাকি কোড অপরিবর্তিত রাখুন।*
