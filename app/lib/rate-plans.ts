// app/lib/rate-plans.ts
import { supabase } from "../supabase";

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════
export type OccupancyKey = "1A" | "2A" | "EA" | "C7-12" | "C0-6";

export type OccupancyInfo = {
  key: OccupancyKey;
  label: string;
  short: string;        // RuleFormModal এ ব্যবহৃত
  shortLabel: string;   // RateCalendarGrid এ ব্যবহৃত
  multiplier: number;
  icon: string;
  color: string;
};

// ═══════════════════════════════════════════════
// OCCUPANCIES CONSTANT
// ═══════════════════════════════════════════════
export const OCCUPANCIES: OccupancyInfo[] = [
  {
    key: "1A",
    label: "1 Adult",
    short: "1A",
    shortLabel: "1A",
    multiplier: 0.85,
    icon: "👤",
    color: "#60a5fa",
  },
  {
    key: "2A",
    label: "2 Adults",
    short: "2A",
    shortLabel: "2A",
    multiplier: 1.0,
    icon: "👥",
    color: "#10b981",
  },
  {
    key: "EA",
    label: "Extra Adult",
    short: "EA",
    shortLabel: "EA",
    multiplier: 0.35,
    icon: "➕",
    color: "#f59e0b",
  },
  {
    key: "C7-12",
    label: "Child 7-12",
    short: "C7-12",
    shortLabel: "C7-12",
    multiplier: 0.25,
    icon: "🧒",
    color: "#8b5cf6",
  },
  {
    key: "C0-6",
    label: "Child 0-6",
    short: "C0-6",
    shortLabel: "C0-6",
    multiplier: 0.15,
    icon: "👶",
    color: "#ec4899",
  },
];

// ═══════════════════════════════════════════════
// RATE GRID TYPE
// ═══════════════════════════════════════════════
export type RateGridData = {
  roomTypes: string[];
  ratePlans: any[];
  dates: string[];
  prices: Record<string, Record<string, Record<string, Record<string, number>>>>;
  basePrices: Record<string, number>;
  occupancyMultipliers: Record<OccupancyKey, number>;
};

// ═══════════════════════════════════════════════
// FETCH RATE GRID
// ═══════════════════════════════════════════════
export async function fetchRateGrid(
  hotelId: string,
  startDate: string,
  endDate: string
): Promise<RateGridData> {
  if (!hotelId) throw new Error("hotelId is required");

  // 1. Room Types
  const { data: roomTypeRows } = await supabase
    .from("room_type_details")
    .select("room_type, base_price")
    .eq("hotel_id", hotelId)
    .or("is_active.is.null,is_active.eq.true")
    .order("display_order");

  // 2. Rate Plans
  const { data: planRows } = await supabase
    .from("rate_plans")
    .select("id, code, name, description, rate_difference")
    .eq("hotel_id", hotelId)
    .or("is_active.is.null,is_active.eq.true")
    .order("rate_difference");

  // 3. Date list
  const dates: string[] = [];
  const [y1, m1, d1] = startDate.split("-").map(Number);
  const [y2, m2, d2] = endDate.split("-").map(Number);
  let current = new Date(y1, m1 - 1, d1);
  const end = new Date(y2, m2 - 1, d2);
  while (current <= end) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, "0");
    const d = String(current.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    current.setDate(current.getDate() + 1);
  }

  // 4. rate_calendar
  const { data: calendarRows } = await supabase
    .from("rate_calendar")
    .select("room_type, rate_plan_code, occupancy_code, date, price")
    .eq("hotel_id", hotelId)
    .gte("date", startDate)
    .lte("date", endDate);

  // 5. rate_prices (fallback)
  const { data: priceRows } = await supabase
    .from("rate_prices")
    .select("room_type, rate_plan_code, price")
    .eq("hotel_id", hotelId);

  // 6. Build prices
  const prices: Record<string, Record<string, Record<string, Record<string, number>>>> = {};
  const basePrices: Record<string, number> = {};
  const occupancyMultipliers: Record<OccupancyKey, number> = {
    "1A": 0.85,
    "2A": 1.0,
    EA: 0.35,
    "C7-12": 0.25,
    "C0-6": 0.15,
  };

  const roomTypes = (roomTypeRows || []).map((r: any) => r.room_type);
  const ratePlans = planRows || [];

  for (const rt of roomTypeRows || []) {
    basePrices[rt.room_type] = Number(rt.base_price) || 0;
  }

  // Initialize all prices with defaults
  for (const rt of roomTypes) {
    prices[rt] = {};
    for (const plan of ratePlans) {
      prices[rt][plan.code] = {};
      for (const occ of Object.keys(occupancyMultipliers) as OccupancyKey[]) {
        prices[rt][plan.code][occ] = {};
        for (const date of dates) {
          const base = basePrices[rt] || 0;
          const withPlan = base + Number(plan.rate_difference || 0);
          prices[rt][plan.code][occ][date] = Math.round(
            withPlan * occupancyMultipliers[occ]
          );
        }
      }
    }
  }

  // Apply rate_prices fallback (2A tier)
  for (const p of priceRows || []) {
    if (prices[p.room_type]?.[p.rate_plan_code]?.["2A"]) {
      for (const date of dates) {
        prices[p.room_type][p.rate_plan_code]["2A"][date] =
          Number(p.price) || 0;
      }
    }
  }

  // Apply rate_calendar (highest priority)
  for (const row of calendarRows || []) {
    const occ = row.occupancy_code as OccupancyKey;
    if (prices[row.room_type]?.[row.rate_plan_code]?.[occ]) {
      prices[row.room_type][row.rate_plan_code][occ][row.date] =
        Number(row.price) || 0;
    }
  }

  return {
    roomTypes,
    ratePlans,
    dates,
    prices,
    basePrices,
    occupancyMultipliers,
  };
}

// ═══════════════════════════════════════════════
// SINGLE RATE UPSERT (sync to rate_calendar + rate_prices)
// ═══════════════════════════════════════════════
export async function upsertRate(
  hotelId: string,
  roomType: string,
  ratePlanId: string,
  occupancy: OccupancyKey,
  date: string,
  price: number
) {
  if (!hotelId || !roomType || !ratePlanId || !date) {
    throw new Error("Missing required fields for upsertRate");
  }

  const priceInt = Math.max(0, Math.round(Number(price) || 0));

  // 1. Save to rate_calendar (main storage)
  const { error: calError } = await supabase
    .from("rate_calendar")
    .upsert(
      {
        hotel_id: hotelId,
        room_type: roomType,
        rate_plan_code: ratePlanId,
        occupancy_code: occupancy,
        date: date,
        price: priceInt,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "hotel_id,room_type,rate_plan_code,occupancy_code,date",
      }
    );

  if (calError) {
    console.error("[upsertRate] rate_calendar error:", calError);
    throw calError;
  }

  // 2. Sync to rate_prices if "2A" (booking engine reads from rate_prices)
  if (occupancy === "2A") {
    const { error: priceError } = await supabase
      .from("rate_prices")
      .upsert(
        {
          hotel_id: hotelId,
          room_type: roomType,
          rate_plan_code: ratePlanId,
          price: priceInt,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "hotel_id,room_type,rate_plan_code",
        }
      );

    if (priceError) {
      console.warn("[upsertRate] rate_prices sync failed:", priceError);
    }
  }

  return { success: true, price: priceInt };
}

// ═══════════════════════════════════════════════
// BULK RATE UPSERT
// ═══════════════════════════════════════════════
export async function bulkUpsertRates(
  hotelId: string,
  roomType: string,
  ratePlanId: string,
  occupancy: OccupancyKey,
  dates: string[],
  price: number
) {
  if (!hotelId || !roomType || !ratePlanId || !dates.length) {
    throw new Error("Missing required fields for bulkUpsertRates");
  }

  const priceInt = Math.max(0, Math.round(Number(price) || 0));

  const rows = dates.map((date) => ({
    hotel_id: hotelId,
    room_type: roomType,
    rate_plan_code: ratePlanId,
    occupancy_code: occupancy,
    date: date,
    price: priceInt,
    is_active: true,
    updated_at: new Date().toISOString(),
  }));

  // 1. Save to rate_calendar
  const { error: calError } = await supabase
    .from("rate_calendar")
    .upsert(rows, {
      onConflict: "hotel_id,room_type,rate_plan_code,occupancy_code,date",
    });

  if (calError) {
    console.error("[bulkUpsertRates] rate_calendar error:", calError);
    throw calError;
  }

  // 2. Sync to rate_prices if "2A"
  if (occupancy === "2A") {
    const { error: priceError } = await supabase
      .from("rate_prices")
      .upsert(
        {
          hotel_id: hotelId,
          room_type: roomType,
          rate_plan_code: ratePlanId,
          price: priceInt,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "hotel_id,room_type,rate_plan_code",
        }
      );
    if (priceError) {
      console.warn("[bulkUpsertRates] rate_prices sync failed:", priceError);
    }
  }

  return { success: true, count: rows.length };
}

// ═══════════════════════════════════════════════
// DELETE RATE
// ═══════════════════════════════════════════════
export async function deleteRate(
  hotelId: string,
  roomType: string,
  ratePlanId: string,
  occupancy: OccupancyKey,
  date: string
) {
  const { error } = await supabase
    .from("rate_calendar")
    .delete()
    .eq("hotel_id", hotelId)
    .eq("room_type", roomType)
    .eq("rate_plan_code", ratePlanId)
    .eq("occupancy_code", occupancy)
    .eq("date", date);

  if (error) throw error;
  return { success: true };
}
