"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { rooms, roomCategories, baseRates } from "../data";
import { fetchBookings } from "../db";
import { fetchRates, upsertRate, bulkSetPricing, type BulkRateRow } from "../db-rates";
import type { Booking } from "../types";
import { getPaid, getBalance } from "../types";

// ─── HELPERS ───
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
function dayNameToNum(name: string): number {
  const map: Record<string, number> = {
    Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
    Thursday: 4, Friday: 5, Saturday: 6,
  };
  return map[name] ?? -1;
}

const ALL_SOURCES = ["walkin", "booking engine", "booking", "goibibo", "agoda", "cleartrip", "expedia", "hyperguest", "ixigo"];
const ALL_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type PlanRate = {
  single: number;
  double: number;
  extraAdult: number;
  child712: number;
  child06: number;
};
type RateMap = Record<string, PlanRate>;
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
  const [viewMoreMode, setViewMoreMode] = useState<string>("Rates and inventory");
  const [showBasePrice, setShowBasePrice] = useState(false);
  const [showOtaCompare, setShowOtaCompare] = useState(false);

  const [sourceFilter, setSourceFilter] = useState<string>("All");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [ratePlanFilter, setRatePlanFilter] = useState<string>("EP, CP");

  const [bulkOpen, setBulkOpen] = useState(false);
  const [reportModal, setReportModal] = useState<null | "updates" | "channels" | "logs">(null);

  const dates = getDates(startDate, daysToShow);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [bookingsData, ratesData] = await Promise.all([
        fetchBookings(),
        fetchRates("2026-01-01", "2027-12-31"),
      ]);
      setBookings(bookingsData);
      const map: RateMap = {};
      for (const r of ratesData) {
        const key = rateKey(r.rate_date, r.room_type, r.rate_plan);
        map[key] = {
          single: r.single_price ?? r.price,
          double: r.double_price ?? r.price + 200,
          extraAdult: r.extra_adult_price ?? 800,
          child712: r.child_7_12_price ?? 500,
          child06: r.child_0_6_price ?? 500,
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
      (b) => b.status !== "CANCELLED" && b.status !== "BLOCKED" && bookingSpansDate(b, date)
    ).length;
    const blocked = bookings.filter(
      (b) => b.status === "BLOCKED" && bookingSpansDate(b, date)
    ).length;
    const available = totalRooms - occupied - blocked;
    const occupancyPct = totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0;
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
      (b) => b.roomType === category && b.status === "BLOCKED" && bookingSpansDate(b, date)
    ).length;
    const unassigned = 0;
    const offline = 0;
    const online = total - booked - blocked;
    return { online, offline, booked, unassigned, blocked, total };
  };

  const getCell = (date: Date, roomType: string, plan: string): PlanRate => {
    const key = rateKey(fmt(date), roomType, plan);
    if (rates[key]) return rates[key];
    const base = baseRates[roomType]?.[plan] ?? 0;
    return { single: base, double: base + 200, extraAdult: 800, child712: 500, child06: 500 };
  };

  const setCellField = (date: Date, roomType: string, plan: string, field: keyof PlanRate, value: number) => {
    const key = rateKey(fmt(date), roomType, plan);
    setRates((prev) => {
      const existing = prev[key] ?? getCell(date, roomType, plan);
      return { ...prev, [key]: { ...existing, [field]: value } };
    });
  };

  const saveCell = async (date: Date, roomType: string, plan: string) => {
    const key = rateKey(fmt(date), roomType, plan);
    const cell = rates[key];
    if (!cell) return;
    setSavingKeys((prev) => new Set(prev).add(key));
    try {
      await upsertRate(roomType, plan, fmt(date), cell.single, {
        single_price: cell.single,
        double_price: cell.double,
        extra_adult_price: cell.extraAdult,
        child_7_12_price: cell.child712,
        child_0_6_price: cell.child06,
      });
      showToast("✓ Saved");
    } catch {
      showToast("⚠ Failed to save");
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

  const visibleCategories = useMemo(() => {
    if (categoryFilter === "All") return roomCategories;
    return roomCategories.filter((c) => c.name === categoryFilter);
  }, [categoryFilter]);

  const visiblePlansFor = (cat: typeof roomCategories[number]) => {
    if (ratePlanFilter === "EP") return cat.ratePlans.filter((p) => p.code === "EP");
    if (ratePlanFilter === "CP") return cat.ratePlans.filter((p) => p.code === "CP");
    if (ratePlanFilter === "MAP") return cat.ratePlans.filter((p) => p.code === "MAP");
    return cat.ratePlans;
  };

  return (
    <div className="p-6 lg:p-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-navy">Inventory &amp; Rates</h1>
          <p className="text-muted mt-1 text-sm">
            Per-person pricing for each rate plan ·{" "}
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

      {/* KPI */}
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

      {/* FILTERS */}
      <div className="bg-white border border-cream-dark rounded-xl p-4 mb-6 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 items-end">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-1">Rates / Inventory / Restrictions</label>
            <select value={viewMoreMode} onChange={(e) => setViewMoreMode(e.target.value)} className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy bg-white">
              <option>Rates and inventory</option><option>Rates</option><option>Inventory</option><option>Restrictions</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-1">Date range</label>
            <input type="text" value={`${prettyDate(startDate)} - ${prettyDate(fmt(dates[dates.length - 1]))}`} readOnly className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm bg-white text-navy" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-1">Source</label>
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy bg-white">
              <option>All</option><option>Direct</option><option>OTA</option><option>Walk-in</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-1">Days</label>
            <select value={daysToShow} onChange={(e) => setDaysToShow(Number(e.target.value))} className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy bg-white">
              <option value={8}>8</option><option value={14}>14</option><option value={30}>30</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-1">Room Categories</label>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy bg-white">
              <option>All</option>
              {roomCategories.map((c) => <option key={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-1">Rate plans</label>
            <select value={ratePlanFilter} onChange={(e) => setRatePlanFilter(e.target.value)} className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy bg-white">
              <option>EP, CP</option><option>EP</option><option>CP</option><option>MAP</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 mt-3">
          <button onClick={() => setBulkOpen(true)} className="px-4 py-2 bg-navy text-cream rounded-lg text-sm font-semibold hover:bg-navy-light transition">Bulk update ✏️</button>
          <div className="relative">
            <button onClick={() => setViewMoreOpen(!viewMoreOpen)} className="px-4 py-2 border border-cream-dark rounded-lg text-sm font-medium text-navy bg-white hover:bg-cream transition">View more ▾</button>
            {viewMoreOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setViewMoreOpen(false)} />
                <div className="absolute top-full right-0 mt-1 z-30 bg-white border border-cream-dark rounded-lg shadow-xl py-1 min-w-[220px]">
                  {[
                    { label: "Rates and inventory", action: () => showToast("Showing rates & inventory") },
                    { label: "Base price", action: () => setShowBasePrice(!showBasePrice) },
                    { label: "OTA price compare", action: () => setShowOtaCompare(!showOtaCompare) },
                    { label: "View latest updates", action: () => setReportModal("updates") },
                    { label: "Channel status report", action: () => setReportModal("channels") },
                    { label: "View detail logs", action: () => setReportModal("logs") },
                  ].map((item) => (
                    <button key={item.label} onClick={() => { item.action(); setViewMoreOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-navy hover:bg-cream transition-colors">
                      {item.label}
                      {item.label === "Base price" && showBasePrice && <span className="float-right text-emerald-600">✓</span>}
                      {item.label === "OTA price compare" && showOtaCompare && <span className="float-right text-emerald-600">✓</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {loading && (
        <div className="bg-white border border-cream-dark rounded-xl p-12 text-center mb-6">
          <p className="text-navy font-medium">⏳ Loading…</p>
        </div>
      )}

      {/* SUMMARY */}
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
                      } else if (row.key === "totalAvailable") value = <span className="text-emerald-600 font-semibold">{o.available}</span>;
                      else if (row.key === "totalBooked") value = <span className="text-navy font-semibold">{o.occupied}</span>;
                      else if (row.key === "totalBlocked") value = <span className="text-blue-600 font-semibold">{o.blocked}</span>;
                      else value = <span className="text-navy/70">0</span>;
                      return <td key={i} className="text-center px-3 py-3 text-sm border-l border-cream-dark">{value}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CATEGORY TABLES */}
      {!loading && visibleCategories.map((cat) => {
        const plans = visiblePlansFor(cat);
        return (
          <div key={cat.name} className="bg-white border border-cream-dark rounded-xl shadow-sm overflow-hidden mb-6">
            <div className="flex items-center justify-between px-5 py-3 bg-cream/40 border-b border-cream-dark">
              <div className="flex items-center gap-3">
                <h3 className="font-serif text-base font-semibold text-navy">{cat.name}</h3>
                <button onClick={() => setReportModal("channels")} className="text-xs text-gold-dark font-medium hover:underline">
                  View connected channels
                </button>
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
                            return <td key={i} className="text-center px-3 py-2 text-sm border-l border-cream-dark"><span className={row.color}>{val}</span></td>;
                          })}
                        </tr>
                      ))}
                    </>
                  )}

                  {showRates && plans.map((plan) => (
                    <React.Fragment key={plan.code}>
                      <tr className="bg-navy text-cream">
                        <td className="px-4 py-2 text-xs font-bold w-48">{plan.label}</td>
                        {dates.map((d, i) => (
                          <td key={i} className="text-center px-2 py-2 text-[10px] border-l border-navy-light opacity-70">
                            per person rates
                          </td>
                        ))}
                      </tr>

                      <tr className="border-b border-cream-dark bg-gold/5">
                        <td className="px-4 py-2 text-xs font-semibold text-navy bg-white">👤 Single Person (1 Adult)</td>
                        {dates.map((d, i) => {
                          const cell = getCell(d, cat.name, plan.code);
                          const key = rateKey(fmt(d), cat.name, plan.code);
                          const isSaving = savingKeys.has(key);
                          return (
                            <td key={i} className="text-center px-2 py-2 border-l border-cream-dark">
                              <div className="relative inline-block">
                                <input
                                  type="number"
                                  value={cell.single}
                                  onChange={(e) => setCellField(d, cat.name, plan.code, "single", Number(e.target.value))}
                                  onBlur={() => saveCell(d, cat.name, plan.code)}
                                  className="w-24 text-center px-2 py-1 border border-cream-dark rounded-md text-sm text-navy outline-none hover:border-gold focus:border-gold transition font-semibold"
                                />
                                {isSaving && <span className="absolute -top-2 -right-2 text-[10px]">💾</span>}
                              </div>
                            </td>
                          );
                        })}
                      </tr>

                      <tr className="border-b border-cream-dark">
                        <td className="px-4 py-2 text-xs font-semibold text-navy bg-white">👥 Double Person (2 Adults)</td>
                        {dates.map((d, i) => {
                          const cell = getCell(d, cat.name, plan.code);
                          return (
                            <td key={i} className="text-center px-2 py-2 border-l border-cream-dark">
                              <input
                                type="number"
                                value={cell.double}
                                onChange={(e) => setCellField(d, cat.name, plan.code, "double", Number(e.target.value))}
                                onBlur={() => saveCell(d, cat.name, plan.code)}
                                className="w-24 text-center px-2 py-1 border border-cream-dark rounded-md text-sm text-navy outline-none hover:border-gold focus:border-gold transition font-semibold"
                              />
                            </td>
                          );
                        })}
                      </tr>

                      <tr className="border-b border-cream-dark">
                        <td className="px-4 py-2 text-xs font-semibold text-navy bg-white">➕ Extra Adult (3rd onwards)</td>
                        {dates.map((d, i) => {
                          const cell = getCell(d, cat.name, plan.code);
                          return (
                            <td key={i} className="text-center px-2 py-2 border-l border-cream-dark">
                              <input
                                type="number"
                                value={cell.extraAdult}
                                onChange={(e) => setCellField(d, cat.name, plan.code, "extraAdult", Number(e.target.value))}
                                onBlur={() => saveCell(d, cat.name, plan.code)}
                                className="w-24 text-center px-2 py-1 border border-cream-dark rounded-md text-sm text-navy outline-none hover:border-gold focus:border-gold transition"
                              />
                            </td>
                          );
                        })}
                      </tr>

                      <tr className="border-b border-cream-dark">
                        <td className="px-4 py-2 text-xs font-semibold text-navy bg-white">🧒 Child (7-12 yrs)</td>
                        {dates.map((d, i) => {
                          const cell = getCell(d, cat.name, plan.code);
                          return (
                            <td key={i} className="text-center px-2 py-2 border-l border-cream-dark">
                              <input
                                type="number"
                                value={cell.child712}
                                onChange={(e) => setCellField(d, cat.name, plan.code, "child712", Number(e.target.value))}
                                onBlur={() => saveCell(d, cat.name, plan.code)}
                                className="w-24 text-center px-2 py-1 border border-cream-dark rounded-md text-sm text-navy outline-none hover:border-gold focus:border-gold transition"
                              />
                            </td>
                          );
                        })}
                      </tr>

                      <tr className="border-b-2 border-navy">
                        <td className="px-4 py-2 text-xs font-semibold text-navy bg-white">👶 Child (0-6 yrs) — Free</td>
                        {dates.map((d, i) => {
                          const cell = getCell(d, cat.name, plan.code);
                          return (
                            <td key={i} className="text-center px-2 py-2 border-l border-cream-dark">
                              <input
                                type="number"
                                value={cell.child06}
                                onChange={(e) => setCellField(d, cat.name, plan.code, "child06", Number(e.target.value))}
                                onBlur={() => saveCell(d, cat.name, plan.code)}
                                className="w-24 text-center px-2 py-1 border border-cream-dark rounded-md text-sm text-navy outline-none hover:border-gold focus:border-gold transition"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* ═══ NEW BULK UPDATE MODAL ═══ */}
      {bulkOpen && (
        <BulkUpdateModal
          onClose={() => setBulkOpen(false)}
          onApply={async (payload) => {
            try {
              const rows: BulkRateRow[] = [];
              const from = parseISO(payload.dateFrom);
              const to = parseISO(payload.dateTo);
              const allowedDayNums = payload.days.map(dayNameToNum);
              const cur = new Date(from);
              while (cur <= to) {
                const matchesDay = allowedDayNums.length === 0 || allowedDayNums.includes(cur.getDay());
                if (matchesDay) {
                  const dateStr = fmt(cur);
                  for (const block of payload.blocks) {
                    if (!block.roomType || !block.ratePlan) continue;
                    rows.push({
                      roomType: block.roomType,
                      ratePlan: block.ratePlan,
                      rateDate: dateStr,
                      singlePrice: Number(block.singlePrice) || 0,
                      doublePrice: Number(block.doublePrice) || 0,
                      extraAdultPrice: Number(block.extraAdultPrice) || 0,
                      childPrice: Number(block.childPrice) || 0,
                      infantPrice: Number(block.infantPrice) || 0,
                    });
                  }
                }
                cur.setDate(cur.getDate() + 1);
              }
              if (rows.length > 0) await bulkSetPricing(rows);
              setBulkOpen(false);
              showToast(`✓ Updated ${rows.length} rate entries`);
              await load();
            } catch (err) {
              console.error(err);
              showToast("⚠ Bulk update failed");
            }
          }}
          startDate={startDate}
        />
      )}

      {reportModal && <ReportModal type={reportModal} bookings={bookings} onClose={() => setReportModal(null)} />}

      {toast && (
        <div className="fixed top-6 right-6 bg-emerald-500 text-white px-6 py-3 rounded-lg shadow-2xl z-[300] text-sm font-medium">
          {toast}
        </div>
      )}
    </div>
  );
}

// ─── REPORT MODAL ───
function ReportModal({ type, bookings, onClose }: { type: "updates" | "channels" | "logs"; bookings: Booking[]; onClose: () => void }) {
  const titles: Record<string, string> = { updates: "Latest Updates", channels: "Channel Status Report", logs: "Detail Logs" };
  return (
    <>
      <div className="fixed inset-0 bg-navy/50 backdrop-blur-sm z-[190]" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl z-[200] w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="px-6 py-4 border-b border-cream-dark flex justify-between items-center">
          <h2 className="font-serif text-xl font-semibold text-navy">{titles[type]}</h2>
          <button onClick={onClose} className="text-2xl text-muted hover:text-navy leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 text-sm">
          {type === "updates" && (
            <div className="space-y-3">
              {[
                { who: "You", what: "Updated Deluxe Room EP single price", when: "2 min ago" },
                { who: "You", what: "Set CP double price for 15 Sep", when: "15 min ago" },
              ].map((u, i) => (
                <div key={i} className="border-l-4 border-gold pl-4 py-2">
                  <p className="font-semibold text-navy">{u.who}</p>
                  <p className="text-navy/80 mt-0.5">{u.what}</p>
                  <p className="text-xs text-muted mt-1">{u.when}</p>
                </div>
              ))}
            </div>
          )}
          {type === "channels" && (
            <div className="space-y-3">
              {[
                { name: "agoda", status: "Connected", last: "2 min ago" },
                { name: "MakeMyTrip", status: "Connected", last: "5 min ago" },
                { name: "Booking.com", status: "Connected", last: "10 min ago" },
                { name: "Expedia", status: "Connected", last: "1 hour ago" },
                { name: "Goibibo", status: "Connected", last: "3 min ago" },
              ].map((c, i) => (
                <div key={i} className="flex justify-between items-center border border-cream-dark rounded-lg p-3">
                  <div><p className="font-semibold text-navy">{c.name}</p><p className="text-xs text-muted">Last sync: {c.last}</p></div>
                  <span className="text-xs px-3 py-1 rounded-full font-semibold bg-emerald-100 text-emerald-700">{c.status}</span>
                </div>
              ))}
            </div>
          )}
          {type === "logs" && (
            <div className="space-y-2 font-mono text-xs">
              {bookings.slice(0, 10).map((b, i) => (
                <div key={i} className="bg-cream/40 rounded p-3 border-l-4 border-navy">
                  <p className="text-gold-dark">[{new Date().toISOString().slice(0, 19)}]</p>
                  <p className="text-navy">Booking {b.id} · {b.primaryGuest.name} · {b.status}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// BULK UPDATE MODAL — matches Stayflexi screenshots exactly
// ═══════════════════════════════════════════════════════════
type RateBlock = {
  id: string;
  roomType: string;
  ratePlan: string;
  singlePrice: string;
  doublePrice: string;
  extraAdultPrice: string;
  childPrice: string;
  infantPrice: string;
};

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
    blocks: RateBlock[];
  }) => void;
  startDate: string;
}) {
  const [actionType, setActionType] = useState("Set Pricing");
  const [sources, setSources] = useState<string[]>(["walkin"]);
  const [days, setDays] = useState<string[]>([...ALL_DAYS]);
  const [dateFrom, setDateFrom] = useState(startDate);
  const [dateTo, setDateTo] = useState("2026-10-13");
  const [blocks, setBlocks] = useState<RateBlock[]>([
    {
      id: "b1",
      roomType: "Deluxe Room",
      ratePlan: "EP",
      singlePrice: "",
      doublePrice: "",
      extraAdultPrice: "",
      childPrice: "",
      infantPrice: "",
    },
  ]);

  const toggleIn = (arr: string[], val: string, set: (v: string[]) => void) => {
    set(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  const addBlock = () => {
    setBlocks((prev) => [
      ...prev,
      {
        id: `b${Date.now()}`,
        roomType: roomCategories[0].name,
        ratePlan: "EP",
        singlePrice: "",
        doublePrice: "",
        extraAdultPrice: "",
        childPrice: "",
        infantPrice: "",
      },
    ]);
  };

  const updateBlock = (id: string, patch: Partial<RateBlock>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  return (
    <>
      <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-[190]" onClick={onClose} />
      <div className="fixed inset-2 md:inset-6 lg:inset-10 bg-white rounded-2xl shadow-2xl z-[200] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-cream-dark flex justify-between items-center bg-cream/30">
          <h2 className="font-serif text-xl font-semibold text-navy">Bulk Update</h2>
          <button onClick={onClose} className="text-3xl text-muted hover:text-navy leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Action Type */}
          <div className="border border-cream-dark rounded-lg p-4 bg-white">
            <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-2">Action Type</label>
            <select value={actionType} onChange={(e) => setActionType(e.target.value)} className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy bg-white">
              <option>Set Pricing</option>
              <option>Adjust Pricing</option>
              <option>Set Availability</option>
              <option>Block Rooms</option>
            </select>
          </div>

          {/* Source */}
          <div className="border border-cream-dark rounded-lg p-4 bg-white">
            <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-3">Source</label>
            <div className="flex flex-wrap gap-2">
              {ALL_SOURCES.map((src) => (
                <button
                  key={src}
                  onClick={() => toggleIn(sources, src, setSources)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium border transition ${
                    sources.includes(src)
                      ? "bg-navy text-cream border-navy"
                      : "bg-white text-navy border-cream-dark hover:border-gold"
                  }`}
                >
                  {src}
                </button>
              ))}
              <span className="text-muted text-xs ml-auto self-center">▾</span>
            </div>
          </div>

          {/* Days */}
          <div className="border border-cream-dark rounded-lg p-4 bg-white">
            <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-3">Days</label>
            <div className="flex flex-wrap gap-2">
              {ALL_DAYS.map((d) => (
                <button
                  key={d}
                  onClick={() => toggleIn(days, d, setDays)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium border transition ${
                    days.includes(d)
                      ? "bg-navy text-cream border-navy"
                      : "bg-white text-navy border-cream-dark hover:border-gold"
                  }`}
                >
                  {d}
                </button>
              ))}
              <span className="text-muted text-xs ml-auto self-center">▾</span>
            </div>
          </div>

          {/* Date range */}
          <div className="border border-cream-dark rounded-lg p-4 bg-white">
            <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-2">Date range *</label>
            <div className="flex items-center gap-3 text-sm">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy"
              />
              <span className="text-muted">→</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy"
              />
            </div>
          </div>

          {/* Rate blocks */}
          {blocks.map((block, idx) => (
            <div key={block.id} className="border-2 border-cream-dark rounded-lg p-4 bg-white relative">
              {/* Row 1: Room Type + Rate Plan */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-1">
                    Room Types
                  </label>
                  <select
                    value={block.roomType}
                    onChange={(e) => updateBlock(block.id, { roomType: e.target.value })}
                    className="w-full px-3 py-2.5 border border-cream-dark rounded-lg text-sm text-navy bg-white"
                  >
                    {roomCategories.map((c) => (
                      <option key={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-1">
                    Rate Plans
                  </label>
                  <select
                    value={block.ratePlan}
                    onChange={(e) => updateBlock(block.id, { ratePlan: e.target.value })}
                    className="w-full px-3 py-2.5 border border-cream-dark rounded-lg text-sm text-navy bg-white"
                  >
                    <option>EP</option>
                    <option>CP</option>
                    <option>MAP</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Single / Double / Extra prices */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-1">
                    Set Price for 1 Adults
                  </label>
                  <input
                    type="number"
                    value={block.singlePrice}
                    onChange={(e) => updateBlock(block.id, { singlePrice: e.target.value })}
                    placeholder="e.g. 2500"
                    className="w-full px-3 py-2.5 border border-cream-dark rounded-lg text-sm text-navy"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-1">
                    Set Price for 2 Adults
                  </label>
                  <input
                    type="number"
                    value={block.doublePrice}
                    onChange={(e) => updateBlock(block.id, { doublePrice: e.target.value })}
                    placeholder="e.g. 3300"
                    className="w-full px-3 py-2.5 border border-cream-dark rounded-lg text-sm text-navy"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-1">
                    Set Price for 3 Adults
                  </label>
                  <input
                    type="number"
                    value={block.extraAdultPrice}
                    onChange={(e) => updateBlock(block.id, { extraAdultPrice: e.target.value })}
                    placeholder="e.g. 1000"
                    className="w-full px-3 py-2.5 border border-cream-dark rounded-lg text-sm text-navy"
                  />
                </div>
              </div>

              {/* Row 3: Child + Infant */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-1">
                    Child price (7-12 yrs)
                  </label>
                  <input
                    type="number"
                    value={block.childPrice}
                    onChange={(e) => updateBlock(block.id, { childPrice: e.target.value })}
                    placeholder="e.g. 500"
                    className="w-full px-3 py-2.5 border border-cream-dark rounded-lg text-sm text-navy"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-1">
                    Infant price (0-6 yrs)
                  </label>
                  <input
                    type="number"
                    value={block.infantPrice}
                    onChange={(e) => updateBlock(block.id, { infantPrice: e.target.value })}
                    placeholder="e.g. 500"
                    className="w-full px-3 py-2.5 border border-cream-dark rounded-lg text-sm text-navy"
                  />
                </div>
              </div>

              {/* Remove block (only if more than one) */}
              {blocks.length > 1 && (
                <button
                  onClick={() => removeBlock(block.id)}
                  className="absolute top-2 right-2 text-rose-500 hover:text-rose-700 text-lg"
                  title="Remove this rate block"
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          {/* Add Room Type button */}
          <button
            onClick={addBlock}
            className="px-5 py-2.5 bg-navy text-cream rounded-lg text-sm font-semibold hover:bg-navy-light transition"
          >
            + Add Room Type
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-cream-dark flex gap-2 justify-end bg-cream/30">
          <button onClick={onClose} className="px-5 py-2.5 border border-cream-dark rounded-lg font-medium text-navy hover:bg-cream">
            Cancel
          </button>
          <button
            onClick={() => onApply({ sources, days, dateFrom, dateTo, blocks })}
            className="px-6 py-2.5 bg-navy text-cream rounded-lg font-semibold hover:bg-navy-light"
          >
            Set Pricing
          </button>
        </div>
      </div>
    </>
  );
}
