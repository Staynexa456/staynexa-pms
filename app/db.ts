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
  if (!payload.hotelId) {
    throw new Error('hotelId is required to create a booking');
  }

  const guestInsert = await supabase
    .from('guests')
    .insert({
      name: payload.primaryGuest.name,
      phone: payload.primaryGuest.phone,
      email: payload.primaryGuest.email,
    })
    .select()
    .single();
  if (guestInsert.error) throw guestInsert.error;

  const { data: roomRow } = await supabase
    .from('rooms')
    .select('id')
    .eq('room_number', payload.roomNumber)
    .eq('hotel_id', payload.hotelId)
    .maybeSingle();

  if (!roomRow) {
    throw new Error(`Room ${payload.roomNumber} not found in this hotel. Check Inventory.`);
  }

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      booking_ref: `SNBOOKING.${Date.now()}`,
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
    })
    .select()
    .single();
  if (error) throw error;

  invalidateCache('bookings:');
  invalidateCache('stats:');
  invalidateCache('kpi:');
  invalidateCache('room-availability:');
  return data;
}

export async function blockRoom(payload: {
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  reason: string;
  hotelId?: string;
}) {
  if (!payload.hotelId) throw new Error('hotelId is required');

  const { data: roomRow } = await supabase
    .from('rooms')
    .select('id')
    .eq('room_number', payload.roomNumber)
    .eq('hotel_id', payload.hotelId)
    .maybeSingle();

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      booking_ref: `BLK.${Date.now()}`,
      hotel_id: payload.hotelId,
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

  invalidateCache('bookings:');
  invalidateCache('stats:');
  invalidateCache('kpi:');
  invalidateCache('room-availability:');
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
  return updateBooking(id, { is_no_show: true, status: 'NO-SHOW' });
}
export async function unassignRoom(id: string) {
  return updateBooking(id, { room_id: null });
}
export async function moveReservation(id: string, newRoomNumber: string, hotelId?: string) {
  let q = supabase.from('rooms').select('id').eq('room_number', newRoomNumber);
  if (hotelId) q = q.eq('hotel_id', hotelId);
  const { data: roomRow } = await q.maybeSingle();
  return updateBooking(id, { room_id: roomRow?.id ?? null });
}
export async function sendMagicLink(id: string) {
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
  await updateBooking(id, {
    magic_link_token: token,
    magic_link_sent_at: new Date().toISOString(),
  });
  return `${typeof window !== 'undefined' ? window.location.origin : ''}/guest/${token}`;
}

// ═══════════════════════════════════════════════
// DASHBOARD KPIs
// ═══════════════════════════════════════════════
export type DashboardKpi =
  | 'newBookings' | 'inHouse' | 'arrivals' | 'departures'
  | 'cancellations' | 'onHold' | 'noShows' | 'magicLink';

export type SubFilter =
  | 'all' | 'pendingArrivals' | 'arrivalsInHouse'
  | 'pendingDepartures' | 'checkedOut';

export async function fetchDashboardStatsForDate(
  hotelId: string | undefined,
  dateISO: string
) {
  const key = `stats-date:${hotelId ?? 'all'}:${dateISO}`;
  return cached(key, 5_000, async () => {
    let query = supabase.from('bookings').select('*');
    if (hotelId) query = query.eq('hotel_id', hotelId);

    const { data, error } = await query;
    if (error) {
      console.error('[fetchDashboardStatsForDate]', error);
      return {
        newBookings: 0, inHouse: 0, arrivals: 0, departures: 0,
        cancellations: 0, onHold: 0, noShows: 0, magicLink: 0,
      };
    }

    const bookings = (data ?? []).filter((b: any) => {
      const ci = b.check_in;
      const co = b.check_out;
      if (!ci || !co) return false;
      return ci <= dateISO && co >= dateISO;
    });

    return {
      newBookings: bookings.filter((b: any) => b.status === 'CONFIRMED').length,
      inHouse: bookings.filter((b: any) => b.status === 'CHECKED-IN').length,
      arrivals: bookings.filter((b: any) =>
        b.check_in === dateISO &&
        (b.status === 'CONFIRMED' || b.status === 'CHECKED-IN' || b.status === 'PENDING DEPARTURE')
      ).length,
      departures: bookings.filter((b: any) =>
        b.check_out === dateISO &&
        (b.status === 'CHECKED-IN' || b.status === 'CHECKED-OUT' || b.status === 'PENDING DEPARTURE')
      ).length,
      cancellations: bookings.filter((b: any) => b.status === 'CANCELLED').length,
      onHold: bookings.filter((b: any) => b.status === 'ON-HOLD').length,
      noShows: bookings.filter((b: any) => b.is_no_show === true).length,
      magicLink: bookings.filter((b: any) => b.magic_link_token !== null).length,
    };
  });
}

export async function fetchBookingsByKpiAndSubFilter(
  hotelId: string | undefined,
  kpi: DashboardKpi,
  subFilter: SubFilter,
  dateISO: string
) {
  const key = `kpi:${hotelId ?? 'all'}:${kpi}:${subFilter}:${dateISO}`;
  return cached(key, 5_000, async () => {
    let query = supabase
      .from('bookings')
      .select(`
        *,
        room:rooms!room_id (id, room_number, room_type, hotel_id, base_price),
        guest:guests!primary_guest_id (*),
        hotel:hotels!hotel_id (id, name, address, city, state, phone, email, gst_number)
      `)
      .order('check_in', { ascending: false })
      .limit(500);

    if (hotelId) query = query.eq('hotel_id', hotelId);

    const { data, error } = await query;
    if (error) {
      console.error('[fetchBookingsByKpiAndSubFilter]', error);
      return [];
    }

    let rows = (data ?? []).map((b: any) => ({
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

    switch (kpi) {
      case 'newBookings':
        rows = rows.filter((b: any) =>
          b.check_in <= dateISO && b.check_out >= dateISO && b.status === 'CONFIRMED'
        );
        break;
      case 'inHouse':
        rows = rows.filter((b: any) => b.status === 'CHECKED-IN');
        break;
      case 'arrivals':
        rows = rows.filter((b: any) =>
          b.check_in === dateISO && b.status !== 'CANCELLED' && b.is_no_show !== true
        );
        if (subFilter === 'pendingArrivals') {
          rows = rows.filter((b: any) => b.status === 'CONFIRMED' || b.status === 'PENDING DEPARTURE');
        } else if (subFilter === 'arrivalsInHouse') {
          rows = rows.filter((b: any) => b.status === 'CHECKED-IN');
        }
        break;
      case 'departures':
        rows = rows.filter((b: any) =>
          b.check_out === dateISO && b.status !== 'CANCELLED' && b.is_no_show !== true
        );
        if (subFilter === 'pendingDepartures') {
          rows = rows.filter((b: any) => b.status === 'CHECKED-IN' || b.status === 'PENDING DEPARTURE');
        } else if (subFilter === 'checkedOut') {
          rows = rows.filter((b: any) => b.status === 'CHECKED-OUT');
        } else {
          rows = rows.filter((b: any) =>
            b.status === 'CHECKED-IN' || b.status === 'CHECKED-OUT' || b.status === 'PENDING DEPARTURE'
          );
        }
        break;
      case 'cancellations':
        rows = rows.filter((b: any) => b.status === 'CANCELLED');
        break;
      case 'onHold':
        rows = rows.filter((b: any) => b.status === 'ON-HOLD');
        break;
      case 'noShows':
        rows = rows.filter((b: any) => b.is_no_show === true);
        break;
      case 'magicLink':
        rows = rows.filter((b: any) => b.magic_link_token !== null);
        break;
    }

    return rows;
  });
}

export async function fetchRoomCategoryAvailability(hotelId?: string) {
  const key = `room-availability:${hotelId ?? 'all'}`;
  return cached(key, 30_000, async () => {
    let query = supabase.from('rooms').select('*');
    if (hotelId) query = query.eq('hotel_id', hotelId);

    const { data, error } = await query;
    if (error) return [];

    const rooms = data ?? [];
    const byType: Record<string, { total: number; available: number; base_price: number }> = {};
    for (const r of rooms) {
      const t = r.room_type || 'Standard Room';
      if (!byType[t]) byType[t] = { total: 0, available: 0, base_price: r.base_price ?? 0 };
      byType[t].total += 1;
      byType[t].available += 1;
    }

    let bookingQuery = supabase
      .from('bookings')
      .select('room_id, status, check_in, check_out')
      .in('status', ['CONFIRMED', 'CHECKED-IN', 'PENDING DEPARTURE']);
    if (hotelId) bookingQuery = bookingQuery.eq('hotel_id', hotelId);

    const { data: bookings } = await bookingQuery;
    const today = new Date().toISOString().slice(0, 10);
    const roomIdToType: Record<string, string> = {};
    for (const r of rooms) roomIdToType[r.id] = r.room_type || 'Standard Room';

    for (const b of bookings ?? []) {
      if (!b.room_id) continue;
      const occupied = b.check_in <= today && b.check_out > today;
      if (occupied) {
        const t = roomIdToType[b.room_id];
        if (t && byType[t]) byType[t].available = Math.max(0, byType[t].available - 1);
      }
    }

    return Object.entries(byType).map(([name, v]) => ({
      name,
      inventory: v.available,
      total: v.total,
      base_price: v.base_price,
    }));
  });
}

// ═══════════════════════════════════════════════
// ADDONS
// ═══════════════════════════════════════════════
export async function fetchAddonsForBooking(bookingId: string) {
  const key = `addons:${bookingId}`;
  return cached(key, 10_000, async () => {
    const { data, error } = await supabase
      .from('booking_addons')
      .select('*')
      .eq('booking_id', bookingId);
    if (error) return [];
    return data ?? [];
  });
}
export async function addBookingAddon(payload: { bookingId: string; description: string; amount: number; quantity?: number }) {
  const { data, error } = await supabase
    .from('booking_addons')
    .insert({
      booking_id: payload.bookingId,
      description: payload.description,
      amount: payload.amount,
      quantity: payload.quantity ?? 1,
    })
    .select()
    .single();
  if (error) throw error;
  invalidateCache('addons:');
  return data;
}
export async function deleteBookingAddon(addonId: string) {
  const { error } = await supabase.from('booking_addons').delete().eq('id', addonId);
  if (error) throw error;
  invalidateCache('addons:');
  return true;
}
export const deleteAddon = deleteBookingAddon;

// ═══════════════════════════════════════════════
// PAYMENTS
// ═══════════════════════════════════════════════
export type PaymentRecord = {
  id: string;
  booking_id: string;
  amount: number;
  method: string;
  reference?: string | null;
  note?: string | null;
  paid_at?: string;
  created_at?: string;
  [key: string]: any;
};
export async function fetchPaymentsForBooking(bookingId: string) {
  const key = `payments:${bookingId}`;
  return cached(key, 10_000, async () => {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at');
    if (error) return [];
    return data ?? [];
  });
}
export async function fetchAllPayments() {
  const key = `payments:all`;
  return cached(key, 10_000, async () => {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return [];
    return data ?? [];
  });
}
export async function addPayment(bookingId: string, amount: number, method: string, reference?: string, note?: string) {
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
  invalidateCache('payments:');
  return data;
}
export async function recordPayment(payload: { bookingId: string; amount: number; method: string; reference?: string; note?: string }) {
  return addPayment(payload.bookingId, payload.amount, payload.method, payload.reference, payload.note);
}
export async function deletePayment(paymentId: string) {
  const { error } = await supabase.from('payments').delete().eq('id', paymentId);
  if (error) throw error;
  invalidateCache('payments:');
  return true;
}
export async function updatePaymentMethod(paymentId: string, method: string) {
  const { data, error } = await supabase
    .from('payments')
    .update({ method })
    .eq('id', paymentId)
    .select()
    .single();
  if (error) throw error;
  invalidateCache('payments:');
  return data;
}

// ═══════════════════════════════════════════════
// HOTELS
// ═══════════════════════════════════════════════
export type Hotel = {
  id: string;
  name: string;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  gst_number?: string | null;
  is_active?: boolean;
  [key: string]: any;
};
export async function fetchHotels() {
  const key = `hotels:all`;
  return cached(key, 60_000, async () => {
    const { data, error } = await supabase
      .from('hotels')
      .select('*')
      .order('name');
    if (error) throw error;
    return data ?? [];
  });
}
export async function getUserHotels(): Promise<Hotel[]> {
  return fetchHotels();
}
export async function createHotelForUser(
  firstArg: string | { name: string; city?: string; state?: string; address?: string; phone?: string; email?: string; gst_number?: string; owner_id?: string },
  secondArg?: string
) {
  const payload = typeof firstArg === "string" ? { name: secondArg ?? "My Hotel" } : firstArg;
  const { data, error } = await supabase
    .from('hotels')
    .insert({
      name: payload.name,
      city: payload.city ?? null,
      state: payload.state ?? null,
      address: payload.address ?? null,
      phone: payload.phone ?? null,
      email: payload.email ?? null,
      gst_number: (payload as any).gst_number ?? null,
      owner_id: (payload as any).owner_id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  invalidateCache('hotels:');
  return data;
}
export async function createHotel(payload: any) { return createHotelForUser(payload); }
export async function updateHotel(hotelId: string, updates: any) {
  const { data, error } = await supabase
    .from('hotels')
    .update(updates)
    .eq('id', hotelId)
    .select()
    .single();
  if (error) throw error;
  invalidateCache('hotels:');
  return data;
}
export async function deactivateHotel(hotelId: string) {
  const { data, error } = await supabase
    .from('hotels')
    .update({ is_active: false })
    .eq('id', hotelId)
    .select()
    .single();
  if (error) throw error;
  invalidateCache('hotels:');
  return data;
}
export async function activateHotel(hotelId: string) {
  const { data, error } = await supabase
    .from('hotels')
    .update({ is_active: true })
    .eq('id', hotelId)
    .select()
    .single();
  if (error) throw error;
  invalidateCache('hotels:');
  return data;
}
export async function deleteHotel(hotelId: string) {
  const { error } = await supabase.from('hotels').delete().eq('id', hotelId);
  if (error) throw error;
  invalidateCache('hotels:');
  return true;
}

// ═══════════════════════════════════════════════
// GUESTS
// ═══════════════════════════════════════════════
export async function fetchGuests() {
  const key = `guests:all`;
  return cached(key, 30_000, async () => {
    const { data, error } = await supabase
      .from('guests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  });
}

export async function updateGuest(id: string, updates: any) {
  if (!id) throw new Error("updateGuest: id is required");

  const { error } = await supabase
    .from("guests")
    .update(updates)
    .eq("id", id);

  if (error) {
    console.error("[updateGuest]", error);
    throw error;
  }

  invalidateCache('guests:');
  invalidateCache('bookings:');
}

// ═══════════════════════════════════════════════
// ROOMS
// ═══════════════════════════════════════════════
export type Room = {
  id: string;
  room_number: string;
  room_type: string;
  hotel_id?: string;
  [key: string]: any;
};
export async function fetchRooms(hotelId?: string) {
  const key = `rooms:${hotelId ?? 'all'}`;
  return cached(key, 60_000, async () => {
    let query = supabase.from('rooms').select('*').order('room_number');
    if (hotelId) query = query.eq('hotel_id', hotelId);
    else requireHotelId(hotelId);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  });
}

// ═══════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════
export async function signUp(
  emailOrPayload: string | { email: string; password: string; fullName?: string; hotelName?: string },
  password?: string,
  fullName?: string
) {
  const payload = typeof emailOrPayload === "string"
    ? { email: emailOrPayload, password: password ?? "", fullName }
    : emailOrPayload;

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: payload.email,
    password: payload.password,
    options: {
      data: {
        full_name: payload.fullName ?? null,
        hotel_name: ("hotelName" in payload && payload.hotelName) || null,
      },
    },
  });
  if (authError) throw authError;

  if (authData?.user && "hotelName" in payload && payload.hotelName) {
    try {
      await createHotelForUser({ name: payload.hotelName, email: payload.email });
    } catch (err) {
      console.error('[signUp] hotel creation failed:', err);
    }
  }
  return authData;
}
export async function resetPassword(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/reset-password`,
  });
  if (error) throw error;
  return data;
}
export const sendPasswordReset = resetPassword;
export async function updatePassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
  return data;
}
export async function signOut() {
  return supabase.auth.signOut();
}