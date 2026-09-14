"use client";

import React, { useState, useEffect, useCallback } from "react";
import { fetchRooms, type Room } from "../db";
import { fetchRates, upsertRate, bulkSetPricing, type BulkRateRow, type RateRow } from "../db-rates";
import { getActiveHotelId } from "../active-hotel";

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
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

// Build unique room categories from DB rooms
function buildCategories(rooms: Room[]) {
  const map = new Map<string, { name: string; count: number; basePrice: number }>();
  for (const r of rooms) {
    const existing = map.get(r.room_type);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(r.room_type, {
        name: r.room_type,
        count: 1,
        basePrice: Number(r.base_price) || 2500,
      });
    }
  }
  return Array.from(map.values());
}

const ALL_SOURCES = ["walkin", "booking engine", "booking", "goibibo", "agoda", "cleartrip", "expedia", "hyperguest", "ixigo"];
const ALL_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type PlanRate = { single: number; double: number; extraAdult: number; child712: number; child06: number };
type RateMap = Record<string, PlanRate>;

function rateKey(date: string, roomType: string, plan: string): string {
  return `${date}__${roomType}__${plan}`;
}

export default function InventoryPage() {
  const [startDate, setStartDate] = useState("2026-09-12");
  const [daysToShow, setDaysToShow] = useState(8);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [rates, setRates] = useState<RateMap>({});
  const [loading, setLoading] = useState(true);
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const [showRates, setShowRates] = useState(true);
  const [showInventory, setShowInventory] = useState(true);

  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [ratePlanFilter, setRatePlanFilter] = useState<string>("EP, CP");

  const [bulkOpen, setBulkOpen] = useState(false);
  const [activeHotelId, setActiveHotelId] = useState<string | null>(null);

  const dates = getDates(startDate, daysToShow);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const hotelId = getActiveHotelId();
      setActiveHotelId(hotelId);

      const [roomsData, ratesData] = await Promise.all([
        fetchRooms(),
        fetchRates("2026-01-01", "2027-12-31"),
      ]);
      setRooms(roomsData);

      const map: RateMap = {};
      for (const r of ratesData) {
        const key = rateKey(r.rate_date, r.room_type, r.rate_plan);
        map[key] = {
          single: Number((r as unknown as { single_price?: number }).single_price) || r.price,
          double: Number((r as unknown as { double_price?: number }).double_price) || r.price + 200,
          extraAdult: Number((r as unknown as { extra_adult_price?: number }).extra_adult_price) || 800,
          child712: Number((r as unknown as { child_7_12_price?: number }).child_7_12_price) || 500,
          child06: Number((r as unknown as { child_0_6_price?: number }).child_0_6_price) || 500,
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

  const categories = buildCategories(rooms);

  const getCell = (date: Date, roomType: string, plan: string): PlanRate => {
    const key = rateKey(fmt(date), roomType, plan);
    if (rates[key]) return rates[key];
    const cat = categories.find((c) => c.name === roomType);
    const base = cat?.basePrice ?? 2500;
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

  const visibleCategories = categoryFilter === "All"
    ? categories
    : categories.filter((c) => c.name === categoryFilter);

  const categoryOptions = ["All", ...categories.map((c) => c.name)];

  return (
    <div className="p-6 lg:p-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-navy">
            Inventory &amp; Rates
          </h1>
          <p className="text-muted mt-1 text-sm">
            {rooms.length} rooms · {categories.length} categories ·{" "}
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
        <div className="bg-white border border-cream-dark rounded-xl p-5 shadow-sm border-l-4 border-l-gold">
          <p className="text-xs text-muted uppercase tracking-wide">Categories</p>
          <p className="font-serif text-2xl font-semibold text-navy mt-1">{categories.length}</p>
        </div>
        <div className="bg-white border border-cream-dark rounded-xl p-5 shadow-sm border-l-4 border-l-emerald-500">
          <p className="text-xs text-muted uppercase tracking-wide">Rate Entries</p>
          <p className="font-serif text-2xl font-semibold text-emerald-600 mt-1">{Object.keys(rates).length}</p>
        </div>
        <div className="bg-white border border-cream-dark rounded-xl p-5 shadow-sm border-l-4 border-l-navy">
          <p className="text-xs text-muted uppercase tracking-wide">Active Hotel ID</p>
          <p className="text-xs font-mono text-navy mt-2 truncate">
            {activeHotelId?.slice(0, 8) || "—"}
          </p>
        </div>
      </div>

      {/* FILTERS */}
      <div className="bg-white border border-cream-dark rounded-xl p-4 mb-6 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
          <div className="col-span-2">
            <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-1">Date range</label>
            <input type="text" value={`${prettyDate(startDate)} - ${prettyDate(fmt(dates[dates.length - 1]))}`} readOnly className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm bg-white text-navy" />
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
              {categoryOptions.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-1">Rate plans</label>
            <select value={ratePlanFilter} onChange={(e) => setRatePlanFilter(e.target.value)} className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy bg-white">
              <option>EP, CP</option><option>EP</option><option>CP</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 mt-3">
          <button onClick={() => setBulkOpen(true)} className="px-4 py-2 bg-navy text-cream rounded-lg text-sm font-semibold hover:bg-navy-light transition">Bulk update ✏️</button>
        </div>
      </div>

      {/* LOADING */}
      {loading && (
        <div className="bg-white border border-cream-dark rounded-xl p-12 text-center mb-6">
          <p className="text-navy font-medium">⏳ Loading rates…</p>
        </div>
      )}

      {/* EMPTY */}
      {!loading && rooms.length === 0 && (
        <div className="bg-white border border-cream-dark rounded-xl p-12 text-center mb-6">
          <p className="text-4xl mb-4">📊</p>
          <p className="text-navy font-medium mb-2">No rooms in this property yet</p>
          <p className="text-muted text-sm">Add rooms from the Properties page or switch to another property.</p>
        </div>
      )}

      {/* PER-CATEGORY TABLES */}
      {!loading && visibleCategories.map((cat) => {
        const plans = ratePlanFilter === "EP"
          ? [{ code: "EP", label: "EP" }]
          : ratePlanFilter === "CP"
          ? [{ code: "CP", label: "CP" }]
          : [{ code: "EP", label: "EP" }, { code: "CP", label: "CP" }];

        return (
          <div key={cat.name} className="bg-white border border-cream-dark rounded-xl shadow-sm overflow-hidden mb-6">
            <div className="flex items-center justify-between px-5 py-3 bg-cream/40 border-b border-cream-dark">
              <div className="flex items-center gap-3">
                <h3 className="font-serif text-base font-semibold text-navy">{cat.name}</h3>
                <span className="text-xs text-muted bg-white px-2 py-0.5 rounded-full border border-cream-dark">
                  {cat.count} rooms
                </span>
                <span className="text-xs text-gold-dark font-medium">
                  ₹{cat.basePrice}/night base
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px]">
                <tbody>
                  {showRates && plans.map((plan) => (
                    <React.Fragment key={plan.code}>
                      <tr className="bg-navy text-cream">
                        <td className="px-4 py-2 text-xs font-bold w-48">{plan.label}</td>
                        {dates.map((d, i) => (
                          <td key={i} className="text-center px-2 py-2 text-[10px] border-l border-navy-light opacity-70">
                            per person
                          </td>
                        ))}
                      </tr>

                      <tr className="border-b border-cream-dark bg-gold/5">
                        <td className="px-4 py-2 text-xs font-semibold text-navy bg-white">👤 Single (1 Adult)</td>
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
                        <td className="px-4 py-2 text-xs font-semibold text-navy bg-white">👥 Double (2 Adults)</td>
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
                        <td className="px-4 py-2 text-xs font-semibold text-navy bg-white">➕ Extra Adult</td>
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
                        <td className="px-4 py-2 text-xs font-semibold text-navy bg-white">👶 Child (0-6 yrs)</td>
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

      {/* BULK UPDATE MODAL */}
      {bulkOpen && (
        <BulkUpdateModal
          categories={categories}
          onClose={() => setBulkOpen(false)}
          onApply={async (payload) => {
            try {
              const rows: BulkRateRow[] = [];
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
                      singlePrice: Number(payload.adultPrice) || 0,
                      doublePrice: Number(payload.childPrice) || 0,
                      extraAdultPrice: Number(payload.infantPrice) || 0,
                      childPrice: 500,
                      infantPrice: 500,
                    });
                  }
                }
                cur.setDate(cur.getDate() + 1);
              }
              if (rows.length > 0) await bulkSetPricing(rows);
              setBulkOpen(false);
              showToast(`✓ Bulk updated ${rows.length} rates`);
              await load();
            } catch (err) {
              console.error(err);
              showToast("⚠ Bulk update failed");
            }
          }}
          startDate={startDate}
        />
      )}

      {toast && (
        <div className="fixed top-6 right-6 bg-emerald-500 text-white px-6 py-3 rounded-lg shadow-2xl z-[200] text-sm font-medium">
          {toast}
        </div>
      )}
    </div>
  );
}

// ─── BULK UPDATE MODAL ───
function BulkUpdateModal({
  categories,
  onClose,
  onApply,
  startDate,
}: {
  categories: { name: string }[];
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
  const [sources, setSources] = useState<string[]>([]);
  const [days, setDays] = useState<string[]>([...ALL_DAYS]);
  const [dateFrom, setDateFrom] = useState(startDate);
  const [dateTo, setDateTo] = useState("2026-10-13");
  const [roomTypes, setRoomTypes] = useState<string[]>([categories[0]?.name || "Standard Room"]);
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
            <label className="text-xs uppercase tracking-widest text-muted font-semibold block mb-2">Source</label>
            <div className="flex flex-wrap gap-2">
              {ALL_SOURCES.map((src) => (
                <button key={src} onClick={() => toggleIn(sources, src, setSources)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${sources.includes(src) ? "bg-navy text-cream border-navy" : "bg-white text-navy border-cream-dark hover:border-gold"}`}>{src}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest text-muted font-semibold block mb-2">Days</label>
            <div className="flex flex-wrap gap-2">
              {ALL_DAYS.map((d) => (
                <button key={d} onClick={() => toggleIn(days, d, setDays)} className={`px-4 py-1.5 rounded-full text-xs font-medium border transition ${days.includes(d) ? "bg-navy text-cream border-navy" : "bg-white text-navy border-cream-dark hover:border-gold"}`}>{d}</button>
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
              {categories.map((c) => (
                <button key={c.name} onClick={() => toggleIn(roomTypes, c.name, setRoomTypes)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${roomTypes.includes(c.name) ? "bg-navy text-cream border-navy" : "bg-white text-navy border-cream-dark hover:border-gold"}`}>{c.name}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest text-muted font-semibold block mb-2">Rate Plans</label>
            <div className="flex flex-wrap gap-2">
              {["EP", "CP"].map((p) => (
                <button key={p} onClick={() => toggleIn(ratePlans, p, setRatePlans)} className={`px-4 py-1.5 rounded-full text-xs font-medium border transition ${ratePlans.includes(p) ? "bg-navy text-cream border-navy" : "bg-white text-navy border-cream-dark hover:border-gold"}`}>{p}</button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs uppercase tracking-widest text-muted font-semibold block mb-1">Single price</label>
              <input type="number" value={adultPrice} onChange={(e) => setAdultPrice(e.target.value)} placeholder="0" className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted font-semibold block mb-1">Double price</label>
              <input type="number" value={childPrice} onChange={(e) => setChildPrice(e.target.value)} placeholder="0" className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted font-semibold block mb-1">Extra adult</label>
              <input type="number" value={infantPrice} onChange={(e) => setInfantPrice(e.target.value)} placeholder="0" className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy" />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-cream-dark flex gap-2 justify-end bg-cream/30">
          <button onClick={onClose} className="px-5 py-2.5 border border-cream-dark rounded-lg font-medium text-navy hover:bg-cream">Cancel</button>
          <button onClick={() => onApply({ sources, days, dateFrom, dateTo, roomTypes, ratePlans, adultPrice, childPrice, infantPrice })} className="px-6 py-2.5 bg-navy text-cream rounded-lg font-semibold hover:bg-navy-light">Apply Bulk Update</button>
        </div>
      </div>
    </>
  );
}
