// app/db-rates.ts

import { supabase } from "./supabase";

export type RateRow = {
  room_type: string;
  rate_plan: string;
  rate_date: string;
  price: number;
  single_price: number;
  double_price: number;
  extra_adult_price: number;
  child_7_12_price: number;
  child_0_6_price: number;
};

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

export async function upsertRate(
  roomType: string,
  ratePlan: string,
  rateDate: string,
  price: number,
  extras?: Partial<{
    single_price: number;
    double_price: number;
    extra_adult_price: number;
    child_7_12_price: number;
    child_0_6_price: number;
  }>
): Promise<void> {
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
    single_price: extras?.single_price ?? price,
    double_price: extras?.double_price ?? price + 200,
    extra_adult_price: extras?.extra_adult_price ?? 800,
    child_7_12_price: extras?.child_7_12_price ?? 500,
    child_0_6_price: extras?.child_0_6_price ?? 500,
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
