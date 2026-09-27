// app/lib/use-rate-grid.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase";
import type { OccupancyKey } from "./rate-plans";

export type RatePlanRow = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  rate_difference: number;
};

export type RateGrid = {
  roomTypes: string[];
  ratePlans: RatePlanRow[];
  dates: string[];
  prices: Record<string, Record<string, Record<string, Record<string, number>>>>;
  basePrices: Record<string, number>;
  occupancyMultipliers: Record<OccupancyKey, number>;
};

const DEFAULT_MULTIPLIERS: Record<OccupancyKey, number> = {
  "1A": 0.85,
  "2A": 1.0,
  EA: 0.35,
  "C7-12": 0.25,
  "C0-6": 0.15,
};

export function useRateGrid(
  hotelId: string | null,
  startDate: string,
  endDate: string
) {
  const [grid, setGrid] = useState<RateGrid | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!hotelId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // ১. Room Types
      const { data: roomTypeRows, error: rtErr } = await supabase
        .from("room_type_details")
        .select("room_type, base_price")
        .eq("hotel_id", hotelId)
        .or("is_active.is.null,is_active.eq.true")
        .order("display_order");

      if (rtErr) throw rtErr;

      // ২. Rate Plans
      const { data: planRows, error: planErr } = await supabase
        .from("rate_plans")
        .select("id, code, name, description, rate_difference")
        .eq("hotel_id", hotelId)
        .or("is_active.is.null,is_active.eq.true")
        .order("rate_difference");

      if (planErr) throw planErr;

      // ৩. Date list
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

      // ৪. rate_calendar থেকে সব দাম আনুন
      const { data: calendarRows, error: calErr } = await supabase
        .from("rate_calendar")
        .select("room_type, rate_plan_code, occupancy_code, date, price")
        .eq("hotel_id", hotelId)
        .gte("date", startDate)
        .lte("date", endDate);

      if (calErr) {
        console.warn("[useRateGrid] rate_calendar load:", calErr);
      }

      // ৫. rate_prices থেকে fallback দাম (2A tier)
      const { data: priceRows } = await supabase
        .from("rate_prices")
        .select("room_type, rate_plan_code, price")
        .eq("hotel_id", hotelId);

      // ৬. Prices object তৈরি করুন
      const prices: Record<string, Record<string, Record<string, Record<string, number>>>> = {};
      const basePrices: Record<string, number> = {};
      const multipliers = { ...DEFAULT_MULTIPLIERS };

      const roomTypes = (roomTypeRows || []).map((r: any) => r.room_type);
      const ratePlans: RatePlanRow[] = (planRows || []) as RatePlanRow[];

      // Initialize base prices
      for (const rt of roomTypeRows || []) {
        basePrices[rt.room_type] = Number(rt.base_price) || 0;
      }

      // Initialize nested structure
      for (const rt of roomTypes) {
        prices[rt] = {};
        for (const plan of ratePlans) {
          prices[rt][plan.code] = {};
          for (const occ of Object.keys(DEFAULT_MULTIPLIERS) as OccupancyKey[]) {
            prices[rt][plan.code][occ] = {};
            for (const date of dates) {
              const base = basePrices[rt] || 0;
              const withPlan = base + Number(plan.rate_difference || 0);
              const defaultPrice = Math.round(withPlan * DEFAULT_MULTIPLIERS[occ]);
              prices[rt][plan.code][occ][date] = defaultPrice;
            }
          }
        }
      }

      // ৭. rate_prices এর fallback (2A tier)
      for (const p of priceRows || []) {
        if (prices[p.room_type]?.[p.rate_plan_code]?.["2A"]) {
          for (const date of dates) {
            prices[p.room_type][p.rate_plan_code]["2A"][date] = Number(p.price) || 0;
          }
        }
      }

      // ৮. rate_calendar এর explicit values (highest priority)
      for (const row of calendarRows || []) {
        const occ = row.occupancy_code as OccupancyKey;
        if (prices[row.room_type]?.[row.rate_plan_code]?.[occ]) {
          prices[row.room_type][row.rate_plan_code][occ][row.date] = Number(row.price) || 0;
        }
      }

      setGrid({
        roomTypes,
        ratePlans,
        dates,
        prices,
        basePrices,
        occupancyMultipliers: multipliers,
      });
    } catch (err: any) {
      console.error("[useRateGrid] error:", err);
      setError(err.message || "Failed to load rate grid");
    } finally {
      setLoading(false);
    }
  }, [hotelId, startDate, endDate]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { grid, loading, error, refresh, setGrid };
}
