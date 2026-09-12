"use client";

import React, { useState, useEffect, useCallback } from "react";
import { rooms, roomCategories, baseRates } from "../data";
import { fetchBookings } from "../db";
import { fetchRates, upsertRate, bulkUpsertRates } from "../db-rates";
import type { Booking } from "../types";
import { getPaid, getBalance } from "../types";

// ─── DATE HELPERS ───
function getDates(startDate: string, days: number): Date[] {
  const out: Date[] = [];
  const start = new Date(startDate);
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(d);
  }
  return out;
}
function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function prettyDate(iso: string): string {
  const d = parseISO(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
function shortFmt(d: Date) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return { day: days[d.getDay()], date: d.getDate(), month: months[d.getMonth()] };
}
function bookingSpansDate(b: Booking, date: Date): boolean {
  const dateStr = fmt(date);
  return b.checkIn <= dateStr && b.checkOut > dateStr;
}

const ALL_SOURCES = ["walkin", "booking engine", "booking", "goibibo", "agoda", "cleartrip", "expedia", "hyperguest", "ixigo"];
const ALL_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Key format: `${date}_${roomType}_${ratePlan}` → price
type RateMap = Record<string, { price: number; adult: number; child: number; infant: number }>;

function rateKey(date: string, roomType: string, plan: string): string {
  return `${date}__${roomType}__${plan}`;
}

export default function InventoryPage() {
  const [startDate, setStartDate] = useState("2026-09-12");
  const [daysToShow, setDaysToShow] = useState(8);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rates, setRates] = useState<RateMap>({});
  const [loading, setLoading] = useState(true);
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const [showInventory, setShowInventory] = useState(true);
  const [showRates, setShowRates] = useState(true);
  const [showRestrictions, setShowRestrictions] = useState(true);
  const [viewMoreOpen, setViewMoreOpen] = useState(false);

  const [bulkOpen, setBulkOpen] = useState(false);

  const dates = getDates(startDate, daysToShow);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // Load bookings + rates from DB
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [bookingsData, ratesData] = await Promise.all([
        fetchBookings(),
        fetchRates("2026-01-01", "2027-12-31"),
      ]);
      setBookings(bookingsData);

      // Build rate map: override base rates with DB values
      const map: RateMap = {};
      // First, seed all combinations with base rates
      for (const cat of roomCategories) {
        for (const plan of cat.ratePlans) {
          const base = baseRates[cat.name]?.[plan.code] ?? 0;
          // We don't need to pre-seed every date since we fall back at render time
          void base;
        }
      }
      // Then overlay DB rows
      for (const r of ratesData) {
        const key = rateKey(r.rate_date, r.room_type, r.rate_plan);
        map[key] = {
          price: r.price,
          adult: r.adult_price ?? r.price,
          child: r.child_price ?? 0,
          infant: r.infant_price ?? 0,
        };
      }
      setRates(map);
    } catch (err) {
      console.error("Inventory load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const shiftDates = (offset: number) => {
    const d = parseISO(startDate);
    d.setDate(d.getDate() + offset);
    setStartDate(fmt(d));
  };

  const getOccupancyForDate = (date: Date) => {
    const totalRooms = rooms.length;
    const occupied = bookings.filter(
      (b) =>
        b.status !== "CANCELLED" &&
        b.status !== "BLOCKED" &&
        bookingSpansDate(b, date)
    ).length;
    const blocked = bookings.filter(
      (b) => b.status === "BLOCKED" && bookingSpansDate(b, date)
    ).length;
    const available = totalRooms - occupied - blocked;
    const occupancyPct =
      totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0;
    return { totalRooms, occupied, blocked, available, occupancyPct };
  };

  const getCategoryMetrics = (category: string, date: Date) => {
    const cat = roomCategories.find((c) => c.name === category);
    const total = cat?.totalRooms ?? 0;
    const booked = bookings.filter((b) => {
      if (b.roomType !== category) return false;
      if (b.status === "CANCELLED") return false;
      return bookingSpansDate(b, date);
    }).length;
    const blocked = bookings.filter(
      (b) =>
        b.roomType === category &&
        b.status === "BLOCKED" &&
        bookingSpansDate(b, date)
    ).length;
    const unassigned = 0;
    const offline = 0;
    const online = total - booked - blocked;
    return { online, offline, booked, unassigned, blocked, total };
  };

  // Get rate for a cell (falls back to base rate)
  const getCellRate = (date: Date, roomType: string, plan: string) => {
    const key = rateKey(fmt(date), roomType, plan);
    if (rates[key]) return rates[key];
    const base = baseRates[roomType]?.[plan] ?? 0;
    return { price: base, adult: base, child: 0, infant: 0 };
  };

  // Update a rate in the local state (immediately shows in the input)
  const setCellRate = (date: Date, roomType: string, plan: string, price: number) => {
    const key = rateKey(fmt(date), roomType, plan);
    setRates((prev) => ({
      ...prev,
      [key]: {
        price,
        adult: price,
        child: prev[key]?.child ?? 0,
        infant: prev[key]?.infant ?? 0,
      },
    }));
  };

  // Persist a cell rate to DB
  const saveCellRate = async (date: Date, roomType: string, plan: string) => {
    const key = rateKey(fmt(date), roomType, plan);
    const cell = rates[key];
    if (!cell) return;

    const isOverridden = cell.price !== (baseRates[roomType]?.[plan] ?? 0);
    // Only persist if the value differs from base rate
    if (!isOverridden) return;

    setSavingKeys((prev) => new Set(prev).add(key));
    try {
      await upsertRate(roomType, plan, fmt(date), cell.price, {
        adult_price: cell.adult,
        child_price: cell.child,
        infant_price: cell.infant,
      });
      showToast("✓ Price saved");
    } catch {
      showToast("⚠ Failed to save price");
    } finally {
      setSavingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const totalCollected = bookings.reduce((sum, b) => sum + getPaid(b), 0);
  const totalOutstanding = bookings.reduce((sum, b) => sum + getBalance(b), 0);

  return (
    <div className="p-6 lg:p-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-navy">
            Inventory &amp; Rates
          </h1>
          <p className="text-muted mt-1 text-sm">
            Manage availability, pricing, and restrictions ·{" "}
            <button onClick={load} className="text-gold-dark font-medium hover:underline">
              {loading ? "loading…" : "🔄 Refresh"}
            </button>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => shiftDates(-daysToShow)} className="px-3 py-2 border border-cream-dark rounded-lg text-sm font-medium text-navy hover:bg-cream transition">←</button>
          <button onClick={() => setStartDate("2026-09-12")} className="px-4 py-2 border border-cream-dark rounded-lg text-sm font-medium text-navy hover:bg-cream transition">Today</button>
          <button onClick={() => shiftDates(daysToShow)} className="px-3 py-2 border border-cream-dark rounded-lg text-sm font-medium text-navy hover:bg-cream transition">→</button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-cream-dark rounded-xl p-5 shadow-sm">
          <p className="text-xs text-muted uppercase tracking-wide">Total Rooms</p>
          <p className="font-serif text-2xl font-semibold text-navy mt-1">{rooms.length}</p>
        </div>
        <div className="bg-white border border-cream-dark rounded-xl p-5 shadow-sm border-l-4 border-l-emerald-500">
          <p className="text-xs text-muted uppercase tracking-wide">Collected</p>
          <p className="font-serif text-2xl font-semibold text-emerald-600 mt-1">₹{totalCollected.toLocaleString("en-IN")}</p>
        </div>
        <div className="bg-white border border-cream-dark rounded-xl p-5 shadow-sm border-l-4 border-l-rose-500">
          <p className="text-xs text-muted uppercase tracking-wide">Outstanding</p>
          <p className="font-serif text-2xl font-semibold text-rose-500 mt-1">₹{totalOutstanding.toLocaleString("en-IN")}</p>
        </div>
        <div className="bg-white border border-cream-dark rounded-xl p-5 shadow-sm border-l-4 border-l-gold">
          <p className="text-xs text-muted uppercase tracking-wide">Occupancy Today</p>
          <p className="font-serif text-2xl font-semibold text-navy mt-1">
            {getOccupancyForDate(new Date("2026-09-13")).occupancyPct}%
          </p>
        </div>
      </div>

      {/* FILTERS BAR */}
      <div className="bg-white border border-cream-dark rounded-xl p-4 mb-6 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 items-end">
          <div className="relative">
            <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-1">
              Rates / Inventory / Restrictions
            </label>
            <button
              onClick={() => setViewMoreOpen(!viewMoreOpen)}
              className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy bg-white text-left flex justify-between items-center"
            >
              <span className="truncate">Rates, Inventory, Restrictions</span>
              <span className="text-muted">▾</span>
            </button>
            {viewMoreOpen && (
              <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-cream-dark rounded-lg shadow-xl p-3 min-w-[200px]">
                <p className="text-[10px] uppercase text-muted font-semibold mb-2">Show rows</p>
                <label className="flex items-center gap-2 py-1 cursor-pointer">
                  <input type="checkbox" checked={showInventory} onChange={(e) => setShowInventory(e.target.checked)} />
                  <span className="text-sm text-navy">Inventory</span>
                </label>
                <label className="flex items-center gap-2 py-1 cursor-pointer">
                  <input type="checkbox" checked={showRates} onChange={(e) => setShowRates(e.target.checked)} />
                  <span className="text-sm text-navy">Rates</span>
                </label>
                <label className="flex items-center gap-2 py-1 cursor-pointer">
                  <input type="checkbox" checked={showRestrictions} onChange={(e) => setShowRestrictions(e.target.checked)} />
                  <span className="text-sm text-navy">Restrictions</span>
                </label>
              </div>
            )}
          </div>

          <div className="col-span-2">
            <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-1">
              Date range
            </label>
            <input
              type="text"
              value={`${prettyDate(startDate)} - ${prettyDate(fmt(dates[dates.length - 1]))}`}
              readOnly
              className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm bg-white text-navy"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-1">Source</label>
            <select className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy bg-white">
              <option>All</option>
              <option>Direct</option>
              <option>OTA</option>
              <option>Walk-in</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-1">Days</label>
            <select
              value={daysToShow}
              onChange={(e) => setDaysToShow(Number(e.target.value))}
              className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy bg-white"
            >
              <option value={8}>8</option>
              <option value={14}>14</option>
              <option value={30}>30</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-1">Room Categories</label>
            <select className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy bg-white">
              <option>All</option>
              {roomCategories.map((c) => (
                <option key={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-1">Rate plans</label>
            <select className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy bg-white">
              <option>EP, CP</option>
              <option>EP</option>
              <option>CP</option>
              <option>MAP</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 mt-3">
          <button
            onClick={() => setBulkOpen(true)}
            className="px-4 py-2 bg-navy text-cream rounded-lg text-sm font-semibold hover:bg-navy-light transition"
          >
            Bulk update ✏️
          </button>
        </div>
      </div>

      {/* LOADING */}
      {loading && (
        <div className="bg-white border border-cream-dark rounded-xl p-12 text-center mb-6">
          <p className="text-navy font-medium">⏳ Loading occupancy and rates…</p>
        </div>
      )}

      {/* SUMMARY OCCUPANCY */}
      {!loading && showInventory && (
        <div className="bg-white border border-cream-dark rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="bg-cream/60 text-navy border-b border-cream-dark">
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider w-48 bg-white">Dates</th>
                  {dates.map((d, i) => {
                    const s = shortFmt(d);
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <th key={i} className={`text-center px-3 py-3 text-[10px] font-semibold uppercase tracking-wider border-l border-cream-dark ${isWeekend ? "bg-gold/5 text-gold-dark" : ""}`}>
                        <div className="opacity-70">{s.day}</div>
                        <div className="text-xs">{s.day} {s.date} {s.month}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {[
                  { key: "occupancy", label: "Occupancy (%)" },
                  { key: "totalAvailable", label: "Total Available" },
                  { key: "totalBooked", label: "Total Booked" },
                  { key: "totalUnassigned", label: "Total Unassigned" },
                  { key: "onHold", label: "On-Hold" },
                  { key: "totalBlocked", label: "Total Blocked" },
                  { key: "totalOffline", label: "Total Offline" },
                ].map((row) => (
                  <tr key={row.key} className="border-b border-cream-dark last:border-b-0 hover:bg-cream/30">
                    <td className="px-4 py-3 text-sm font-medium text-navy bg-white">{row.label}</td>
                    {dates.map((d, i) => {
                      const o = getOccupancyForDate(d);
                      let value: React.ReactNode = 0;
                      if (row.key === "occupancy") {
                        const color = o.occupancyPct >= 80 ? "text-emerald-600" : o.occupancyPct >= 50 ? "text-amber-600" : o.occupancyPct > 0 ? "text-rose-500" : "text-muted";
                        value = <span className={`font-bold text-base ${color}`}>{o.occupancyPct}%</span>;
                      } else if (row.key === "totalAvailable") {
                        value = <span className="text-emerald-600 font-semibold">{o.available}</span>;
                      } else if (row.key === "totalBooked") {
                        value = <span className="text-navy font-semibold">{o.occupied}</span>;
                      } else if (row.key === "totalBlocked") {
                        value = <span className="text-blue-600 font-semibold">{o.blocked}</span>;
                      } else {
                        value = <span className="text-navy/70">0</span>;
                      }
                      return <td key={i} className="text-center px-3 py-3 text-sm border-l border-cream-dark">{value}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PER-CATEGORY TABLES */}
      {!loading && roomCategories.map((cat) => (
        <div key={cat.name} className="bg-white border border-cream-dark rounded-xl shadow-sm overflow-hidden mb-4">
          <div className="flex items-center justify-between px-5 py-3 bg-cream/40 border-b border-cream-dark">
            <div className="flex items-center gap-3">
              <h3 className="font-serif text-base font-semibold text-navy">{cat.name}</h3>
              <button className="text-xs text-gold-dark font-medium hover:underline">View connected channels</button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <tbody>
                {showInventory && (
                  <>
                    {[
                      { key: "online", label: "Online Available", color: "text-emerald-600 font-semibold" },
                      { key: "offline", label: "Offline Available", color: "text-navy/60" },
                      { key: "booked", label: "Booked", color: "text-navy font-semibold" },
                      { key: "unassigned", label: "Unassigned", color: "text-navy/60" },
                      { key: "blocked", label: "Blocked", color: "text-navy/60" },
                      { key: "total", label: "Total", color: "text-navy font-bold" },
                    ].map((row, ri) => (
                      <tr key={row.key} className={`border-b border-cream-dark ${ri === 5 ? "bg-cream/40" : ""}`}>
                        <td className="px-4 py-2 text-xs text-muted font-medium w-48 bg-white">{row.label}</td>
                        {dates.map((d, i) => {
                          const m = getCategoryMetrics(cat.name, d);
                          const val = m[row.key as keyof typeof m];
                          return (
                            <td key={i} className="text-center px-3 py-2 text-sm border-l border-cream-dark">
                              <span className={row.color}>{val}</span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </>
                )}

                {showRates && cat.ratePlans.map((plan, pi) => (
                  <tr key={plan.code} className={`border-b border-cream-dark ${pi === 0 ? "bg-gold/5" : ""}`}>
                    <td className="px-4 py-2 text-xs font-bold text-navy bg-white">{plan.label}</td>
                    {dates.map((d, i) => {
                      const cell = getCellRate(d, cat.name, plan.code);
                      const key = rateKey(fmt(d), cat.name, plan.code);
                      const base = baseRates[cat.name]?.[plan.code] ?? 0;
                      const isOverridden = cell.price !== base;
                      const isSaving = savingKeys.has(key);
                      return (
                        <td key={i} className="text-center px-2 py-2 border-l border-cream-dark">
                          <div className="relative inline-block">
                            <input
                              type="number"
                              value={cell.price}
                              onChange={(e) => setCellRate(d, cat.name, plan.code, Number(e.target.value))}
                              onBlur={() => saveCellRate(d, cat.name, plan.code)}
                              className={`w-24 text-center px-2 py-1 border rounded-md text-sm outline-none transition ${
                                isOverridden
                                  ? "border-teal-400 bg-teal-50 text-teal-700 font-semibold"
                                  : "border-cream-dark text-navy hover:border-gold focus:border-gold"
                              }`}
                            />
                            {isSaving && (
                              <span className="absolute -top-2 -right-2 text-[10px] text-gold-dark">💾</span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {showRates && cat.ratePlans[0] && (
                  <>
                    {[
                      { label: "1XAdults", key: "1x" },
                      { label: "2XAdults", key: "2x" },
                      { label: "Child Price (7-12)", key: "child712" },
                      { label: "Child Prices (0-6)", key: "child06" },
                    ].map((row) => (
                      <tr key={row.key} className="border-b border-cream-dark">
                        <td className="px-4 py-2 text-xs text-muted bg-white">{row.label}</td>
                        {dates.map((d, i) => {
                          const cell = getCellRate(d, cat.name, cat.ratePlans[0].code);
                          const val = row.key === "1x" ? cell.price : row.key === "2x" ? cell.price + 0 : 500;
                          return (
                            <td key={i} className="text-center px-3 py-2 text-sm text-teal-700 font-semibold border-l border-cream-dark">
                              {val}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* BULK UPDATE MODAL */}
      {bulkOpen && (
        <BulkUpdateModal
          onClose={() => setBulkOpen(false)}
          onApply={async (payload) => {
            try {
              // Build rows for all selected room types × rate plans × dates in range
              const rows: Array<{ roomType: string; ratePlan: string; rateDate: string; price: number }> = [];
              const from = parseISO(payload.dateFrom);
              const to = parseISO(payload.dateTo);
              const cur = new Date(from);
              while (cur <= to) {
                const dateStr = fmt(cur);
                for (const rt of payload.roomTypes) {
                  for (const plan of payload.ratePlans) {
                    rows.push({
                      roomType: rt,
                      ratePlan: plan,
                      rateDate: dateStr,
                      price: Number(payload.adultPrice) || 0,
                    });
                  }
                }
                cur.setDate(cur.getDate() + 1);
              }
              if (rows.length > 0) {
                await bulkUpsertRates(rows);
              }
              setBulkOpen(false);
              showToast(`✓ Bulk updated ${rows.length} rates`);
              await load();
            } catch (err) {
              console.error("Bulk update error:", err);
              showToast("⚠ Bulk update failed");
            }
          }}
          startDate={startDate}
        />
      )}

      {/* TOAST */}
      {toast && (
        <div className="fixed top-6 right-6 bg-emerald-500 text-white px-6 py-3 rounded-lg shadow-2xl z-[200] text-sm font-medium flex items-center gap-3">
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}

// ─── BULK UPDATE MODAL ───
function BulkUpdateModal({
  onClose,
  onApply,
  startDate,
}: {
  onClose: () => void;
  onApply: (payload: {
    sources: string[];
    days: string[];
    dateFrom: string;
    dateTo: string;
    roomTypes: string[];
    ratePlans: string[];
    adultPrice: string;
    childPrice: string;
    infantPrice: string;
  }) => void;
  startDate: string;
}) {
  const [actionType, setActionType] = useState("Set Pricing");
  const [sources, setSources] = useState<string[]>([]);
  const [days, setDays] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState(startDate);
  const [dateTo, setDateTo] = useState("2026-10-13");
  const [roomTypes, setRoomTypes] = useState<string[]>(["Deluxe Room"]);
  const [ratePlans, setRatePlans] = useState<string[]>(["EP"]);
  const [adultPrice, setAdultPrice] = useState("");
  const [childPrice, setChildPrice] = useState("");
  const [infantPrice, setInfantPrice] = useState("");

  const toggleIn = (arr: string[], val: string, set: (v: string[]) => void) => {
    set(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  return (
    <>
      <div className="fixed inset-0 bg-navy/50 backdrop-blur-sm z-[190]" onClick={onClose} />
      <div className="fixed inset-4 md:inset-8 lg:inset-16 bg-white rounded-2xl shadow-2xl z-[200] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-cream-dark flex justify-between items-center">
          <h2 className="font-serif text-xl font-semibold text-navy">Bulk Update</h2>
          <button onClick={onClose} className="text-2xl text-muted hover:text-navy leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <label className="text-xs uppercase tracking-widest text-muted font-semibold block mb-1">Action Type</label>
            <select value={actionType} onChange={(e) => setActionType(e.target.value)} className="w-full md:w-1/2 px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy bg-white">
              <option>Set Pricing</option>
              <option>Adjust Pricing</option>
              <option>Set Availability</option>
              <option>Block Rooms</option>
            </select>
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest text-muted font-semibold block mb-2">Source</label>
            <div className="flex flex-wrap gap-2">
              {ALL_SOURCES.map((src) => (
                <button key={src} onClick={() => toggleIn(sources, src, setSources)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${sources.includes(src) ? "bg-navy text-cream border-navy" : "bg-white text-navy border-cream-dark hover:border-gold"}`}>
                  {src}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest text-muted font-semibold block mb-2">Days</label>
            <div className="flex flex-wrap gap-2">
              {ALL_DAYS.map((d) => (
                <button key={d} onClick={() => toggleIn(days, d, setDays)} className={`px-4 py-1.5 rounded-full text-xs font-medium border transition ${days.includes(d) ? "bg-navy text-cream border-navy" : "bg-white text-navy border-cream-dark hover:border-gold"}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest text-muted font-semibold block mb-1">Date range *</label>
            <div className="grid grid-cols-2 gap-3">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy" />
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy" />
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest text-muted font-semibold block mb-2">Room Types</label>
            <div className="flex flex-wrap gap-2">
              {roomCategories.map((c) => (
                <button key={c.name} onClick={() => toggleIn(roomTypes, c.name, setRoomTypes)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${roomTypes.includes(c.name) ? "bg-navy text-cream border-navy" : "bg-white text-navy border-cream-dark hover:border-gold"}`}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest text-muted font-semibold block mb-2">Rate Plans</label>
            <div className="flex flex-wrap gap-2">
              {["EP", "CP", "MAP"].map((p) => (
                <button key={p} onClick={() => toggleIn(ratePlans, p, setRatePlans)} className={`px-4 py-1.5 rounded-full text-xs font-medium border transition ${ratePlans.includes(p) ? "bg-navy text-cream border-navy" : "bg-white text-navy border-cream-dark hover:border-gold"}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs uppercase tracking-widest text-muted font-semibold block mb-1">Adult price</label>
              <input type="number" value={adultPrice} onChange={(e) => setAdultPrice(e.target.value)} placeholder="0" className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted font-semibold block mb-1">Child price</label>
              <input type="number" value={childPrice} onChange={(e) => setChildPrice(e.target.value)} placeholder="0" className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted font-semibold block mb-1">Infant price</label>
              <input type="number" value={infantPrice} onChange={(e) => setInfantPrice(e.target.value)} placeholder="0" className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy" />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-cream-dark flex gap-2 justify-end bg-cream/30">
          <button onClick={onClose} className="px-5 py-2.5 border border-cream-dark rounded-lg font-medium text-navy hover:bg-cream">Cancel</button>
          <button
            onClick={() => onApply({ sources, days, dateFrom, dateTo, roomTypes, ratePlans, adultPrice, childPrice, infantPrice })}
            className="px-6 py-2.5 bg-navy text-cream rounded-lg font-semibold hover:bg-navy-light"
          >
            Apply Bulk Update
          </button>
        </div>
      </div>
    </>
  );
}
