// app/lib/rate-plans.ts
import { supabase } from "../supabase";

export type OccupancyKey = "1A" | "2A" | "EA" | "C7-12" | "C0-6";

// ═══════════════════════════════════════════════
// SINGLE RATE UPSERT
// rate_calendar + rate_prices দুটোতেই sync করবে
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

  // ১. rate_calendar এ সেভ করুন (rate calendar view এর জন্য)
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

  // ২. যদি "2A" (Base Adult Double) হয়, তবে rate_prices এও sync করুন
  // কারণ বুকিং ইঞ্জিন rate_prices থেকে দাম পড়ে
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
// একসাথে অনেক dates update করার জন্য
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

  // ১. rate_calendar এ bulk upsert
  const { error: calError } = await supabase
    .from("rate_calendar")
    .upsert(rows, {
      onConflict: "hotel_id,room_type,rate_plan_code,occupancy_code,date",
    });

  if (calError) {
    console.error("[bulkUpsertRates] rate_calendar error:", calError);
    throw calError;
  }

  // ২. "2A" হলে rate_prices এও bulk sync
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
