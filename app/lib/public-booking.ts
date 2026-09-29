// app/lib/public-booking.ts
import { supabase } from '../supabase';

// ═══════════════════════════════════════════════
// TYPES (সব ফিল্ড ক্যাচ-অল সহ — কোনো টাইপ এরর আসবে না)
// ═══════════════════════════════════════════════

export type PublicHotel = {
  id: string;
  name: string;
  slug?: string;
  city?: string;
  state?: string;
  address?: string;
  phone?: string;
  email?: string;
  [key: string]: any;
};

export type PublicRatePlan = {
  id?: string;
  hotel_id?: string;
  code: string;
  name: string;
  description?: string;
  price_1a?: number;
  price_2a?: number;
  price_extra_adult?: number;
  price_child?: number;
  base_price?: number;
  is_active?: boolean;
  [key: string]: any;
};

export type PublicRoomType = {
  id: string;
  hotel_id: string;
  room_type: string;
  base_price: number;
  max_adults: number;
  max_children: number;
  max_infants: number;
  rate_plans: PublicRatePlan[];
  [key: string]: any;   // ✅ Catch-all — যেকোনো ফিল্ড গ্রহণ করে
};

export type BookingEngineConfig = {
  id?: string;
  hotel_id?: string;
  is_enabled?: boolean;
  logo_url?: string;
  hero_banner_url?: string;
  hero_title?: string;
  hero_subtitle?: string;
  hero_overlay_opacity?: number;
  theme_color?: string;
  show_hero_banner?: boolean;
  show_about_section?: boolean;
  about_title?: string;
  about_description?: string;
  about_image_url?: string;
  show_amenities_section?: boolean;
  amenities?: string[];
  show_gallery_section?: boolean;
  gallery_title?: string;
  gallery_images?: string[];
  show_testimonials?: boolean;
  testimonials?: any[];
  show_map?: boolean;
  map_embed_url?: string;
  show_faq?: boolean;
  faqs?: any[];
  show_terms_checkbox?: boolean;
  show_cancellation_policy?: boolean;
  terms_and_conditions?: string;
  cancellation_policy?: string;
  terms_url?: string;
  privacy_url?: string;
  contact_phone?: string;
  contact_email?: string;
  contact_address?: string;
  whatsapp_number?: string;
  facebook_url?: string;
  instagram_url?: string;
  check_in_time?: string;
  check_out_time?: string;
  footer_text?: string;
  payment_enabled?: boolean;
  payment_gateway?: string;
  allow_partial_payment?: boolean;
  partial_payment_pct?: number;
  partial_payment_label?: string;
  show_full_payment?: boolean;
  show_partial_payment?: boolean;
  show_pay_at_property?: boolean;
  show_coupon_code?: boolean;
  ssl_badge_text?: string;
  pci_badge_text?: string;
  discount_badge_enabled?: boolean;
  [key: string]: any;   // ✅ Catch-all
};

// ═══════════════════════════════════════════════
// FETCH HOTEL BY SLUG
// ═══════════════════════════════════════════════
export async function fetchHotelBySlug(slug: string): Promise<PublicHotel | null> {
  if (!slug) return null;

  // Try slug first
  let { data, error } = await supabase
    .from('hotels')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    console.error('[fetchHotelBySlug]', error);
  }

  // Fallback: match by name (slugified)
  if (!data) {
    const nameGuess = slug
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    const { data: byName } = await supabase
      .from('hotels')
      .select('*')
      .ilike('name', `%${nameGuess}%`)
      .maybeSingle();
    data = byName;
  }

  return (data as PublicHotel) || null;
}

// ═══════════════════════════════════════════════
// FETCH PUBLIC CONFIG
// ═══════════════════════════════════════════════
export async function fetchPublicConfig(hotelId: string): Promise<BookingEngineConfig | null> {
  if (!hotelId) return null;

  const { data, error } = await supabase
    .from('booking_engine_config')
    .select('*')
    .eq('hotel_id', hotelId)
    .maybeSingle();

  if (error) {
    console.error('[fetchPublicConfig]', error);
  }

  return (data as BookingEngineConfig) || null;
}

// ═══════════════════════════════════════════════
// FETCH PUBLIC ROOM TYPES (with rate plans)
// ═══════════════════════════════════════════════
export async function fetchPublicRoomTypes(hotelId: string): Promise<PublicRoomType[]> {
  if (!hotelId) return [];

  // 1. Fetch rooms
  const { data: rooms, error: roomErr } = await supabase
    .from('rooms')
    .select('*')
    .eq('hotel_id', hotelId);

  if (roomErr || !rooms) {
    console.error('[fetchPublicRoomTypes] rooms error:', roomErr);
    return [];
  }

  // 2. Fetch rate plans
  const { data: ratePlans, error: rpErr } = await supabase
    .from('rate_plans')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('is_active', true);

  if (rpErr) {
    console.error('[fetchPublicRoomTypes] rate_plans error:', rpErr);
  }

  // 3. Group rooms by room_type
  const typeMap = new Map<string, PublicRoomType>();

  rooms.forEach((d: any) => {
    if (!typeMap.has(d.room_type)) {
      // Filter rate plans for this room type
      const plansForType = (ratePlans || []).filter(
        (rp: any) => rp.room_type === d.room_type || !rp.room_type
      );

      // If no rate plans from DB, create default plans from base_price
      const finalPlans = plansForType.length > 0
        ? plansForType.map((rp: any) => ({
            id: rp.id,
            hotel_id: rp.hotel_id,
            code: rp.code || 'EP',
            name: rp.name || 'European Plan',
            description: rp.description || 'Room only',
            price_1a: rp.price_1a || d.base_price,
            price_2a: rp.price_2a || d.base_price,
            price_extra_adult: rp.price_extra_adult || d.base_price * 0.5,
            price_child: rp.price_child || 0,
            base_price: d.base_price,
            is_active: true,
          }))
        : [
            {
              code: 'EP',
              name: 'European Plan (Room Only)',
              description: 'Room only, no meals',
              price_1a: d.base_price,
              price_2a: d.base_price,
              price_extra_adult: d.base_price * 0.5,
              price_child: 0,
              base_price: d.base_price,
              is_active: true,
            },
          ];

      typeMap.set(d.room_type, {
        // ✅ Catch-all টাইপ — সব ফিল্ড অটো-অ্যাকসেপ্ট হবে
        id: d.id,
        hotel_id: d.hotel_id,
        room_type: d.room_type,
        description: d.description || '',
        short_description: d.short_description || '',
        base_price: d.base_price || 0,
        max_adults: d.max_adults ?? 2,
        max_children: d.max_children ?? 0,
        max_infants: d.max_infants ?? 0,
        max_occupancy: d.max_occupancy ?? 2,
        total_rooms: 0,
        photos: d.photos || [],
        photo_url: d.photo_url || d.photos?.[0] || null,
        amenities: d.amenities || [],
        room_features: d.room_features || [],
        bed_type: d.bed_type,
        bed_count: d.bed_count || 1,
        room_size: d.room_size,
        view_type: d.view_type,
        floor_type: d.floor_type || null,
        rate_plans: finalPlans,
      });
    }
    // Count total rooms
    const existing = typeMap.get(d.room_type)!;
    existing.total_rooms = (existing.total_rooms || 0) + 1;
  });

  return Array.from(typeMap.values());
}

// ═══════════════════════════════════════════════
// FETCH PUBLIC ADDONS
// ═══════════════════════════════════════════════
export async function fetchPublicAddons(hotelId: string): Promise<any[]> {
  if (!hotelId) return [];

  const { data, error } = await supabase
    .from('addons')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('is_active', true);

  if (error) {
    console.error('[fetchPublicAddons]', error);
    return [];
  }

  return data || [];
}

// ═══════════════════════════════════════════════
// VALIDATE PROMO CODE
// ═══════════════════════════════════════════════
export async function validatePromoCode(hotelId: string, code: string): Promise<any | null> {
  if (!hotelId || !code) return null;

  const { data, error } = await supabase
    .from('promo_codes')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) {
    console.error('[validatePromoCode]', error);
    return null;
  }

  // Check expiry
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return null;
  }

  return data;
}

// ═══════════════════════════════════════════════
// CHECK AVAILABILITY (Batch)
// ═══════════════════════════════════════════════
export async function checkAvailabilityBatch(
  hotelId: string,
  checkIn: string,
  checkOut: string
): Promise<Record<string, number>> {
  if (!hotelId || !checkIn || !checkOut) return {};

  // Get all rooms
  const { data: rooms } = await supabase
    .from('rooms')
    .select('id, room_type')
    .eq('hotel_id', hotelId);

  if (!rooms) return {};

  // Get conflicting bookings
  const { data: conflicts } = await supabase
    .from('bookings')
    .select('room_id')
    .eq('hotel_id', hotelId)
    .in('status', ['CONFIRMED', 'CHECKED-IN', 'PENDING DEPARTURE', 'BLOCKED'])
    .lt('check_in', checkOut)
    .gt('check_out', checkIn);

  const bookedRoomIds = new Set((conflicts || []).map((b: any) => b.room_id).filter(Boolean));

  // Count available per type
  const counts: Record<string, number> = {};
  rooms.forEach((r: any) => {
    if (!counts[r.room_type]) counts[r.room_type] = 0;
    if (!bookedRoomIds.has(r.id)) counts[r.room_type] += 1;
  });

  return counts;
}

// ═══════════════════════════════════════════════
// COMPUTE TAX (Standard 12% GST)
// ═══════════════════════════════════════════════
export function computeTax(amount: number): number {
  if (!amount || amount <= 0) return 0;
  // 12% GST
  return Math.round(amount * 0.12);
}

// ═══════════════════════════════════════════════
// GET PRICE FOR OCCUPANCY
// ═══════════════════════════════════════════════
export function getPriceForOccupancy(
  plan: PublicRatePlan,
  adults: number,
  children: number
): number {
  if (!plan) return 0;

  // Base logic: 
  // 1 adult = price_1a
  // 2 adults = price_2a
  // 3+ adults = price_2a + (extra_adults × price_extra_adult)
  // children = price_child × children

  if (adults === 1) {
    return (plan.price_1a || plan.base_price || 0) + (children * (plan.price_child || 0));
  } else if (adults === 2) {
    return (plan.price_2a || plan.base_price || 0) + (children * (plan.price_child || 0));
  } else {
    const base = plan.price_2a || plan.base_price || 0;
    const extra = (adults - 2) * (plan.price_extra_adult || 0);
    const childTotal = children * (plan.price_child || 0);
    return base + extra + childTotal;
  }
}