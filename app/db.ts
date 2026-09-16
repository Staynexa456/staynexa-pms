// app/db.ts
import { supabase } from './supabase';

// ---------- BOOKINGS ----------
export async function fetchBookings(hotelId?: string) {
  let query = supabase
    .from('bookings')
    .select(`
      *,
      guests:primary_guest_id (*),
      rooms:room_id (*)
    `)
    .order('check_in', { ascending: true });

  if (hotelId) {
    query = query.eq('hotel_id', hotelId);
  }

  const { data, error } = await query;
  if (error) throw error;
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

// ---------- HOTELS ----------
export async function fetchHotels() {
  const { data, error } = await supabase
    .from('hotels')
    .select('id, name, city, state')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

// ---------- GUESTS ----------
export async function fetchGuests(hotelId?: string) {
  let query = supabase.from('guests').select('*');
  // If guests table has hotel_id:
  // if (hotelId) query = query.eq('hotel_id', hotelId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
