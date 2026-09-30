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

function requireHotelId(hotelId?: string) {
  if (!hotelId) console.warn('[db] hotelId missing — querying all tenants');
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
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((b: any) => ({
      ...b,
      roomNumber: b.room?.room_number ?? null,
      roomType: b.room?.room_type ?? null,
      roomBasePrice: b.room?.base_price ?? null,
      primaryGuest: b.guest ?? { name: 'Guest', phone: '', email: '' },
      hotelName: b.hotel?.name ?? null,
      checkIn: b.check_in,
      checkOut: b.check_out,
    }));
  });
}

export async function updateBooking(id: string, updates: Record<string, any>) {
  if (!id || Object.keys(updates).length === 0) throw new Error("Invalid update");
  const { data, error } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) throw error;
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
  if (Object.keys(mapped).length === 0) throw new Error("Nothing to update");
  return updateBooking(id, mapped);
}

// ═══════════════════════════════════════════════
// CREATE RESERVATION (Single Room)
// ═══════════════════════════════════════════════
export async function createReservation(payload: {
  roomNumber?: string;
  roomType?: string;
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
  discount?: number;
  promoCode?: string;
  notes?: string;
  hotelId?: string;
  selectedAddons?: Array<{ id: string; name: string; price: number }>;
}) {
  if (!payload.hotelId) throw new Error('Hotel ID is required');
  if (!payload.roomNumber && !payload.roomType) {
    throw new Error('Room number or room type is required');
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

  let roomId: string | null = null;
  let roomNumber: string | null = null;

  if (payload.roomNumber) {
    const { data: roomRow } = await supabase
      .from('rooms')
      .select('id, room_number')
      .eq('hotel_id', payload.hotelId)
      .eq('room_number', payload.roomNumber)
      .maybeSingle();

    if (!roomRow) {
      throw new Error(`Room ${payload.roomNumber} was not found in this hotel.`);
    }
    roomId = roomRow.id;
    roomNumber = roomRow.room_number;
  } else if (payload.roomType) {
    const { data: roomsOfType } = await supabase
      .from('rooms')
      .select('id, room_number')
      .eq('hotel_id', payload.hotelId)
      .eq('room_type', payload.roomType);

    if (!roomsOfType || roomsOfType.length === 0) {
      throw new Error(`${payload.roomType} is not available in this hotel. Please select a different room type.`);
    }

    const { data: conflicts } = await supabase
      .from('bookings')
      .select('room_id')
      .eq('hotel_id', payload.hotelId)
      .in('status', ['CONFIRMED', 'CHECKED-IN', 'PENDING DEPARTURE', 'BLOCKED'])
      .lt('check_in', payload.checkOut)
      .gt('check_out', payload.checkIn);

    const bookedRoomIds = new Set(
      (conflicts || []).map((b: any) => b.room_id).filter(Boolean)
    );

    const freeRoom = roomsOfType.find((r) => !bookedRoomIds.has(r.id));

    if (!freeRoom) {
      throw new Error(
        `${payload.roomType} is fully booked on these dates. Please check another date or select a different room type.`
      );
    }

    roomId = freeRoom.id;
    roomNumber = freeRoom.room_number;
  }

  if (!roomId) throw new Error('Could not determine a room. Please try again.');

  if (payload.roomNumber) {
    const { data: conflictCheck } = await supabase
      .from('bookings')
      .select('id')
      .eq('room_id', roomId)
      .in('status', ['CONFIRMED', 'CHECKED-IN', 'PENDING DEPARTURE', 'BLOCKED'])
      .lt('check_in', payload.checkOut)
      .gt('check_out', payload.checkIn);

    if (conflictCheck && conflictCheck.length > 0) {
      throw new Error(
        `Room ${payload.roomNumber} is already booked on these dates. Please select a different room or date.`
      );
    }
  }

  const bookingRef = `SNB-${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth() + 1).padStart(2, "0")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      booking_ref: bookingRef,
      hotel_id: payload.hotelId,
      room_id: roomId,
      primary_guest_id: guestInsert.data.id,
      source: payload.source ?? 'bookingengine',
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
      discount: payload.discount ?? 0,
      promo_code: payload.promoCode ?? null,
      paid: 0,
      group_id: null,
      room_index: 1,
    })
    .select()
    .single();

  if (error) {
    if (
      error.message.includes('ইতিমধ্যে') ||
      error.message.includes('already') ||
      error.message.includes('duplicate')
    ) {
      throw new Error(
        'Sorry! This room was just booked by another guest. Please try a different room or date.'
      );
    }
    throw error;
  }

  if (payload.selectedAddons && payload.selectedAddons.length > 0) {
    const addonsToInsert = payload.selectedAddons.map((addon) => ({
      booking_id: data.id,
      addon_id: addon.id,
      name: addon.name,
      price: addon.price,
      quantity: 1,
    }));
    await supabase.from('booking_addons').insert(addonsToInsert);
  }

  invalidateCache('bookings:');
  invalidateCache('stats:');
  invalidateCache('kpi:');
  invalidateCache('room-availability:');
  return data;
}

// ═══════════════════════════════════════════════
// CREATE GROUP RESERVATION (Multi-Room Booking)
// ═══════════════════════════════════════════════
export async function createGroupReservation(payload: {
  hotelId: string;
  primaryGuest: Guest;
  checkIn: string;
  checkOut: string;
  source?: string;
  notes?: string;
  rooms: Array<{
    roomNumber?: string;
    roomType?: string;
    adults: number;
    children: number;
    infants?: number;
    amount: number;
    tax: number;
    ratePlan?: string;
    selectedAddons?: Array<{ id: string; name: string; price: number }>;
  }>;
}) {
  if (!payload.hotelId) throw new Error('Hotel ID is required');
  if (!payload.rooms || payload.rooms.length === 0) throw new Error('At least one room is required');

  const groupId = crypto.randomUUID();
  const mainBookingRef = `SNB-${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth() + 1).padStart(2, "0")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

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
  const guestId = guestInsert.data.id;

  const createdBookings: any[] = [];

  for (let i = 0; i < payload.rooms.length; i++) {
    const roomData = payload.rooms[i];
    let roomId: string | null = null;
    let roomNumber: string | null = null;

    if (roomData.roomNumber) {
      const { data: roomRow } = await supabase
        .from('rooms')
        .select('id, room_number')
        .eq('hotel_id', payload.hotelId)
        .eq('room_number', roomData.roomNumber)
        .maybeSingle();
      if (!roomRow) throw new Error(`Room ${roomData.roomNumber} not found.`);
      roomId = roomRow.id;
      roomNumber = roomRow.room_number;
    } else if (roomData.roomType) {
      const { data: roomsOfType } = await supabase
        .from('rooms')
        .select('id, room_number')
        .eq('hotel_id', payload.hotelId)
        .eq('room_type', roomData.roomType);

      if (!roomsOfType || roomsOfType.length === 0) {
        throw new Error(`${roomData.roomType} is not available in this hotel.`);
      }

      const { data: conflicts } = await supabase
        .from('bookings')
        .select('room_id')
        .eq('hotel_id', payload.hotelId)
        .in('status', ['CONFIRMED', 'CHECKED-IN', 'PENDING DEPARTURE', 'BLOCKED'])
        .lt('check_in', payload.checkOut)
        .gt('check_out', payload.checkIn);

      const bookedRoomIds = new Set((conflicts || []).map((b: any) => b.room_id).filter(Boolean));
      
      const alreadySelectedInGroup = createdBookings.map((b: any) => b.room_id);
      alreadySelectedInGroup.forEach((id) => bookedRoomIds.add(id));

      const freeRoom = roomsOfType.find((r) => !bookedRoomIds.has(r.id));

      if (!freeRoom) {
        throw new Error(`${roomData.roomType} is fully booked on these dates.`);
      }
      roomId = freeRoom.id;
      roomNumber = freeRoom.room_number;
    }

    if (!roomId) throw new Error('Could not determine a room.');

    const bookingRef = `${mainBookingRef}-${i + 1}`;
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        booking_ref: bookingRef,
        hotel_id: payload.hotelId,
        room_id: roomId,
        primary_guest_id: guestId,
        source: payload.source ?? 'bookingengine',
        check_in: payload.checkIn,
        check_out: payload.checkOut,
        adults: roomData.adults,
        children: roomData.children,
        infants: roomData.infants ?? 0,
        status: 'CONFIRMED',
        rate_plan: roomData.ratePlan ?? 'EP',
        notes: payload.notes ?? null,
        amount: roomData.amount,
        tax: roomData.tax,
        discount: 0,
        promo_code: null,
        paid: 0,
        group_id: groupId,
        room_index: i + 1,
      })
      .select()
      .single();

    if (bookingError) throw bookingError;
    createdBookings.push({ ...booking, room_number: roomNumber });

    if (roomData.selectedAddons && roomData.selectedAddons.length > 0) {
      const addonsToInsert = roomData.selectedAddons.map((addon) => ({
        booking_id: booking.id,
        addon_id: addon.id,
        name: addon.name,
        price: addon.price,
        quantity: 1,
      }));
      await supabase.from('booking_addons').insert(addonsToInsert);
    }
  }

  invalidateCache('bookings:');
  invalidateCache('stats:');
  invalidateCache('kpi:');
  invalidateCache('room-availability:');

  return {
    groupId,
    mainBookingRef,
    bookings: createdBookings,
  };
}

// ═══════════════════════════════════════════════
// BLOCK ROOM
// ═══════════════════════════════════════════════
export async function blockRoom(payload: {
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  reason: string;
  hotelId?: string;
}) {
  if (!payload.hotelId) throw new Error('Hotel ID is required');

  const { data: roomRow } = await supabase
    .from('rooms')
    .select('id')
    .eq('room_number', payload.roomNumber)
    .eq('hotel_id', payload.hotelId)
    .maybeSingle();

  if (!roomRow) throw new Error(`Room ${payload.roomNumber} not found.`);

  const { data: existing } = await supabase
    .from('bookings')
    .select('id')
    .eq('room_id', roomRow.id)
    .neq('status', 'CANCELLED')
    .lt('check_in', payload.checkOut)
    .gt('check_out', payload.checkIn);

  if (existing && existing.length > 0) {
    throw new Error(
      `Room ${payload.roomNumber} already has a booking on these dates. Cannot block.`
    );
  }

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      booking_ref: `BLK.${Date.now()}`,
      hotel_id: payload.hotelId,
      room_id: roomRow.id,
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

// ═══════════════════════════════════════════════
// BOOKING ACTIONS
// ═══════════════════════════════════════════════
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
export async function deleteBooking(id: string) {
  if (!id) throw new Error("Booking ID is required");
  const { error } = await supabase.from('bookings').delete().eq('id', id);
  if (error) throw error;
  invalidateCache('bookings:');
  invalidateCache('stats:');
  invalidateCache('kpi:');
  return true;
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
  | 'newBookings'
  | 'inHouse'
  | 'arrivals'
  | 'departures'
  | 'cancellations'
  | 'onHold'
  | 'noShows'
  | 'magicLink';

export type SubFilter =
  | 'all'
  | 'pendingArrivals'
  | 'arrivalsInHouse'
  | 'pendingDepartures'
  | 'checkedOut';

export async function fetchDashboardStatsForDate(
  hotelId: string | undefined,
  dateISO: string
) {
  const key = `stats-date:${hotelId ?? 'all'}:${dateISO}`;
  return cached(key, 5_000, async () => {
    let query = supabase.from('bookings').select('*');
    if (hotelId) query = query.eq('hotel_id', hotelId);
    const { data, error } = await query;
    if (error)
      return {
        newBookings: 0,
        inHouse: 0,
        arrivals: 0,
        departures: 0,
        cancellations: 0,
        onHold: 0,
        noShows: 0,
        magicLink: 0,
      };

    const bookings = (data ?? []).filter(
      (b: any) => b.check_in <= dateISO && b.check_out >= dateISO
    );
    return {
      newBookings: bookings.filter((b: any) => b.status === 'CONFIRMED').length,
      inHouse: bookings.filter((b: any) => b.status === 'CHECKED-IN').length,
      arrivals: bookings.filter(
        (b: any) =>
          b.check_in === dateISO &&
          ['CONFIRMED', 'CHECKED-IN', 'PENDING DEPARTURE'].includes(b.status)
      ).length,
      departures: bookings.filter(
        (b: any) =>
          b.check_out === dateISO &&
          ['CHECKED-IN', 'CHECKED-OUT', 'PENDING DEPARTURE'].includes(b.status)
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
      .select(
        `*, room:rooms!room_id (id, room_number, room_type, hotel_id, base_price), guest:guests!primary_guest_id (*)`
      )
      .order('check_in', { ascending: false })
      .limit(500);
    if (hotelId) query = query.eq('hotel_id', hotelId);
    const { data, error } = await query;
    if (error) return [];

    let rows = (data ?? []).map((b: any) => ({
      ...b,
      roomNumber: b.room?.room_number ?? null,
      roomType: b.room?.room_type ?? null,
      primaryGuest: b.guest ?? { name: 'Guest', phone: '', email: '' },
      checkIn: b.check_in,
      checkOut: b.check_out,
    }));

    switch (kpi) {
      case 'newBookings':
        rows = rows.filter(
          (b: any) =>
            b.check_in <= dateISO && b.check_out >= dateISO && b.status === 'CONFIRMED'
        );
        break;
      case 'inHouse':
        rows = rows.filter((b: any) => b.status === 'CHECKED-IN');
        break;
      case 'arrivals':
        rows = rows.filter(
          (b: any) => b.check_in === dateISO && b.status !== 'CANCELLED' && b.is_no_show !== true
        );
        if (subFilter === 'pendingArrivals')
          rows = rows.filter((b: any) =>
            ['CONFIRMED', 'PENDING DEPARTURE'].includes(b.status)
          );
        else if (subFilter === 'arrivalsInHouse')
          rows = rows.filter((b: any) => b.status === 'CHECKED-IN');
        break;
      case 'departures':
        rows = rows.filter(
          (b: any) =>
            b.check_out === dateISO && b.status !== 'CANCELLED' && b.is_no_show !== true
        );
        if (subFilter === 'pendingDepartures')
          rows = rows.filter((b: any) =>
            ['CHECKED-IN', 'PENDING DEPARTURE'].includes(b.status)
          );
        else if (subFilter === 'checkedOut')
          rows = rows.filter((b: any) => b.status === 'CHECKED-OUT');
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
      if (b.check_in <= today && b.check_out > today) {
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
export async function addBookingAddon(payload: {
  bookingId: string;
  description: string;
  amount: number;
  quantity?: number;
}) {
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

  const { data: bd } = await supabase
    .from('bookings')
    .select('paid')
    .eq('id', bookingId)
    .single();
  if (bd) {
    await supabase
      .from('bookings')
      .update({ paid: (Number(bd.paid) || 0) + amount })
      .eq('id', bookingId);
  }

  invalidateCache('payments:');
  invalidateCache('bookings:');
  invalidateCache('stats:');
  invalidateCache('kpi:');
  return data;
}
export async function recordPayment(payload: {
  bookingId: string;
  amount: number;
  method: string;
  reference?: string;
  note?: string;
}) {
  return addPayment(
    payload.bookingId,
    payload.amount,
    payload.method,
    payload.reference,
    payload.note
  );
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
    const { data, error } = await supabase.from('hotels').select('*').order('name');
    if (error) throw error;
    return data ?? [];
  });
}

// ═══════════════════════════════════════════════
// CREATE HOTEL FOR USER
// ═══════════════════════════════════════════════
export async function createHotelForUser(firstArg: any, secondArg?: any) {
  const { data: { user } } = await supabase.auth.getUser();

  const payload =
    typeof firstArg === 'string'
      ? { name: secondArg ?? 'My Hotel' }
      : firstArg;

  const { data, error } = await supabase
    .from('hotels')
    .insert({
      name: payload.name,
      city: payload.city ?? null,
      state: payload.state ?? null,
      address: payload.address ?? null,
      phone: payload.phone ?? null,
      email: payload.email ?? null,
      gst_number: payload.gst_number ?? null,
      owner_id: payload.owner_id ?? user?.id ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  invalidateCache('hotels:');
  return data;
}

// ═══════════════════════════════════════════════
// GET USER HOTELS (With Role & Fallback)
// ═══════════════════════════════════════════════
export async function getUserHotels(): Promise<(Hotel & { userRole?: string })[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return [];

  // ১. প্রথমে 'hotel_users' টেবিল থেকে ইউজারের হোটেল আইডি এবং রোল বের করুন
  const { data: userHotelLinks, error: linkError } = await supabase
    .from('hotel_users')
    .select('hotel_id, role')
    .eq('user_id', session.user.id);

  // যদি লিংক পাওয়া যায়, তাহলে সেই আইডি দিয়ে হোটেলের ডিটেইলস আনুন
  if (!linkError && userHotelLinks && userHotelLinks.length > 0) {
    const hotelIds = userHotelLinks.map((link: any) => link.hotel_id);
    
    const { data: hotelDetails, error: hotelError } = await supabase
      .from('hotels')
      .select('*')
      .in('id', hotelIds);

    if (!hotelError && hotelDetails) {
      return hotelDetails.map((hotel: any) => {
        const link = userHotelLinks.find((l: any) => l.hotel_id === hotel.id);
        return {
          ...hotel,
          userRole: link?.role || 'staff'
        };
      });
    }
  }

  // ২. যদি 'hotel_users' এ ডেটা না থাকে, তাহলে চেক করুন ইউজার হোটেলের ওনার কি না
  const { data: ownedHotels, error: ownedError } = await supabase
    .from('hotels')
    .select('*')
    .eq('owner_id', session.user.id);

  if (!ownedError && ownedHotels && ownedHotels.length > 0) {
    return ownedHotels.map((h: any) => ({
      ...h,
      userRole: 'owner'
    }));
  }

  // ৩. কোনো ডেটা না পেলে খালি অ্যারে রিটার্ন করুন
  return [];
}

// ═══════════════════════════════════════════════
// HOTEL CRUD OPERATIONS (MISSING EXPORTS FIX)
// ═══════════════════════════════════════════════

export async function createHotel(payload: any) {
  return createHotelForUser(payload);
}

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
  if (!id) throw new Error('Guest ID is required');
  const allowedFields = [
    'name', 'phone', 'email', 'address', 'city', 'state', 'pincode',
    'gst', 'company', 'idType', 'idNumber', 'country', 'zipCode',
    'companyName', 'companyGst', 'companyEmail', 'companyPhone', 'companyAddress',
  ];
  const cleanUpdates: any = {};
  for (const key of Object.keys(updates)) {
    if (allowedFields.includes(key) && updates[key] !== undefined)
      cleanUpdates[key] = updates[key];
  }
  if (Object.keys(cleanUpdates).length === 0) return;
  const { error } = await supabase.from('guests').update(cleanUpdates).eq('id', id);
  if (error) throw error;
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
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  });
}

// ═══════════════════════════════════════════════
// HOUSEKEEPING
// ═══════════════════════════════════════════════
export type HousekeepingStatus = 'CLEAN' | 'DIRTY' | 'INSPECTED' | 'MAINTENANCE';
export async function updateRoomHousekeeping(
  roomId: string,
  status: HousekeepingStatus,
  staffName?: string,
  notes?: string
) {
  if (!roomId) throw new Error('Room ID is required');
  const updates: Record<string, any> = {
    housekeeping_status: status,
    last_cleaned_at: ['CLEAN', 'INSPECTED'].includes(status)
      ? new Date().toISOString()
      : null,
    last_cleaned_by: staffName || null,
  };
  if (notes !== undefined) updates.housekeeping_notes = notes;
  const { error } = await supabase.from('rooms').update(updates).eq('id', roomId);
  if (error) throw error;
  invalidateCache('rooms:');
  invalidateCache('bookings:');
}
export async function bulkUpdateHousekeeping(
  roomIds: string[],
  status: HousekeepingStatus,
  staffName?: string
) {
  if (!roomIds || roomIds.length === 0) return;
  const updates: Record<string, any> = {
    housekeeping_status: status,
    last_cleaned_at: ['CLEAN', 'INSPECTED'].includes(status)
      ? new Date().toISOString()
      : null,
    last_cleaned_by: staffName || null,
  };
  const { error } = await supabase.from('rooms').update(updates).in('id', roomIds);
  if (error) throw error;
  invalidateCache('rooms:');
  invalidateCache('bookings:');
}
export async function fetchHousekeepingRooms(hotelId?: string) {
  const key = `housekeeping:${hotelId ?? 'all'}`;
  return cached(key, 5_000, async () => {
    let query = supabase.from('rooms').select('*').order('room_number');
    if (hotelId) query = query.eq('hotel_id', hotelId);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  });
}

// ═══════════════════════════════════════════════
// DASHBOARD ENHANCED STATS
// ═══════════════════════════════════════════════
export async function fetchRevenueStats(hotelId?: string) {
  const key = `revenue-stats:${hotelId ?? 'all'}`;
  return cached(key, 30_000, async () => {
    let bookingQuery = supabase
      .from('bookings')
      .select('id, check_in, check_out, amount, tax, paid, status, created_at')
      .neq('status', 'CANCELLED')
      .neq('status', 'BLOCKED');
    if (hotelId) bookingQuery = bookingQuery.eq('hotel_id', hotelId);
    const { data: bookingsData, error: bErr } = await bookingQuery;
    if (bErr) throw bErr;
    const { data: paymentsData, error: pErr } = await supabase
      .from('payments')
      .select('id, amount, created_at');
    if (pErr) throw pErr;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    let todayRevenue = 0, weekRevenue = 0, monthRevenue = 0;
    (paymentsData || []).forEach((p: any) => {
      const paidAt = new Date(p.created_at);
      const amt = Number(p.amount) || 0;
      if (paidAt >= today && paidAt <= todayEnd) todayRevenue += amt;
      if (paidAt >= startOfWeek) weekRevenue += amt;
      if (paidAt >= startOfMonth) monthRevenue += amt;
    });
    let todayBookings = 0, monthBookings = 0;
    (bookingsData || []).forEach((b: any) => {
      const created = new Date(b.created_at || b.check_in);
      if (created >= today && created <= todayEnd) todayBookings += 1;
      if (created >= startOfMonth) monthBookings += 1;
    });
    return { todayRevenue, weekRevenue, monthRevenue, todayBookings, monthBookings };
  });
}

export async function fetchTodayOperations(hotelId?: string) {
  const key = `today-ops:${hotelId ?? 'all'}`;
  return cached(key, 10_000, async () => {
    const todayISO = new Date().toISOString().slice(0, 10);
    let query = supabase
      .from('bookings')
      .select(
        `id, check_in, check_out, status, amount, tax, paid, booking_ref, source, guest:guests!primary_guest_id (name, phone), room:rooms!room_id (room_number, room_type)`
      )
      .order('check_in', { ascending: true });
    if (hotelId) query = query.eq('hotel_id', hotelId);
    const { data, error } = await query;
    if (error) throw error;

    const all = (data || []).map((b: any) => ({
      ...b,
      guestName: b.guest?.name || 'Guest',
      guestPhone: b.guest?.phone || '',
      roomNumber: b.room?.room_number || '—',
      roomType: b.room?.room_type || '—',
      balanceDue: Math.max(
        0,
        (Number(b.amount) || 0) + (Number(b.tax) || 0) - (Number(b.paid) || 0)
      ),
    }));

    const arrivals = all.filter(
      (b) => b.check_in === todayISO && b.status !== 'CANCELLED' && b.status !== 'NO-SHOW'
    );
    const departures = all.filter(
      (b) => b.check_out === todayISO && b.status !== 'CANCELLED'
    );
    const inHouse = all.filter((b) => b.status === 'CHECKED-IN');
    const pendingPayment = all.filter(
      (b) => (b.status === 'CHECKED-IN' || b.status === 'CONFIRMED') && b.balanceDue > 0
    );
    const recentBookings = [...all]
      .sort((a, b) => new Date(b.check_in).getTime() - new Date(a.check_in).getTime())
      .slice(0, 5);
    const arrivalsRevenue = arrivals.reduce((s, b) => s + (Number(b.amount) || 0), 0);
    const pendingAmount = pendingPayment.reduce((s, b) => s + b.balanceDue, 0);
    return {
      arrivals,
      departures,
      inHouse,
      pendingPayment,
      recentBookings,
      arrivalsRevenue,
      pendingAmount,
      totalActive: all.length,
    };
  });
}

// ═══════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════
export async function fetchReportBookings(
  hotelId: string | undefined,
  startDate: string,
  endDate: string
) {
  const key = `report-bookings:${hotelId ?? 'all'}:${startDate}:${endDate}`;
  return cached(key, 15_000, async () => {
    let q = supabase
      .from('bookings')
      .select(
        `*, guest:guests!primary_guest_id (*), room:rooms!room_id (room_number, room_type, base_price)`
      )
      .lte('check_in', endDate)
      .gte('check_out', startDate)
      .order('check_in', { ascending: false });
    if (hotelId) q = q.eq('hotel_id', hotelId);
    const { data, error } = await q;
    if (error) throw error;

    return (data || []).map((b: any) => {
      const nights =
        b.check_in && b.check_out
          ? Math.max(
              1,
              Math.round(
                (new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) /
                  86400000
              )
            )
          : 1;
      const amount = Number(b.amount) || 0;
      const tax = Number(b.tax) || 0;
      const paid = Number(b.paid) || 0;
      return {
        ...b,
        guestName: b.guest?.name || 'Guest',
        guestPhone: b.guest?.phone || '',
        roomNumber: b.room?.room_number || '—',
        roomType: b.room?.room_type || '—',
        roomCharge: amount,
        taxAmount: tax,
        paidAmount: paid,
        totalAmount: amount + tax,
        balanceDue: Math.max(0, amount + tax - paid),
        nights,
        adr: nights > 0 ? amount / nights : 0,
        status: b.status || 'CONFIRMED',
        checkIn: b.check_in,
        checkOut: b.check_out,
      };
    });
  });
}

export async function fetchReportPayments(
  hotelId: string | undefined,
  startDate: string,
  endDate: string
) {
  const key = `report-payments:${hotelId ?? 'all'}:${startDate}:${endDate}`;
  return cached(key, 15_000, async () => {
    let query = supabase
      .from('payments')
      .select(
        `*, booking:bookings!booking_id (booking_ref, room:rooms!room_id (room_number), guest:guests!primary_guest_id (name, phone))`
      )
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`)
      .order('created_at', { ascending: false });
    if (hotelId) query = query.eq('booking.hotel_id', hotelId);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((p: any) => ({
      ...p,
      bookingId: p.booking?.booking_ref || '—',
      roomNumber: p.booking?.room?.room_number || '—',
      guestName: p.booking?.guest?.name || 'Guest',
      guestPhone: p.booking?.guest?.phone || '',
      netAmount: p.amount,
      description: p.note || '—',
      paymentType: p.method || 'Unknown',
    }));
  });
}

// ═══════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════
export async function signUp(emailOrPayload: any, password?: string, fullName?: string) {
  const payload =
    typeof emailOrPayload === 'string'
      ? { email: emailOrPayload, password: password ?? '', fullName }
      : emailOrPayload;
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: payload.email,
    password: payload.password,
    options: {
      data: {
        full_name: payload.fullName ?? null,
        hotel_name: ('hotelName' in payload && payload.hotelName) || null,
      },
    },
  });
  if (authError) throw authError;
  if (authData?.user && 'hotelName' in payload && payload.hotelName) {
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
