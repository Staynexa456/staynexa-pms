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
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtDisplayDate(iso: string): string {
  const d = new Date(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
function rupee(n: number): string {
  if (n >= 100000) return `Rs.${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `Rs.${(n / 1000).toFixed(1)}k`;
  return `Rs.${n.toFixed(0)}`;
}

// ═══════════════════════════════════════════════════════════
// STAT FILTER CONFIG
// ═══════════════════════════════════════════════════════════

type StatFilterKey =
  | "new-bookings"
  | "in-house"
  | "arrivals"
  | "departures"
  | "cancellations"
  | "on-hold"
  | "no-shows"
  | "magic-link";

const STAT_OPTIONS: Record<StatFilterKey, string[]> = {
  "new-bookings": ["Today", "This Week", "This Month"],
  "in-house": ["All", "Checked In", "Due Out Today"],
  arrivals: ["All", "Pending Arrival", "Arrival In House"],
  departures: ["All", "Pending Departure", "Checked-out"],
  cancellations: ["Cancelled today", "Cancelled for today"],
  "on-hold": ["All", "Pending Payment"],
  "no-shows": ["All", "Today"],
  "magic-link": ["All", "Sent", "Used"],
};

// Default option when a stat card is clicked
const DEFAULT_OPTION: Record<StatFilterKey, string> = {
  "new-bookings": "Today",
  "in-house": "All",
  arrivals: "All",
  departures: "All",
  cancellations: "Cancelled today",
  "on-hold": "All",
  "no-shows": "All",
  "magic-link": "All",
};

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export default function DashboardPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [dashboardTab, setDashboardTab] = useState<"reservations" | "performance">("reservations");

  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const [openDropdown, setOpenDropdown] = useState<StatFilterKey | null>(null);
  const [activeFilter, setActiveFilter] = useState<{ key: StatFilterKey; value: string } | null>(null);

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

  // ═══ COMPUTE STATS ═══
  const stats = useMemo(() => {
    const today = selectedDate;
    return {
      newBookings: bookings.filter((b) => b.bookingMadeOn === today).length,
      inHouse: bookings.filter(
        (b) => b.status === "CHECKED-IN" || (b.checkIn <= today && b.checkOut > today && b.status !== "CANCELLED" && b.status !== "BLOCKED")
      ).length,
      arrivals: bookings.filter((b) => b.checkIn === today).length,
      departures: bookings.filter((b) => b.checkOut === today || b.status === "PENDING DEPARTURE").length,
      cancellations: bookings.filter((b) => b.status === "CANCELLED").length,
      onHold: 0,
      noShows: 0,
      magicLink: 0,
    };
  }, [bookings, selectedDate]);

  // ═══ FILTERED BOOKINGS ═══
  // ═══ FILTERED BOOKINGS ═══
  const filteredBookings = useMemo(() => {
    let result = bookings.slice();
    const today = selectedDate;

    if (activeFilter) {
      const { key, value } = activeFilter;

      if (key === "new-bookings") {
        if (value === "Today") {
          result = result.filter((b) => b.bookingMadeOn === today);
        } else if (value === "This Week") {
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          const weekStr = weekAgo.toISOString().slice(0, 10);
          result = result.filter((b) => b.bookingMadeOn >= weekStr && b.bookingMadeOn <= today);
        } else if (value === "This Month") {
          const monthAgo = new Date(today);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          const monthStr = monthAgo.toISOString().slice(0, 10);
          result = result.filter((b) => b.bookingMadeOn >= monthStr && b.bookingMadeOn <= today);
        } else {
          result = result.filter((b) => b.bookingMadeOn === today);
        }
      } else if (key === "in-house") {
        result = result.filter(
          (b) =>
            b.status === "CHECKED-IN" ||
            (b.checkIn <= today && b.checkOut > today && b.status !== "CANCELLED" && b.status !== "BLOCKED")
        );
        if (value === "Due Out Today") {
          result = result.filter((b) => b.checkOut === today);
        } else if (value === "Checked In") {
          result = result.filter((b) => b.status === "CHECKED-IN");
        }
      } else if (key === "arrivals") {
        result = result.filter((b) => b.checkIn === today);
        if (value === "Pending Arrival") {
          result = result.filter((b) => b.status === "CONFIRMED");
        } else if (value === "Arrival In House") {
          result = result.filter((b) => b.status === "CHECKED-IN");
        }
      } else if (key === "departures") {
        if (value === "Pending Departure") {
          result = result.filter(
            (b) => b.status === "PENDING DEPARTURE" || (b.checkOut === today && b.status === "CHECKED-IN")
          );
        } else if (value === "Checked-out") {
          result = result.filter((b) => b.status === "CHECKED-OUT");
        } else {
          result = result.filter(
            (b) =>
              b.checkOut === today ||
              b.status === "PENDING DEPARTURE" ||
              (b.status === "CHECKED-OUT" && b.checkOut === today)
          );
        }
      } else if (key === "cancellations") {
        result = result.filter((b) => b.status === "CANCELLED");
        if (value === "Cancelled today") {
          result = result.filter((b) => b.bookingMadeOn === today);
        }
      } else if (key === "on-hold") {
        result = result.filter((b) => b.status === "CONFIRMED" && b.amount > 0);
      } else if (key === "no-shows") {
        result = result.filter((b) => b.status === "CANCELLED" && b.checkIn < today);
      } else if (key === "magic-link") {
        result = [];
      }
    }

    // Search (null-safe)
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (b) =>
          (b.primaryGuest?.name || "").toLowerCase().includes(q) ||
          b.id.toLowerCase().includes(q) ||
          (b.roomNumber || "").toLowerCase().includes(q) ||
          ((b.primaryGuest?.phone) || "").toLowerCase().includes(q)
      );
    }

    // Sort (null-safe)
    if (sortBy === "guest-name") {
      result.sort((a, b) =>
        (a.primaryGuest?.name || "").localeCompare(b.primaryGuest?.name || "")
      );
    } else if (sortBy === "check-in") {
      result.sort((a, b) => (a.checkIn || "").localeCompare(b.checkIn || ""));
    } else if (sortBy === "check-out") {
      result.sort((a, b) => (a.checkOut || "").localeCompare(b.checkOut || ""));
    } else if (sortBy === "room-no") {
      result.sort((a, b) => (a.roomNumber || "").localeCompare(b.roomNumber || ""));
    } else {
      result.sort((a, b) =>
        (b.bookingMadeOn || "").localeCompare(a.bookingMadeOn || "")
      );
    }

    return result;
  }, [bookings, search, sortBy, activeFilter, selectedDate]);

  // ═══ HANDLERS ═══
  // Click on stat card → auto-apply default filter + open dropdown
  const handleStatClick = (filter: StatFilterKey) => {
    const isCurrentlyActive = activeFilter?.key === filter;

    if (isCurrentlyActive && openDropdown === filter) {
      // Click again to close and clear
      setOpenDropdown(null);
      setActiveFilter(null);
    } else if (isCurrentlyActive) {
      // Already active — just toggle dropdown
      setOpenDropdown(openDropdown === filter ? null : filter);
    } else {
      // Apply default filter option + open dropdown
      const defaultOpt = DEFAULT_OPTION[filter];
      setActiveFilter({ key: filter, value: defaultOpt });
      setOpenDropdown(filter);
    }
  };

  const handleSelectFilterOption = (filter: StatFilterKey, option: string) => {
    if (option === "All" || option === "ALL") {
      // If "All" → keep the filter but show all in that category
      setActiveFilter({ key: filter, value: "All" });
    } else {
      setActiveFilter({ key: filter, value: option });
    }
    setOpenDropdown(null);
  };

  const clearAllFilters = () => {
    setActiveFilter(null);
    setSearch("");
  };

  // ═══ CSV DOWNLOAD ═══
  const handleDownloadReport = () => {
    if (filteredBookings.length === 0) {
      alert("No bookings to download");
      return;
    }
    const headers = [
      "Booking ID", "Guest Name", "Phone", "Email", "Room No", "Room Type",
      "Check-in", "Check-out", "Booking Made On", "Source", "Status",
      "Adults", "Children", "Total Amount", "Paid", "Balance"
    ];
    // Search
if (search.trim()) {
  const q = search.toLowerCase();
  result = result.filter(
    (b) =>
      (b.primaryGuest?.name || "").toLowerCase().includes(q) ||
      b.id.toLowerCase().includes(q) ||
      (b.roomNumber || "").toLowerCase().includes(q) ||
      ((b.primaryGuest?.phone) || "").toLowerCase().includes(q)
  );
}
    const csv = [headers, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const filterLabel = activeFilter ? `-${activeFilter.key}-${activeFilter.value.replace(/\s+/g, "")}` : "";
    a.download = `staynexa-reservations-${selectedDate}${filterLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalOutstanding = bookings.reduce((sum, b) => sum + getBalance(b), 0);
  const totalCollected = bookings.reduce((sum, b) => sum + getPaid(b), 0);

  // ═══ STAT CARDS ═══
  const statsData: { key: StatFilterKey; label: string; value: number; color: string }[] = [
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

          {/* STAT CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
            {statsData.map((stat) => {
              const isOpen = openDropdown === stat.key;
              const isActive = activeFilter?.key === stat.key;
              return (
                <div key={stat.key} className="relative">
                  <button
                    onClick={() => handleStatClick(stat.key)}
                    className={`w-full bg-white rounded-lg p-4 flex flex-col justify-between h-28 border-t-4 ${stat.color} text-left transition-all ${
                      isActive
                        ? "shadow-lg ring-2 ring-gold -translate-y-1"
                        : "shadow-sm hover:shadow-md hover:-translate-y-0.5"
                    }`}
                  >
                    <span className="font-serif text-3xl font-semibold text-navy leading-none">
                      {stat.value}
                    </span>
                    <span className="text-xs text-muted font-medium tracking-wide">
                      {stat.label}
                      {isActive && (
                        <span className="block text-[10px] text-gold-dark mt-0.5 font-semibold truncate">
                          ▸ {activeFilter.value}
                        </span>
                      )}
                    </span>
                  </button>

                  {isOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)} />
                      <div className="absolute top-full left-0 mt-2 z-50 bg-white border border-cream-dark rounded-lg shadow-xl min-w-[200px] py-1">
                        {STAT_OPTIONS[stat.key].map((option) => (
                          <button
                            key={option}
                            onClick={() => handleSelectFilterOption(stat.key, option)}
                            className={`w-full text-left px-4 py-2.5 text-sm hover:bg-cream transition-colors flex items-center justify-between ${
                              isActive && activeFilter.value === option
                                ? "text-gold-dark font-semibold bg-cream/60"
                                : "text-navy/80"
                            }`}
                          >
                            <span>{option}</span>
                            {isActive && activeFilter.value === option && <span className="text-gold">✓</span>}
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
          {activeFilter && (
            <div className="bg-gold/10 border border-gold/30 rounded-lg p-3 mb-4 flex justify-between items-center">
              <p className="text-sm text-navy">
                Showing:{" "}
                <span className="font-semibold text-gold-dark capitalize">
                  {activeFilter.value === "All" || activeFilter.value === "ALL"
                    ? `All ${activeFilter.key.replace(/-/g, " ")}`
                    : `${activeFilter.value} — ${activeFilter.key.replace(/-/g, " ")}`}
                </span>{" "}
                · <span className="font-bold">{filteredBookings.length}</span> booking{filteredBookings.length === 1 ? "" : "s"}
              </p>
              <button onClick={clearAllFilters} className="text-xs text-navy/60 hover:text-navy underline">
                Clear filter
              </button>
            </div>
          )}

          {/* SEARCH + SORT BAR */}
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

          <p className="text-xs text-muted mb-3 text-right">
            {filteredBookings.length} results found
          </p>

          {/* BOOKINGS LIST */}
          {loading && (
            <div className="bg-white border border-cream-dark rounded-xl p-12 text-center mb-6">
              <p className="text-navy font-medium">⏳ Loading bookings from database…</p>
            </div>
          )}

          {!loading && (
            <div className="bg-white border border-cream-dark rounded-xl shadow-sm divide-y divide-cream-dark">
              {filteredBookings.length === 0 && (
                <div className="p-12 text-center text-muted">
                  <p className="text-3xl mb-3">🔍</p>
                  <p className="font-medium text-navy mb-1">
                    {activeFilter ? "No bookings match this filter" : "No bookings yet"}
                  </p>
                  {activeFilter && (
                    <button onClick={clearAllFilters} className="text-xs text-gold-dark underline mt-2">
                      Clear all filters
                    </button>
                  )}
                </div>
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
              <p className="font-serif text-4xl font-semibold text-emerald-600">{rupee(totalCollected)}</p>
              <p className="text-xs text-navy/70 mt-2 font-medium">Total collected</p>
            </div>
            <div className="bg-white border border-cream-dark rounded-xl p-5 shadow-sm">
              <p className="text-xs text-muted mb-2">Outstanding</p>
              <p className="font-serif text-4xl font-semibold text-rose-500">{rupee(totalOutstanding)}</p>
              <p className="text-xs text-navy/70 mt-2 font-medium">Pending</p>
            </div>
          </div>

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
