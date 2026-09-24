// app/lib/property-settings.ts
import { supabase } from "../supabase";

export type PropertySettings = {
  id?: string;
  hotel_id: string;
  folio_phone?: string;
  folio_email?: string;
  booking_folio_header?: string;
  hide_booking_id?: boolean;
  hide_ota_charges?: boolean;
  show_terms_email?: boolean;
  show_actual_checkin?: boolean;
  logo_size?: number;
  invoice_font_size?: number;
  margin_top?: number;
  invoice_date_rule?: string;
  folio_pdf_layout?: string;
  folio_header_color?: string;
  folio_content_color?: string;
  auto_generate_invoice?: boolean;
  show_tariff_reg_card?: boolean;
  reg_card_version?: string;
  show_reg_card_number?: boolean;
  show_cancellation_policy?: boolean;
  show_tnc_reg_card?: boolean;
  tax_caption?: string;
  show_hsn_code?: boolean;
  balance_alert_threshold?: number;
  folio_footer_note?: string;
  custom_folio_sequencing?: boolean;
  folio_prefix?: string;
  folio_sequence_start?: number;
  folio_suffix?: string;
  custom_cancelled_id?: boolean;
  booking_engine_url?: string;
  gtm_header_script?: string;
  gtm_body_script?: string;
  branding_color?: string;
  contact_phone?: string;
  contact_email?: string;
  logo_url?: string;
  rate_check_widget?: boolean;
  allow_no_addons?: boolean;
  allow_partial_payment?: boolean;
  partial_payment_pct?: number;
  manual_approve?: boolean;
  allow_add_rooms_widget?: boolean;
};

export type RoomTypeDetail = {
  id?: string;
  hotel_id: string;
  room_type: string;
  description?: string;
  max_adults: number;
  max_children: number;
  photo_url?: string;
  amenities: string[];
  base_price: number;
  is_active: boolean;
  display_order: number;
};

export type Policy = {
  id?: string;
  hotel_id: string;
  policy_type: "cancellation" | "amendment" | "terms";
  name: string;
  description?: string;
  rules: any[];
  is_active: boolean;
};

// ═══════════════════════════════════════════════
// PROPERTY SETTINGS
// ═══════════════════════════════════════════════

export async function fetchPropertySettings(hotelId: string): Promise<PropertySettings | null> {
  if (!hotelId) return null;
  const { data, error } = await supabase
    .from("property_settings")
    .select("*")
    .eq("hotel_id", hotelId)
    .maybeSingle();

  if (error) {
    console.error("[fetchPropertySettings]", error);
    return null;
  }
  return data as PropertySettings;
}

export async function upsertPropertySettings(hotelId: string, updates: Partial<PropertySettings>): Promise<void> {
  const existing = await fetchPropertySettings(hotelId);
  const payload = { ...updates, hotel_id: hotelId, updated_at: new Date().toISOString() };

  if (existing?.id) {
    const { error } = await supabase
      .from("property_settings")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("property_settings")
      .insert(payload);
    if (error) throw error;
  }
}

// ═══════════════════════════════════════════════
// ROOM TYPE DETAILS
// ═══════════════════════════════════════════════

export async function fetchRoomTypeDetails(hotelId: string): Promise<RoomTypeDetail[]> {
  if (!hotelId) return [];
  const { data, error } = await supabase
    .from("room_type_details")
    .select("*")
    .eq("hotel_id", hotelId)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[fetchRoomTypeDetails]", error);
    return [];
  }
  return (data || []) as RoomTypeDetail[];
}

export async function upsertRoomTypeDetail(hotelId: string, detail: Partial<RoomTypeDetail> & { room_type: string }): Promise<void> {
  const payload = {
    ...detail,
    hotel_id: hotelId,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("room_type_details")
    .upsert(payload, { onConflict: "hotel_id,room_type" });

  if (error) throw error;
}

export async function deleteRoomTypeDetail(hotelId: string, roomType: string): Promise<void> {
  const { error } = await supabase
    .from("room_type_details")
    .delete()
    .eq("hotel_id", hotelId)
    .eq("room_type", roomType);
  if (error) throw error;
}

// ═══════════════════════════════════════════════
// POLICIES
// ═══════════════════════════════════════════════

export async function fetchPolicies(hotelId: string): Promise<Policy[]> {
  if (!hotelId) return [];
  const { data, error } = await supabase
    .from("policies")
    .select("*")
    .eq("hotel_id", hotelId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[fetchPolicies]", error);
    return [];
  }
  return (data || []) as Policy[];
}

export async function createPolicy(hotelId: string, policy: Omit<Policy, "id" | "hotel_id">): Promise<void> {
  const { error } = await supabase
    .from("policies")
    .insert({ ...policy, hotel_id: hotelId });
  if (error) throw error;
}

export async function updatePolicy(id: string, updates: Partial<Policy>): Promise<void> {
  const { error } = await supabase
    .from("policies")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

export async function deletePolicy(id: string): Promise<void> {
  const { error } = await supabase.from("policies").delete().eq("id", id);
  if (error) throw error;
}