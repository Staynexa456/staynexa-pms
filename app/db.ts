// app/db.ts
import { supabase } from './supabase';

// ============ BOOKINGS ============
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

// ============ HOTELS ============
export async function fetchHotels() {
  const { data, error } = await supabase
    .from('hotels')
    .select('id, name, city, state')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

// ============ GUESTS ============
export async function fetchGuests() {
  const { data, error } = await supabase
    .from('guests')
    .select('*');
  if (error) throw error;
  return data ?? [];
}

export async function updateGuest(guestId: string, updates: Record<string, any>) {
  const { data, error } = await supabase
    .from('guests')
    .update(updates)
    .eq('id', guestId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============ ROOMS ============
export async function fetchRooms(hotelId?: string) {
  let query = supabase.from('rooms').select('*').order('room_number');
  if (hotelId) query = query.eq('hotel_id', hotelId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
