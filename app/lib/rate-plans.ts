// app/lib/rate-plans.ts
import { supabase } from "../supabase";

export type OccupancyKey = "1A" | "2A" | "EXTRA" | "C7-12" | "C0-6";

export const OCCUPANCIES: { key: OccupancyKey; label: string; pct: number }[] = [
  { key: "1A", label: "1 Adult", pct: 85 },
  { key: "2A", label: "2 Adults", pct: 100 },
  { key: "EXTRA", label: "Extra", pct: 35 },
  { key: "C7-12", label: "Child 7-12", pct: 25 },
  { key: "C0-6", label: "Child 0-6", pct: 15 },
];

export type RatePlan = {
  id: string;
  code: string;
  name: string;
  description?: string;
};

export type RateGridPrices = Record<
  string,
  Record<string, Record<OccupancyKey, Record<string, number>>>
>;

export async function fetchRatesForRange(
  hotelId: string,
  startDate: string,
  endDate: string
): Promise<any[]> {
  if (!hotelId) return [];
  const { data, error } = await supabase
    .from("rate_prices")
    .select("*")
    .eq("hotel_id", hotelId)
    .gte("date", startDate)
    .lte("date", endDate);

  if (error) {
    console.error("[fetchRatesForRange]", error);
    return [];
  }
  return data || [];
}

export async function upsertRate(
  hotelId: string,
  roomType: string,
  ratePlanId: string,
  occupancy: OccupancyKey,
  date: string,
  price: number
): Promise<void> {
  const { error } = await supabase
    .from("rate_prices")
    .upsert(
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

export function computeRateFromBase(
  basePrice: number,
  occupancy: OccupancyKey
): number {
  const o = OCCUPANCIES.find((x) => x.key === occupancy);
  if (!o) return basePrice;
  return Math.round((basePrice * o.pct) / 100);
}