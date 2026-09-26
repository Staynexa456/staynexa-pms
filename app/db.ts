// app/db.ts
import { supabase } from "./supabase";

// ═══════════════════════════════════════════════
// AUTH & HOTEL FUNCTIONS
// ═══════════════════════════════════════════════
export async function signUp(email: string, password: string, fullName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });
  if (error) throw error;
  return data;
}

export async function createHotelForUser(userId: string, hotelName: string, ownerName: string) {
  const { data, error } = await supabase
    .from("hotels")
    .insert([{
      user_id: userId,
      name: hotelName,
      owner_name: ownerName,
      created_at: new Date().toISOString(),
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ═══════════════════════════════════════════════
// BOOKING ENGINE FUNCTIONS
// ═══════════════════════════════════════════════
export async function createReservation(data: {
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  ratePlan: string;
  source: string;
  primaryGuest: {
    name: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
  };
  adults: number;
  children: number;
  infants: number;
  amount: number;
  tax: number;
  notes: string;
  hotelId: string;
}) {
  // ১. গেস্ট তৈরি বা খুঁজে বের করা
  let guestId;
  const { data: existingGuest } = await supabase
    .from("guests")
    .select("id")
    .eq("phone", data.primaryGuest.phone)
    .eq("hotel_id", data.hotelId)
    .maybeSingle();

  if (existingGuest) {
    guestId = existingGuest.id;
  } else {
    const { data: newGuest, error: guestError } = await supabase
      .from("guests")
      .insert([{
        hotel_id: data.hotelId,
        name: data.primaryGuest.name,
        phone: data.primaryGuest.phone,
        email: data.primaryGuest.email,
        address: data.primaryGuest.address,
        city: data.primaryGuest.city,
        state: data.primaryGuest.state,
        pincode: data.primaryGuest.pincode,
      }])
      .select()
      .single();
      
    if (guestError) throw new Error("Guest creation failed: " + guestError.message);
    guestId = newGuest.id;
  }

  // ২. রুমের আইডি বের করা
  const { data: room } = await supabase
    .from("rooms")
    .select("id")
    .eq("hotel_id", data.hotelId)
    .eq("room_number", data.roomNumber)
    .single();

  if (!room) throw new Error("Room not found");

  // ৩. ইউনিক বুকিং রেফারেন্স (PK) তৈরি
  const bookingRef = `SNB-${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth() + 1).padStart(2, "0")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  // ৪. বুকিং তৈরি এবং ডাটা রিটার্ন
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert([{
      hotel_id: data.hotelId,
      room_id: room.id,
      primary_guest_id: guestId,
      booking_ref: bookingRef, // 👈 PK
      check_in: data.checkIn,
      check_out: data.checkOut,
      adults: data.adults,
      children: data.children,
      amount: data.amount,
      tax: data.tax,
      status: "PENDING",
      payment_status: "unpaid",
      source: data.source,
      notes: data.notes,
    }])
    .select() // 👈 CRITICAL FIX
    .single();

  if (bookingError) throw new Error("Booking creation failed: " + bookingError.message);

  return booking;
}
