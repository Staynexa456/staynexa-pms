// app/lib/public-booking.ts
import { supabase } from '../supabase';

// ═══════════════════════════════════════════════
// TYPES
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
  code: string;
  name: string;
  description?: string;
  price_1a?: number;
  price_2a?: number;
  price_extra_adult?: number;
  price_child?: number;
  base_price?: number;
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
  [key: string]: any;
};

export type BookingEngineConfig = {
  hotel_id?: string;
  is_enabled?: boolean;
  theme_color?: string;
  payment_enabled?: boolean;
  payment_gateway?: string;
  allow_partial_payment?: boolean;
  partial_payment_pct?: number;
  show_full_payment?: boolean;
  show_partial_payment?: boolean;
  show_pay_at_property?: boolean;
  [key: string]: any;
};

// ═══════════════════════════════════════════════
// FETCH HOTEL BY SLUG (with fallbacks)
// ═══════════════════════════════════════════════
export async function fetchHotelBySlug(slug: string): Promise<PublicHotel | null> {
  if (!slug) return null;

  // Try slug column
  const { data: bySlug } = await supabase
    .from('hotels')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (bySlug) return bySlug as PublicHotel;

  // Fallback: guess name from slug
  const nameGuess = slug
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const { data: byName } = await supabase
    .from('hotels')
    .select('*')
    .ilike('name', `%${nameGuess}%`)
    .limit(1)
    .maybeSingle();

  return (byName as PublicHotel) || null;
}

// ═══════════════════════════════════════════════
// FETCH PUBLIC CONFIG (with default fallback)
// ═══════════════════════════════════════════════
export async function fetchPublicConfig(hotelId: string): Promise<BookingEngineConfig | null> {
  if (!hotelId) return null;

  // Try booking_engine_config table
  let { data } = await supabase
    .from('booking_engine_config')
    .select('*')
    .eq('hotel_id', hotelId)
    .maybeSingle();

  // Fallback: try booking_config table
  if (!data) {
    const fallback = await supabase
      .from('booking_config')
      .select('*')
      .eq('hotel_id', hotelId)
      .maybeSingle();
    data = fallback.data;
  }

  // If nothing found, return a default enabled config
  if (!data) {
    return {
      hotel_id: hotelId,
      is_enabled: true,
      theme_color: "#0f172a",
      payment_enabled: false,
      payment_gateway: "none",
      show_full_payment: true,
      show_partial_payment: false,
      show_pay_at_property: true,
      allow_partial_payment: false,
      partial_payment_pct: 50,
      check_in_time: "12:00 PM",
      check_out_time: "11:00 AM",
    };
  }

  return data as BookingEngineConfig;
}

// ═══════════════════════════════════════════════
// FETCH PUBLIC ROOM TYPES
// ═══════════════════════════════════════════════
export async function fetchPublicRoomTypes(hotelId: string): Promise<PublicRoomType[]> {
  if (!hotelId) return [];

  const { data: rooms, error: roomErr } = await supabase
    .from('rooms')
    .select('*')
    .eq('hotel_id', hotelId);

  if (roomErr || !rooms || rooms.length === 0) return [];

  // Fetch rate plans
  const { data: ratePlans } = await supabase
    .from('rate_plans')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('is_active', true);

  const typeMap = new Map<string, PublicRoomType>();

  rooms.forEach((d: any) => {
    if (!typeMap.has(d.room_type)) {
      const plansForType = (ratePlans || []).filter(
        (rp: any) => rp.room_type === d.room_type || !rp.room_type
      );

      const finalPlans = plansForType.length > 0
        ? plansForType.map((rp: any) => ({
            code: rp.code || 'EP',
            name: rp.name || 'European Plan',
            description: rp.description || 'Room only',
            price_1a: rp.price_1a || d.base_price,
            price_2a: rp.price_2a || d.base_price,
            price_extra_adult: rp.price_extra_adult || d.base_price * 0.5,
            price_child: rp.price_child || 0,
            base_price: d.base_price,
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
            },
          ];

      typeMap.set(d.room_type, {
        id: d.id,
        hotel_id: d.hotel_id,
        room_type: d.room_type,
        description: d.description || '',
        base_price: d.base_price || 0,
        max_adults: d.max_adults ?? 2,
        max_children: d.max_children ?? 0,
        max_infants: d.max_infants ?? 0,
        photos: d.photos || [],
        photo_url: d.photo_url || d.photos?.[0] || null,
        amenities: d.amenities || [],
        bed_type: d.bed_type,
        room_size: d.room_size,
        view_type: d.view_type,
        total_rooms: 0,
        rate_plans: finalPlans,
      });
    }
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
  const { data } = await supabase
    .from('addons')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('is_active', true);
  return data || [];
}

// ═══════════════════════════════════════════════
// VALIDATE PROMO CODE
// ═══════════════════════════════════════════════
export async function validatePromoCode(hotelId: string, code: string): Promise<any | null> {
  if (!hotelId || !code) return null;
  const { data } = await supabase
    .from('promo_codes')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .maybeSingle();
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
  return data;
}

// ═══════════════════════════════════════════════
// CHECK AVAILABILITY
// ═══════════════════════════════════════════════
export async function checkAvailabilityBatch(
  hotelId: string,
  checkIn: string,
  checkOut: string
): Promise<Record<string, number>> {
  if (!hotelId || !checkIn || !checkOut) return {};

  const { data: rooms } = await supabase
    .from('rooms')
    .select('id, room_type')
    .eq('hotel_id', hotelId);

  if (!rooms) return {};

  const { data: conflicts } = await supabase
    .from('bookings')
    .select('room_id')
    .eq('hotel_id', hotelId)
    .in('status', ['CONFIRMED', 'CHECKED-IN', 'PENDING DEPARTURE', 'BLOCKED'])
    .lt('check_in', checkOut)
    .gt('check_out', checkIn);

  const bookedRoomIds = new Set((conflicts || []).map((b: any) => b.room_id).filter(Boolean));

  const counts: Record<string, number> = {};
  rooms.forEach((r: any) => {
    if (!counts[r.room_type]) counts[r.room_type] = 0;
    if (!bookedRoomIds.has(r.id)) counts[r.room_type] += 1;
  });

  return counts;
}

// ═══════════════════════════════════════════════
// COMPUTE TAX (12% GST)
// ═══════════════════════════════════════════════
export function computeTax(amount: number): number {
  if (!amount || amount <= 0) return 0;
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
  const a = Math.max(1, adults || 1);
  const c = Math.max(0, children || 0);

  if (a === 1) {
    return (plan.price_1a || plan.base_price || 0) + (c * (plan.price_child || 0));
  }
  const base = plan.price_2a || plan.base_price || 0;
  const extra = Math.max(0, a - 2) * (plan.price_extra_adult || 0);
  const childTotal = c * (plan.price_child || 0);
  return base + extra + childTotal;
}
