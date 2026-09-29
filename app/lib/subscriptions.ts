// app/lib/subscriptions.ts
import { supabase } from "../supabase";

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════
export type SubscriptionPlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  monthly_price: number;
  yearly_price: number;
  currency: string;
  max_rooms: number;
  max_bookings_per_month: number;
  max_users: number;
  features: string[];
  is_active: boolean;
  is_popular: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type SubscriptionHistory = {
  id: string;
  hotel_id: string;
  plan_code: string;
  plan_name: string;
  started_at: string;
  expires_at: string | null;
  amount_paid: number;
  payment_method: string | null;
  notes: string | null;
  assigned_by: string | null;
  is_current: boolean;
  created_at: string;
};

export type HotelSubscription = {
  hotel_id: string;
  hotel_name: string;
  city: string | null;
  state: string | null;
  owner_email: string | null;
  current_plan: string | null;
  subscription_started_at: string | null;
  subscription_expires_at: string | null;
  is_active: boolean;
  days_until_expiry: number | null;
  is_expired: boolean;
};

// ═══════════════════════════════════════════════
// FETCH ALL PLANS
// ═══════════════════════════════════════════════
export async function fetchPlans(): Promise<SubscriptionPlan[]> {
  const { data, error } = await supabase
    .from("subscription_plans")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error || !data) {
    console.error("[fetchPlans]", error);
    return [];
  }

  return data.map((p: any) => ({
    ...p,
    features: Array.isArray(p.features) ? p.features : [],
  }));
}

// ═══════════════════════════════════════════════
// CREATE/UPDATE PLAN
// ═══════════════════════════════════════════════
export async function upsertPlan(plan: Partial<SubscriptionPlan>) {
  const payload = {
    ...plan,
    features: plan.features || [],
    updated_at: new Date().toISOString(),
  };

  if (plan.id) {
    const { data, error } = await supabase
      .from("subscription_plans")
      .update(payload)
      .eq("id", plan.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from("subscription_plans")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

// ═══════════════════════════════════════════════
// DELETE PLAN
// ═══════════════════════════════════════════════
export async function deletePlan(planId: string) {
  // Check if any hotel uses this plan
  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("code")
    .eq("id", planId)
    .single();

  if (!plan) throw new Error("Plan not found");

  const { data: hotels } = await supabase
    .from("hotels")
    .select("id")
    .eq("subscription_plan", plan.code);

  if (hotels && hotels.length > 0) {
    throw new Error(
      `Cannot delete: ${hotels.length} hotel(s) are using this plan. Reassign them first.`
    );
  }

  const { error } = await supabase
    .from("subscription_plans")
    .delete()
    .eq("id", planId);

  if (error) throw error;
}

// ═══════════════════════════════════════════════
// ASSIGN PLAN TO HOTEL
// ═══════════════════════════════════════════════
export async function assignPlanToHotel(payload: {
  hotel_id: string;
  plan_code: string;
  duration_months?: number;
  amount_paid?: number;
  payment_method?: string;
  notes?: string;
}) {
  const durationMonths = payload.duration_months ?? 1;
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setMonth(expiresAt.getMonth() + durationMonths);

  // Get plan details
  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("name")
    .eq("code", payload.plan_code)
    .single();

  // Mark old history as not current
  await supabase
    .from("subscription_history")
    .update({ is_current: false })
    .eq("hotel_id", payload.hotel_id)
    .eq("is_current", true);

  // Update hotel
  const { error: hotelErr } = await supabase
    .from("hotels")
    .update({
      subscription_plan: payload.plan_code,
      subscription_started_at: now.toISOString(),
      subscription_expires_at: expiresAt.toISOString(),
    })
    .eq("id", payload.hotel_id);

  if (hotelErr) throw hotelErr;

  // Add history
  const { error: histErr } = await supabase
    .from("subscription_history")
    .insert({
      hotel_id: payload.hotel_id,
      plan_code: payload.plan_code,
      plan_name: plan?.name || payload.plan_code,
      started_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      amount_paid: payload.amount_paid ?? 0,
      payment_method: payload.payment_method ?? null,
      notes: payload.notes ?? null,
      is_current: true,
    });

  if (histErr) throw histErr;

  return { expires_at: expiresAt.toISOString() };
}

// ═══════════════════════════════════════════════
// FETCH HOTEL SUBSCRIPTIONS
// ═══════════════════════════════════════════════
export async function fetchHotelSubscriptions(): Promise<HotelSubscription[]> {
  const { data: hotels } = await supabase
    .from("hotels")
    .select(`
      id, name, city, state,
      subscription_plan, subscription_started_at,
      subscription_expires_at, is_active, owner_id
    `)
    .order("subscription_expires_at", { ascending: true, nullsFirst: false });

  if (!hotels) return [];

  // Get owner emails
  const ownerIds = Array.from(
    new Set(hotels.map((h: any) => h.owner_id).filter(Boolean))
  );

  let ownerMap: Record<string, string> = {};
  if (ownerIds.length > 0) {
    const { data: owners } = await supabase
      .from("hotel_users")
      .select("user_id, email")
      .in("user_id", ownerIds)
      .eq("role", "owner");

    (owners || []).forEach((o: any) => {
      ownerMap[o.user_id] = o.email;
    });
  }

  const now = new Date();

  return hotels.map((h: any) => {
    const expiresAt = h.subscription_expires_at
      ? new Date(h.subscription_expires_at)
      : null;
    const daysUntil = expiresAt
      ? Math.ceil((expiresAt.getTime() - now.getTime()) / 86400000)
      : null;

    return {
      hotel_id: h.id,
      hotel_name: h.name,
      city: h.city,
      state: h.state,
      owner_email: h.owner_id ? ownerMap[h.owner_id] || null : null,
      current_plan: h.subscription_plan,
      subscription_started_at: h.subscription_started_at,
      subscription_expires_at: h.subscription_expires_at,
      is_active: h.is_active,
      days_until_expiry: daysUntil,
      is_expired: daysUntil !== null && daysUntil < 0,
    };
  });
}

// ═══════════════════════════════════════════════
// FETCH HOTEL SUBSCRIPTION HISTORY
// ═══════════════════════════════════════════════
export async function fetchHotelHistory(hotelId: string): Promise<SubscriptionHistory[]> {
  const { data, error } = await supabase
    .from("subscription_history")
    .select("*")
    .eq("hotel_id", hotelId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return data || [];
}

// ═══════════════════════════════════════════════
// CANCEL SUBSCRIPTION
// ═══════════════════════════════════════════════
export async function cancelSubscription(hotelId: string, reason?: string) {
  await supabase
    .from("hotels")
    .update({
      subscription_expires_at: new Date().toISOString(),
    })
    .eq("id", hotelId);

  await supabase
    .from("subscription_history")
    .update({ is_current: false })
    .eq("hotel_id", hotelId)
    .eq("is_current", true);

  return true;
}

// ═══════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════
export async function fetchSubscriptionStats() {
  const [plansRes, hotelsRes] = await Promise.all([
    supabase.from("subscription_plans").select("*"),
    supabase.from("hotels").select("subscription_plan, subscription_expires_at"),
  ]);

  const plans = plansRes.data || [];
  const hotels = hotelsRes.data || [];
  const now = new Date();

  const byPlan: Record<string, number> = {};
  let expiringSoon = 0;
  let expired = 0;

  hotels.forEach((h: any) => {
    const code = h.subscription_plan || "free";
    byPlan[code] = (byPlan[code] || 0) + 1;

    if (h.subscription_expires_at) {
      const exp = new Date(h.subscription_expires_at);
      const days = Math.ceil((exp.getTime() - now.getTime()) / 86400000);
      if (days < 0) expired++;
      else if (days <= 7) expiringSoon++;
    }
  });

  return {
    totalPlans: plans.length,
    activePlans: plans.filter((p: any) => p.is_active).length,
    totalHotels: hotels.length,
    byPlan,
    expiringSoon,
    expired,
  };
}
