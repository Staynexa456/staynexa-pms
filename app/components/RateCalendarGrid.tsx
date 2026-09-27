// app/components/RateCalendarGrid.tsx
"use client";

import React, { useState, useMemo } from "react";
import { OCCUPANCIES, type OccupancyKey } from "../lib/rate-plans";

function fmtFull(n: number): string {
  return `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
}

function fmtDate(iso: string): { day: string; date: string; month: string } {
  if (!iso) return { day: "", date: "", month: "" };
  const [y, m, d] = iso.split("-").map(Number);
  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const wd = days[new Date(y, m - 1, d).getDay()];
  return { day: wd, date: String(d), month: months[m - 1] };
}

function isWeekend(iso: string): boolean {
  if (!iso) return false;
  const [y, m, d] = iso.split("-").map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  return wd === 0 || wd === 6;
}

type RatePlanRow = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  rate_difference: number;
};

interface Props {
  roomTypes: string[];
  ratePlans: RatePlanRow[];
  dates: string[];
  prices: Record<string, Record<string, Record<string, Record<string, number>>>>;
  basePrices: Record<string, number>;
  onCellEdit: (
    roomType: string,
    ratePlanId: string,
    occupancy: OccupancyKey,
    date: string,
    newPrice: number
  ) => Promise<void>;
  onBulkEdit: (
    roomType: string,
    ratePlanId: string,
    occupancy: OccupancyKey,
    dates: string[],
    newPrice: number
  ) => Promise<void>;
}

export default function RateCalendarGrid({
  roomTypes,
  ratePlans,
  dates,
  prices,
  basePrices,
  onCellEdit,
  onBulkEdit,
}: Props) {
  const [activeRoomType, setActiveRoomType] = useState<string>(roomTypes[0] || "");
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{
    planId: string;
    occupancy: OccupancyKey;
    date: string;
  } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Bulk edit modal state
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPlanId, setBulkPlanId] = useState<string>(ratePlans[0]?.id || "");
  const [bulkOccupancy, setBulkOccupancy] = useState<OccupancyKey>("2A"); // ✅ Fixed
  const [bulkStart, setBulkStart] = useState<string>(dates[0] || "");
  const [bulkEnd, setBulkEnd] = useState<string>(dates[dates.length - 1] || "");
  const [bulkPrice, setBulkPrice] = useState<string>("");

  // Current plan and prices
  const activePlan = useMemo(
    () => ratePlans.find((p) => p.id === expandedPlanId),
    [ratePlans, expandedPlanId]
  );

  const getPrice = (planId: string, planCode: string, occupancy: OccupancyKey, date: string): number => {
    return prices[activeRoomType]?.[planCode]?.[occupancy]?.[date] ?? 0;
  };

  const handleCellClick = (
    planId: string,
    planCode: string,
    occupancy: OccupancyKey,
    date: string
  ) => {
    const current = getPrice(planId, planCode, occupancy, date);
    setEditingCell({ planId, occupancy, date });
    setEditValue(String(current));
  };

  const handleCellSave = async () => {
    if (!editingCell || !activePlan) return;
    const newPrice = Number(editValue);
    if (isNaN(newPrice) || newPrice < 0) {
      setEditingCell(null);
      return;
    }
    setSaving(true);
    try {
      await onCellEdit(
        activeRoomType,
        activePlan.code,
        editingCell.occupancy,
        editingCell.date,
        newPrice
      );
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
      setEditingCell(null);
    }
  };

  const handleCellKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCellSave();
    } else if (e.key === "Escape") {
      setEditingCell(null);
    }
  };

  const handleBulkApply = async () => {
    if (!bulkPlanId || !bulkPrice) return;
    const plan = ratePlans.find((p) => p.id === bulkPlanId);
    if (!plan) return;

    // Filter dates in range
    const inRangeDates = dates.filter((d) => d >= bulkStart && d <= bulkEnd);
    if (inRangeDates.length === 0) {
      alert("No dates in selected range");
      return;
    }

    const price = Number(bulkPrice);
    if (isNaN(price) || price < 0) {
      alert("Invalid price");
      return;
    }

    setSaving(true);
    try {
      await onBulkEdit(activeRoomType, plan.code, bulkOccupancy, inRangeDates, price);
      setBulkOpen(false);
      setBulkPrice("");
    } catch (err) {
      console.error(err);
      alert("Bulk update failed");
    } finally {
      setSaving(false);
    }
  };

  // If no room types
  if (roomTypes.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
        <p className="text-4xl mb-3">🏨</p>
        <p className="font-bold text-slate-700">No room types yet</p>
        <p className="text-sm text-slate-400 mt-1">Add room types from Property Details</p>
      </div>
    );
  }

  return (
    <>
      {/* Room Type Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {roomTypes.map((rt) => (
          <button
            key={rt}
            onClick={() => {
              setActiveRoomType(rt);
              setExpandedPlanId(null);
            }}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition flex items-center gap-2 ${
              activeRoomType === rt
                ? "bg-teal-500 text-white shadow-md shadow-teal-500/30"
                : "bg-white border border-slate-200 text-slate-600 hover:border-teal-300"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                activeRoomType === rt ? "bg-white" : "bg-teal-500"
              }`}
            />
            {rt}
          </button>
        ))}
      </div>

      {/* Active Room Banner */}
      <div className="bg-slate-900 text-white rounded-t-2xl px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-bold">{activeRoomType}</span>
          <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-mono">
            BASE: {fmtFull(basePrices[activeRoomType] || 0)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            {ratePlans.length} rate plans · {OCCUPANCIES.length} occupancies
          </span>
          <button
            onClick={() => setBulkOpen(true)}
            disabled={ratePlans.length === 0}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition flex items-center gap-1.5"
          >
            ⚡ Bulk Update
          </button>
        </div>
      </div>

      {/* Rate Plans */}
      <div className="bg-white rounded-b-2xl border border-t-0 border-slate-200 overflow-hidden">
        {ratePlans.length === 0 ? (
          <div className="p-16 text-center">
            <p className="text-3xl mb-3">🎯</p>
            <p className="font-bold text-slate-700">No rate plans</p>
            <p className="text-sm text-slate-400 mt-1">
              Add EP, CP, MAP, AP rate plans from Property Settings
            </p>
          </div>
        ) : (
          ratePlans.map((plan) => {
            const isExpanded = expandedPlanId === plan.id;
            const baseForPlan =
              (basePrices[activeRoomType] || 0) + Number(plan.rate_difference || 0);

            return (
              <div key={plan.id} className="border-b border-slate-100 last:border-b-0">
                {/* Plan Header */}
                <div className="p-5 flex items-center justify-between hover:bg-slate-50 transition">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center text-xs font-bold">
                      {plan.code}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-slate-900">{plan.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Double: {fmtFull(baseForPlan)} · Click to view {OCCUPANCIES.length}{" "}
                        occupancies
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setExpandedPlanId(isExpanded ? null : plan.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 ${
                      isExpanded
                        ? "bg-teal-500 text-white shadow-md"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {isExpanded ? "EXPANDED" : "VIEW RATES"}
                    <span className="text-base">{isExpanded ? "⌃" : "⌄"}</span>
                  </button>
                </div>

                {/* Expanded Matrix */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-900 text-white">
                          <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider sticky left-0 bg-slate-900 z-10 min-w-[110px]">
                            Occupancy
                          </th>
                          {dates.map((date) => {
                            const f = fmtDate(date);
                            const weekend = isWeekend(date);
                            return (
                              <th
                                key={date}
                                className={`px-2 py-2 text-center min-w-[85px] ${
                                  weekend ? "bg-slate-800" : ""
                                }`}
                              >
                                <div className="text-[9px] font-bold tracking-wider opacity-70">
                                  {f.day}
                                </div>
                                <div className="text-base font-bold">{f.date}</div>
                                <div className="text-[9px] font-semibold opacity-70">
                                  {f.month}
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {OCCUPANCIES.map((occ) => (
                          <tr
                            key={occ.key}
                            className="border-b border-slate-100 last:border-b-0 hover:bg-white/70 transition"
                          >
                            <td className="px-4 py-2 sticky left-0 bg-slate-50 z-10">
                              <div className="flex items-center gap-2">
                                <span className="text-base">{occ.icon}</span>
                                <div>
                                  <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                                    {occ.key}
                                  </p>
                                  <p className="text-[9px] text-slate-400">{occ.label}</p>
                                </div>
                              </div>
                            </td>
                            {dates.map((date) => {
                              const price = getPrice(
                                plan.id,
                                plan.code,
                                occ.key,
                                date
                              );
                              const isEditing =
                                editingCell?.planId === plan.id &&
                                editingCell?.occupancy === occ.key &&
                                editingCell?.date === date;

                              return (
                                <td key={date} className="px-1.5 py-1.5 text-center">
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onBlur={handleCellSave}
                                      onKeyDown={handleCellKeyDown}
                                      autoFocus
                                      className="w-full px-1.5 py-1 text-center text-xs font-bold rounded-md border-2 border-teal-500 outline-none bg-white"
                                    />
                                  ) : (
                                    <button
                                      onClick={() =>
                                        handleCellClick(plan.id, plan.code, occ.key, date)
                                      }
                                      className="w-full px-1.5 py-2 rounded-md text-xs font-bold text-slate-700 hover:bg-teal-50 hover:text-teal-700 transition border border-transparent hover:border-teal-300"
                                    >
                                      {price > 0 ? price.toLocaleString("en-IN") : "—"}
                                    </button>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Legend */}
                    <div className="px-4 py-3 bg-white border-t border-slate-100 flex flex-wrap items-center gap-4 text-[10px]">
                      <span className="text-slate-400 font-bold uppercase tracking-wider">
                        Legend:
                      </span>
                      {OCCUPANCIES.map((o) => (
                        <span key={o.key} className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ background: o.color }}
                          />
                          <span className="font-semibold text-slate-600">
                            {o.icon} {o.key} — {o.label}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Saving Indicator */}
      {saving && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-50">
          <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          <span className="text-sm font-semibold">Saving...</span>
        </div>
      )}

      {/* Bulk Update Modal */}
      {bulkOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-slate-800 to-slate-900 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">⚡ Bulk Update Rates</h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Apply same price to all dates in range
                </p>
              </div>
              <button
                onClick={() => setBulkOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                  Rate Plan
                </label>
                <select
                  value={bulkPlanId}
                  onChange={(e) => setBulkPlanId(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:border-teal-500 outline-none bg-white"
                >
                  {ratePlans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                  Occupancy Tier
                </label>
                <select
                  value={bulkOccupancy}
                  onChange={(e) => setBulkOccupancy(e.target.value as OccupancyKey)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:border-teal-500 outline-none bg-white"
                >
                  {OCCUPANCIES.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.icon} {o.key} — {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                    From
                  </label>
                  <input
                    type="date"
                    value={bulkStart}
                    onChange={(e) => setBulkStart(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:border-teal-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                    To
                  </label>
                  <input
                    type="date"
                    value={bulkEnd}
                    onChange={(e) => setBulkEnd(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:border-teal-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                  New Price (₹)
                </label>
                <input
                  type="number"
                  value={bulkPrice}
                  onChange={(e) => setBulkPrice(e.target.value)}
                  placeholder="e.g., 2500"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-lg font-bold focus:border-teal-500 outline-none"
                />
              </div>
            </div>

            <div className="px-6 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
              <button
                onClick={() => setBulkOpen(false)}
                className="px-5 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-white transition uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkApply}
                disabled={saving || !bulkPrice}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-xs font-bold shadow-lg disabled:opacity-50 transition uppercase tracking-wider"
              >
                {saving ? "Applying..." : "⚡ Apply to All"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
