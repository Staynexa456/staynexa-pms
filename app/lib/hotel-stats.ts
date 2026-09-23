// app/lib/hotel-stats.ts
import { supabase } from "../supabase";

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════

export type RoomTypeStats = {
  type: string;
  total: number;
  occupied: number;
  available: number;
  basePrice: number;
};

export type BookingSummary = {
  id: string;
  booking_ref: string;
  guestName: string;
  guestPhone: string;
  roomNumber: string | null;
  roomType: string | null;
  checkIn: string;
  checkOut: string;
  status: string;
  amount: number;
  tax: number;
  paid: number;
  balance: number;
  totalAmount: number;
  source: string;
  adults: number;
  children: number;
};

export type SourceStats = {
  name: string;
  count: number;
  percentage: number;
};

export type PaymentMethodStats = {
  method: string;
  amount: number;
  count: number;
};

export type HotelStats = {
  // Room Inventory
  totalRooms: number;
  occupiedRooms: number;
  availableRooms: number;
  occupancyRate: number;
  roomTypes: RoomTypeStats[];

  // Housekeeping
  cleanRooms: number;
  dirtyRooms: number;
  inspectedRooms: number;
  maintenanceRooms: number;
  cleanlinessPercent: number;

  // Today's Operations
  arrivalsToday: BookingSummary[];
  departuresToday: BookingSummary[];
  inHouseGuests: BookingSummary[];
  pendingCheckins: BookingSummary[];
  pendingCheckouts: BookingSummary[];

  arrivalCount: number;
  departureCount: number;
  inHouseCount: number;

  // Revenue (from bookings - what was BILLED)
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  totalRevenue: number;
  totalPending: number;

  // Collection (from payments - what was ACTUALLY COLLECTED)
  todayCollection: number;
  weekCollection: number;
  monthCollection: number;
  totalCollected: number;

  // Booking Stats
  totalBookings: number;
  monthBookings: number;
  statusCounts: Record<string, number>;

  // Sources
  sources: SourceStats[];

  // Payment Methods
  paymentMethods: PaymentMethodStats[];

  // KPIs
  adr: number;
  revpar: number;
  monthRoomNights: number;
  monthTotalRoomNights: number;
};

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════

function getTodayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function getDateOffset(daysBack: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return d.toISOString().split("T")[0];
}

function getMonthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function getYearStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
}

function nightsBetween(checkIn: string, checkOut: string): number {
  try {
    const a = new Date(checkIn).getTime();
    const b = new Date(checkOut).getTime();
    return Math.max(1, Math.round((b - a) / 86400000));
  } catch {
    return 1;
  }
}

// ═══════════════════════════════════════════════
// MAIN COMPUTATION ENGINE
// ═══════════════════════════════════════════════

export async function fetchHotelStats(hotelId: string): Promise<HotelStats> {
  if (!hotelId) {
    throw new Error("hotelId is required to fetch hotel stats");
  }

  // ═══ ১. সব রুম আনা ═══
  const { data: rooms, error: roomsError } = await supabase
    .from("rooms")
    .select("id, room_number, room_type, base_price, housekeeping_status")
    .eq("hotel_id", hotelId);

  if (roomsError) {
    console.error("[fetchHotelStats] Rooms error:", roomsError);
  }

  // ═══ ২. সব বুকিং আনা (gেস্ট এবং রুম সহ) ═══
  const { data: bookings, error: bookingsError } = await supabase
    .from("bookings")
    .select(`
      id, booking_ref, check_in, check_out, amount, tax, paid, status,
      source, adults, children, rate_plan, room_id, primary_guest_id,
      guest:guests!primary_guest_id (name, phone),
      room:rooms!room_id (room_number, room_type)
    `)
    .eq("hotel_id", hotelId);

  if (bookingsError) {
    console.error("[fetchHotelStats] Bookings error:", bookingsError);
  }

  const safeRooms = rooms || [];
  const safeBookings = bookings || [];

  // ═══ ৩. সব পেমেন্ট আনা (bookings থেকে booking_ids নিয়ে) ═══
  const bookingIds = safeBookings.map((b: any) => b.id).filter(Boolean);
  let allPayments: any[] = [];

  if (bookingIds.length > 0) {
    const { data: payments, error: paymentsError } = await supabase
      .from("payments")
      .select("id, booking_id, amount, method, created_at")
      .in("booking_id", bookingIds);

    if (paymentsError) {
      console.error("[fetchHotelStats] Payments error:", paymentsError);
    }
    allPayments = payments || [];
  }

  // ═══ ৪. তারিখ সেটআপ ═══
  const today = getTodayISO();
  const weekStart = getDateOffset(7);
  const monthStart = getMonthStart();
  const yearStart = getYearStart();

  // ═══ ৫. ROOM INVENTORY ক্যালকুলেশন ═══
  const totalRooms = safeRooms.length;

  const todayBookings = safeBookings.filter((b: any) => {
    const ci = b.check_in || "";
    const co = b.check_out || "";
    return (
      ci <= today &&
      co > today &&
      ["CONFIRMED", "CHECKED-IN", "PENDING DEPARTURE"].includes(b.status)
    );
  });

  const occupiedRooms = todayBookings.length;
  const availableRooms = Math.max(0, totalRooms - occupiedRooms);
  const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

  // ═══ ৬. ROOM TYPE BREAKDOWN ═══
  const roomTypeMap = new Map<string, RoomTypeStats>();
  safeRooms.forEach((r: any) => {
    const type = r.room_type || "Standard";
    if (!roomTypeMap.has(type)) {
      roomTypeMap.set(type, {
        type,
        total: 0,
        occupied: 0,
        available: 0,
        basePrice: Number(r.base_price) || 0,
      });
    }
    const entry = roomTypeMap.get(type)!;
    entry.total += 1;
    entry.available += 1;
  });

  todayBookings.forEach((b: any) => {
    const type = b.room?.room_type || "Standard";
    const entry = roomTypeMap.get(type);
    if (entry) {
      entry.occupied += 1;
      entry.available = Math.max(0, entry.available - 1);
    }
  });

  const roomTypes = Array.from(roomTypeMap.values());

  // ═══ ৭. HOUSEKEEPING ═══
  let cleanRooms = 0;
  let dirtyRooms = 0;
  let inspectedRooms = 0;
  let maintenanceRooms = 0;

  safeRooms.forEach((r: any) => {
    const status = r.housekeeping_status || "CLEAN";
    if (status === "DIRTY") dirtyRooms++;
    else if (status === "INSPECTED") inspectedRooms++;
    else if (status === "MAINTENANCE") maintenanceRooms++;
    else cleanRooms++;
  });

  const cleanlinessPercent =
    totalRooms > 0
      ? ((cleanRooms + inspectedRooms) / totalRooms) * 100
      : 0;

  // ═══ ৮. BOOKING LIST MAPPER ═══
  const toSummary = (b: any): BookingSummary => {
    const amount = Number(b.amount) || 0;
    const tax = Number(b.tax) || 0;
    const paid = Number(b.paid) || 0;
    const total = amount + tax;
    return {
      id: b.id,
      booking_ref: b.booking_ref || "",
      guestName: b.guest?.name || "Guest",
      guestPhone: b.guest?.phone || "",
      roomNumber: b.room?.room_number || null,
      roomType: b.room?.room_type || null,
      checkIn: b.check_in || "",
      checkOut: b.check_out || "",
      status: b.status || "CONFIRMED",
      amount,
      tax,
      paid,
      balance: Math.max(0, total - paid),
      totalAmount: total,
      source: b.source || "walk-in",
      adults: Number(b.adults) || 1,
      children: Number(b.children) || 0,
    };
  };

  // ═══ ৯. TODAY'S OPERATIONS ═══
  const arrivalsToday = safeBookings
    .filter(
      (b: any) =>
        b.check_in === today &&
        b.status !== "CANCELLED" &&
        b.status !== "NO-SHOW"
    )
    .map(toSummary);

  const departuresToday = safeBookings
    .filter(
      (b: any) => b.check_out === today && b.status !== "CANCELLED"
    )
    .map(toSummary);

  const inHouseGuests = safeBookings
    .filter((b: any) => b.status === "CHECKED-IN")
    .map(toSummary);

  const pendingCheckins = safeBookings
    .filter(
      (b: any) =>
        b.check_in === today &&
        b.status === "CONFIRMED"
    )
    .map(toSummary);

  const pendingCheckouts = safeBookings
    .filter(
      (b: any) =>
        b.check_out === today &&
        (b.status === "CHECKED-IN" || b.status === "PENDING DEPARTURE")
    )
    .map(toSummary);

  // ═══ ১০. REVENUE (from bookings - what was BILLED) ═══
  const activeBookings = safeBookings.filter(
    (b: any) => b.status !== "CANCELLED" && b.status !== "BLOCKED"
  );

  const todayBookingsForRev = activeBookings.filter(
    (b: any) => b.check_in === today
  );
  const weekBookings = activeBookings.filter(
    (b: any) => b.check_in >= weekStart && b.check_in <= today
  );
  const monthBookings = activeBookings.filter(
    (b: any) => b.check_in >= monthStart && b.check_in <= today
  );

  const sumBilled = (arr: any[]) =>
    arr.reduce(
      (s, b) => s + (Number(b.amount) || 0) + (Number(b.tax) || 0),
      0
    );
  const sumPaid = (arr: any[]) =>
    arr.reduce((s, b) => s + (Number(b.paid) || 0), 0);

  const todayRevenue = sumBilled(todayBookingsForRev);
  const weekRevenue = sumBilled(weekBookings);
  const monthRevenue = sumBilled(monthBookings);
  const totalRevenue = sumBilled(activeBookings);
  const totalPending = activeBookings.reduce((s: number, b: any) => {
    const total = (Number(b.amount) || 0) + (Number(b.tax) || 0);
    const paid = Number(b.paid) || 0;
    return s + Math.max(0, total - paid);
  }, 0);

  // ═══ ১১. COLLECTION (from payments - what was RECEIVED) ═══
  const filterPayments = (arr: any[], since: string, until: string) =>
    arr.filter((p: any) => {
      const d = (p.created_at || "").split("T")[0];
      return d >= since && d <= until;
    });

  const sumAmount = (arr: any[]) =>
    arr.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const todayCollection = sumAmount(
    filterPayments(allPayments, today, today)
  );
  const weekCollection = sumAmount(
    filterPayments(allPayments, weekStart, today)
  );
  const monthCollection = sumAmount(
    filterPayments(allPayments, monthStart, today)
  );
  const totalCollected = sumAmount(allPayments);

  // ═══ ১২. STATUS COUNTS ═══
  const statusCounts: Record<string, number> = {
    CONFIRMED: 0,
    "CHECKED-IN": 0,
    "CHECKED-OUT": 0,
    "PENDING DEPARTURE": 0,
    CANCELLED: 0,
    BLOCKED: 0,
    "NO-SHOW": 0,
    "ON-HOLD": 0,
  };

  safeBookings.forEach((b: any) => {
    const s = b.status || "CONFIRMED";
    if (statusCounts[s] !== undefined) statusCounts[s]++;
    else statusCounts[s] = 1;
  });

  // ═══ ১৩. SOURCES ═══
  const sourceMap = new Map<string, number>();
  monthBookings.forEach((b: any) => {
    const src = (b.source || "walk-in").toLowerCase();
    sourceMap.set(src, (sourceMap.get(src) || 0) + 1);
  });

  const totalSourceBookings = monthBookings.length || 1;
  const sources: SourceStats[] = Array.from(sourceMap.entries())
    .map(([name, count]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      count,
      percentage: (count / totalSourceBookings) * 100,
    }))
    .sort((a, b) => b.count - a.count);

  // ═══ ১৪. PAYMENT METHODS ═══
  const methodMap = new Map<string, { amount: number; count: number }>();
  filterPayments(allPayments, monthStart, today).forEach((p: any) => {
    const m = p.method || "Other";
    if (!methodMap.has(m)) methodMap.set(m, { amount: 0, count: 0 });
    const e = methodMap.get(m)!;
    e.amount += Number(p.amount) || 0;
    e.count += 1;
  });

  const paymentMethods: PaymentMethodStats[] = Array.from(
    methodMap.entries()
  ).map(([method, data]) => ({
    method,
    amount: data.amount,
    count: data.count,
  }));

  // ═══ ১৫. KPIs (ADR, RevPAR) ═══
  let monthRoomNights = 0;
  monthBookings.forEach((b: any) => {
    monthRoomNights += nightsBetween(b.check_in, b.check_out);
  });

  const monthNightsCount = Math.max(1, new Date().getDate());
  const monthTotalRoomNights = totalRooms * monthNightsCount;

  const adr = monthRoomNights > 0 ? monthRevenue / monthRoomNights : 0;
  const revpar =
    monthTotalRoomNights > 0 ? monthRevenue / monthTotalRoomNights : 0;

  // ═══ RETURN ═══
  return {
    totalRooms,
    occupiedRooms,
    availableRooms,
    occupancyRate,
    roomTypes,

    cleanRooms,
    dirtyRooms,
    inspectedRooms,
    maintenanceRooms,
    cleanlinessPercent,

    arrivalsToday,
    departuresToday,
    inHouseGuests,
    pendingCheckins,
    pendingCheckouts,

    arrivalCount: arrivalsToday.length,
    departureCount: departuresToday.length,
    inHouseCount: inHouseGuests.length,

    todayRevenue,
    weekRevenue,
    monthRevenue,
    totalRevenue,
    totalPending,

    todayCollection,
    weekCollection,
    monthCollection,
    totalCollected,

    totalBookings: safeBookings.length,
    monthBookings: monthBookings.length,
    statusCounts,

    sources,
    paymentMethods,

    adr,
    revpar,
    monthRoomNights,
    monthTotalRoomNights,
  };
}