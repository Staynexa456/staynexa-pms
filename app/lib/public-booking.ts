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
  // app/lib/public-booking.ts এ BookingEngineConfig type এর ভেতরে যোগ করুন:

  // 🆕 Phase 1 - Advanced Booking Options
  terms_and_conditions?: string | null;
  show_terms_checkbox?: boolean;
  show_coupon_code?: boolean;
  show_price_breakdown?: boolean;
  ssl_badge_text?: string | null;
  pci_badge_text?: string | null;
  discount_badge_enabled?: boolean;
  [key: string]: any;
};

export type OccupancyCode = "1A" | "2A" | "EA" | "C7-12" | "C0-6";

export type PublicRatePlan = {
  code: string;
  name: string;
  description?: string | null;
  rate_difference: number;
  prices: Record<OccupancyCode, number>;
  price: number;
  min_length_of_stay: number;
  [key: string]: any;
};

export type PublicRoomType = {
  id: string;
  hotel_id: string;
  room_type: string;
  description?: string | null;
  short_description?: string | null;
  base_price: number;
  max_adults: number;
  max_children: number;
  max_occupancy?: number;
  photo_url?: string | null;
  photos?: string[];
  room_size?: string | null;
  bed_type?: string | null;
  bed_count?: number;
  view_type?: string | null;
  floor_type?: string | null;
  amenities?: string[];
  room_features?: string[];
  total_rooms?: number;
  rate_plans: PublicRatePlan[];
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

export type PublicPromoCode = {
  id: string;
  hotel_id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_order_amount: number;
  valid_until: string;
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
  facebook_url?: string | null;
  instagram_url?: string | null;
  whatsapp_number?: string | null;
  footer_text?: string | null;
  check_in_time?: string | null;
  check_out_time?: string | null;
  [key: string]: any;
};

// ═══════════════════════════════════════════════
// OCCUPANCY MULTIPLIERS (Fallback)
// ═══════════════════════════════════════════════
const DEFAULT_MULTIPLIERS: Record<OccupancyCode, number> = {
  "1A": 0.85,
  "2A": 1.0,
  EA: 0.35,
  "C7-12": 0.25,
  "C0-6": 0.15,
};

// ═══════════════════════════════════════════════
// 1. FETCH HOTEL
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
// 2. FETCH CONFIG
// ═══════════════════════════════════════════════
export async function fetchPublicConfig(
  hotelId: string
): Promise<BookingEngineConfig | null> {
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
// 3. FETCH ROOM TYPES WITH ALL OCCUPANCY PRICES
// ═══════════════════════════════════════════════
export async function fetchPublicRoomTypes(
  hotelId: string
): Promise<PublicRoomType[]> {
  if (!hotelId) return [];

  // Room Type Details
  const { data: details } = await supabase
    .from("room_type_details")
    .select("*")
    .eq("hotel_id", hotelId)
    .or("is_active.is.null,is_active.eq.true")
    .order("display_order", { ascending: true });

  if (!details || details.length === 0) return [];

  // Room Count
  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, room_type")
    .eq("hotel_id", hotelId)
    .or("is_active.is.null,is_active.eq.true");

  // Rate Plans
  const { data: ratePlans } = await supabase
    .from("rate_plans")
    .select("*")
    .eq("hotel_id", hotelId)
    .or("is_active.is.null,is_active.eq.true")
    .order("rate_difference", { ascending: true });

  // Rate Calendar (all occupancy tiers)
  const { data: calendarRows } = await supabase
    .from("rate_calendar")
    .select("room_type, rate_plan_code, occupancy_code, date, price")
    .eq("hotel_id", hotelId)
    .eq("is_active", true)
    .order("date", { ascending: true });

  // Build map
  const typeMap = new Map<string, PublicRoomType>();

  for (const d of details) {
    const roomsOfType = (rooms || []).filter((r) => r.room_type === d.room_type);
    const plansForType: PublicRatePlan[] = [];

    if (ratePlans && ratePlans.length > 0) {
      for (const plan of ratePlans) {
        // Build tier prices
        const tierPrices: Record<OccupancyCode, number> = {
          "1A": 0,
          "2A": 0,
          EA: 0,
          "C7-12": 0,
          "C0-6": 0,
        };

        const baseForPlan =
          Number(d.base_price || 0) + Number(plan.rate_difference || 0);

        // Find all 5 tier prices from rate_calendar
        for (const occ of Object.keys(tierPrices) as OccupancyCode[]) {
          const calRow = (calendarRows || []).find(
            (r) =>
              r.room_type === d.room_type &&
              r.rate_plan_code === plan.code &&
              r.occupancy_code === occ
          );

          if (calRow) {
            tierPrices[occ] = Number(calRow.price);
          } else {
            // Fallback: base * multiplier
            tierPrices[occ] = Math.round(baseForPlan * DEFAULT_MULTIPLIERS[occ]);
          }
        }

        plansForType.push({
          code: plan.code,
          name: plan.name,
          description: plan.description || null,
          rate_difference: Number(plan.rate_difference) || 0,
          prices: tierPrices,
          price: tierPrices["2A"],
          min_length_of_stay: plan.min_length_of_stay || 1,
        });
      }
    } else {
      // No rate plans → default
      const base = Number(d.base_price) || 0;
      const tierPrices: Record<OccupancyCode, number> = {
        "1A": Math.round(base * DEFAULT_MULTIPLIERS["1A"]),
        "2A": base,
        EA: Math.round(base * DEFAULT_MULTIPLIERS.EA),
        "C7-12": Math.round(base * DEFAULT_MULTIPLIERS["C7-12"]),
        "C0-6": Math.round(base * DEFAULT_MULTIPLIERS["C0-6"]),
      };
      plansForType.push({
        code: "STD",
        name: "Standard Rate",
        description: "Room only",
        rate_difference: 0,
        prices: tierPrices,
        price: base,
        min_length_of_stay: 1,
      });
    }

    const minPrice =
      plansForType.length > 0
        ? Math.min(...plansForType.map((p) => p.price))
        : Number(d.base_price) || 0;

    typeMap.set(d.room_type, {
      id: d.id,
      hotel_id: d.hotel_id,
      room_type: d.room_type,
      description: d.description || "",
      short_description: d.short_description || "",
      max_adults: d.max_adults || 2,
      max_children: d.max_children || 0,
      max_occupancy: d.max_occupancy || 2,
      photo_url: d.photo_url || d.photos?.[0] || null,
      photos: d.photos || [],
      room_size: d.room_size || null,
      bed_type: d.bed_type || null,
      bed_count: d.bed_count || 1,
      view_type: d.view_type || null,
      floor_type: d.floor_type || null,
      amenities: d.amenities || [],
      room_features: d.room_features || [],
      base_price: minPrice,
      total_rooms: roomsOfType.length,
      rate_plans: plansForType,
    });
  }

  return Array.from(typeMap.values());
}

// ═══════════════════════════════════════════════
// 4. GET PRICE FOR OCCUPANCY ✅ (এই ফাংশনটি মিসিং ছিল)
// ═══════════════════════════════════════════════
export function getPriceForOccupancy(
  plan: PublicRatePlan,
  adults: number,
  children: number
): number {
  const p = plan.prices;

  // 1 Adult only
  if (adults === 1 && children === 0) return p["1A"];

  // 2 Adults only
  if (adults === 2 && children === 0) return p["2A"];

  // 3+ Adults
  if (adults >= 3) {
    return p["2A"] + (adults - 2) * p["EA"];
  }

  // 2 Adults + children
  if (adults === 2 && children > 0) {
    return p["2A"] + children * p["C7-12"];
  }

  // 1 Adult + children
  if (adults === 1 && children > 0) {
    return p["1A"] + children * p["C7-12"];
  }

  // Fallback
  return p["2A"];
}

// ═══════════════════════════════════════════════
// 5. CHECK AVAILABILITY BATCH
// ═══════════════════════════════════════════════
export async function checkAvailabilityBatch(
  hotelId: string,
  checkIn: string,
  checkOut: string
): Promise<Record<string, number>> {
  if (!hotelId || !checkIn || !checkOut) return {};

  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, room_type")
    .eq("hotel_id", hotelId);

  if (!rooms || rooms.length === 0) return {};

  const { data: bookings } = await supabase
    .from("bookings")
    .select("room_id")
    .eq("hotel_id", hotelId)
    .in("status", ["CONFIRMED", "CHECKED-IN", "PENDING DEPARTURE", "BLOCKED"])
    .lt("check_in", checkOut)
    .gt("check_out", checkIn);

  const bookedRoomIds = new Set(
    (bookings || []).map((b: any) => b.room_id).filter(Boolean)
  );

  const result: Record<string, number> = {};
  for (const room of rooms) {
    if (!bookedRoomIds.has(room.id)) {
      result[room.room_type] = (result[room.room_type] || 0) + 1;
    }
  }
  return result;
}

// ═══════════════════════════════════════════════
// 6. FETCH ADD-ONS
// ═══════════════════════════════════════════════
export async function fetchPublicAddons(
  hotelId: string
): Promise<PublicAddon[]> {
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
// 7. VALIDATE PROMO CODE
// ═══════════════════════════════════════════════
export async function validatePromoCode(
  hotelId: string,
  code: string
): Promise<PublicPromoCode | null> {
  if (!hotelId || !code) return null;
  const { data, error } = await supabase
    .from("promo_codes")
    .select("*")
    .eq("hotel_id", hotelId)
    .eq("code", code.toUpperCase())
    .eq("is_active", true)
    .maybeSingle();
  if (error || !data) return null;
  if (data.valid_until && new Date(data.valid_until) < new Date()) return null;
  return data as PublicPromoCode;
}

// ═══════════════════════════════════════════════
// 8. COMPUTE TAX
// ═══════════════════════════════════════════════
export function computeTax(amount: number): number {
  if (amount <= 7500) return Math.round(amount * 0.12 * 100) / 100;
  return Math.round(amount * 0.18 * 100) / 100;
}
