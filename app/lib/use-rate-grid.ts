// app/lib/use-rate-grid.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase";

export type OccupancyKey = "1A" | "2A" | "EA" | "C7-12" | "C0-6";

export type RateGrid = {
  roomTypes: string[];
  ratePlans: any[];
  dates: string[];
  prices: Record<string, Record<string, Record<OccupancyKey, Record<string, number>>>>;
  basePrices: Record<string, number>;
};

export function useRateGrid(
  hotelId: string | null | undefined,
  startDate: string,
  endDate: string
) {
  const [grid, setGrid] = useState<RateGrid | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!hotelId) {
      setGrid(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // ─── Date Range Setup ───
      const start = new Date(startDate);
      const end = new Date(endDate);
      const dates: string[] = [];
      const current = new Date(start);
      while (current <= end) {
        dates.push(current.toISOString().slice(0, 10));
        current.setDate(current.getDate() + 1);
      }

      // ─── 1. Fetch Room Types (Unique) ───
      // First try room_type_details, fallback to rooms
      const { data: roomTypeDetails } = await supabase
        .from("room_type_details")
        .select("room_type, base_price")
        .eq("hotel_id", hotelId)
        .eq("is_active", true);

      let roomTypesList: { room_type: string; base_price: number }[] = [];

      if (roomTypeDetails && roomTypeDetails.length > 0) {
        roomTypesList = roomTypeDetails.map((r: any) => ({
          room_type: r.room_type,
          base_price: Number(r.base_price) || 0,
        }));
      } else {
        // Fallback: fetch from rooms
        const { data: rooms } = await supabase
          .from("rooms")
          .select("room_type, base_price")
          .eq("hotel_id", hotelId);

        const uniqueTypes = new Map<string, number>();
        (rooms || []).forEach((r: any) => {
          if (!uniqueTypes.has(r.room_type)) {
            uniqueTypes.set(r.room_type, Number(r.base_price) || 0);
          }
        });
        roomTypesList = Array.from(uniqueTypes.entries()).map(([room_type, base_price]) => ({
          room_type,
          base_price,
        }));
      }

      const roomTypes = roomTypesList.map((r) => r.room_type);
      const basePrices: Record<string, number> = {};
      roomTypesList.forEach((r) => {
        basePrices[r.room_type] = r.base_price;
      });

      // ─── 2. Fetch Rate Plans ───
      const { data: ratePlans, error: rpErr } = await supabase
        .from("rate_plans")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("is_active", true)
        .order("code");

      if (rpErr) throw rpErr;

      // Filter rate plans that match our room types
      const validRatePlans = (ratePlans || []).filter((rp: any) =>
        roomTypes.includes(rp.room_type)
      );

      // ─── 3. Fetch Rate Calendar ───
      const { data: calendarData, error: calErr } = await supabase
        .from("rate_calendar")
        .select("room_type, rate_plan_code, date, occupancy_code, price")
        .eq("hotel_id", hotelId)
        .eq("is_active", true)
        .gte("date", startDate)
        .lte("date", endDate);

      if (calErr) throw calErr;

      // ─── 4. Build Prices Grid ───
      const prices: Record<string, Record<string, Record<OccupancyKey, Record<string, number>>>> = {};

      roomTypes.forEach((roomType) => {
        prices[roomType] = {};
        validRatePlans
          .filter((rp: any) => rp.room_type === roomType)
          .forEach((rp: any) => {
            prices[roomType][rp.code] = {
              "1A": {},
              "2A": {},
              "EA": {},
              "C7-12": {},
              "C0-6": {},
            };

            // Fill default prices from rate_plan
            dates.forEach((date) => {
              prices[roomType][rp.code]["1A"][date] = Number(rp.price_1a) || 0;
              prices[roomType][rp.code]["2A"][date] = Number(rp.price_2a) || 0;
              prices[roomType][rp.code]["EA"][date] = Number(rp.price_extra_adult) || 0;
              prices[roomType][rp.code]["C7-12"][date] = Number(rp.price_child) || 0;
              prices[roomType][rp.code]["C0-6"][date] = 0;
            });
          });
      });

      // Override with calendar data if available
      (calendarData || []).forEach((entry: any) => {
        const roomType = entry.room_type;
        const ratePlanCode = entry.rate_plan_code;
        const date = entry.date;
        const occupancy = entry.occupancy_code as OccupancyKey;
        const price = Number(entry.price) || 0;

        if (prices[roomType] && prices[roomType][ratePlanCode] && prices[roomType][ratePlanCode][occupancy]) {
          prices[roomType][ratePlanCode][occupancy][date] = price;
        }
      });

      // ─── 5. Set Grid ───
      setGrid({
        roomTypes,
        ratePlans: validRatePlans,
        dates,
        prices,
        basePrices,
      });
    } catch (err: any) {
      console.error("[useRateGrid] Error:", err);
      setError(err.message || "Failed to load rate grid");
      setGrid(null);
    } finally {
      setLoading(false);
    }
  }, [hotelId, startDate, endDate]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { grid, loading, error, refresh, setGrid };
}
