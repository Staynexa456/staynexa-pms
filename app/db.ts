// app/db.ts
import { supabase } from './supabase';

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════
export type Guest = {
  name: string;
  phone: string;
  email: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

export type Hotel = {
  id: string;
  name: string;
  slug?: string;
  city?: string;
  state?: string;
  address?: string;
  phone?: string;
  email?: string;
  owner_id?: string;
  created_at?: string;
  [key: string]: any;
};

export type HousekeepingStatus = "CLEAN" | "DIRTY" | "INSPECTED" | "OUT_OF_ORDER" | "MAINTENANCE" | string;

export type Room = {
  id: string;
  hotel_id: string;
  room_number: string;
  room_type: string;
  base_price: number;
  max_adults: number;
  max_children: number;
  max_infants: number;
  housekeeping_status?: HousekeepingStatus;
  housekeeping_updated_by?: string;
  is_active?: boolean;
  [key: string]: any;
};

export type PaymentRecord = {
  id: string;
  hotel_id: string;
  booking_id?: string;
  amount: number;
  method: string; 
  reference?: string;
  note?: string;
  status: string;
  created_at?: string;
  [key: string]: any;
};

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

function notifyBookingUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("booking-updated"));
  }
}

// ═══════════════════════════════════════════════
// AUTH & HOTELS
// ═══════════════════════════════════════════════
export async function getUserHotels(userId?: string): Promise<Hotel[]> {
  if (!userId) {
    console.warn("[getUserHotels] userId missing — returning empty");
    return [];
  }
  const { data, error } = await supabase
    .from('hotels')
    .select('*')
    .eq('owner_id', userId) 
    .order('created_at', { ascending: false });
  if (error) {
    console.error("[getUserHotels]", error);
    return [];
  }
  return data as Hotel[];
}

export async function fetchHotels(): Promise<Hotel[]> {
  const { data, error } = await supabase
    .from('hotels')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Hotel[];
}

export async function sendPasswordReset(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/reset-password`,
  });
  if (error) throw error;
  return data;
}

export async function updatePassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
  return data;
}

export async function signUp(email: string, password: string, metadata?: any) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: metadata }
  });
  if (error) throw error;
  return data;
}

// ═══════════════════════════════════════════════
// ROOMS & HOUSEKEEPING
// ═══════════════════════════════════════════════
export async function fetchRooms(hotelId?: string): Promise<Room[]> {
  if (!hotelId) return [];
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('hotel_id', hotelId)
    .order('room_number');
  if (error) throw error;
  return data as Room[];
}

export async function fetchHousekeepingRooms(hotelId?: string): Promise<Room[]> {
  if (!hotelId) return [];
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('hotel_id', hotelId)
    .order('room_number');
  if (error) throw error;
  return data as Room[];
}

export async function updateRoomHousekeeping(roomId: string, status: HousekeepingStatus, updatedBy?: string) {
  const updateData: any = { housekeeping_status: status };
  if (updatedBy) {
    updateData.housekeeping_updated_by = updatedBy;
  }
  
  const { data, error } = await supabase
    .from('rooms')
    .update(updateData)
    .eq('id', roomId)
    .select()
    .single();
    
  if (error) throw error;
  invalidateCache('room-availability:');
  invalidateCache('housekeeping:');
  return data;
}

export async function bulkUpdateHousekeeping(roomIds: string[], status: HousekeepingStatus, updatedBy?: string) {
  if (!roomIds || roomIds.length === 0) return;
  
  const updateData: any = { housekeeping_status: status };
  if (updatedBy) {
    updateData.housekeeping_updated_by = updatedBy;
  }

  const { data, error } = await supabase
    .from('rooms')
    .update(updateData)
    .in('id', roomIds);
  if (error) throw error;
  invalidateCache('room-availability:');
  invalidateCache('housekeeping:');
  return data;
}

// ═══════════════════════════════════════════════
// GUESTS
// ═══════════════════════════════════════════════
export async function updateGuest(id: string, updates: any) {
  const { data, error } = await supabase
    .from('guests')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ═══════════════════════════════════════════════
// PAYMENTS
// ═══════════════════════════════════════════════
export async function fetchAllPayments(hotelId?: string): Promise<PaymentRecord[]> {
  if (!hotelId) {
    console.warn("[fetchAllPayments] hotelId missing — returning empty");
    return []; 
  }
  
  const { data, error } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('hotel_id', hotelId)
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  return data as PaymentRecord[];
}

export async function deletePayment(id: string) {
  const { error } = await supabase
    .from('payment_transactions')
    .delete()
    .eq('id', id);
  if (error) throw error;
  invalidateCache('payments:');
  return true;
}

export async function updatePaymentMethod(id: string, method: string) {
  const { data, error } = await supabase
    .from('payment_transactions')
    .update({ method, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  invalidateCache('payments:');
  return data;
}

export async function recordPayment(payload: {
  bookingId: string;
  method: string;
  amount: number;
  reference?: string;
  note?: string;
}) {
  const { bookingId, method, amount, reference, note } = payload;

  const { data: booking } = await supabase
    .from('bookings')
    .select('paid')
    .eq('id', bookingId)
    .single();
    
  const newPaid = (booking?.paid || 0) + amount;
  
  const { data, error } = await supabase
    .from('bookings')
    .update({ paid: newPaid })
    .eq('id', bookingId)
    .select()
    .single();
    
  if (error) throw error;
  
  console.log(`[Payment] Recorded: ${method} - Rs.${amount} - Ref: ${reference} - Note: ${note}`);

  invalidateCache('bookings:');
  invalidateCache('stats:');
  invalidateCache('kpi:');
  notifyBookingUpdated();
  return data;
}

// ═══════════════════════════════════════════════
// BOOKINGS
// ═══════════════════════════════════════════════
export async function fetchBookings(hotelId?: string) {
  if (!hotelId) {
    console.warn("[fetchBookings] hotelId missing — returning empty");
    return [];
  }
  const key = `bookings:${hotelId}`;
  return cached(key, 10_000, async () => {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        room:rooms!room_id (id, room_number, room_type, hotel_id, base_price),
        guest:guests!primary_guest_id (*),
        hotel:hotels!hotel_id (id, name, address, city, state, phone, email, gst_number)
      `)
      .eq('hotel_id', hotelId)
      .order('check_in', { ascending: true });
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
      address: payload.primaryGuest.address || null,
      city: payload.primaryGuest.city || null,
      state: payload.primaryGuest.state || null,
      pincode: payload.primaryGuest.pincode || null,
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
      throw new Error(`${payload.roomType} is not available in this hotel.`);
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
      throw new Error(`${payload.roomType} is fully booked on these dates.`);
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
      throw new Error(`Room ${payload.roomNumber} is already booked on these dates.`);
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
      throw new Error('Sorry! This room was just booked. Please try a different room or date.');
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
  notifyBookingUpdated();
  return data;
}

// ═══════════════════════════════════════════════
// CREATE GROUP RESERVATION
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

  // ✅ FIX: Math.random() এর বদলে crypto.randomUUID() ব্যবহার করা হয়েছে যাতে Supabase uuid টাইপ অ্যাকসেপ্ট করে
  const groupId = crypto.randomUUID();
  const mainBookingRef = `SNB-${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth() + 1).padStart(2, "0")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const guestInsert = await supabase
    .from('guests')
    .insert({
      name: payload.primaryGuest.name,
      phone: payload.primaryGuest.phone,
      email: payload.primaryGuest.email,
      address: payload.primaryGuest.address || null,
      city: payload.primaryGuest.city || null,
      state: payload.primaryGuest.state || null,
      pincode: payload.primaryGuest.pincode || null,
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
        paid: 0, // ✅ পেমেন্ট পেন্ডিং থাকবে
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
  notifyBookingUpdated();

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
    throw new Error(`Room ${payload.roomNumber} already has a booking on these dates.`);
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
  notifyBookingUpdated();
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
  notifyBookingUpdated();
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
  if (!hotelId) {
    return { newBookings: 0, inHouse: 0, arrivals: 0, departures: 0, cancellations: 0, onHold: 0, noShows: 0, magicLink: 0 };
  }
  const key = `stats-date:${hotelId}:${dateISO}`;
  return cached(key, 5_000, async () => {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('hotel_id', hotelId);
    if (error)
      return { newBookings: 0, inHouse: 0, arrivals: 0, departures: 0, cancellations: 0, onHold: 0, noShows: 0, magicLink: 0 };

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
  if (!hotelId) return [];
  const key = `kpi:${hotelId}:${kpi}:${subFilter}:${dateISO}`;
  return cached(key, 5_000, async () => {
    const { data, error } = await supabase
      .from('bookings')
      .select(
        `*, room:rooms!room_id (id, room_number, room_type, hotel_id, base_price), guest:guests!primary_guest_id (*)`
      )
      .eq('hotel_id', hotelId)
      .order('check_in', { ascending: false })
      .limit(500);
      
    if (error) return [];

    let filtered = (data ?? []).filter(
      (b: any) => b.check_in <= dateISO && b.check_out >= dateISO
    );

    switch (kpi) {
      case 'newBookings':
        filtered = filtered.filter((b: any) => b.status === 'CONFIRMED');
        break;
      case 'inHouse':
        filtered = filtered.filter((b: any) => b.status === 'CHECKED-IN');
        break;
      case 'arrivals':
        filtered = filtered.filter(
          (b: any) =>
            b.check_in === dateISO &&
            ['CONFIRMED', 'CHECKED-IN', 'PENDING DEPARTURE'].includes(b.status)
        );
        break;
      case 'departures':
        filtered = filtered.filter(
          (b: any) =>
            b.check_out === dateISO &&
            ['CHECKED-IN', 'CHECKED-OUT', 'PENDING DEPARTURE'].includes(b.status)
        );
        break;
      case 'cancellations':
        filtered = filtered.filter((b: any) => b.status === 'CANCELLED');
        break;
      case 'onHold':
        filtered = filtered.filter((b: any) => b.status === 'ON-HOLD');
        break;
      case 'noShows':
        filtered = filtered.filter((b: any) => b.is_no_show === true);
        break;
      case 'magicLink':
        filtered = filtered.filter((b: any) => b.magic_link_token !== null);
        break;
      default:
        break;
    }

    if (subFilter === 'pendingArrivals') {
      filtered = filtered.filter((b: any) => b.status === 'CONFIRMED' && b.check_in === dateISO);
    } else if (subFilter === 'arrivalsInHouse') {
      filtered = filtered.filter((b: any) => b.status === 'CHECKED-IN');
    } else if (subFilter === 'pendingDepartures') {
      filtered = filtered.filter((b: any) => b.status === 'PENDING DEPARTURE');
    } else if (subFilter === 'checkedOut') {
      filtered = filtered.filter((b: any) => b.status === 'CHECKED-OUT');
    }

    return filtered;
  });
}
