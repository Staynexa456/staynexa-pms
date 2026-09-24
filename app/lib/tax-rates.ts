// app/lib/tax-rates.ts
import { supabase } from "../supabase";

export type TaxRate = {
  id?: string;
  hotel_id: string;
  name: string;
  tax_type: "GST" | "Service" | "Luxury" | "Custom";
  percentage: number;
  apply_to: "room" | "food" | "all";
  min_amount: number;
  max_amount?: number | null;
  hsn_code?: string;
  is_active: boolean;
  display_order: number;
};

export async function fetchTaxRates(hotelId: string): Promise<TaxRate[]> {
  if (!hotelId) return [];
  const { data, error } = await supabase
    .from("tax_rates")
    .select("*")
    .eq("hotel_id", hotelId)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[fetchTaxRates]", error);
    return [];
  }
  return (data || []) as TaxRate[];
}

export async function createTaxRate(hotelId: string, tax: Omit<TaxRate, "id" | "hotel_id">): Promise<void> {
  const { error } = await supabase
    .from("tax_rates")
    .insert({ ...tax, hotel_id: hotelId });
  if (error) throw error;
}

export async function updateTaxRate(id: string, updates: Partial<TaxRate>): Promise<void> {
  const { error } = await supabase
    .from("tax_rates")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteTaxRate(id: string): Promise<void> {
  const { error } = await supabase.from("tax_rates").delete().eq("id", id);
  if (error) throw error;
}

// India GST default slabs
export function defaultTaxRates(hotelId: string): Omit<TaxRate, "id">[] {
  return [
    {
      hotel_id: hotelId,
      name: "GST 12%",
      tax_type: "GST",
      percentage: 12,
      apply_to: "room",
      min_amount: 0,
      max_amount: 7500,
      hsn_code: "996311",
      is_active: true,
      display_order: 0,
    },
    {
      hotel_id: hotelId,
      name: "GST 18%",
      tax_type: "GST",
      percentage: 18,
      apply_to: "room",
      min_amount: 7500,
      max_amount: null,
      hsn_code: "996311",
      is_active: true,
      display_order: 1,
    },
  ];
}