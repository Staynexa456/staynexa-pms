// app/lib/public-booking.ts
import { supabase } from "../supabase";

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════
export type PublicHotel = {
  id: string;
  name: string;
  slug: string;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  [key: string]: any;
};

export type PublicRoomType = {
  id: string;
  hotel_id: string;
  room_type: string;
  description?: string | null;
  base_price: number;
  max_adults: number;
  max_children: number;
  photo_url?: string | null;
  [key: string]: any;
};

export type PublicRatePlan = {
  id?: string;
  hotel_id?: string;
  code: string;
  name: string;
  description?: string | null;
  rate_difference: number;
  min_length_of_stay: number;
  [key: string]: any;
};

export type PublicAddon = {
  id: string;
  hotel_id: string;
  name: string;
  description?: string | null;
  price: number;
  is_active: boolean;
  [key: string]: any;
};

export type BookingEngineConfig = {
  id: string;
  hotel_id: string;
  is_enabled: boolean;
  theme_color: string;
  hero_title?: string | null;
  hero_subtitle?: string | null;
  logo_url?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  contact_address?: string | null;
  show_rooms: boolean;
  allow_partial_payment: boolean;
  partial_payment_pct: number;
  min_advance_days: number;
  max_advance_days: number;
  require_payment: boolean;
  gtm_header_script?: string | null;
  gtm_body_script?: string | null;
  terms_url?: string | null;
  privacy_url?: string | null;
  hero_banner_url?: string | null;
  show_hero_banner?: boolean;
  hero_overlay_opacity?: number;
  payment_gateway?: string | null;
  payment_enabled?: boolean;
  payment_amount_type?: string | null;
  advance_percentage?: number;
  razorpay_key_id?: string | null;
  cashfree_app_id?: string | null;
  upi_id?: string | null;
  upi_qr_url?: string | null;
  payment_notes?: string | null;
  
  // Sections
  about_title?: string | null;
  about_description?: string | null;
  about_image_url?: string | null;
  show_about_section?: boolean;
  amenities?: string[] | null;
  show_amenities_section?: boolean;
  gallery_images?: string[] | null;
  gallery_title?: string | null;
  show_gallery_section?: boolean;
  testimonials?: any[] | null;
  show_testimonials?: boolean;
  map_embed_url?: string | null;
  show_map?: boolean;
  faqs?: any[] | null;
  show_faq?: boolean;
  
  // Social & Footer
  facebook_url?: string | null;
  instagram_url?: string | null;
  whatsapp_number?: string | null;
  footer_text?: string | null;
  check_in_time?: string | null;
  check_out_time?: string | null;
  
  [key: string]: any;
};

// ═══════════════════════════════════════════════
// 1. FETCH HOTEL BY SLUG
// ═══════════════════════════════════════════════
export async function fetchHotelBySlug(slug: string): Promise<PublicHotel | null> {
  if (!slug) return null;
  const { data, error } = await supabase
    .from("hotels")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("[fetchHotelBySlug]", error);
    return null;
  }
  return data as PublicHotel | null;
}

// ═══════════════════════════════════════════════
// 2. FETCH BOOKING ENGINE CONFIG
// ═══════════════════════════════════════════════
export async function fetchPublicConfig(hotelId: string): Promise<BookingEngineConfig | null> {
  if (!hotelId) return null;
  const { data, error } = await supabase
    .from("booking_engine_settings")
    .select("*")
    .eq("hotel_id", hotelId)
    .maybeSingle();

  if (error) {
    console.error("[fetchPublicConfig]", error);
    return null;
  }
  return data as BookingEngineConfig | null;
}

// ═══════════════════════════════════════════════
// 3. FETCH ROOM TYPES
// ═══════════════════════════════════════════════
export async function fetchPublicRoomTypes(hotelId: string): Promise<PublicRoomType[]> {
  if (!hotelId) return [];
  const { data, error } = await supabase
    .from("rooms")
    .select("room_type, description, base_price, max_adults, max_children, photo_url, hotel_id, id")
    .eq("hotel_id", hotelId)
    .order("base_price", { ascending: true });

  if (error) {
    console.error("[fetchPublicRoomTypes]", error);
    return [];
  }

  // Deduplicate room types (if multiple rooms share the same type)
  const uniqueTypes = new Map<string, PublicRoomType>();
  for (const room of data || []) {
    if (!uniqueTypes.has(room.room_type)) {
      uniqueTypes.set(room.room_type, room as PublicRoomType);
    }
  }
  return Array.from(uniqueTypes.values());
}

// ═══════════════════════════════════════════════
// 4. FETCH RATE PLANS
// ═══════════════════════════════════════════════
export async function fetchPublicRatePlans(hotelId: string): Promise<PublicRatePlan[]> {
  if (!hotelId) return [];
  const { data, error } = await supabase
    .from("rate_plans")
    .select("*")
    .eq("hotel_id", hotelId)
    .eq("is_active", true)
    .order("rate_difference", { ascending: true });

  if (error) {
    console.error("[fetchPublicRatePlans]", error);
    return [];
  }
  return (data || []) as PublicRatePlan[];
}

// ═══════════════════════════════════════════════
// 5. FETCH ADD-ONS (NEW FEATURE)
// ═══════════════════════════════════════════════
export async function fetchPublicAddons(hotelId: string): Promise<PublicAddon[]> {
  if (!hotelId) return [];
  
  const { data, error } = await supabase
    .from("hotel_addons")
    .select("*")
    .eq("hotel_id", hotelId)
    .eq("is_active", true)
    .order("price", { ascending: true });

  if (error) {
    console.error("[fetchPublicAddons]", error);
    return [];
  }
  return (data || []) as PublicAddon[];
}

// ═══════════════════════════════════════════════
// 6. CHECK AVAILABILITY (ROOMS LEFT)
// ═══════════════════════════════════════════════
export async function checkAvailability(
  hotelId: string,
  roomType: string,
  checkIn: string,
  checkOut: string
): Promise<number> {
  if (!hotelId || !roomType || !checkIn || !checkOut) return 0;

  // 1. Total rooms of this type in the hotel
  const { data: roomsData } = await supabase
    .from("rooms")
    .select("id")
    .eq("hotel_id", hotelId)
    .eq("room_type", roomType);

  const totalRooms = roomsData?.length || 0;
  if (totalRooms === 0) return 0;

  // 2. Booked rooms overlapping these dates
  const { data: bookingsData } = await supabase
    .from("bookings")
    .select("room_id")
    .eq("hotel_id", hotelId)
    .in("status", ["CONFIRMED", "CHECKED-IN", "PENDING DEPARTURE", "BLOCKED"])
    .lt("check_in", checkOut)
    .gt("check_out", checkIn);

  const bookedRoomIds = new Set((bookingsData || []).map((b: any) => b.room_id).filter(Boolean));
  
  // Calculate available rooms
  const availableCount = (roomsData || []).filter(r => !bookedRoomIds.has(r.id)).length;
  
  return Math.max(0, availableCount);
}

// ═══════════════════════════════════════════════
// 7. COMPUTE TAX (GST)
// ═══════════════════════════════════════════════
export function computeTax(amount: number): number {
  // Standard Indian Hotel GST Rules
  // <= 7500: 12%, > 7500: 18%
  if (amount <= 7500) {
    return Math.round(amount * 0.12 * 100) / 100;
  }
  return Math.round(amount * 0.18 * 100) / 100;
}
