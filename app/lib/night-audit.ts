// app/lib/night-audit.ts
import { supabase } from "../supabase";

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════

export type NightAuditRoomStats = {
  totalRooms: number;
  occupiedRooms: number;
  availableRooms: number;
  outOfOrder: number;
  occupancyRate: number;
  roomNights: number;
  adr: number;
  revpar: number;
};

export type NightAuditRevenue = {
  roomRevenue: number;
  addonRevenue: number;
  addonTax: number;
  roomTax: number;
  totalRevenue: number;
  discount: number;
  refunds: number;
  netRevenue: number;
};

export type NightAuditPayments = {
  cash: number;
  upi: number;
  card: number;
  bankTransfer: number;
  other: number;
  total: number;
  count: number;
};

export type NightAuditCashDrawer = {
  openingBalance: number;
  cashReceived: number;
  cashRefunds: number;
  expenses: number;
  expectedClosing: number;
  actualClosing: number | null;
  difference: number;
};

export type NightAuditTransaction = {
  id: string;
  type: "BOOKING" | "CHECKIN" | "CHECKOUT" | "PAYMENT" | "REFUND" | "CANCEL" | "ADDON";
  time: string;
  description: string;
  guestName: string;
  roomNumber: string | null;
  amount: number;
  method?: string;
};

export type NightAuditArrivalPreview = {
  guestName: string;
  roomNumber: string | null;
  roomType: string | null;
  checkIn: string;
  adults: number;
  children: number;
  status: string;
};

export type NightAuditReport = {
  businessDate: string;
  hotelName: string;
  generatedAt: string;

  roomStats: NightAuditRoomStats;
  revenue: NightAuditRevenue;
  payments: NightAuditPayments;
  cashDrawer: NightAuditCashDrawer;

  transactions: NightAuditTransaction[];
  arrivalsCompleted: number;
  departuresCompleted: number;
  newBookings: number;
  cancellations: number;

  tomorrowArrivals: NightAuditArrivalPreview[];
  tomorrowDepartures: NightAuditArrivalPreview[];
  inHouseCount: number;

  hasLocked: boolean;
};

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════

function nightsBetween(ci: string, co: string): number {
  try {
    const a = new Date(ci).getTime();
    const b = new Date(co).getTime();
    return Math.max(1, Math.round((b - a) / 86400000));
  } catch {
    return 1;
  }
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

/**
 * Safely extract just the date part (YYYY-MM-DD) from any date/timestamp string
 */
function toDateStr(iso: string | null | undefined): string {
  if (!iso) return "";
  // Handle both "2026-09-24" and "2026-09-24T00:00:00+00:00" formats
  return String(iso).split("T")[0].split(" ")[0];
}

function getNightlyRate(booking: any): number {
  const totalRoomCharge = Number(booking.amount) || 0;
  const nights = nightsBetween(booking.check_in, booking.check_out);
  return nights > 0 ? totalRoomCharge / nights : 0;
}

function getNightlyTax(booking: any): number {
  const totalTax = Number(booking.tax) || 0;
  const nights = nightsBetween(booking.check_in, booking.check_out);
  return nights > 0 ? totalTax / nights : 0;
}

function getNightlyAddons(booking: any): { revenue: number; tax: number; list: any[] } {
  const match = (booking.notes || "").match(/ADDONS_JSON:(\[[^\]]*\])/);
  if (!match) return { revenue: 0, tax: 0, list: [] };

  let totalRevenue = 0;
  let totalTax = 0;
  let list: any[] = [];

  try {
    const addons = JSON.parse(match[1]);
    list = addons;
    addons.forEach((a: any) => {
      const price = Number(a.price) || 0;
      const taxPct = Number(a.tax) || 0;
      totalRevenue += price;
      totalTax += (price * taxPct) / 100;
    });
  } catch {
    return { revenue: 0, tax: 0, list: [] };
  }

  const nights = nightsBetween(booking.check_in, booking.check_out);
  return {
    revenue: nights > 0 ? totalRevenue / nights : 0,
    tax: nights > 0 ? totalTax / nights : 0,
    list,
  };
}

// ═══════════════════════════════════════════════
// MAIN: Night Audit Calculator
// ═══════════════════════════════════════════════

export async function fetchNightAudit(
  hotelId: string,
  businessDate: string
): Promise<NightAuditReport> {
  if (!hotelId) throw new Error("hotelId is required");
  if (!businessDate) throw new Error("businessDate is required");

  const tomorrow = addDays(businessDate, 1);
  const bDate = toDateStr(businessDate);

  // ═══ ১. হোটেল নাম ═══
  const { data: hotelData } = await supabase
    .from("hotels")
    .select("name")
    .eq("id", hotelId)
    .maybeSingle();

  // ═══ ২. সব রুম ═══
  const { data: roomsData, error: roomsError } = await supabase
    .from("rooms")
    .select("id, room_number, room_type, housekeeping_status")
    .eq("hotel_id", hotelId);

  if (roomsError) console.error("[NightAudit] Rooms query error:", roomsError);
  const allRooms = roomsData || [];

  // ═══ ৩. সব বুকিং — updated_at ছাড়াই (safe) ═══
  const { data: bookingsData, error: bookingsError } = await supabase
    .from("bookings")
    .select(`
      id, booking_ref, check_in, check_out, amount, tax, paid, status,
      source, adults, children, notes, created_at, room_id, primary_guest_id,
      guest:guests!primary_guest_id (name, phone),
      room:rooms!room_id (room_number, room_type)
    `)
    .eq("hotel_id", hotelId);

  if (bookingsError) {
    console.error("[NightAudit] Bookings query error:", bookingsError);
    console.error("[NightAudit] Error details:", JSON.stringify(bookingsError, null, 2));
  }

  const allBookings = bookingsData || [];
  console.log(`[NightAudit] Loaded ${allBookings.length} bookings for hotel ${hotelId} on ${bDate}`);

  // ═══ ৪. সব পেমেন্ট ═══
  const bookingIds = allBookings.map((b: any) => b.id).filter(Boolean);
  let allPayments: any[] = [];
  if (bookingIds.length > 0) {
    const { data: payments, error: paymentsError } = await supabase
      .from("payments")
      .select("id, booking_id, amount, method, reference, note, created_at")
      .in("booking_id", bookingIds);

    if (paymentsError) {
      console.error("[NightAudit] Payments query error:", paymentsError);
    }
    allPayments = payments || [];
  }

  // ═══════════════════════════════════════════════
  // ৫. BUSINESS DATE-এ ACTIVE BOOKINGS
  // ═══════════════════════════════════════════════
  const activeBookings = allBookings.filter((b: any) => {
    const ci = toDateStr(b.check_in);
    const co = toDateStr(b.check_out);
    return (
      ci <= bDate &&
      co > bDate &&
      ["CONFIRMED", "CHECKED-IN", "PENDING DEPARTURE"].includes(b.status)
    );
  });

  console.log(`[NightAudit] Active bookings on ${bDate}: ${activeBookings.length}`);

  // ═══ ৬. ROOM STATS ═══
  const occupiedRooms = activeBookings.length;
  const outOfOrder = allRooms.filter(
    (r: any) => r.housekeeping_status === "MAINTENANCE"
  ).length;
  const availableRooms = Math.max(
    0,
    allRooms.length - occupiedRooms - outOfOrder
  );
  const occupancyRate =
    allRooms.length > 0 ? (occupiedRooms / allRooms.length) * 100 : 0;
  const roomNights = occupiedRooms;

  // ═══════════════════════════════════════════════
  // ৭. REVENUE FOR BUSINESS DATE
  // ═══════════════════════════════════════════════
  let roomRevenue = 0;
  let roomTax = 0;
  let addonRevenue = 0;
  let addonTax = 0;

  activeBookings.forEach((b: any) => {
    roomRevenue += getNightlyRate(b);
    roomTax += getNightlyTax(b);
    const addons = getNightlyAddons(b);
    addonRevenue += addons.revenue;
    addonTax += addons.tax;
  });

  const totalRevenue = roomRevenue + roomTax + addonRevenue + addonTax;

  // ═══ ৮. PAYMENTS (এই দিনে RECEIVED) ═══
  const dayPayments = allPayments.filter((p: any) => {
    return toDateStr(p.created_at) === bDate;
  });

  const refunds = dayPayments
    .filter((p: any) => (Number(p.amount) || 0) < 0)
    .reduce((s: number, p: any) => s + Math.abs(Number(p.amount) || 0), 0);

  const positivePayments = dayPayments.filter(
    (p: any) => (Number(p.amount) || 0) > 0
  );

  const byMethod: Record<string, number> = {
    Cash: 0,
    UPI: 0,
    Card: 0,
    "Bank Transfer": 0,
    Other: 0,
  };

  positivePayments.forEach((p: any) => {
    const m = (p.method || "Other").toLowerCase();
    const amt = Number(p.amount) || 0;
    if (m.includes("cash")) byMethod.Cash += amt;
    else if (m.includes("upi")) byMethod.UPI += amt;
    else if (m.includes("card")) byMethod.Card += amt;
    else if (m.includes("bank")) byMethod["Bank Transfer"] += amt;
    else byMethod.Other += amt;
  });

  const totalPayments = positivePayments.reduce(
    (s: number, p: any) => s + (Number(p.amount) || 0),
    0
  );

  const payments = {
    cash: byMethod.Cash,
    upi: byMethod.UPI,
    card: byMethod.Card,
    bankTransfer: byMethod["Bank Transfer"],
    other: byMethod.Other,
    total: totalPayments,
    count: positivePayments.length,
  };

  // ═══ ৯. CASH DRAWER ═══
  const openingBalance = 0;
  const cashReceived = byMethod.Cash;
  const cashRefunds = dayPayments
    .filter(
      (p: any) =>
        (Number(p.amount) || 0) < 0 &&
        (p.method || "").toLowerCase().includes("cash")
    )
    .reduce((s: number, p: any) => s + Math.abs(Number(p.amount) || 0), 0);
  const expenses = 0;
  const expectedClosing = openingBalance + cashReceived - cashRefunds - expenses;

  const cashDrawer = {
    openingBalance,
    cashReceived,
    cashRefunds,
    expenses,
    expectedClosing,
    actualClosing: null,
    difference: 0,
  };

  // ═══════════════════════════════════════════════
  // ১০. TRANSACTIONS LOG
  // ═══════════════════════════════════════════════
  const transactions: NightAuditTransaction[] = [];

  // ─── ক. নতুন বুকিং ───
  const bookingsCreatedToday = allBookings.filter((b: any) => {
    return toDateStr(b.created_at) === bDate;
  });

  bookingsCreatedToday.forEach((b: any) => {
    transactions.push({
      id: `booking-${b.id}`,
      type: "BOOKING",
      time: formatTime(b.created_at),
      description: `New booking — Room ${b.room?.room_number || "—"} (${b.source || "walk-in"})`,
      guestName: b.guest?.name || "Guest",
      roomNumber: b.room?.room_number || null,
      amount: (Number(b.amount) || 0) + (Number(b.tax) || 0),
    });
  });

  // ─── খ. চেক-ইন ───
  const checkInsToday = allBookings.filter((b: any) => {
    return (
      toDateStr(b.check_in) === bDate &&
      ["CHECKED-IN", "PENDING DEPARTURE"].includes(b.status)
    );
  });

  checkInsToday.forEach((b: any) => {
    transactions.push({
      id: `checkin-${b.id}`,
      type: "CHECKIN",
      time: formatTime(b.check_in),
      description: `Checked-in — Room ${b.room?.room_number || "—"}`,
      guestName: b.guest?.name || "Guest",
      roomNumber: b.room?.room_number || null,
      amount: 0,
    });
  });

  // ─── গ. চেক-আউট ───
  const checkOutsToday = allBookings.filter((b: any) => {
    return toDateStr(b.check_out) === bDate && b.status === "CHECKED-OUT";
  });

  checkOutsToday.forEach((b: any) => {
    transactions.push({
      id: `checkout-${b.id}`,
      type: "CHECKOUT",
      time: formatTime(b.check_out),
      description: `Checked-out — Room ${b.room?.room_number || "—"}`,
      guestName: b.guest?.name || "Guest",
      roomNumber: b.room?.room_number || null,
      amount: 0,
    });
  });

  // ─── ঘ. বাতিল ───
  const cancelledToday = allBookings.filter((b: any) => {
    if (b.status !== "CANCELLED") return false;
    return toDateStr(b.created_at) === bDate;
  });

  cancelledToday.forEach((b: any) => {
    transactions.push({
      id: `cancel-${b.id}`,
      type: "CANCEL",
      time: formatTime(b.created_at),
      description: `Booking cancelled — Room ${b.room?.room_number || "—"}`,
      guestName: b.guest?.name || "Guest",
      roomNumber: b.room?.room_number || null,
      amount: 0,
    });
  });

  // ─── ঙ. Addons ───
  activeBookings.forEach((b: any) => {
    const addons = getNightlyAddons(b);
    addons.list.forEach((a: any) => {
      transactions.push({
        id: `addon-${b.id}-${a.id || Math.random()}`,
        type: "ADDON",
        time: formatTime(a.date || b.created_at),
        description: `Addon: ${a.name} — Room ${b.room?.room_number || "—"}`,
        guestName: b.guest?.name || "Guest",
        roomNumber: b.room?.room_number || null,
        amount: (Number(a.price) || 0) * (1 + (Number(a.tax) || 0) / 100),
      });
    });
  });

  // ─── চ. পেমেন্ট ───
  dayPayments.forEach((p: any) => {
    const amt = Number(p.amount) || 0;
    const isRefund = amt < 0;
    const b = allBookings.find((bb: any) => bb.id === p.booking_id);
    transactions.push({
      id: `payment-${p.id}`,
      type: isRefund ? "REFUND" : "PAYMENT",
      time: formatTime(p.created_at),
      description: isRefund
        ? `Refund via ${p.method || "Cash"}`
        : `Payment received via ${p.method || "Cash"}`,
      guestName: b?.guest?.name || "Guest",
      roomNumber: b?.room?.room_number || null,
      amount: Math.abs(amt),
      method: p.method,
    });
  });

  // ─── সময় অনুযায়ী সাজানো ───
  transactions.sort((a, b) => {
    const ta = a.time === "—" ? "99:99" : a.time;
    const tb = b.time === "—" ? "99:99" : b.time;
    return ta.localeCompare(tb);
  });

  // ═══ ১১. TODAY'S COUNTS ═══
  const arrivalsCompleted = checkInsToday.length;
  const departuresCompleted = checkOutsToday.length;
  const newBookings = bookingsCreatedToday.length;
  const cancellations = cancelledToday.length;

  // ═══ ১২. TOMORROW'S PREVIEW ═══
  const tomorrowArrivals = allBookings
    .filter(
      (b: any) =>
        toDateStr(b.check_in) === tomorrow &&
        b.status !== "CANCELLED" &&
        b.status !== "NO-SHOW"
    )
    .map((b: any) => ({
      guestName: b.guest?.name || "Guest",
      roomNumber: b.room?.room_number || null,
      roomType: b.room?.room_type || null,
      checkIn: b.check_in,
      adults: Number(b.adults) || 1,
      children: Number(b.children) || 0,
      status: b.status,
    }));

  const tomorrowDepartures = allBookings
    .filter(
      (b: any) =>
        toDateStr(b.check_out) === tomorrow && b.status !== "CANCELLED"
    )
    .map((b: any) => ({
      guestName: b.guest?.name || "Guest",
      roomNumber: b.room?.room_number || null,
      roomType: b.room?.room_type || null,
      checkIn: b.check_out,
      adults: Number(b.adults) || 1,
      children: Number(b.children) || 0,
      status: b.status,
    }));

  const inHouseCount = activeBookings.length;

  // ═══ RETURN ═══
  return {
    businessDate: bDate,
    hotelName: hotelData?.name || "Unknown Hotel",
    generatedAt: new Date().toISOString(),

    roomStats: {
      totalRooms: allRooms.length,
      occupiedRooms,
      availableRooms,
      outOfOrder,
      occupancyRate,
      roomNights,
      adr: roomNights > 0 ? roomRevenue / roomNights : 0,
      revpar: allRooms.length > 0 ? roomRevenue / allRooms.length : 0,
    },

    revenue: {
      roomRevenue,
      addonRevenue,
      addonTax,
      roomTax,
      totalRevenue,
      discount: 0,
      refunds,
      netRevenue: totalRevenue - refunds,
    },

    payments,
    cashDrawer,

    transactions,
    arrivalsCompleted,
    departuresCompleted,
    newBookings,
    cancellations,

    tomorrowArrivals,
    tomorrowDepartures,
    inHouseCount,

    hasLocked: false,
  };
}