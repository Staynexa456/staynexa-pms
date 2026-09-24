// app/lib/policies.ts
import { supabase } from "../supabase";

export type PolicyRule = {
  id: string;
  type: "hours" | "days" | "percent" | "flat";
  value: number;
  description?: string;
};

export type Policy = {
  id?: string;
  hotel_id: string;
  policy_type: "cancellation" | "amendment" | "terms";
  name: string;
  description?: string;
  rules: PolicyRule[];
  is_active: boolean;
  created_at?: string;
};

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

export async function createPolicy(
  hotelId: string,
  policy: Omit<Policy, "id" | "hotel_id">
): Promise<void> {
  const { error } = await supabase
    .from("policies")
    .insert({ ...policy, hotel_id: hotelId });
  if (error) throw error;
}

export async function updatePolicy(
  id: string,
  updates: Partial<Policy>
): Promise<void> {
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

// Default policies
export function defaultCancellationPolicy(hotelId: string): Omit<Policy, "id" | "hotel_id"> {
  return {
    policy_type: "cancellation",
    name: "Standard Cancellation",
    description: "Free cancellation up to 24 hours before check-in",
    rules: [
      { id: "r1", type: "hours", value: 24, description: "Free cancellation before 24 hours" },
      { id: "r2", type: "percent", value: 100, description: "Full refund if cancelled early" },
    ],
    is_active: true,
  };
}