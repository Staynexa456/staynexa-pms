// app/lib/public-booking.ts
import { supabase } from "../supabase";

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════
export type PublicHotel = { id: string; name: string; slug: string; city?: string | null; state?: string | null; address?: string | null; phone?: string | null; email?: string | null; [key: string]: any; };
export type PublicRoomType = { id: string; hotel_id: string; room_type: string; description?: string | null; base_price: number; max_adults: number; max_children: number; photo_url?: string | null; [key: string]: any; };
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
// 1. FETCH HOTEL BY SLUG
// ═══════════════════════════════════════════════
export async function fetchHotelBySlug(slug: string): Promise<PublicHotel | null> {
  if (!slug) return null;
  const { data, error } = await supabase.from("hotels").select("*").eq("slug", slug).maybeSingle();
  if (error) { console.error("[fetchHotelBySlug]", error); return null; }
  return data as PublicHotel | null;
}

// ═══════════════════════════════════════════════
// 2. FETCH BOOKING ENGINE CONFIG
// ═══════════════════════════════════════════════
export async function fetchPublicConfig(hotelId: string): Promise<BookingEngineConfig | null> {
  if (!hotelId) return null;
  const { data, error } = await supabase.from("booking_engine_settings").select("*").eq("hotel_id", hotelId).maybeSingle();
  if (error) { console.error("[fetchPublicConfig]", error); return null; }
  return data as BookingEngineConfig | null;
}

// ═══════════════════════════════════════════════
// 3. FETCH ROOM TYPES (MERGED FIX)
// ═══════════════════════════════════════════════
export async function fetchPublicRoomTypes(hotelId: string): Promise<PublicRoomType[]> {
  if (!hotelId) return [];

  // ১. ডিটেইলস (ছবি, বিবরণ, ম্যাক্স এডাল্ট) 'room_type_details' থেকে নিন
  const { data: details, error: detailsError } = await supabase
    .from("room_type_details")
    .select("*")
    .eq("hotel_id", hotelId);

  if (detailsError) {
    console.error("[fetchPublicRoomTypes] details error:", detailsError);
    return [];
  }

  // ২. বেস প্রাইস 'rooms' টেবিল থেকে নিন (ন্যূনতম দাম নিন)
  const { data: rooms, error: roomsError } = await supabase
    .from("rooms")
    .select("room_type, base_price")
    .eq("hotel_id", hotelId);

  if (roomsError) {
    console.error("[fetchPublicRoomTypes] rooms error:", roomsError);
    return [];
  }

  // ৩. দুটি ডাটা একত্রিত করুন
  const uniqueTypes = new Map<string, PublicRoomType>();

  // ডিটেইলস থেকে ডাটা সেভ করুন
  for (const d of details || []) {
    uniqueTypes.set(d.room_type, {
      id: d.id,
      hotel_id: d.hotel_id,
      room_type: d.room_type,
      description: d.description,
      max_adults: d.max_adults || 2,
      max_children: d.max_children || 0,
      photo_url: d.photo_url,
      base_price: 0, // সাময়িক, পরে আপডেট হবে
    } as PublicRoomType);
  }

  // রুমের দাম আপডেট করুন
  for (const r of rooms || []) {
    if (uniqueTypes.has(r.room_type)) {
      const existing = uniqueTypes.get(r.room_type)!;
      if (existing.base_price === 0 || r.base_price < existing.base_price) {
        existing.base_price = r.base_price;
      }
    } else {
      // যদি 'rooms' এ কোনো টাইপ থাকে যা 'room_type_details' এ নেই
      uniqueTypes.set(r.room_type, {
        id: r.room_type,
        hotel_id: hotelId,
        room_type: r.room_type,
        description: "",
        max_adults: 2,
        max_children: 0,
        photo_url: null,
        base_price: r.base_price || 0,
      } as PublicRoomType);
    }
  }

  return Array.from(uniqueTypes.values());
}

// ═══════════════════════════════════════════════
// 4. FETCH RATE PLANS
// ═══════════════════════════════════════════════
export async function fetchPublicRatePlans(hotelId: string): Promise<PublicRatePlan[]> {
  if (!hotelId) return [];
  const { data, error } = await supabase.from("rate_plans").select("*").eq("hotel_id", hotelId).eq("is_active", true).order("rate_difference", { ascending: true });
  if (error) { console.error("[fetchPublicRatePlans]", error); return []; }
  return (data || []) as PublicRatePlan[];
}

// ═══════════════════════════════════════════════
// 5. FETCH ADD-ONS
// ═══════════════════════════════════════════════
export async function fetchPublicAddons(hotelId: string): Promise<PublicAddon[]> {
  if (!hotelId) return [];
  const { data, error } = await supabase.from("hotel_addons").select("*").eq("hotel_id", hotelId).eq("is_active", true).order("price", { ascending: true });
  if (error) { console.error("[fetchPublicAddons]", error); return []; }
  return (data || []) as PublicAddon[];
}

// ═══════════════════════════════════════════════
// 6. VALIDATE PROMO CODE
// ═══════════════════════════════════════════════
export async function validatePromoCode(hotelId: string, code: string): Promise<PublicPromoCode | null> {
  if (!hotelId || !code) return null;
  const { data, error } = await supabase.from("promo_codes").select("*").eq("hotel_id", hotelId).eq("code", code.toUpperCase()).eq("is_active", true).maybeSingle();
  if (error || !data) return null;
  if (data.valid_until && new Date(data.valid_until) < new Date()) return null;
  return data as PublicPromoCode;
}

// ═══════════════════════════════════════════════
// 7. CHECK AVAILABILITY
// ═══════════════════════════════════════════════
export async function checkAvailability(hotelId: string, roomType: string, checkIn: string, checkOut: string): Promise<number> {
  if (!hotelId || !roomType || !checkIn || !checkOut) return 0;

  // ১. ঐ টাইপের মোট রুম সংখ্যা
  const { data: roomsData } = await supabase.from("rooms").select("id").eq("hotel_id", hotelId).eq("room_type", roomType);
  const totalRooms = roomsData?.length || 0;
  if (totalRooms === 0) return 0;

  // ২. বুক করা রুমের তালিকা
  const { data: bookingsData } = await supabase.from("bookings").select("room_id").eq("hotel_id", hotelId).in("status", ["CONFIRMED", "CHECKED-IN", "PENDING DEPARTURE", "BLOCKED"]).lt("check_in", checkOut).gt("check_out", checkIn);
  const bookedRoomIds = new Set((bookingsData || []).map((b: any) => b.room_id).filter(Boolean));

  // ৩. এভেইলেবল রুম ক্যালকুলেশন
  const availableCount = (roomsData || []).filter(r => !bookedRoomIds.has(r.id)).length;
  return Math.max(0, availableCount);
}

// ═══════════════════════════════════════════════
// 8. COMPUTE TAX
// ═══════════════════════════════════════════════
export function computeTax(amount: number): number {
  if (amount <= 7500) return Math.round(amount * 0.12 * 100) / 100;
  return Math.round(amount * 0.18 * 100) / 100;
}
