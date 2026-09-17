"use client";

import { useEffect, useState, useCallback } from "react";
import {
  fetchDashboardStatsForDate,
  fetchBookingsByKpiAndSubFilter,
  fetchRoomCategoryAvailability,
  updateBookingStatus,
  sendMagicLink,
  invalidateCache,
  type DashboardKpi,
  type SubFilter,
} from "./db";
import { getActiveHotelId } from "./active-hotel";
import FolioModal from "./components/FolioModal";

// ────────────── Date helpers ──────────────
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtDisplayDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateTime(s: string): string {
  if (!s) return "—";
  return new Date(s).toLocaleString("en-IN", {
    month: "short", day: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

// ────────────── KPI / SubFilter config ──────────────
const KPIS: { key: DashboardKpi; label: string; color: string }[] = [
  { key: "newBookings",   label: "New bookings",  color: "bg-blue-100 text-blue-900 border-blue-300" },
  { key: "inHouse",       label: "In-house",      color: "bg-emerald-100 text-emerald-900 border-emerald-300" },
  { key: "arrivals",      label: "Arrivals",      color: "bg-yellow-100 text-yellow-900 border-yellow-300" },
  { key: "departures",    label: "Departures",    color: "bg-sky-100 text-sky-900 border-sky-300" },
  { key: "cancellations", label: "Cancellations", color: "bg-rose-100 text-rose-900 border-rose-300" },
  { key: "onHold",        label: "On hold",       color: "bg-slate-200 text-slate-800 border-slate-400" },
  { key: "noShows",       label: "No shows",      color: "bg-slate-300 text-slate-900 border-slate-500" },
  { key: "magicLink",     label: "Magic link",    color: "bg-indigo-100 text-indigo-900 border-indigo-300" },
];

const SUB_FILTERS: Record<DashboardKpi, { key: SubFilter; label: string }[]> = {
  newBookings: [{ key: "all", label: "All" }],
  inHouse:     [{ key: "all", label: "All" }],
  arrivals: [
    { key: "all",              label: "All" },
    { key: "pendingArrivals",  label: "Pending arrivals" },
    { key: "arrivalsInHouse",  label: "Arrived (in-house)" },
  ],
  departures: [
    { key: "all",                label: "All" },
    { key: "pendingDepartures",  label: "Pending departures" },
    { key: "checkedOut",         label: "Checked-out" },
  ],
  cancellations: [{ key: "all", label: "All" }],
  onHold:        [{ key: "all", label: "All" }],
  noShows:       [{ key: "all", label: "All" }],
  magicLink:     [{ key: "all", label: "All" }],
};

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [roomAvailability, setRoomAvailability] = useState<any[]>([]);
  const [activeKpi, setActiveKpi] = useState<DashboardKpi>("newBookings");
  const [subFilter, setSubFilter] = useState<SubFilter>("all");
  const [loading, setLoading] = useState(true);
const [selectedDate, setSelectedDate] = useState(() => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem("selectedDate");
    if (saved) return new Date(saved + "T00:00:00");
  }
  return new Date();
});
  const [dateOpen, setDateOpen] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "checkIn" | "checkOut" | "bookingMade" | "bookingId" | "room">("bookingMade");
  const [searchQuery, setSearchQuery] = useState("");
  const [folioFor, setFolioFor] = useState<any | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const hotelId = getActiveHotelId() || undefined;
      const dateISO = toISO(selectedDate);
      const [s, b, r] = await Promise.all([
        fetchDashboardStatsForDate(hotelId, dateISO),
        fetchBookingsByKpiAndSubFilter(hotelId, activeKpi, subFilter, dateISO),
        fetchRoomCategoryAvailability(hotelId),
      ]);
      setStats(s);
      setBookings(b);
      setRoomAvailability(r);
    } catch (err) {
      console.error("[dashboard] load error:", err);
    } finally {
      setLoading(false);
    }
  }, [activeKpi, subFilter, selectedDate]);

  useEffect(() => {
    loadAll();
    const handler = () => loadAll();
    window.addEventListener("hotel-changed", handler);
    const interval = setInterval(loadAll, 30_000);
    return () => {
      window.removeEventListener("hotel-changed", handler);
      clearInterval(interval);
    };
  }, [loadAll]);

  const handleKpiClick = (kpi: DashboardKpi) => {
    setActiveKpi(kpi);
    setSubFilter("all");
  };

  const handleRefresh = () => {
    invalidateCache();
    loadAll();
  };

  const handleCheckIn = async (b: any) => {
    if (!confirm(`Check in "${b.primaryGuest?.name}"?`)) return;
    try {
      await updateBookingStatus(b.id, "CHECKED-IN");
      invalidateCache();
      showToast("✅ Checked in");
      await loadAll();
    } catch (e: any) {
      showToast(`⚠ ${e.message}`);
    }
  };

  const handleCheckOut = async (b: any) => {
    if (!confirm(`Check out "${b.primaryGuest?.name}"?`)) return;
    try {
      await updateBookingStatus(b.id, "CHECKED-OUT");
      invalidateCache();
      showToast("✅ Checked out");
      await loadAll();
    } catch (e: any) {
      showToast(`⚠ ${e.message}`);
    }
  };

  const handleMagicLink = async (b: any) => {
    try {
      const link = await sendMagicLink(b.id);
      await navigator.clipboard.writeText(link);
      showToast("✨ Magic link copied!");
      await loadAll();
    } catch (e: any) {
      showToast(`⚠ ${e.message}`);
    }
  };

  const handleSendReview = async (b: any) => {
    showToast("⭐ Review link sent (not yet wired)");
  };

  // Sort + filter
  const visibleBookings = [...bookings]
    .filter((b) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        (b.primaryGuest?.name || "").toLowerCase().includes(q) ||
        (b.primaryGuest?.phone || "").includes(q) ||
        (b.roomNumber || "").toLowerCase().includes(q) ||
        (b.booking_ref || "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name": return (a.primaryGuest?.name || "").localeCompare(b.primaryGuest?.name || "");
        case "checkIn": return (a.check_in || "").localeCompare(b.check_in || "");
        case "checkOut": return (a.check_out || "").localeCompare(b.check_out || "");
        case "room": return (a.roomNumber || "").localeCompare(b.roomNumber || "");
        case "bookingId": return (a.booking_ref || "").localeCompare(b.booking_ref || "");
        default: return (b.created_at || "").localeCompare(a.created_at || "");
      }
    });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        <div>
          {/* HEADER with working date picker */}
          <div className="mb-6">
            <h1 className="text-3xl font-semibold text-gray-900 mb-1">
              {(() => {
                const h = new Date().getHours();
                if (h < 12) return "Good morning";
                if (h < 17) return "Good afternoon";
                return "Good evening";
              })()}
            </h1>
            <div className="text-sm text-gray-600 flex items-center gap-2 flex-wrap">
              Here is what going on with your property on
              <div className="relative">
                <button
                  onClick={() => setDateOpen(!dateOpen)}
                  className="px-3 py-1 border rounded-md text-xs font-medium bg-white hover:bg-gray-50 flex items-center gap-2"
                >
                  📅 {fmtDisplayDate(selectedDate)} <span className="text-gray-400">▾</span>
                </button>
                {dateOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setDateOpen(false)} />
                    <div className="absolute top-full left-0 mt-1 z-50 bg-white border rounded-lg shadow-xl p-3">
                  <input
  type="date"
  value={toISO(selectedDate)}
  onChange={(e) => {
    if (e.target.value) {
      localStorage.setItem("selectedDate", e.target.value);
      setSelectedDate(new Date(e.target.value + "T00:00:00"));
      setDateOpen(false);
      invalidateCache();
    }
  }}
  className="px-2 py-1 border rounded text-sm"
  autoFocus
/>
                      <div className="flex gap-2 mt-2 text-xs">
                        <button
                          onClick={() => { setSelectedDate(new Date()); setDateOpen(false); }}
                          className="px-2 py-1 border rounded hover:bg-gray-50"
                        >Today</button>
                        <button
                          onClick={() => { const d = new Date(); d.setDate(d.getDate() + 1); setSelectedDate(d); setDateOpen(false); }}
                          className="px-2 py-1 border rounded hover:bg-gray-50"
                        >Tomorrow</button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* KPI CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-5">
            {KPIS.map((k) => (
              <button
                key={k.key}
                onClick={() => handleKpiClick(k.key)}
                className={`rounded-lg p-3 text-center transition-all border-2 ${
                  activeKpi === k.key
                    ? "ring-2 ring-offset-1 ring-blue-500 " + k.color
                    : k.color + " opacity-80 hover:opacity-100"
                }`}
              >
                <div className="text-2xl font-bold">{stats?.[k.key] ?? 0}</div>
                <div className="text-[11px] font-medium uppercase tracking-wide mt-1">{k.label}</div>
              </button>
            ))}
          </div>

          {/* SEARCH + SUB-FILTER + SORT */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <input
              type="text"
              placeholder="Search tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-2 border rounded-md text-sm w-64 bg-white"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border rounded-md text-sm bg-white"
            >
              <option value="bookingMade">Booking made on</option>
              <option value="name">Name</option>
              <option value="checkIn">Check-in</option>
              <option value="checkOut">Check-out</option>
              <option value="bookingId">Booking ID</option>
              <option value="room">Room number</option>
            </select>

            {/* Sub-filter dropdown depends on active KPI */}
            {SUB_FILTERS[activeKpi].length > 1 && (
              <select
                value={subFilter}
                onChange={(e) => setSubFilter(e.target.value as SubFilter)}
                className="px-3 py-2 border rounded-md text-sm bg-white"
              >
                {SUB_FILTERS[activeKpi].map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            )}

            <button className="px-3 py-2 border rounded-md text-sm bg-white hover:bg-gray-50 flex items-center gap-1.5">
              <span>⬇</span> Download
            </button>
            <button
              onClick={handleRefresh}
              className="px-3 py-2 border rounded-md text-sm bg-white hover:bg-gray-50 ml-auto"
              disabled={loading}
            >
              {loading ? "⏳ Loading…" : "🔄 Refresh"}
            </button>
            <span className="text-xs text-gray-500">{visibleBookings.length} results found</span>
          </div>

          {/* LIST */}
          <div className="space-y-3">
            {loading && (
              <div className="bg-white rounded-lg border p-12 text-center text-gray-500">
                Loading…
              </div>
            )}
            {!loading && visibleBookings.length === 0 && (
              <div className="bg-white rounded-lg border p-12 text-center text-gray-500">
                No {KPIS.find((k) => k.key === activeKpi)?.label.toLowerCase() || "bookings"}.
              </div>
            )}
            {!loading && visibleBookings.map((b) => (
              <BookingRow
                key={b.id}
                booking={b}
                kpi={activeKpi}
                onCheckIn={handleCheckIn}
                onCheckOut={handleCheckOut}
                onFolio={() => setFolioFor(b)}
                onMagicLink={handleMagicLink}
                onSendReview={handleSendReview}
              />
            ))}
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border p-4">
            <h2 className="font-semibold text-gray-900 mb-3">Availability Today</h2>
            <div className="grid grid-cols-3 gap-2 text-xs text-gray-500 font-medium mb-2 px-1">
              <div>Room category</div>
              <div className="text-center">Inventory</div>
              <div className="text-right">Base Price</div>
            </div>
            {roomAvailability.length === 0 ? (
              <p className="text-sm text-gray-400 py-3 text-center">No rooms configured</p>
            ) : (
              <div className="space-y-1">
                {roomAvailability.map((r) => (
                  <div key={r.name} className="grid grid-cols-3 gap-2 text-sm py-2 border-b last:border-b-0">
                    <div className="truncate font-medium text-gray-700">{r.name}</div>
                    <div className={`text-center font-semibold ${r.inventory === 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      {r.inventory}
                    </div>
                    <div className="text-right text-gray-600">
                      ₹ {Number(r.base_price || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 text-sm py-3 mt-2 border-t font-semibold text-gray-900">
              <div>Total Available</div>
              <div className="text-center text-emerald-600">
                {roomAvailability.reduce((s, r) => s + (r.inventory || 0), 0)}
              </div>
              <div></div>
            </div>
          </div>

          <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
            <span className="inline-block bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded mb-2">
              OVERDUE
            </span>
            <h3 className="font-semibold text-gray-900 text-sm mb-2">
              Complete Razorpay onboarding
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed mb-3">
              As per RBI guidelines, all merchants should complete the KYC process in order to use Razorpay payment gateway.
            </p>
            <button className="w-full bg-black text-white text-sm font-medium py-2 rounded-md hover:bg-gray-800">
              SETUP NOW
            </button>
          </div>
        </div>
      </div>

      {folioFor && (
        <FolioModal
          booking={folioFor}
          onClose={() => setFolioFor(null)}
          refreshKey={0}
          onOpenPaymentManager={() => { setFolioFor(null); }}
          onSettleDues={() => { setFolioFor(null); }}
          onCheckInOrOut={() => { setFolioFor(null); }}
          onPaymentMade={() => { setFolioFor(null); loadAll(); }}
          onBookingUpdate={() => { setFolioFor(null); loadAll(); }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white px-6 py-3 rounded-xl shadow-2xl text-sm font-medium z-[100]">
          {toast}
        </div>
      )}
    </div>
  );
}

// ────────────── BOOKING ROW ──────────────
function BookingRow({
  booking: b,
  kpi,
  onCheckIn,
  onCheckOut,
  onFolio,
  onMagicLink,
  onSendReview,
}: {
  booking: any;
  kpi: DashboardKpi;
  onCheckIn: (b: any) => void;
  onCheckOut: (b: any) => void;
  onFolio: () => void;
  onMagicLink: (b: any) => void;
  onSendReview: (b: any) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const statusColors: Record<string, string> = {
    CONFIRMED: "bg-amber-100 text-amber-800",
    "CHECKED-IN": "bg-emerald-100 text-emerald-800",
    "CHECKED-OUT": "bg-gray-200 text-gray-700",
    CANCELLED: "bg-rose-100 text-rose-800",
    "ON-HOLD": "bg-purple-100 text-purple-800",
    BLOCKED: "bg-slate-200 text-slate-700",
  };

  const status = b.status || "CONFIRMED";
  const checkInFmt = fmtDateTime(b.check_in);
  const checkOutFmt = fmtDateTime(b.check_out);
  const balance = Number(b.amount || 0) - Number(b.paid_amount || 0);

  // Which action buttons to render?
  const showCheckIn = kpi === "newBookings" || kpi === "inHouse" || kpi === "arrivals";
  const showCheckOut = kpi === "departures";
  const showFolio = true;
  const showMagicLink = kpi === "newBookings" || kpi === "arrivals";
  const showReview = kpi === "departures";

  return (
    <div className="bg-white rounded-lg border hover:shadow-sm transition">
      <div className="p-4 flex items-start gap-4">
        <div className="flex flex-col items-center min-w-[60px] pt-1">
          <span className="text-lg font-bold text-gray-900">{b.roomNumber ?? "—"}</span>
          <span className="text-[10px] text-gray-400">🔑</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-3 mb-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-gray-900">{b.primaryGuest?.name ?? "Guest"}</h3>
                {b.is_no_show && (
                  <span className="text-[10px] font-bold bg-rose-600 text-white px-1.5 py-0.5 rounded">
                    NO SHOW
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">{b.primaryGuest?.phone || "NA"}</p>
              <p className="text-xs text-gray-700 mt-1">
                <span className="font-medium">{checkInFmt}</span> - <span className="font-medium">{checkOutFmt}</span>
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">{b.booking_ref}</p>
            </div>

            <div className="text-right shrink-0">
              <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded ${statusColors[status] || "bg-gray-100"}`}>
                {status}
              </span>
              <p className="text-base font-bold text-gray-900 mt-1">
                ₹ {Number(b.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
              <p className={`text-xs ${balance > 0 ? "text-rose-600 font-medium" : "text-gray-400"}`}>
                Bal: ₹ {balance.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 mt-3">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs">🏨</div>
              <div>
                <p className="font-medium text-gray-800 text-sm">{b.roomType ?? "Room"}</p>
                <p className="text-[11px] text-gray-500">{b.rate_plan || "Room Only"} · 👥 ({b.adults || 0} / {b.children || 0})</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {showCheckIn && status === "CONFIRMED" && (
                <button
                  onClick={() => onCheckIn(b)}
                  className="px-3 py-1.5 border rounded-md text-xs font-medium hover:bg-gray-50"
                >
                  Check-in
                </button>
              )}
              {showFolio && (
                <button
                  onClick={onFolio}
                  className="px-3 py-1.5 border rounded-md text-xs font-medium hover:bg-gray-50"
                >
                  View folio
                </button>
              )}
              {showMagicLink && (
                <button
                  onClick={() => onMagicLink(b)}
                  className="px-3 py-1.5 bg-black text-white rounded-md text-xs font-medium hover:bg-gray-800 flex items-center gap-1"
                >
                  ✨ Send magic link
                </button>
              )}
              {showReview && (
                <button
                  onClick={() => onSendReview(b)}
                  className="px-3 py-1.5 border border-amber-300 bg-amber-50 text-amber-800 rounded-md text-xs font-medium hover:bg-amber-100 flex items-center gap-1"
                >
                  ⭐ Send review
                </button>
              )}
              {showCheckOut && status === "CHECKED-IN" && (
                <button
                  onClick={() => onCheckOut(b)}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-md text-xs font-medium hover:bg-emerald-700"
                >
                  Check out
                </button>
              )}
              <button
                onClick={() => setExpanded(!expanded)}
                className="px-2 py-1.5 text-gray-400 hover:text-gray-700"
              >
                {expanded ? "▲" : "▼"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t bg-gray-50 px-4 py-3 text-xs text-gray-600 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><span className="text-gray-400">Email:</span> {b.primaryGuest?.email || "—"}</div>
          <div><span className="text-gray-400">Source:</span> {b.source || "—"}</div>
          <div><span className="text-gray-400">Notes:</span> {b.notes || "—"}</div>
          <div><span className="text-gray-400">Hotel:</span> {b.hotelName || "—"}</div>
        </div>
      )}
    </div>
  );
}