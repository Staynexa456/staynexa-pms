import { supabase } from "../supabase";

export async function hasFeature(hotelId: string, featureCode: string): Promise<boolean> {
  if (!hotelId || !featureCode) return false;
  const { data } = await supabase
    .from("hotel_features")
    .select("is_enabled")
    .eq("hotel_id", hotelId)
    .eq("feature_code", featureCode)
    .eq("is_enabled", true)
    .maybeSingle();
  return !!data;
}

export async function getHotelFeatures(hotelId: string): Promise<string[]> {
  if (!hotelId) return [];
  const { data } = await supabase
    .from("hotel_features")
    .select("feature_code")
    .eq("hotel_id", hotelId)
    .eq("is_enabled", true);
  return (data || []).map((f: any) => f.feature_code);
}
