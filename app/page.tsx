"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { fetchBookings } from "./db";
import type { Booking } from "./types";
import { getPaid, getBalance } from "./types";

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
function fmtDisplayDate(iso: string): string {
  const d = new Date(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
function pctChange(current: number, previous: number): { value: number; isUp: boolean } {
  if (previous === 0) return { value: current > 0 ? 100 : 0, isUp: current > 0 };
  const change = ((current - previous) / previous) * 100;
  return { value: Math.abs(Math.round(change * 100) / 100), isUp: change >= 0 };
}
function rupee(n: number): string {
  if (n >= 100000) return `Rs.${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `Rs.${(n / 1000).toFixed(1)}k`;
  return `Rs.${n.toFixed(0)}`;
}

// ═══════════════════════════════════════════════════════════
// STAT CARD FILTERS
// ═══════════════════════════════════════════════════════════

type StatFilter =
  | "all"
  | "new-bookings"
  | "in-house"
  | "arrivals"
  | "departures"
  | "cancellations"
  | "on-hold"
  | "no-shows"
  | "magic-link";

const STAT_OPTIONS: Record<StatFilter, string[]> = {
  all: ["All"],
  "new-bookings": ["All", "Today", "This Week", "This Month"],
  "in-house": ["All", "Checked In", "Due Out Today"],
  arrivals: ["All", "Pending Arrival", "Arrival In House"],
  departures: ["ALL", "Pending Departure", "Checked-out"],
  cancellations: ["Cancelled today", "Cancelled for today"],
  "on-hold": ["All", "Pending Payment"],
  "no-shows": ["All", "Today"],
  "magic-link": ["All", "Sent", "Used"],
};

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export default function DashboardPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [dashboardTab, setDashboardTab] = useState<"reservations" | "performance">("reservations");

  // Date + filter state
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Stat filter dropdown
  const [openDropdown, setOpenDropdown] = useState<StatFilter | null>(null);
  const [activeFilters, setActiveFilters] = useState<Record<StatFilter, string>>({
    all: "All",
    "new-bookings": "All",
    "in-house": "All",
    arrivals: "All",
    departures: "ALL",
    cancellations: "Cancelled today",
    "on-hold": "All",
    "no-shows": "All",
    "magic-link": "All",
  });

  // Sort + pagination
  const [sortBy, setSortBy] = useState("booking-date");
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchBookings();
      setBookings(data);
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ═══ COMPUTE STATS (based on selectedDate) ═══
  const stats = useMemo(() => {
    const today = selectedDate;
    return {
      newBookings: bookings.filter((b) => b.bookingMadeOn === today).length,
      inHouse: bookings.filter(
        (b) => b.status === "CHECKED-IN" || (b.checkIn <= today && b.checkOut > today)
      ).length,
      arrivals: bookings.filter((b) => b.checkIn === today && b.status === "CONFIRMED").length,
      departures: bookings.filter((b) => b.checkOut === today).length,
      cancellations: bookings.filter((b) => b.status === "CANCELLED").length,
      onHold: 0,
      noShows: 0,
      magicLink: 0,
    };
  }, [bookings, selectedDate]);

  // ═══ FILTERED BOOKINGS ═══
  const filteredBookings = useMemo(() => {
    let result = bookings.slice();

    // Filter by active stat filter
    if (openDropdown || activeFilters["arrivals"] !== "All") {
      // Use the filter that was last set
    }

    // Apply search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (b) =>
          b.primaryGuest.name.toLowerCase().includes(q) ||
          b.id.toLowerCase().includes(q) ||
          b.roomNumber.toLowerCase().includes(q)
      );
    }

    // Apply sort
    if (sortBy === "guest-name") {
      result.sort((a, b) => a.primaryGuest.name.localeCompare(b.primaryGuest.name));
    } else if (sortBy === "check-in") {
      result.sort((a, b) => a.checkIn.localeCompare(b.checkIn));
    } else if (sortBy === "check-out") {
      result.sort((a, b) => a.checkOut.localeCompare(b.checkOut));
    } else if (sortBy === "room-no") {
      result.sort((a, b) => a.roomNumber.localeCompare(b.roomNumber));
    } else {
      result.sort((a, b) => b.bookingMadeOn.localeCompare(a.bookingMadeOn));
    }

    return result;
  }, [bookings, search, sortBy]);

  // ═══ HANDLERS ═══
  const handleStatClick = (filter: StatFilter) => {
    setOpenDropdown(openDropdown === filter ? null : filter);
  };

  const handleSelectFilterOption = (filter: StatFilter, option: string) => {
    setActiveFilters({ ...activeFilters, [filter]: option });
    setOpenDropdown(null);
  };

  const handleDownloadReport = () => {
    // Generate CSV
    const headers = ["ID", "Guest", "Phone", "Room", "Room Type", "Check-in", "Check-out", "Source", "Status", "Amount", "Paid", "Balance"];
    const rows = filteredBookings.map((b) => [
      b.id,
      b.primaryGuest.name,
      b.primaryGuest.phone,
      b.roomNumber,
      b.roomType,
      b.checkIn,
      b.checkOut,
      b.source,
      b.status,
      b.amount.toFixed(2),
      getPaid(b).toFixed(2),
      getBalance(b).toFixed(2),
    ]);

    const csv = [headers, ...rows].map((r) => r.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `staynexa-reservations-${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalOutstanding = bookings.reduce((sum, b) => sum + getBalance(b), 0);
  const totalCollected = bookings.reduce((sum, b) => sum + getPaid(b), 0);
  const totalRevenue = bookings.reduce((sum, b) => sum + b.amount, 0);

  // ═══ STAT CARDS ═══
  const statsData: { key: StatFilter; label: string; value: number; color: string }[] = [
    { key: "new-bookings", label: "New bookings", value: stats.newBookings, color: "border-t-teal-300" },
    { key: "in-house", label: "In-house", value: stats.inHouse, color: "border-t-green-300" },
    { key: "arrivals", label: "Arrivals", value: stats.arrivals, color: "border-t-yellow-300" },
    { key: "departures", label: "Departures", value: stats.departures, color: "border-t-indigo-400" },
    { key: "cancellations", label: "Cancellations", value: stats.cancellations, color: "border-t-red-400" },
    { key: "on-hold", label: "On hold", value: stats.onHold, color: "border-t-slate-500" },
    { key: "no-shows", label: "No shows", value: stats.noShows, color: "border-t-gray-300" },
    { key: "magic-link", label: "Magic link", value: stats.magicLink, color: "border-t-pink-300" },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* ═══ HEADER ═══ */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
        <div>
          <h1 className="font-serif text-4xl font-semibold text-navy">Good evening</h1>
          <p className="text-muted mt-1 text-sm md:text-base flex items-center gap-2 flex-wrap">
            Here is what going on with your property on
            <button
              onClick={() => setDatePickerOpen(!datePickerOpen)}
              className="inline-flex items-center gap-1 font-semibold text-navy underline decoration-gold decoration-2 underline-offset-4 hover:text-gold-dark transition relative"
            >
              📅 {fmtDisplayDate(selectedDate)}
            </button>
            {datePickerOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDatePickerOpen(false)} />
                <div className="absolute top-full left-0 mt-2 z-50 bg-white border border-navy/10 rounded-lg shadow-xl p-3">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => { setSelectedDate(e.target.value); setDatePickerOpen(false); }}
                    className="px-3 py-2 border border-cream-dark rounded-lg text-sm outline-none focus:border-gold"
                    autoFocus
                  />
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => { setSelectedDate(todayISO()); setDatePickerOpen(false); }} className="text-xs text-navy px-3 py-1.5 border border-cream-dark rounded hover:bg-cream">Today</button>
                    <button onClick={() => { setSelectedDate(yesterdayISO()); setDatePickerOpen(false); }} className="text-xs text-navy px-3 py-1.5 border border-cream-dark rounded hover:bg-cream">Yesterday</button>
                  </div>
                </div>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-cream-dark p-1 rounded-lg">
          <button
            onClick={() => setDashboardTab("reservations")}
            className={`px-5 py-2 text-sm font-medium rounded-md transition ${
              dashboardTab === "reservations" ? "bg-navy text-cream shadow-sm" : "text-navy/60 hover:text-navy"
            }`}
          >
            Reservations
          </button>
          <button
            onClick={() => setDashboardTab("performance")}
            className={`px-5 py-2 text-sm font-medium rounded-md transition ${
              dashboardTab === "performance" ? "bg-navy text-cream shadow-sm" : "text-navy/60 hover:text-navy"
            }`}
          >
            Performance
          </button>
        </div>
      </div>

      {/* ═══ RESERVATIONS TAB ═══ */}
      {dashboardTab === "reservations" && (
        <>
          {/* Banner */}
          <div className="bg-white border border-cream-dark rounded-xl p-4 flex gap-4 items-start mb-6 shadow-sm">
            <div className="text-xl">🚀</div>
            <div className="flex-1">
              <h3 className="font-serif text-base font-semibold text-navy">Welcome to Staynexa PMS</h3>
              <p className="text-xs text-muted mt-1 mb-3">
                Live data from your database ·{" "}
                <button onClick={load} className="text-gold-dark underline font-medium">
                  {loading ? "loading…" : "refresh"}
                </button>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted uppercase tracking-wide">Collected</p>
              <p className="font-serif text-lg font-semibold text-emerald-600">
                ₹{totalCollected.toLocaleString("en-IN")}
              </p>
            </div>
          </div>

          {/* ═══ STAT CARDS WITH DROPDOWNS ═══ */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
            {statsData.map((stat) => {
              const isOpen = openDropdown === stat.key;
              const isFiltered = activeFilters[stat.key] && activeFilters[stat.key] !== "All" && activeFilters[stat.key] !== "ALL" && activeFilters[stat.key] !== "Cancelled today";
              return (
                <div key={stat.key} className="relative">
                  <button
                    onClick={() => handleStatClick(stat.key)}
                    className={`w-full bg-white rounded-lg p-4 flex flex-col justify-between h-28 border-t-4 ${stat.color} text-left transition-all ${
                      isOpen ? "shadow-lg ring-2 ring-gold -translate-y-1" : "shadow-sm hover:shadow-md hover:-translate-y-0.5"
                    }`}
                  >
                    <span className="font-serif text-3xl font-semibold text-navy leading-none">
                      {stat.value}
                    </span>
                    <span className="text-xs text-muted font-medium tracking-wide">
                      {stat.label}
                      {isFiltered && (
                        <span className="block text-[10px] text-gold-dark mt-0.5 font-semibold">
                          ▸ {activeFilters[stat.key]}
                        </span>
                      )}
                    </span>
                  </button>

                  {isOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)} />
                      <div className="absolute top-full left-0 mt-2 z-50 bg-white border border-cream-dark rounded-lg shadow-xl min-w-[190px] py-1">
                        {STAT_OPTIONS[stat.key].map((option) => (
                          <button
                            key={option}
                            onClick={() => handleSelectFilterOption(stat.key, option)}
                            className={`w-full text-left px-4 py-2.5 text-sm hover:bg-cream transition-colors flex items-center justify-between ${
                              activeFilters[stat.key] === option
                                ? "text-gold-dark font-semibold bg-cream/60"
                                : "text-navy/80"
                            }`}
                          >
                            <span>{option}</span>
                            {activeFilters[stat.key] === option && <span className="text-gold">✓</span>}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Active filter banner */}
          {(activeFilters.arrivals !== "All" || activeFilters.departures !== "ALL" || activeFilters["in-house"] !== "All") && (
            <div className="bg-gold/10 border border-gold/30 rounded-lg p-3 mb-4 flex justify-between items-center">
              <p className="text-sm text-navy">
                Filtering by:{" "}
                <span className="font-semibold text-gold-dark">
                  {activeFilters.arrivals !== "All" && `Arrivals · ${activeFilters.arrivals}`}
                  {activeFilters.departures !== "ALL" && ` Departures · ${activeFilters.departures}`}
                  {activeFilters["in-house"] !== "All" && ` In-house · ${activeFilters["in-house"]}`}
                </span>
              </p>
              <button
                onClick={() =>
                  setActiveFilters({
                    all: "All",
                    "new-bookings": "All",
                    "in-house": "All",
                    arrivals: "All",
                    departures: "ALL",
                    cancellations: "Cancelled today",
                    "on-hold": "All",
                    "no-shows": "All",
                    "magic-link": "All",
                  })
                }
                className="text-xs text-navy/60 hover:text-navy underline"
              >
                Clear all filters
              </button>
            </div>
          )}

          {/* ═══ SEARCH + SORT BAR ═══ */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type and press enter to add tags and search"
              className="w-full md:w-1/2 p-2.5 border border-cream-dark rounded-lg text-sm outline-none focus:border-gold transition-colors bg-white"
            />
            <div className="flex gap-3 items-center text-sm flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-muted text-xs">Sort by</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="border border-cream-dark rounded-lg p-2 outline-none text-navy/80 bg-white text-sm"
                >
                  <option value="booking-date">Booking date</option>
                  <option value="guest-name">Guest name</option>
                  <option value="check-in">Check-in</option>
                  <option value="check-out">Check-out</option>
                  <option value="room-no">Room no.</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted text-xs">Select pages</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="border border-cream-dark rounded-lg p-2 outline-none text-navy/80 bg-white text-sm"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <button
                onClick={handleDownloadReport}
                className="border border-navy text-navy px-3 py-2 rounded-lg text-sm font-medium hover:bg-navy hover:text-cream transition"
              >
                Download report
              </button>
            </div>
          </div>

          {/* Results count */}
          <p className="text-xs text-muted mb-3 text-right">
            {filteredBookings.length} results found
          </p>

          {/* ═══ BOOKINGS LIST ═══ */}
          {loading && (
            <div className="bg-white border border-cream-dark rounded-xl p-12 text-center mb-6">
              <p className="text-navy font-medium">⏳ Loading bookings from database…</p>
            </div>
          )}

          {!loading && (
            <div className="bg-white border border-cream-dark rounded-xl shadow-sm divide-y divide-cream-dark">
              {filteredBookings.length === 0 && (
                <div className="p-12 text-center text-muted">No bookings match your filters.</div>
              )}
              {filteredBookings.slice(0, pageSize).map((b) => (
                <div
                  key={b.id}
                  className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-center text-sm hover:bg-cream/40 transition-colors"
                >
                  <div className="md:col-span-2">
                    <p className="font-semibold text-navy">{b.primaryGuest.name}</p>
                    <p className="text-muted text-xs mt-0.5">{b.primaryGuest.phone}</p>
                  </div>
                  <div className="md:col-span-3">
                    <p className="text-navy/70 text-xs truncate">{b.id}</p>
                    <div className="mt-1 flex items-center">
                      {b.source === "agoda" && <span className="text-[10px] font-bold text-red-500">agoda</span>}
                      {b.source === "makemytrip" && (
                        <span className="text-[10px] font-bold text-red-600">
                          make<span className="text-blue-600">MyTrip</span>
                        </span>
                      )}
                      {b.source === "expedia" && <span className="text-[10px] font-bold text-blue-800">Expedia</span>}
                      {b.source === "goibibo" && <span className="text-[10px] font-bold text-orange-500">goibibo</span>}
                      {b.source === "booking" && <span className="text-[10px] font-bold text-indigo-600">Booking.com</span>}
                      {b.source === "direct" && <span className="text-[10px] font-bold text-gray-500">Direct</span>}
                    </div>
                  </div>
                  <div className="md:col-span-3">
                    <p className="text-navy/70 text-xs">{b.checkIn} → {b.checkOut}</p>
                  </div>
                  <div className="md:col-span-2 md:text-right">
                    <div className="flex items-center md:justify-end gap-1 text-navy font-medium text-xs">
                      🔑 {b.roomNumber} · {b.roomType}
                    </div>
                    <p className="text-muted text-xs mt-0.5">({b.adults} / {b.children})</p>
                  </div>
                  <div className="md:col-span-2 md:text-right">
                    <p className={`text-xs font-bold ${b.status === "PENDING DEPARTURE" ? "text-red-500" : "text-navy/70"}`}>
                      {b.status}
                    </p>
                    <p className="text-xs text-navy mt-0.5">
                      Total <span className="font-semibold">₹{b.amount.toLocaleString("en-IN")}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Summary cards */}
          {!loading && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="bg-white border border-cream-dark rounded-xl shadow-sm p-5">
                <h3 className="font-serif text-base font-semibold text-navy mb-3">Total Bookings</h3>
                <p className="font-serif text-3xl font-semibold text-navy">{bookings.length}</p>
                <p className="text-xs text-muted mt-1">Across all dates</p>
              </div>
              <div className="bg-white border border-cream-dark rounded-xl shadow-sm p-5">
                <h3 className="font-serif text-base font-semibold text-navy mb-3">Outstanding</h3>
                <p className="font-serif text-3xl font-semibold text-rose-500">
                  ₹{totalOutstanding.toLocaleString("en-IN")}
                </p>
                <p className="text-xs text-muted mt-1">Pending collection</p>
              </div>
              <div className="bg-white border border-cream-dark rounded-xl shadow-sm p-5">
                <h3 className="font-serif text-base font-semibold text-navy mb-3">Collected</h3>
                <p className="font-serif text-3xl font-semibold text-emerald-600">
                  ₹{totalCollected.toLocaleString("en-IN")}
                </p>
                <p className="text-xs text-muted mt-1">From all bookings</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ PERFORMANCE TAB ═══ */}
      {dashboardTab === "performance" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white border border-cream-dark rounded-xl p-5 shadow-sm">
              <p className="text-xs text-muted mb-2">for last 30 days</p>
              <p className="font-serif text-4xl font-semibold text-navy">
                {bookings.length ? Math.round(bookings.reduce((s, b) => {
                  const made = new Date(b.bookingMadeOn).getTime();
                  const checkin = new Date(b.checkIn).getTime();
                  return s + Math.max(0, Math.round((checkin - made) / 86400000));
                }, 0) / bookings.length) : 0} days
              </p>
              <p className="text-xs text-navy/70 mt-2 font-medium">Pre-booking window</p>
            </div>
            <div className="bg-white border border-cream-dark rounded-xl p-5 shadow-sm">
              <p className="text-xs text-muted mb-2">Today&apos;s pickup</p>
              <p className="font-serif text-4xl font-semibold text-navy">
                {bookings.filter((b) => b.checkIn === selectedDate).length} rooms
              </p>
              <p className="text-xs text-navy/70 mt-2 font-medium">Arrivals</p>
            </div>
            <div className="bg-white border border-cream-dark rounded-xl p-5 shadow-sm">
              <p className="text-xs text-muted mb-2">Collected</p>
              <p className="font-serif text-4xl font-semibold text-emerald-600">
                {rupee(totalCollected)}
              </p>
              <p className="text-xs text-navy/70 mt-2 font-medium">Total collected</p>
            </div>
            <div className="bg-white border border-cream-dark rounded-xl p-5 shadow-sm">
              <p className="text-xs text-muted mb-2">Outstanding</p>
              <p className="font-serif text-4xl font-semibold text-rose-500">
                {rupee(totalOutstanding)}
              </p>
              <p className="text-xs text-navy/70 mt-2 font-medium">Pending</p>
            </div>
          </div>

          {/* CTA to Reports */}
          <div className="bg-navy rounded-2xl p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-gold/80 font-semibold mb-2">
                Detailed analytics
              </p>
              <h3 className="font-serif text-3xl text-cream mb-2">Explore all reports</h3>
              <p className="text-cream/70 text-sm max-w-lg">
                Access 40+ reports covering property, front desk, payments, taxes, POS, channel manager, and more.
              </p>
            </div>
            <Link
              href="/reports"
              className="px-6 py-3.5 bg-gradient-to-b from-gold-light to-gold text-navy rounded-xl font-semibold text-sm shadow-lg shadow-gold/30 hover:-translate-y-0.5 transition-all whitespace-nowrap"
            >
              Open Reports →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
