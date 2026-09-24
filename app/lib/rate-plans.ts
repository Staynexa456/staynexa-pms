// app/lib/rate-plans.ts
import { supabase } from "../supabase";

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════

export type OccupancyKey = "single" | "double" | "extra_adult" | "child_7_12" | "child_0_6";

export const OCCUPANCIES: { key: OccupancyKey; label: string; pct: number; icon: string }[] = [
  { key: "single", label: "1 Adult", pct: 85, icon: "👤" },
  { key: "double", label: "2 Adults", pct: 100, icon: "👥" },
  { key: "extra_adult", label: "Extra Adult", pct: 35, icon: "➕" },
  { key: "child_7_12", label: "Child 7-12", pct: 25, icon: "🧒" },
  { key: "child_0_6", label: "Child 0-6", pct: 15, icon: "👶" },
];

export type RatePlan = {
  id: string;
  code: string;
  name: string;
  description?: string;
};

export type RateGrid = {
  roomTypes: string[];
  ratePlans: RatePlan[];
  dates: string[];
  prices: Record<string, Record<string, Record<OccupancyKey, Record<string, number>>>>;
  basePrices: Record<string, number>;
};

// ═══════════════════════════════════════════════
// FETCH RATE GRID
// ═══════════════════════════════════════════════

export async function fetchRateGrid(
  hotelId: string,
  startDate: string,
  endDate: string
): Promise<RateGrid | null> {
  if (!hotelId) return null;

  try {
    // 1. Fetch rate plan settings
    const { data: plansData, error: plansError } = await supabase
      .from("rate_plan_settings")
      .select("*")
      .eq("hotel_id", hotelId)
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (plansError) console.error("[fetchRateGrid] plans:", plansError);

    // 2. Fetch rooms for room types + base prices
    const { data: roomsData, error: roomsError } = await supabase
      .from("rooms")
      .select("room_type, base_price")
      .eq("hotel_id", hotelId);

    if (roomsError) console.error("[fetchRateGrid] rooms:", roomsError);

    // 3. Fetch rate prices for date range
    const { data: pricesData, error: pricesError } = await supabase
      .from("rate_prices")
      .select("*")
      .eq("hotel_id", hotelId)
      .gte("date", startDate)
      .lte("date", endDate);

    if (pricesError) console.error("[fetchRateGrid] prices:", pricesError);

    // 4. Build unique room types + base prices
    const roomTypeMap = new Map<string, number>();
    (roomsData || []).forEach((r: any) => {
      const rt = r.room_type || "Standard";
      if (!roomTypeMap.has(rt) || r.base_price > 0) {
        roomTypeMap.set(rt, Number(r.base_price) || 0);
      }
    });

    const roomTypes = Array.from(roomTypeMap.keys()).sort();
    const basePrices: Record<string, number> = {};
    roomTypeMap.forEach((v, k) => {
      basePrices[k] = v;
    });

    // 5. Build rate plans list
    const ratePlans: RatePlan[] = (plansData || []).map((p: any) => ({
      id: p.code,
      code: p.code,
      name: p.name,
      description: p.description,
    }));

    // 6. Generate date array
    const dates: string[] = [];
    const [sy, sm, sd] = startDate.split("-").map(Number);
    const [ey, em, ed] = endDate.split("-").map(Number);
    const startD = new Date(sy, sm - 1, sd);
    const endD = new Date(ey, em - 1, ed);
    const cursor = new Date(startD);
    while (cursor <= endD) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, "0");
      const d = String(cursor.getDate()).padStart(2, "0");
      dates.push(`${y}-${m}-${d}`);
      cursor.setDate(cursor.getDate() + 1);
    }

    // 7. Build empty prices structure
    const prices: RateGrid["prices"] = {};
    roomTypes.forEach((rt) => {
      prices[rt] = {};
      ratePlans.forEach((rp) => {
        prices[rt][rp.id] = {} as any;
        OCCUPANCIES.forEach((occ) => {
          prices[rt][rp.id][occ.key] = {};
        });
      });
    });

    // 8. Override with saved values
    (pricesData || []).forEach((p: any) => {
      const rt = p.room_type;
      const rp = p.rate_plan_id;
      const occ = p.occupancy as OccupancyKey;
      if (!prices[rt]) prices[rt] = {};
      if (!prices[rt][rp]) prices[rt][rp] = {} as any;
      if (!prices[rt][rp][occ]) prices[rt][rp][occ] = {};
      prices[rt][rp][occ][p.date] = Number(p.price) || 0;
    });

    // 9. Fill missing with computed defaults
    const planMultipliers: Record<string, number> = {
      EP: 1.0,
      CP: 1.15,
      MAP: 1.3,
      AP: 1.45,
    };

    roomTypes.forEach((rt) => {
      const base = basePrices[rt] || 0;
      ratePlans.forEach((rp) => {
        const planMult = planMultipliers[rp.code] || 1.0;
        OCCUPANCIES.forEach((occ) => {
          dates.forEach((date) => {
            if (!prices[rt]?.[rp.id]?.[occ.key]?.[date]) {
              const price = Math.round(base * planMult * (occ.pct / 100));
              if (!prices[rt]) prices[rt] = {};
              if (!prices[rt][rp.id]) prices[rt][rp.id] = {} as any;
              if (!prices[rt][rp.id][occ.key]) prices[rt][rp.id][occ.key] = {};
              prices[rt][rp.id][occ.key][date] = price;
            }
          });
        });
      });
    });

    return { roomTypes, ratePlans, dates, prices, basePrices };
  } catch (err) {
    console.error("[fetchRateGrid] unexpected:", err);
    return null;
  }
}

// ═══════════════════════════════════════════════
// SINGLE UPSERT
// ═══════════════════════════════════════════════

export async function upsertRate(
  hotelId: string,
  roomType: string,
  ratePlanId: string,
  occupancy: OccupancyKey,
  date: string,
  price: number
): Promise<void> {
  const { error } = await supabase.from("rate_prices").upsert(
    {
      hotel_id: hotelId,
      room_type: roomType,
      rate_plan_id: ratePlanId,
      occupancy,
      date,
      price,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "hotel_id,room_type,rate_plan_id,occupancy,date" }
  );

  if (error) throw error;
}

// ═══════════════════════════════════════════════
// BULK UPSERT
// ═══════════════════════════════════════════════

export async function bulkUpsertRates(
  hotelId: string,
  roomType: string,
  ratePlanId: string,
  occupancy: OccupancyKey,
  dates: string[],
  price: number
): Promise<void> {
  if (dates.length === 0) return;

  const rows = dates.map((date) => ({
    hotel_id: hotelId,
    room_type: roomType,
    rate_plan_id: ratePlanId,
    occupancy,
    date,
    price,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("rate_prices")
    .upsert(rows, {
      onConflict: "hotel_id,room_type,rate_plan_id,occupancy,date",
    });

  if (error) throw error;
}

// ═══════════════════════════════════════════════
// DELETE
// ═══════════════════════════════════════════════

export async function deleteRate(
  hotelId: string,
  roomType: string,
  ratePlanId: string,
  occupancy: OccupancyKey,
  date: string
): Promise<void> {
  const { error } = await supabase
    .from("rate_prices")
    .delete()
    .eq("hotel_id", hotelId)
    .eq("room_type", roomType)
    .eq("rate_plan_id", ratePlanId)
    .eq("occupancy", occupancy)
    .eq("date", date);

  if (error) throw error;
}

// ═══════════════════════════════════════════════
// HELPER
// ═══════════════════════════════════════════════

export function computeRateFromBase(basePrice: number, occupancy: OccupancyKey): number {
  const o = OCCUPANCIES.find((x) => x.key === occupancy);
  if (!o) return basePrice;
  return Math.round((basePrice * o.pct) / 100);
}