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
  terms_url?: string;
  privacy_url?: string;
  // Hero Banner
  hero_banner_url?: string;
  show_hero_banner?: boolean;
  hero_overlay_opacity?: number;
  // Payment Gateway
  payment_enabled?: boolean;
  payment_gateway?: "none" | "razorpay" | "cashfree" | "upi_qr";
  payment_amount_type?: "full" | "partial" | "advance";
  advance_percentage?: number;
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

// ═══════════════════════════════════════════════
// AVAILABILITY
// ═══════════════════════════════════════════════
export async function checkAvailability(
  hotelId: string,
  roomType: string,
  checkIn: string,
  checkOut: string
): Promise<number> {
  try {
    const { data: rooms, error: roomsError } = await supabase
      .from("rooms")
      .select("id, room_number, housekeeping_status, room_type, hotel_id")
      .eq("hotel_id", hotelId)
      .eq("room_type", roomType);

    if (roomsError) {
      console.error("[checkAvail] rooms error:", roomsError);
      return 0;
    }
    if (!rooms || rooms.length === 0) return 0;

    const validRooms = rooms.filter((r: any) => {
      if (r.housekeeping_status === "MAINTENANCE") return false;
      return true;
    });

    if (validRooms.length === 0) return 0;

    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select("room_id, check_in, check_out, status")
      .eq("hotel_id", hotelId)
      .in("status", ["CONFIRMED", "CHECKED-IN", "PENDING DEPARTURE", "BLOCKED"])
      .lt("check_in", checkOut)
      .gt("check_out", checkIn);

    if (bookingsError) {
      console.error("[checkAvail] bookings error:", bookingsError);
    }

    const bookedRoomIds = new Set(
      (bookings || []).map((b: any) => String(b.room_id)).filter(Boolean)
    );

    const available = validRooms.filter((r: any) => !bookedRoomIds.has(String(r.id)));
    return available.length;
  } catch (err) {
    console.error("[checkAvail] exception:", err);
    return 0;
  }
}

// ═══════════════════════════════════════════════
// PRICING
// ═══════════════════════════════════════════════
export function computePriceForPlan(
  basePrice: number,
  rateDifference: number,
  nights: number
): number {
  const perNight = basePrice + (rateDifference || 0);
  return Math.round(perNight * nights);
}

export function computeTax(amount: number): number {
  const rate = amount <= 7500 ? 0.12 : 0.18;
  return Math.round(amount * rate);
}
