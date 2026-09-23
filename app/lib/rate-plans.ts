// app/lib/rate-plans.ts
import { supabase } from "../supabase";

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════

export type RatePlan = {
  id: string;
  hotel_id: string;
  code: string;
  name: string;
  description?: string;
  meal_plan: "NONE" | "BREAKFAST" | "HALF_BOARD" | "FULL_BOARD" | "ALL_MEALS";
  is_active: boolean;
  sort_order: number;
};

export type RateOverride = {
  id: string;
  hotel_id: string;
  room_type: string;
  rate_plan_id: string;
  date: string;
  price: number;
  min_stay: number;
};

export type RateGrid = {
  roomTypes: string[];
  ratePlans: RatePlan[];
  dates: string[];
  // prices[roomType][ratePlanId][date] = price
  prices: Record<string, Record<string, Record<string, number>>>;
  basePrices: Record<string, number>; // roomType -> base price
};

// ═══════════════════════════════════════════════
// DEFAULTS
// ═══════════════════════════════════════════════

export const DEFAULT_RATE_PLANS = [
  { code: "EP", name: "European Plan (Room Only)", meal_plan: "NONE" as const, description: "Room only, no meals", sort_order: 1 },
  { code: "CP", name: "Continental Plan (Breakfast)", meal_plan: "BREAKFAST" as const, description: "Room + Breakfast", sort_order: 2 },
  { code: "MAP", name: "Modified American Plan", meal_plan: "HALF_BOARD" as const, description: "Room + Breakfast + 1 Meal", sort_order: 3 },
  { code: "AP", name: "American Plan (All Meals)", meal_plan: "ALL_MEALS" as const, description: "Room + Breakfast + Lunch + Dinner", sort_order: 4 },
];

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function generateDateRange(startDate: string, endDate: string): string[] {
  const out: string[] = [];
  const [y1, m1, d1] = startDate.split("-").map(Number);
  const [y2, m2, d2] = endDate.split("-").map(Number);
  const current = new Date(y1, m1 - 1, d1);
  const end = new Date(y2, m2 - 1, d2);
  while (current <= end) {
    out.push(fmt(current));
    current.setDate(current.getDate() + 1);
  }
  return out;
}

export function getRoomTypes(rooms: any[]): string[] {
  const types = new Set<string>();
  rooms.forEach((r: any) => types.add(r.room_type || "Standard"));
  return Array.from(types).sort();
}

export function getBasePrice(rooms: any[], roomType: string): number {
  const room = rooms.find((r: any) => (r.room_type || "Standard") === roomType);
  return Number(room?.base_price) || 0;
}

// ═══════════════════════════════════════════════
// ENSURE RATE PLANS EXIST
// ═══════════════════════════════════════════════

export async function ensureRatePlans(hotelId: string): Promise<RatePlan[]> {
  if (!hotelId) return [];

  // Check existing
  const { data: existing, error } = await supabase
    .from("rate_plans")
    .select("*")
    .eq("hotel_id", hotelId)
    .order("sort_order");

  if (error) {
    console.error("[ensureRatePlans] error:", error);
    return [];
  }

  // If we have plans, return them
  if (existing && existing.length > 0) {
    return existing as RatePlan[];
  }

  // Otherwise, seed default rate plans
  const seeds = DEFAULT_RATE_PLANS.map((p) => ({
    hotel_id: hotelId,
    code: p.code,
    name: p.name,
    description: p.description,
    meal_plan: p.meal_plan,
    is_active: true,
    sort_order: p.sort_order,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("rate_plans")
    .insert(seeds)
    .select();

  if (insertError) {
    console.error("[ensureRatePlans] insert error:", insertError);
    return [];
  }

  return (inserted || []) as RatePlan[];
}

// ═══════════════════════════════════════════════
// FETCH RATE GRID
// ═══════════════════════════════════════════════

export async function fetchRateGrid(
  hotelId: string,
  startDate: string,
  endDate: string
): Promise<RateGrid> {
  if (!hotelId) throw new Error("hotelId required");

  // 1. Get rooms for base prices
  const { data: roomsData } = await supabase
    .from("rooms")
    .select("room_type, base_price")
    .eq("hotel_id", hotelId);

  const rooms = roomsData || [];
  const roomTypes = getRoomTypes(rooms);
  const basePrices: Record<string, number> = {};
  roomTypes.forEach((t) => {
    basePrices[t] = getBasePrice(rooms, t);
  });

  // 2. Ensure rate plans exist
  const ratePlans = await ensureRatePlans(hotelId);

  // 3. Get all overrides for the date range
  const dates = generateDateRange(startDate, endDate);
  const { data: overridesData } = await supabase
    .from("rate_overrides")
    .select("*")
    .eq("hotel_id", hotelId)
    .gte("date", startDate)
    .lte("date", endDate);

  const overrides: RateOverride[] = overridesData || [];

  // 4. Build price map: prices[roomType][ratePlanId][date] = price
  const prices: Record<string, Record<string, Record<string, number>>> = {};

  roomTypes.forEach((roomType) => {
    prices[roomType] = {};
    ratePlans.forEach((plan) => {
      prices[roomType][plan.id] = {};
      const base = basePrices[roomType] || 0;

      // Fill with defaults
      dates.forEach((date) => {
        prices[roomType][plan.id][date] = base;
      });

      // Override with actual data
      overrides
        .filter((o) => o.room_type === roomType && o.rate_plan_id === plan.id)
        .forEach((o) => {
          prices[roomType][plan.id][o.date] = Number(o.price) || 0;
        });
    });
  });

  return {
    roomTypes,
    ratePlans,
    dates,
    prices,
    basePrices,
  };
}

// ═══════════════════════════════════════════════
// UPSERT SINGLE RATE
// ═══════════════════════════════════════════════

export async function upsertRate(
  hotelId: string,
  roomType: string,
  ratePlanId: string,
  date: string,
  price: number
): Promise<void> {
  const { error } = await supabase
    .from("rate_overrides")
    .upsert(
      {
        hotel_id: hotelId,
        room_type: roomType,
        rate_plan_id: ratePlanId,
        date,
        price,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "hotel_id,room_type,rate_plan_id,date" }
    );

  if (error) {
    console.error("[upsertRate] error:", error);
    throw error;
  }
}

// ═══════════════════════════════════════════════
// BULK UPSERT RATES
// ═══════════════════════════════════════════════

export async function bulkUpsertRates(
  hotelId: string,
  roomType: string,
  ratePlanId: string,
  dates: string[],
  price: number
): Promise<void> {
  if (dates.length === 0) return;

  const rows = dates.map((date) => ({
    hotel_id: hotelId,
    room_type: roomType,
    rate_plan_id: ratePlanId,
    date,
    price,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("rate_overrides")
    .upsert(rows, { onConflict: "hotel_id,room_type,rate_plan_id,date" });

  if (error) {
    console.error("[bulkUpsertRates] error:", error);
    throw error;
  }
}

// ═══════════════════════════════════════════════
// BULK UPSERT MULTIPLE RATES (grid based)
// ═══════════════════════════════════════════════

export async function bulkUpsertGrid(
  hotelId: string,
  rows: { roomType: string; ratePlanId: string; date: string; price: number }[]
): Promise<void> {
  if (rows.length === 0) return;

  const dbRows = rows.map((r) => ({
    hotel_id: hotelId,
    room_type: r.roomType,
    rate_plan_id: r.ratePlanId,
    date: r.date,
    price: r.price,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("rate_overrides")
    .upsert(dbRows, { onConflict: "hotel_id,room_type,rate_plan_id,date" });

  if (error) {
    console.error("[bulkUpsertGrid] error:", error);
    throw error;
  }
}