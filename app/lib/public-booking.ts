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

export type RateCalendarEntry = {
  room_type: string;
  rate_plan_code: string;
  date: string;
  occupancy_code: string;
  price: number;
};

// ═══════════════════════════════════════════════
// SAFE HELPERS
// ═══════════════════════════════════════════════
function safeArray(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {
      return value.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  return [];
}

function safeString(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return String(value);
}

function safeNumber(value: any, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const n = Number(value);
  return isNaN(n) ? fallback : n;
}

// ═══════════════════════════════════════════════
// FETCH HOTEL BY SLUG
// ═══════════════════════════════════════════════
export async function fetchHotelBySlug(slug: string): Promise<PublicHotel | null> {
  if (!slug) return null;

  const { data: bySlug } = await supabase
    .from('hotels')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (bySlug) return bySlug as PublicHotel;

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
// FETCH PUBLIC CONFIG
// ═══════════════════════════════════════════════
export async function fetchPublicConfig(hotelId: string): Promise<BookingEngineConfig | null> {
  if (!hotelId) return null;

  let { data } = await supabase
    .from('booking_engine_config')
    .select('*')
    .eq('hotel_id', hotelId)
    .maybeSingle();

  if (!data) {
    const fallback = await supabase
      .from('booking_config')
      .select('*')
      .eq('hotel_id', hotelId)
      .maybeSingle();
    data = fallback.data;
  }

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
            price_1a: safeNumber(rp.price_1a, safeNumber(d.base_price)),
            price_2a: safeNumber(rp.price_2a, safeNumber(d.base_price)),
            price_extra_adult: safeNumber(rp.price_extra_adult, safeNumber(d.base_price) * 0.5),
            price_child: safeNumber(rp.price_child, 0),
            base_price: safeNumber(d.base_price),
          }))
        : [
            {
              code: 'EP',
              name: 'European Plan (Room Only)',
              description: 'Room only, no meals',
              price_1a: safeNumber(d.base_price),
              price_2a: safeNumber(d.base_price),
              price_extra_adult: safeNumber(d.base_price) * 0.5,
              price_child: 0,
              base_price: safeNumber(d.base_price),
            },
          ];

      const photosArray = safeArray(d.photos);
      const amenitiesArray = safeArray(d.amenities);

      typeMap.set(d.room_type, {
        id: d.id,
        hotel_id: d.hotel_id,
        room_type: d.room_type,
        description: safeString(d.description),
        base_price: safeNumber(d.base_price),
        max_adults: safeNumber(d.max_adults, 2),
        max_children: safeNumber(d.max_children, 0),
        max_infants: safeNumber(d.max_infants, 0),
        photos: photosArray,
        photo_url: photosArray[0] || null,
        amenities: amenitiesArray,
        bed_type: safeString(d.bed_type),
        bed_count: safeNumber(d.bed_count, 1),
        room_size: safeString(d.room_size),
        view_type: safeString(d.view_type),
        floor_type: safeString(d.floor_type),
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
// VALIDATE PROMO
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
// COMPUTE TAX (12%)
// ═══════════════════════════════════════════════
export function computeTax(amount: number): number {
  if (!amount || amount <= 0) return 0;
  return Math.round(amount * 0.12);
}

// ═══════════════════════════════════════════════
// GET PRICE FOR OCCUPANCY (from rate_plans fallback)
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
    return safeNumber(plan.price_1a, safeNumber(plan.base_price)) + c * safeNumber(plan.price_child);
  }
  const base = safeNumber(plan.price_2a, safeNumber(plan.base_price));
  const extra = Math.max(0, a - 2) * safeNumber(plan.price_extra_adult);
  const childTotal = c * safeNumber(plan.price_child);
  return base + extra + childTotal;
}

// ═══════════════════════════════════════════════
// TAX CONFIG
// ═══════════════════════════════════════════════
export type TaxConfig = {
  enabled: boolean;
  rate: number;
  label: string;
  cgst: number;
  sgst: number;
  showSplit: boolean;
};

export function getTaxConfig(config: BookingEngineConfig | null): TaxConfig {
  return {
    enabled: config?.tax_enabled !== false,
    rate: Number(config?.tax_rate ?? 12),
    label: config?.tax_label || "GST",
    cgst: Number(config?.tax_cgst ?? 6),
    sgst: Number(config?.tax_sgst ?? 6),
    showSplit: config?.tax_show_split !== false,
  };
}

export function computeTaxWithConfig(amount: number, taxConfig: TaxConfig): number {
  if (!taxConfig.enabled || !amount || amount <= 0) return 0;
  return Math.round(amount * (taxConfig.rate / 100));
}

// ═══════════════════════════════════════════════
// 🆕 FETCH RATE CALENDAR (for date range)
// ═══════════════════════════════════════════════
export async function fetchRateCalendar(
  hotelId: string,
  checkIn: string,
  checkOut: string
): Promise<RateCalendarEntry[]> {
  if (!hotelId || !checkIn || !checkOut) return [];

  const { data, error } = await supabase
    .from("rate_calendar")
    .select("room_type, rate_plan_code, date, occupancy_code, price")
    .eq("hotel_id", hotelId)
    .eq("is_active", true)
    .gte("date", checkIn)
    .lt("date", checkOut);

  if (error) {
    console.error("[fetchRateCalendar]", error);
    return [];
  }

  return (data || []).map((r: any) => ({
    room_type: r.room_type,
    rate_plan_code: r.rate_plan_code,
    date: r.date,
    occupancy_code: r.occupancy_code,
    price: Number(r.price) || 0,
  }));
}

// ═══════════════════════════════════════════════
// 🆕 CALCULATE TOTAL FROM CALENDAR
// ═══════════════════════════════════════════════
export function calculateTotalFromCalendar(
  calendarData: RateCalendarEntry[],
  roomType: string,
  ratePlanCode: string,
  checkIn: string,
  checkOut: string,
  adults: number,
  children: number
): { total: number; nights: number; avgPerNight: number; hasCalendarRate: boolean } {
  const [ciY, ciM, ciD] = checkIn.split("-").map(Number);
  const [coY, coM, coD] = checkOut.split("-").map(Number);
  const nights = Math.max(
    1,
    Math.round(
      (new Date(coY, coM - 1, coD).getTime() - new Date(ciY, ciM - 1, ciD).getTime()) /
        86400000
    )
  );

  let total = 0;
  let foundNights = 0;

  const current = new Date(ciY, ciM - 1, ciD);

  for (let i = 0; i < nights; i++) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, "0");
    const d = String(current.getDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${d}`;

    // Find all 5 occupancy entries for this night
    const nightEntries = calendarData.filter(
      (e) =>
        e.room_type === roomType &&
        e.rate_plan_code === ratePlanCode &&
        e.date === dateStr
    );

    if (nightEntries.length > 0) {
      const priceMap: Record<string, number> = {};
      nightEntries.forEach((e) => {
        priceMap[e.occupancy_code] = Number(e.price) || 0;
      });

      const price_1A = priceMap["1A"] || 0;
      const price_2A = priceMap["2A"] || 0;
      const price_EA = priceMap["EA"] || 0;
      const price_c712 = priceMap["C7-12"] || 0;
      const price_c06 = priceMap["C0-6"] || 0;

      let nightlyPrice = 0;
      if (adults === 1) {
        nightlyPrice = price_1A;
      } else if (adults === 2) {
        nightlyPrice = price_2A;
      } else {
        nightlyPrice = price_2A + (adults - 2) * price_EA;
      }

      // Add children (assume 7-12 for pricing)
      nightlyPrice += children * price_c712;

      total += nightlyPrice;
      foundNights++;
    }

    current.setDate(current.getDate() + 1);
  }

  return {
    total,
    nights,
    avgPerNight: foundNights > 0 ? Math.round(total / foundNights) : 0,
    hasCalendarRate: foundNights > 0,
  };
}
