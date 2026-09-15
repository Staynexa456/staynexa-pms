// app/db.ts
import { supabase } from "./supabase";
import type { Booking, Guest, Payment } from "./types";

export type Room = {
  id: string;
  hotel_id: string;
  room_number: string;
  room_type: string;
  floor?: number;
  rate_plan?: string;
  base_price?: number;
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

  const seen = new Set<string>();
  const unique: Room[] = [];
  for (const room of data || []) {
    const roomNum = String(room?.room_number || "").trim();
    if (!roomNum) continue;
    if (seen.has(roomNum)) continue;
    seen.add(roomNum);
    unique.push(room);
  }
  return unique;
}

// ═══════════════════════════════════════════════════════════
// BOOKINGS
// ═══════════════════════════════════════════════════════════

export async function fetchBookings(): Promise<Booking[]> {
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("*")
    .order("check_in", { ascending: true });
  if (error) throw error;
  if (!bookings || bookings.length === 0) return [];

  const guestIds = [...new Set(bookings.map((b: any) => b.primary_guest_id).filter(Boolean))];
  const roomIds = [...new Set(bookings.map((b: any) => b.room_id).filter(Boolean))];

  const [guestsRes, roomsRes, paymentsRes] = await Promise.all([
    guestIds.length
      ? supabase.from("guests").select("*").in("id", guestIds)
      : Promise.resolve({ data: [], error: null }),
    roomIds.length
      ? supabase.from("rooms").select("*").in("id", roomIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("payments").select("*"),
  ]);

  const guestMap: Record<string, any> = {};
  (guestsRes.data || []).forEach((g: any) => { guestMap[g.id] = g; });

  const roomMap: Record<string, any> = {};
  (roomsRes.data || []).forEach((r: any) => { roomMap[r.id] = r; });

  const paymentsMap: Record<string, Payment[]> = {};
  (paymentsRes.data || []).forEach((p: any) => {
    if (!paymentsMap[p.booking_id]) paymentsMap[p.booking_id] = [];
    paymentsMap[p.booking_id].push({
      id: p.id,
      amount: Number(p.amount) || 0,
      method: p.method || "Cash",
      date: p.paid_at || "",
      reference: p.reference,
      note: p.note,
    });
  });

  return bookings.map((row: any) => {
    const guest = guestMap[row.primary_guest_id] || {};
    const room = roomMap[row.room_id] || {};

    return {
      id: row.id,
      bookingRef: row.booking_ref,
      otaId: row.ota_id,
      otaPin: row.ota_pin,
      primaryGuest: {
        name: guest.name || "",
        phone: guest.phone || "",
        email: guest.email || "",
        address: guest.address || "",
        city: guest.city || "",
        state: guest.state || "",
        pincode: guest.pincode || "",
        idType: guest.id_type,
        idNumber: guest.id_number,
      },
      additionalGuests: [],
      source: row.source || "direct",
      roomNumber: room.room_number || "",
      roomType: room.room_type || "",
      roomId: row.room_id,
      ratePlan: row.rate_plan || "EP",
      checkIn: row.check_in || "",
      checkOut: row.check_out || "",
      bookingMadeOn: row.booking_made_on || row.created_at || "",
      status: row.status || "CONFIRMED",
      amount: Number(row.amount) || 0,
      tax: Number(row.tax) || 0,
      payments: paymentsMap[row.id] || [],
      adults: Number(row.adults) || 1,
      children: Number(row.children) || 0,
      infants: Number(row.infants) || 0,
      notes: row.notes || "",
      is_locked: row.is_locked ?? false,
      is_no_show: row.is_no_show ?? false,
    } as any;
  });
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

export async function updateBookingNotes(bookingId: string, notes: string): Promise<void> {
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
  const { data: room } = await supabase
    .from("rooms")
    .select("id")
    .eq("room_number", roomNumber)
    .limit(1)
    .single();

  const { error } = await supabase
    .from("bookings")
    .update({
      room_id: room?.id,
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
  const { data: booking, error: findErr } = await supabase
    .from("bookings")
    .select("primary_guest_id")
    .eq("id", bookingId)
    .single();

  if (findErr) throw findErr;
  if (!booking?.primary_guest_id) throw new Error("No guest linked to this booking");

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
  const activeHotelId = typeof window !== "undefined"
    ? localStorage.getItem("activeHotelId")
    : null;

  const { data: guestRow, error: guestErr } = await supabase
    .from("guests")
    .insert({
      name: data.primaryGuest.name || "Guest",
      phone: data.primaryGuest.phone || "",
      email: data.primaryGuest.email || "",
      address: data.primaryGuest.address || "",
      city: data.primaryGuest.city || "",
      state: data.primaryGuest.state || "",
      pincode: data.primaryGuest.pincode || "",
      id_type: data.primaryGuest.idType || null,
      id_number: data.primaryGuest.idNumber || null,
    })
    .select()
    .single();

  if (guestErr) throw new Error(`Guest create failed: ${guestErr.message}`);

  let roomQuery = supabase
    .from("rooms")
    .select("id, hotel_id")
    .eq("room_number", data.roomNumber);

  if (activeHotelId) roomQuery = roomQuery.eq("hotel_id", activeHotelId);

  const { data: room, error: roomErr } = await roomQuery.limit(1).single();

  if (roomErr || !room) throw new Error(`Room ${data.roomNumber} not found`);

  const { error: bookingErr } = await supabase.from("bookings").insert({
    booking_ref: `SNBOOKING_${Date.now()}`,
    hotel_id: room.hotel_id,
    room_id: room.id,
    primary_guest_id: guestRow.id,
    check_in: data.checkIn,
    check_out: data.checkOut,
    rate_plan: data.ratePlan || "EP",
    source: data.source || "direct",
    adults: data.adults || 1,
    children: data.children || 0,
    infants: data.infants || 0,
    amount: data.amount || 0,
    tax: data.tax || 0,
    notes: data.notes || "",
    status: "CONFIRMED",
    booking_made_on: new Date().toISOString(),
  });

  if (bookingErr) throw new Error(`Booking create failed: ${bookingErr.message}`);
}

export async function blockRoom(data: {
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  reason: string;
}): Promise<void> {
  const activeHotelId = typeof window !== "undefined"
    ? localStorage.getItem("activeHotelId")
    : null;

  let roomQuery = supabase
    .from("rooms")
    .select("id, hotel_id")
    .eq("room_number", data.roomNumber);

  if (activeHotelId) roomQuery = roomQuery.eq("hotel_id", activeHotelId);

  const { data: room, error: roomErr } = await roomQuery.limit(1).single();

  if (roomErr || !room) throw new Error(`Room ${data.roomNumber} not found`);

  const { error } = await supabase.from("bookings").insert({
    booking_ref: `BLK-${Date.now()}`,
    hotel_id: room.hotel_id,
    room_id: room.id,
    primary_guest_id: null,
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
// MODIFY ACTIONS
// ═══════════════════════════════════════════════════════════

export async function lockBooking(bookingId: string): Promise<void> {
  const { error } = await supabase
    .from("bookings")
    .update({ is_locked: true })
    .eq("id", bookingId);
  if (error) throw error;
}

export async function unlockBooking(bookingId: string): Promise<void> {
  const { error } = await supabase
    .from("bookings")
    .update({ is_locked: false })
    .eq("id", bookingId);
  if (error) throw error;
}

export async function markNoShow(bookingId: string): Promise<void> {
  const { error } = await supabase
    .from("bookings")
    .update({ status: "CANCELLED", is_no_show: true })
    .eq("id", bookingId);
  if (error) throw error;
}

export async function unassignRoom(bookingId: string): Promise<void> {
  const { error } = await supabase
    .from("bookings")
    .update({ room_id: null, status: "CONFIRMED" })
    .eq("id", bookingId);
  if (error) throw error;
}

export async function moveReservation(
  bookingId: string,
  newRoomNumber: string
): Promise<void> {
  const { data: room } = await supabase
    .from("rooms")
    .select("id")
    .eq("room_number", newRoomNumber)
    .limit(1)
    .single();

  if (!room) throw new Error(`Room ${newRoomNumber} not found`);

  const { error } = await supabase
    .from("bookings")
    .update({ room_id: room.id })
    .eq("id", bookingId);
  if (error) throw error;
}

export async function sendMagicLink(bookingId: string): Promise<string> {
  const token = crypto.randomUUID();
  const { error } = await supabase
    .from("bookings")
    .update({ magic_link_token: token, magic_link_sent_at: new Date().toISOString() })
    .eq("id", bookingId);
  if (error) throw error;
  return `${window.location.origin}/guest-checkin/${token}`;
}

export async function modifyReservation(
  bookingId: string,
  data: {
    checkIn?: string;
    checkOut?: string;
    adults?: number;
    children?: number;
    amount?: number;
    ratePlan?: string;
  }
): Promise<void> {
  const update: Record<string, any> = {};

  if (data.checkIn !== undefined && data.checkIn !== "") {
    update.check_in = data.checkIn;
  }
  if (data.checkOut !== undefined && data.checkOut !== "") {
    update.check_out = data.checkOut;
  }
  if (data.adults !== undefined) {
    update.adults = data.adults;
  }
  if (data.children !== undefined) {
    update.children = data.children;
  }
  if (data.amount !== undefined) {
    update.amount = data.amount;
  }
  if (data.ratePlan) {
    update.rate_plan = data.ratePlan;
  }

  // Guard: nothing to update
  if (Object.keys(update).length === 0) {
    throw new Error("No fields to update");
  }

  const { data: result, error } = await supabase
    .from("bookings")
    .update(update)
    .eq("id", bookingId)
    .select();

  if (error) {
    console.error("[modifyReservation] Supabase error:", error);
    throw new Error(error.message);
  }

  if (!result || result.length === 0) {
    throw new Error("Booking not found or no permission to update");
  }

  console.log("[modifyReservation] Updated:", result);
}
// ═══════════════════════════════════════════════════════════
// PAYMENTS  (single copy — no duplicates)
// ═══════════════════════════════════════════════════════════

export type PaymentRecord = {
  id: string;
  booking_id: string;
  amount: number;
  method: string;
  reference?: string;
  note?: string;
  paid_at: string;
  created_at: string;
};

export async function fetchPaymentsForBooking(bookingId: string): Promise<PaymentRecord[]> {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("booking_id", bookingId)
    .order("paid_at", { ascending: false });
  if (error) throw error;
  return (data || []) as PaymentRecord[];
}

export async function fetchAllPayments(): Promise<PaymentRecord[]> {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .order("paid_at", { ascending: false });
  if (error) throw error;
  return (data || []) as PaymentRecord[];
}

export async function recordPayment(data: {
  bookingId: string;
  amount: number;
  method: string;
  reference?: string;
  note?: string;
}): Promise<void> {
  const { error } = await supabase.from("payments").insert({
    booking_id: data.bookingId,
    amount: data.amount,
    method: data.method,
    reference: data.reference || null,
    note: data.note || null,
    paid_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function addPayment(
  bookingId: string,
  payment: { amount: number; method: string; reference?: string; note?: string }
): Promise<void> {
  return recordPayment({
    bookingId,
    amount: payment.amount,
    method: payment.method,
    reference: payment.reference,
    note: payment.note,
  });
}

export async function deletePayment(paymentId: string): Promise<void> {
  const { error } = await supabase.from("payments").delete().eq("id", paymentId);
  if (error) throw error;
}

export async function updatePaymentMethod(paymentId: string, newMethod: string): Promise<void> {
  const { error } = await supabase
    .from("payments")
    .update({ method: newMethod })
    .eq("id", paymentId);
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
// HOTELS
// ═══════════════════════════════════════════════════════════

export type Hotel = {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  owner_id?: string;
  active?: boolean;
  [key: string]: any;
};

export async function getUserHotels(): Promise<Hotel[]> {
  try {
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return [];

    const { data, error } = await supabase
      .from("hotels")
      .select("*")
      .eq("owner_id", user.id)
      .order("name", { ascending: true });

    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

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
      owner_id: user.id,
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

export async function updateHotel(hotelId: string, data: Partial<Hotel>): Promise<Hotel> {
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
    options: { data: { full_name: fullName } },
  });
  if (error) throw error;
  return { user: data.user ? { id: data.user.id } : null };
}

export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function createHotelForUser(
  userId: string,
  hotelName: string
): Promise<Hotel> {
  const { data: hotel, error } = await supabase
    .from("hotels")
    .insert({
      owner_id: userId,
      name: hotelName,
      active: true,
    })
    .select()
    .single();
  if (error) throw error;
  return hotel;
}
