// app/lib/actions-required.ts
import { supabase } from "../supabase";

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════

export type PendingAction = {
  id: string;
  bookingId: string;
  type: "CHECK_IN" | "CHECK_OUT" | "OVERDUE_IN" | "OVERDUE_OUT" | "BALANCE_DUE" | "DATA_ISSUE";
  priority: "high" | "medium" | "low";
  guestName: string;
  guestPhone: string;
  roomNumber: string | null;
  roomType: string | null;
  checkIn: string;
  checkOut: string;
  status: string;
  amount: number;
  balance: number;
  message: string;
  actionLabel: string;
  daysLate?: number;
};

export type ActionsRequiredSummary = {
  actions: PendingAction[];
  total: number;
  highPriority: number;
  mediumPriority: number;
  lowPriority: number;
  byType: Record<string, number>;
};

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function daysDiff(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  return Math.round((da - db) / 86400000);
}

function safeGuestName(b: any): string {
  const g = b?.guest;
  if (!g) return "Guest";
  if (Array.isArray(g)) return g[0]?.name || "Guest";
  return g.name || "Guest";
}

function safeGuestPhone(b: any): string {
  const g = b?.guest;
  if (!g) return "";
  if (Array.isArray(g)) return g[0]?.phone || "";
  return g.phone || "";
}

function safeRoomNumber(b: any): string | null {
  const r = b?.room;
  if (!r) return null;
  if (Array.isArray(r)) return r[0]?.room_number || null;
  return r.room_number || null;
}

function safeRoomType(b: any): string | null {
  const r = b?.room;
  if (!r) return null;
  if (Array.isArray(r)) return r[0]?.room_type || null;
  return r.room_type || null;
}

// ═══════════════════════════════════════════════
// MAIN: Compute All Actions Required
// ═══════════════════════════════════════════════

export async function fetchActionsRequired(
  hotelId: string
): Promise<ActionsRequiredSummary> {
  if (!hotelId) throw new Error("hotelId is required");

  const today = todayISO();

  // ═══ সব bookings আনা ═══
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select(`
      id, booking_ref, check_in, check_out, amount, tax, paid, status,
      source, notes, created_at, room_id, primary_guest_id,
      guest:guests!primary_guest_id (name, phone),
      room:rooms!room_id (room_number, room_type)
    `)
    .eq("hotel_id", hotelId)
    .neq("status", "CANCELLED")
    .neq("status", "BLOCKED");

  if (error) {
    console.error("[fetchActionsRequired]", error);
    throw error;
  }

  const allBookings = bookings || [];
  const actions: PendingAction[] = [];

  allBookings.forEach((b: any) => {
    const ci = (b.check_in || "").split("T")[0];
    const co = (b.check_out || "").split("T")[0];
    const total = (Number(b.amount) || 0) + (Number(b.tax) || 0);
    const paid = Number(b.paid) || 0;
    const balance = Math.max(0, total - paid);

    const common = {
      id: `action-${b.id}`,
      bookingId: b.id,
      guestName: safeGuestName(b),
      guestPhone: safeGuestPhone(b),
      roomNumber: safeRoomNumber(b),
      roomType: safeRoomType(b),
      checkIn: ci,
      checkOut: co,
      status: b.status,
      amount: total,
      balance,
    };

    // ═══ ১. Check-in Due Today (status CONFIRMED, check_in === today) ═══
    if (b.status === "CONFIRMED" && ci === today) {
      actions.push({
        ...common,
        type: "CHECK_IN",
        priority: "high",
        message: `Check-in scheduled for today`,
        actionLabel: "Check In",
      });
    }

    // ═══ ২. Overdue Check-in (status CONFIRMED, check_in < today) ═══
    if (b.status === "CONFIRMED" && ci < today) {
      const daysLate = Math.abs(daysDiff(ci, today));
      actions.push({
        ...common,
        type: "OVERDUE_IN",
        priority: "high",
        message: `Check-in was due ${daysLate} day${daysLate > 1 ? "s" : ""} ago`,
        actionLabel: "Check In Now",
        daysLate,
      });
    }

    // ═══ ৩. Check-out Due Today (status CHECKED-IN, check_out === today) ═══
    if (
      ["CHECKED-IN", "PENDING DEPARTURE"].includes(b.status) &&
      co === today
    ) {
      actions.push({
        ...common,
        type: "CHECK_OUT",
        priority: balance > 0 ? "high" : "medium",
        message: balance > 0
          ? `Check-out today · ₹${balance.toFixed(2)} balance due`
          : `Check-out scheduled for today`,
        actionLabel: "Check Out",
      });
    }

    // ═══ ৪. Overdue Check-out (status CHECKED-IN, check_out < today) ═══
    if (
      ["CHECKED-IN", "PENDING DEPARTURE"].includes(b.status) &&
      co < today
    ) {
      const daysLate = Math.abs(daysDiff(co, today));
      actions.push({
        ...common,
        type: "OVERDUE_OUT",
        priority: "high",
        message: `Check-out was due ${daysLate} day${daysLate > 1 ? "s" : ""} ago`,
        actionLabel: "Check Out Now",
        daysLate,
      });
    }

    // ═══ ৫. Data Issue: CHECKED-IN but check_in is in the future ═══
    if (b.status === "CHECKED-IN" && ci > today) {
      actions.push({
        ...common,
        type: "DATA_ISSUE",
        priority: "medium",
        message: `Status is CHECKED-IN but check-in date is ${ci} (future)`,
        actionLabel: "Fix Status",
      });
    }

    // ═══ ৬. Data Issue: CONFIRMED but guest should be checked-in already for days ═══
    // (already covered in #2)

    // ═══ ৭. Balance Due (in-house with pending payment) ═══
    if (
      b.status === "CHECKED-IN" &&
      balance > 0 &&
      co > today // Not due to checkout yet
    ) {
      actions.push({
        ...common,
        type: "BALANCE_DUE",
        priority: balance > 5000 ? "high" : "low",
        message: `₹${balance.toFixed(2)} balance pending`,
        actionLabel: "Collect Payment",
      });
    }
  });

  // ═══ Priority অনুযায়ী সাজানো ═══
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // ═══ Summary তৈরি ═══
  const byType: Record<string, number> = {};
  actions.forEach((a) => {
    byType[a.type] = (byType[a.type] || 0) + 1;
  });

  return {
    actions,
    total: actions.length,
    highPriority: actions.filter((a) => a.priority === "high").length,
    mediumPriority: actions.filter((a) => a.priority === "medium").length,
    lowPriority: actions.filter((a) => a.priority === "low").length,
    byType,
  };
}