// app/lib/rate-rules.ts
import { supabase } from "../supabase";
import type { OccupancyKey } from "./rate-plans";

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════

export type RuleType =
  | "seasonal"
  | "day_of_week"
  | "los"
  | "last_minute"
  | "occupancy";

export type AdjustmentType = "percentage" | "fixed" | "set_price";

export type RateRule = {
  id: string;
  hotel_id: string;
  name: string;
  description?: string;
  rule_type: RuleType;
  priority: number;
  is_active: boolean;
  start_date?: string | null;
  end_date?: string | null;
  days_of_week?: number[] | null;
  min_nights?: number | null;
  max_nights?: number | null;
  advance_days?: number | null;
  min_occupancy?: number | null;
  adjustment_type: AdjustmentType;
  adjustment_value: number;
  room_types?: string[] | null;
  rate_plan_ids?: string[] | null;
  occupancies?: string[] | null;
  created_at: string;
  updated_at: string;
};

export type RuleContext = {
  roomType: string;
  ratePlanId: string;
  occupancy: OccupancyKey;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  bookingDate: string; // today
  hotelOccupancy: number; // 0.0 - 1.0
};

export type RuleApplication = {
  rule: RateRule;
  applied: boolean;
  beforePrice: number;
  afterPrice: number;
  adjustment: number;
  reason: string;
};

export type PriceCalculation = {
  basePrice: number;
  finalPrice: number;
  applications: RuleApplication[];
};

// ═══════════════════════════════════════════════
// RULE TYPE LABELS
// ═══════════════════════════════════════════════

export const RULE_TYPE_INFO: Record<
  RuleType,
  { label: string; icon: string; color: string; description: string }
> = {
  seasonal: {
    label: "Seasonal",
    icon: "🌞",
    color: "amber",
    description: "Date-range based pricing (Peak season, Holidays)",
  },
  day_of_week: {
    label: "Day of Week",
    icon: "📆",
    color: "sky",
    description: "Weekend surcharge, Weekday discount",
  },
  los: {
    label: "Length of Stay",
    icon: "🏨",
    color: "violet",
    description: "Discounts for longer stays",
  },
  last_minute: {
    label: "Last Minute",
    icon: "⏰",
    color: "rose",
    description: "Surcharge for near check-in bookings",
  },
  occupancy: {
    label: "Occupancy Based",
    icon: "📊",
    color: "emerald",
    description: "Dynamic pricing based on hotel occupancy",
  },
};

export const DAY_NAMES = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

// ═══════════════════════════════════════════════
// CRUD OPERATIONS
// ═══════════════════════════════════════════════

export async function fetchRules(hotelId: string): Promise<RateRule[]> {
  if (!hotelId) return [];
  const { data, error } = await supabase
    .from("rate_rules")
    .select("*")
    .eq("hotel_id", hotelId)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[fetchRules]", error);
    return [];
  }
  return (data || []) as RateRule[];
}

export async function createRule(
  rule: Omit<RateRule, "id" | "created_at" | "updated_at">
): Promise<RateRule | null> {
  const { data, error } = await supabase
    .from("rate_rules")
    .insert(rule)
    .select()
    .single();

  if (error) {
    console.error("[createRule]", error);
    throw error;
  }
  return data as RateRule;
}

export async function updateRule(
  ruleId: string,
  updates: Partial<RateRule>
): Promise<RateRule | null> {
  const { data, error } = await supabase
    .from("rate_rules")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", ruleId)
    .select()
    .single();

  if (error) {
    console.error("[updateRule]", error);
    throw error;
  }
  return data as RateRule;
}

export async function deleteRule(ruleId: string): Promise<void> {
  const { error } = await supabase.from("rate_rules").delete().eq("id", ruleId);
  if (error) {
    console.error("[deleteRule]", error);
    throw error;
  }
}

export async function toggleRule(
  ruleId: string,
  isActive: boolean
): Promise<void> {
  await updateRule(ruleId, { is_active: isActive });
}

// ═══════════════════════════════════════════════
// RULE MATCHING
// ═══════════════════════════════════════════════

function isRuleInScope(rule: RateRule, ctx: RuleContext): boolean {
  // Room type scope
  if (rule.room_types && rule.room_types.length > 0) {
    if (!rule.room_types.includes(ctx.roomType)) return false;
  }
  // Rate plan scope
  if (rule.rate_plan_ids && rule.rate_plan_ids.length > 0) {
    if (!rule.rate_plan_ids.includes(ctx.ratePlanId)) return false;
  }
  // Occupancy scope
  if (rule.occupancies && rule.occupancies.length > 0) {
    if (!rule.occupancies.includes(ctx.occupancy)) return false;
  }
  return true;
}

function doesRuleMatch(rule: RateRule, ctx: RuleContext): {
  matches: boolean;
  reason: string;
} {
  if (!rule.is_active) return { matches: false, reason: "Inactive" };
  if (!isRuleInScope(rule, ctx)) return { matches: false, reason: "Out of scope" };

  switch (rule.rule_type) {
    case "seasonal": {
      if (!rule.start_date || !rule.end_date) {
        return { matches: false, reason: "No date range" };
      }
      const matches =
        ctx.checkInDate >= rule.start_date && ctx.checkInDate <= rule.end_date;
      return {
        matches,
        reason: matches
          ? `Check-in within ${rule.start_date} → ${rule.end_date}`
          : "Outside season dates",
      };
    }

    case "day_of_week": {
      if (!rule.days_of_week || rule.days_of_week.length === 0) {
        return { matches: false, reason: "No days set" };
      }
      const [y, m, d] = ctx.checkInDate.split("-").map(Number);
      const dow = new Date(y, m - 1, d).getDay();
      const matches = rule.days_of_week.includes(dow);
      return {
        matches,
        reason: matches
          ? `Check-in on ${DAY_NAMES.find((x) => x.value === dow)?.label}`
          : "Day not in list",
      };
    }

    case "los": {
      const min = rule.min_nights ?? 1;
      const max = rule.max_nights ?? 999;
      const matches = ctx.nights >= min && ctx.nights <= max;
      return {
        matches,
        reason: matches
          ? `Staying ${ctx.nights} nights (${min}-${max} range)`
          : `Stay is ${ctx.nights} nights (outside ${min}-${max})`,
      };
    }

    case "last_minute": {
      if (rule.advance_days === null || rule.advance_days === undefined) {
        return { matches: false, reason: "No advance days set" };
      }
      const bookingDate = new Date(ctx.bookingDate).getTime();
      const checkInDate = new Date(ctx.checkInDate).getTime();
      const daysUntil = Math.round(
        (checkInDate - bookingDate) / 86400000
      );
      const matches = daysUntil >= 0 && daysUntil <= rule.advance_days;
      return {
        matches,
        reason: matches
          ? `Booking ${daysUntil} days before check-in`
          : `Booking ${daysUntil} days before (outside ${rule.advance_days}d)`,
      };
    }

    case "occupancy": {
      if (rule.min_occupancy === null || rule.min_occupancy === undefined) {
        return { matches: false, reason: "No threshold set" };
      }
      const threshold = rule.min_occupancy > 1 ? rule.min_occupancy / 100 : rule.min_occupancy;
      const matches = ctx.hotelOccupancy >= threshold;
      return {
        matches,
        reason: matches
          ? `Occupancy ${(ctx.hotelOccupancy * 100).toFixed(1)}% ≥ ${(threshold * 100).toFixed(0)}%`
          : `Occupancy ${(ctx.hotelOccupancy * 100).toFixed(1)}% < ${(threshold * 100).toFixed(0)}%`,
      };
    }

    default:
      return { matches: false, reason: "Unknown rule type" };
  }
}

function applyAdjustment(
  price: number,
  type: AdjustmentType,
  value: number
): number {
  switch (type) {
    case "percentage":
      return Math.round(price * (1 + value / 100));
    case "fixed":
      return Math.max(0, Math.round(price + value));
    case "set_price":
      return Math.max(0, Math.round(value));
    default:
      return price;
  }
}

// ═══════════════════════════════════════════════
// MAIN: CALCULATE PRICE WITH RULES
// ═══════════════════════════════════════════════

export function calculatePriceWithRules(
  basePrice: number,
  rules: RateRule[],
  ctx: RuleContext
): PriceCalculation {
  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

  let currentPrice = basePrice;
  const applications: RuleApplication[] = [];

  for (const rule of sortedRules) {
    const { matches, reason } = doesRuleMatch(rule, ctx);
    if (!matches) continue;

    const beforePrice = currentPrice;
    const afterPrice = applyAdjustment(
      currentPrice,
      rule.adjustment_type,
      rule.adjustment_value
    );
    const adjustment = afterPrice - beforePrice;

    applications.push({
      rule,
      applied: true,
      beforePrice,
      afterPrice,
      adjustment,
      reason,
    });

    currentPrice = afterPrice;
  }

  return {
    basePrice,
    finalPrice: currentPrice,
    applications,
  };
}

// ═══════════════════════════════════════════════
// FORMAT HELPERS
// ═══════════════════════════════════════════════

export function formatAdjustment(rule: RateRule): string {
  const val = rule.adjustment_value;
  switch (rule.adjustment_type) {
    case "percentage":
      return `${val > 0 ? "+" : ""}${val}%`;
    case "fixed":
      return `${val > 0 ? "+" : ""}₹${val}`;
    case "set_price":
      return `Fixed ₹${val}`;
    default:
      return `${val}`;
  }
}

export function formatScope(rule: RateRule): string {
  const parts: string[] = [];
  if (rule.room_types && rule.room_types.length > 0) {
    parts.push(`${rule.room_types.length} room types`);
  }
  if (rule.rate_plan_ids && rule.rate_plan_ids.length > 0) {
    parts.push(`${rule.rate_plan_ids.length} plans`);
  }
  if (rule.occupancies && rule.occupancies.length > 0) {
    parts.push(`${rule.occupancies.length} occupancies`);
  }
  return parts.length > 0 ? parts.join(" · ") : "All rooms & plans";
}