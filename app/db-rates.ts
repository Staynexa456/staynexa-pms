// app/db-rates.ts

import { supabase } from "./supabase";

export type RateRow = {
  room_type: string;
  rate_plan: string;
  rate_date: string; // YYYY-MM-DD
  price: number;
  adult_price: number;
  child_price: number;
  infant_price: number;
};

// Fetch all rates (optionally within a date range)
export async function fetchRates(
  fromDate?: string,
  toDate?: string
): Promise<RateRow[]> {
  let query = supabase.from("rates").select("*");
  if (fromDate) query = query.gte("rate_date", fromDate);
  if (toDate) query = query.lte("rate_date", toDate);

  const { data, error } = await query;
  if (error) {
    console.error("fetchRates error:", error);
    throw error;
  }
  return (data || []) as RateRow[];
}

// Upsert a single rate (insert or update)
export async function upsertRate(
  roomType: string,
  ratePlan: string,
  rateDate: string,
  price: number,
  extras?: { adult_price?: number; child_price?: number; infant_price?: number }
): Promise<void> {
  // Get hotel_id
  const { data: hotel, error: hErr } = await supabase
    .from("hotels")
    .select("id")
    .limit(1)
    .single();

  if (hErr || !hotel) {
    console.error("hotel lookup error:", hErr);
    throw hErr || new Error("Hotel not found");
  }

  const row = {
    hotel_id: hotel.id,
    room_type: roomType,
    rate_plan: ratePlan,
    rate_date: rateDate,
    price,
    adult_price: extras?.adult_price ?? price,
    child_price: extras?.child_price ?? 0,
    infant_price: extras?.infant_price ?? 0,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("rates")
    .upsert(row, { onConflict: "hotel_id,room_type,rate_plan,rate_date" });

  if (error) {
    console.error("upsertRate error:", error);
    throw error;
  }
}

// Bulk upsert many rates in one call
export async function bulkUpsertRates(
  rows: Array<{
    roomType: string;
    ratePlan: string;
    rateDate: string;
    price: number;
  }>
): Promise<void> {
  const { data: hotel, error: hErr } = await supabase
    .from("hotels")
    .select("id")
    .limit(1)
    .single();

  if (hErr || !hotel) throw hErr || new Error("Hotel not found");

  const insertRows = rows.map((r) => ({
    hotel_id: hotel.id,
    room_type: r.roomType,
    rate_plan: r.ratePlan,
    rate_date: r.rateDate,
    price: r.price,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("rates")
    .upsert(insertRows, { onConflict: "hotel_id,room_type,rate_plan,rate_date" });

  if (error) {
    console.error("bulkUpsertRates error:", error);
    throw error;
  }
}
