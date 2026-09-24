// app/lib/public-booking.ts
import { supabase } from "../supabase";

export type PublicHotel = {
  id: string;
  name: string;
  city?: string;
  state?: string;
  slug: string;
};

export type PublicRoomType = {
  room_type: string;
  description?: string;
  photo_url?: string;
  max_adults: number;
  max_children: number;
  amenities: string[];
  base_price: number;
};

export type PublicRatePlan = {
  code: string;
  name: string;
  description?: string;
  rate_difference: number;
  min_length_of_stay: number;
};

export type BookingEngineConfig = {
  is_enabled: boolean;
  theme_color: string;
  hero_title?: string;
  hero_subtitle?: string;
  logo_url?: string;
  contact_phone?: string;
  contact_email?: string;
  contact_address?: string;
  show_rooms: boolean;
  allow_partial_payment: boolean;
  partial_payment_pct: number;
  min_advance_days: number;
  max_advance_days: number;
  require_payment: boolean;
  terms_url?: string;          // ← এই line যোগ করুন
  privacy_url?: string;        // ← এই line যোগ করুন
};

// ═══════════════════════════════════════════════
// FETCH
// ═══════════════════════════════════════════════

export async function fetchHotelBySlug(slug: string): Promise<PublicHotel | null> {
  const { data, error } = await supabase
    .from("hotels")
    .select("id, name, city, state, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    console.error("[fetchHotelBySlug]", error);
    return null;
  }
  return data as PublicHotel | null;
}

export async function fetchPublicConfig(hotelId: string): Promise<BookingEngineConfig | null> {
  const { data } = await supabase
    .from("booking_engine_settings")
    .select("*")
    .eq("hotel_id", hotelId)
    .maybeSingle();
  return data as BookingEngineConfig | null;
}

export async function fetchPublicRoomTypes(hotelId: string): Promise<PublicRoomType[]> {
  const { data } = await supabase
    .from("room_type_details")
    .select("*")
    .eq("hotel_id", hotelId)
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  return (data || []) as PublicRoomType[];
}

export async function fetchPublicRatePlans(hotelId: string): Promise<PublicRatePlan[]> {
  const { data } = await supabase
    .from("rate_plan_settings")
    .select("*")
    .eq("hotel_id", hotelId)
    .eq("is_active", true)
    .eq("hide_on_booking_engine", false)
    .order("display_order", { ascending: true });
  return (data || []) as PublicRatePlan[];
}

export async function checkAvailability(
  hotelId: string,
  roomType: string,
  checkIn: string,
  checkOut: string
): Promise<number> {
  // Fetch all rooms of this type
  const { data: rooms } = await supabase
    .from("rooms")
    .select("room_number, housekeeping_status, is_active")
    .eq("hotel_id", hotelId)
    .eq("room_type", roomType);

  const validRooms = (rooms || []).filter((r: any) => {
    if (r.is_active === false) return false;
    if (r.housekeeping_status === "MAINTENANCE") return false;
    return true;
  });

  if (validRooms.length === 0) return 0;

  // Fetch overlapping bookings
  const { data: bookings } = await supabase
    .from("bookings")
    .select("room_number, check_in, check_out, status")
    .eq("hotel_id", hotelId)
    .in("status", ["CONFIRMED", "CHECKED-IN", "PENDING DEPARTURE", "BLOCKED"])
    .lt("check_in", checkOut)
    .gt("check_out", checkIn);

  const bookedRooms = new Set(
    (bookings || []).map((b: any) => b.room_number).filter(Boolean)
  );

  const available = validRooms.filter((r: any) => !bookedRooms.has(r.room_number));
  return available.length;
}

export function computePriceForPlan(
  basePrice: number,
  rateDifference: number,
  nights: number
): number {
  const perNight = basePrice + (rateDifference || 0);
  return Math.round(perNight * nights);
}

export function computeTax(amount: number): number {
  // Default: 12% GST for under 7500, 18% above
  const rate = amount <= 7500 ? 0.12 : 0.18;
  return Math.round(amount * rate);
}