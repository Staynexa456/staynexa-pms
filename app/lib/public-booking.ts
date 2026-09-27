// app/lib/public-booking.ts
import { supabase } from "../supabase";

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════
export type PublicHotel = { id: string; name: string; slug: string; city?: string | null; state?: string | null; address?: string | null; phone?: string | null; email?: string | null; [key: string]: any; };
export type PublicRoomType = { id: string; hotel_id: string; room_type: string; description?: string | null; base_price: number; max_adults: number; max_children: number; photo_url?: string | null; total_rooms?: number; [key: string]: any; };
export type PublicRatePlan = { id?: string; hotel_id?: string; code: string; name: string; description?: string | null; rate_difference: number; min_length_of_stay: number; [key: string]: any; };
export type PublicAddon = { id: string; hotel_id: string; name: string; description?: string | null; price: number; is_active: boolean; [key: string]: any; };
export type PublicPromoCode = { id: string; hotel_id: string; code: string; discount_type: "percentage" | "fixed"; discount_value: number; min_order_amount: number; valid_until: string; is_active: boolean; [key: string]: any; };

export type BookingEngineConfig = {
  id: string; hotel_id: string; is_enabled: boolean; theme_color: string; hero_title?: string | null; hero_subtitle?: string | null; logo_url?: string | null;
  contact_phone?: string | null; contact_email?: string | null; contact_address?: string | null; show_rooms: boolean; allow_partial_payment: boolean;
  partial_payment_pct: number; min_advance_days: number; max_advance_days: number; require_payment: boolean; gtm_header_script?: string | null;
  gtm_body_script?: string | null; terms_url?: string | null; privacy_url?: string | null; hero_banner_url?: string | null; show_hero_banner?: boolean;
  hero_overlay_opacity?: number; payment_gateway?: string | null; payment_enabled?: boolean; payment_amount_type?: string | null; advance_percentage?: number;
  razorpay_key_id?: string | null; cashfree_app_id?: string | null; upi_id?: string | null; upi_qr_url?: string | null; payment_notes?: string | null;
  about_title?: string | null; about_description?: string | null; about_image_url?: string | null; show_about_section?: boolean; amenities?: string[] | null;
  show_amenities_section?: boolean; gallery_images?: string[] | null; gallery_title?: string | null; show_gallery_section?: boolean; testimonials?: any[] | null;
  show_testimonials?: boolean; map_embed_url?: string | null; show_map?: boolean; faqs?: any[] | null; show_faq?: boolean; facebook_url?: string | null;
  instagram_url?: string | null; whatsapp_number?: string | null; footer_text?: string | null; check_in_time?: string | null; check_out_time?: string | null;
  [key: string]: any;
};

// ═══════════════════════════════════════════════
// FETCH FUNCTIONS
// ═══════════════════════════════════════════════
export async function fetchHotelBySlug(slug: string): Promise<PublicHotel | null> {
  if (!slug) return null;
  const { data, error } = await supabase.from("hotels").select("*").eq("slug", slug).maybeSingle();
  if (error) { console.error("[fetchHotelBySlug]", error); return null; }
  return data as PublicHotel | null;
}

export async function fetchPublicConfig(hotelId: string): Promise<BookingEngineConfig | null> {
  if (!hotelId) return null;
  const { data, error } = await supabase.from("booking_engine_settings").select("*").eq("hotel_id", hotelId).maybeSingle();
  if (error) { console.error("[fetchPublicConfig]", error); return null; }
  return data as BookingEngineConfig | null;
}

export async function fetchPublicRoomTypes(hotelId: string): Promise<PublicRoomType[]> {
  if (!hotelId) return [];
  const { data: details } = await supabase.from("room_type_details").select("*").eq("hotel_id", hotelId).order("display_order", { ascending: true });
  const { data: rooms } = await supabase.from("rooms").select("id, room_type, base_price").eq("hotel_id", hotelId);
  if (!details || details.length === 0) return [];

  const typeMap = new Map<string, PublicRoomType>();
  for (const d of details) {
    const roomsOfType = (rooms || []).filter(r => r.room_type === d.room_type);
    const minPrice = roomsOfType.length > 0 ? Math.min(...roomsOfType.map(r => Number(r.base_price) || 0)) : 0;
    typeMap.set(d.room_type, {
      id: d.id, hotel_id: d.hotel_id, room_type: d.room_type, description: d.description || "",
      max_adults: d.max_adults || 2, max_children: d.max_children || 0, photo_url: d.photo_url || null,
      base_price: minPrice, total_rooms: roomsOfType.length,
    });
  }
  return Array.from(typeMap.values());
}

export async function checkAvailabilityBatch(hotelId: string, checkIn: string, checkOut: string): Promise<Record<string, number>> {
  if (!hotelId || !checkIn || !checkOut) return {};
  const { data: rooms } = await supabase.from("rooms").select("id, room_type").eq("hotel_id", hotelId);
  if (!rooms || rooms.length === 0) return {};

  const { data: bookings } = await supabase.from("bookings").select("room_id").eq("hotel_id", hotelId)
    .in("status", ["CONFIRMED", "CHECKED-IN", "PENDING DEPARTURE", "BLOCKED"])
    .lt("check_in", checkOut).gt("check_out", checkIn);

  const bookedRoomIds = new Set((bookings || []).map((b: any) => b.room_id).filter(Boolean));
  const result: Record<string, number> = {};
  for (const room of rooms) {
    if (!bookedRoomIds.has(room.id)) {
      result[room.room_type] = (result[room.room_type] || 0) + 1;
    }
  }
  return result;
}

export async function fetchPublicRatePlans(hotelId: string): Promise<PublicRatePlan[]> {
  if (!hotelId) return [];
  const { data, error } = await supabase.from("rate_plans").select("*").eq("hotel_id", hotelId).eq("is_active", true).order("rate_difference", { ascending: true });
  if (error) return [];
  return (data || []) as PublicRatePlan[];
}

export async function fetchPublicAddons(hotelId: string): Promise<PublicAddon[]> {
  if (!hotelId) return [];
  const { data, error } = await supabase.from("hotel_addons").select("*").eq("hotel_id", hotelId).eq("is_active", true).order("price", { ascending: true });
  if (error) return [];
  return (data || []) as PublicAddon[];
}

export async function validatePromoCode(hotelId: string, code: string): Promise<PublicPromoCode | null> {
  if (!hotelId || !code) return null;
  const { data, error } = await supabase.from("promo_codes").select("*").eq("hotel_id", hotelId).eq("code", code.toUpperCase()).eq("is_active", true).maybeSingle();
  if (error || !data) return null;
  if (data.valid_until && new Date(data.valid_until) < new Date()) return null;
  return data as PublicPromoCode;
}

export function computeTax(amount: number): number {
  if (amount <= 7500) return Math.round(amount * 0.12 * 100) / 100;
  return Math.round(amount * 0.18 * 100) / 100;
}
