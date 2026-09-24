// app/lib/rate-plan-settings.ts
import { supabase } from "../supabase";

export type RatePlanSetting = {
  id?: string;
  hotel_id: string;
  code: string;
  name: string;
  display_name?: string;
  description?: string;
  rate_difference: number;
  min_length_of_stay: number;
  pay_at_property: boolean;
  policy_name?: string;
  hide_on_booking_engine: boolean;
  hard_dependency: boolean;
  applicable_room_types: string[];
  is_active: boolean;
  display_order: number;
};

export async function fetchRatePlanSettings(hotelId: string): Promise<RatePlanSetting[]> {
  if (!hotelId) return [];
  const { data, error } = await supabase
    .from("rate_plan_settings")
    .select("*")
    .eq("hotel_id", hotelId)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[fetchRatePlanSettings]", error);
    return [];
  }
  return (data || []) as RatePlanSetting[];
}

export async function upsertRatePlanSetting(
  hotelId: string,
  plan: Partial<RatePlanSetting> & { code: string; name: string }
): Promise<void> {
  const payload = {
    ...plan,
    hotel_id: hotelId,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("rate_plan_settings")
    .upsert(payload, { onConflict: "hotel_id,code" });

  if (error) throw error;
}

export async function deleteRatePlanSetting(hotelId: string, code: string): Promise<void> {
  const { error } = await supabase
    .from("rate_plan_settings")
    .delete()
    .eq("hotel_id", hotelId)
    .eq("code", code);
  if (error) throw error;
}

// Default plans (EP, CP, MAP, AP)
export function defaultRatePlans(hotelId: string): RatePlanSetting[] {
  return [
    {
      hotel_id: hotelId,
      code: "EP",
      name: "European Plan",
      display_name: "EP",
      description: "Room Only",
      rate_difference: 0,
      min_length_of_stay: 1,
      pay_at_property: false,
      policy_name: "Cancellation Policy",
      hide_on_booking_engine: false,
      hard_dependency: false,
      applicable_room_types: [],
      is_active: true,
      display_order: 0,
    },
    {
      hotel_id: hotelId,
      code: "CP",
      name: "Continental Plan",
      display_name: "CP",
      description: "Breakfast included",
      rate_difference: 0,
      min_length_of_stay: 1,
      pay_at_property: false,
      policy_name: "Cancellation Policy",
      hide_on_booking_engine: false,
      hard_dependency: false,
      applicable_room_types: [],
      is_active: true,
      display_order: 1,
    },
    {
      hotel_id: hotelId,
      code: "MAP",
      name: "Modified American Plan",
      display_name: "MAP",
      description: "Breakfast + one meal",
      rate_difference: 0,
      min_length_of_stay: 1,
      pay_at_property: false,
      policy_name: "Cancellation Policy",
      hide_on_booking_engine: false,
      hard_dependency: false,
      applicable_room_types: [],
      is_active: true,
      display_order: 2,
    },
    {
      hotel_id: hotelId,
      code: "AP",
      name: "American Plan",
      display_name: "AP",
      description: "All meals included",
      rate_difference: 0,
      min_length_of_stay: 1,
      pay_at_property: false,
      policy_name: "Cancellation Policy",
      hide_on_booking_engine: false,
      hard_dependency: false,
      applicable_room_types: [],
      is_active: true,
      display_order: 3,
    },
  ];
}