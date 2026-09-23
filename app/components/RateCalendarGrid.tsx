"use client";

import React, { useState } from "react";
import { OCCUPANCIES, type OccupancyKey } from "../lib/rate-plans";

function fmtFull(n: number): string {
  return `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
}

export default function RateCalendarGrid({
  roomTypes,
  ratePlans,
  dates,
  prices,
  basePrices,
  onCellEdit,
  onBulkEdit,
}: {
  roomTypes: string[];
  ratePlans: any[];
  dates: string[];
  prices: Record<string, Record<string, Record<string, Record<string, number>>>>;
  basePrices: Record<string, number>;
  onCellEdit: (
    roomType: string,
    ratePlanId: string,
    occupancy: OccupancyKey,
    date: string,
    newPrice: number
  ) => void;
  onBulkEdit: (
    roomType: string,
    ratePlanId: string,
    occupancy: OccupancyKey,
    dates: string[],
    newPrice: number
  ) => void;
}) {
  // ═══ STATE ═══
  const [activeRoomType, setActiveRoomType] = useState<string>(
    roomTypes[0] || ""
  );
  const [expandedPlans, setExpandedPlans] = useState<Set<string>>(new Set());

  const [editingCell, setEditingCell] = useState<{
    roomType: string;
    planId: string;
    occupancy: OccupancyKey;
    date: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");

  // Bulk edit state
  const [bulkRoomType, setBulkRoomType] = useState(roomTypes[0] || "");
  const [bulkPlanId, setBulkPlanId] = useState(ratePlans[0]?.id || "");
  const [bulkOccupancy, setBulkOccupancy] = useState<OccupancyKey>("double");
  const [bulkStart, setBulkStart] = useState(dates[0] || "");
  const [bulkEnd, setBulkEnd] = useState(dates[dates.length - 1] || "");
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);

  // ═══ HANDLERS ═══
  const togglePlan = (planId: string) => {
    setExpandedPlans((prev) => {
      const next = new Set(prev);
      if (next.has(planId)) next.delete(planId);
      else next.add(planId);
      return next;
    });
  };

  const startEdit = (
    roomType: string,
    planId: string,
    occupancy: OccupancyKey,
    date: string,
    current: number
  ) => {
    setEditingCell({ roomType, planId, occupancy, date });
    setEditValue(String(current));
  };

  const commitEdit = () => {
    if (!editingCell) return;
    const num = Number(editValue);
    if (isNaN(num) || num < 0) {
      setEditingCell(null);
      return;
    }
    onCellEdit(
      editingCell.roomType,
      editingCell.planId,
      editingCell.occupancy,
      editingCell.date,
      num
    );
    setEditingCell(null);
  };

  const handleBulkSubmit = () => {
    const price = Number(bulkPrice);
    if (isNaN(price) || price < 0) {
      alert("Please enter a valid price");
      return;
    }
    if (bulkStart > bulkEnd) {
      alert("Start date must be before End date");
      return;
    }

    const affectedDates = dates.filter((d) => d >= bulkStart && d <= bulkEnd);
    if (affectedDates.length === 0) {
      alert("No dates in range");
      return;
    }

    const occLabel =
      OCCUPANCIES.find((o) => o.key === bulkOccupancy)?.label || bulkOccupancy;

    if (
      !confirm(
        `Update ${affectedDates.length} dates for "${bulkRoomType}" · ${occLabel} · "${
          ratePlans.find((p) => p.id === bulkPlanId)?.code || ""
        }" to ₹${price}?`
      )
    ) {
      return;
    }

    onBulkEdit(bulkRoomType, bulkPlanId, bulkOccupancy, affectedDates, price);
    setBulkOpen(false);
    setBulkPrice("");
  };

  const occColors: Record<OccupancyKey, string> = {
    single: "bg-sky-100 text-sky-700 border-sky-200",
    double: "bg-emerald-100 text-emerald-700 border-emerald-200",
    extra_adult: "bg-amber-100 text-amber-700 border-amber-200",
    child_7_12: "bg-violet-100 text-violet-700 border-violet-200",
    child_0_6: "bg-pink-100 text-pink-700 border-pink-200",
  };

  if (roomTypes.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <p className="text-5xl mb-3 opacity-30">🏨</p>
        <p className="text-slate-500 font-semibold">No room types configured</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* ═══ HEADER ═══ */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚡</span>
          <div>
            <h3 className="text-sm font-bold text-slate-700">Rate Calendar</h3>
            <p className="text-[10px] text-slate-400">
              Click any cell to edit · Per-person dynamic pricing
            </p>
          </div>
        </div>

        <button
          onClick={() => setBulkOpen(!bulkOpen)}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition"
        >
          ⚡ Bulk Update
        </button>
      </div>

      {/* ═══ BULK UPDATE PANEL ═══ */}
      {bulkOpen && (
        <div className="p-5 bg-gradient-to-br from-amber-50 to-orange-50 border-b-2 border-amber-200">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                Room Type
              </label>
              <select
                value={bulkRoomType}
                onChange={(e) => setBulkRoomType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-teal-500"
              >
                {roomTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                Rate Plan
              </label>
              <select
                value={bulkPlanId}
                onChange={(e) => setBulkPlanId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-teal-500"
              >
                {ratePlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                Occupancy
              </label>
              <select
                value={bulkOccupancy}
                onChange={(e) =>
                  setBulkOccupancy(e.target.value as OccupancyKey)
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-teal-500"
              >
                {OCCUPANCIES.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                From
              </label>
              <input
                type="date"
                value={bulkStart}
                onChange={(e) => setBulkStart(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                To
              </label>
              <input
                type="date"
                value={bulkEnd}
                onChange={(e) => setBulkEnd(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                Price (₹)
              </label>
              <input
                type="number"
                value={bulkPrice}
                onChange={(e) => setBulkPrice(e.target.value)}
                placeholder="e.g., 3500"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-teal-500 font-bold"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => {
                setBulkOpen(false);
                setBulkPrice("");
              }}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold hover:bg-white"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkSubmit}
              disabled={!bulkPrice}
              className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-xs font-bold shadow-sm disabled:opacity-50"
            >
              ✓ Apply Bulk Update
            </button>
          </div>
        </div>
      )}

      {/* ═══ ROOM TYPE TABS ═══ */}
      <div className="px-5 pt-4 pb-3 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {roomTypes.map((roomType) => {
            const isActive = activeRoomType === roomType;
            return (
              <button
                key={roomType}
                onClick={() => setActiveRoomType(roomType)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                  isActive
                    ? "bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-lg shadow-teal-500/30"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isActive ? "bg-white" : "bg-teal-500"
                  }`}
                />
                {roomType}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ ACTIVE ROOM TYPE INFO ═══ */}
      <div className="px-5 py-3 bg-gradient-to-r from-slate-900 to-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-base">{activeRoomType}</span>
          <span className="text-[10px] px-2 py-1 bg-white/20 text-white rounded-full font-bold uppercase tracking-wider">
            Base: {fmtFull(basePrices[activeRoomType] || 0)}
          </span>
        </div>
        <p className="text-slate-300 text-[10px] font-medium">
          {ratePlans.length} rate plans · 5 occupancies each
        </p>
      </div>

      {/* ═══ RATE PLANS (Collapsible) ═══ */}
      <div className="p-5 space-y-3">
        {ratePlans.map((plan) => {
          const isExpanded = expandedPlans.has(plan.id);

          // Get double occupancy price for preview
          const doublePrice =
            prices[activeRoomType]?.[plan.id]?.["double"]?.[dates[0]] || 0;

          return (
            <div
              key={plan.id}
              className={`border-2 rounded-2xl overflow-hidden transition-all ${
                isExpanded
                  ? "border-teal-300 shadow-lg shadow-teal-100"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              {/* Plan Header (Clickable) */}
              <button
                onClick={() => togglePlan(plan.id)}
                className={`w-full px-5 py-4 flex items-center justify-between transition-all ${
                  isExpanded
                    ? "bg-gradient-to-r from-teal-50 to-emerald-50"
                    : "bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-md transition-all ${
                      isExpanded
                        ? "bg-gradient-to-br from-teal-500 to-emerald-500 shadow-teal-500/30"
                        : "bg-gradient-to-br from-slate-700 to-slate-900"
                    }`}
                  >
                    {plan.code}
                  </span>
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-800">
                      {plan.name}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Double: {fmtFull(doublePrice)} · Click to view 5 occupancies
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                      isExpanded
                        ? "bg-teal-500 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {isExpanded ? "EXPANDED" : "VIEW RATES"}
                  </span>
                  <svg
                    className={`w-5 h-5 transition-transform ${
                      isExpanded ? "rotate-180 text-teal-600" : "text-slate-400"
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t-2 border-teal-200 bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-slate-900 text-white">
                          <th className="sticky left-0 z-20 bg-slate-900 text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider min-w-[150px]">
                            Occupancy
                          </th>
                          {dates.map((d) => {
                            const dateObj = new Date(d);
                            const isWeekend =
                              dateObj.getDay() === 0 || dateObj.getDay() === 6;
                            const isToday =
                              d === new Date().toISOString().split("T")[0];
                            return (
                              <th
                                key={d}
                                className={`text-center px-3 py-2 min-w-[85px] text-[10px] font-bold uppercase tracking-wider border-l border-slate-700 ${
                                  isToday
                                    ? "bg-rose-600"
                                    : isWeekend
                                    ? "bg-slate-800"
                                    : ""
                                }`}
                              >
                                <div>
                                  {dateObj.toLocaleDateString("en-IN", {
                                    weekday: "short",
                                  })}
                                </div>
                                <div className="text-[10px] text-white/80 font-semibold mt-0.5">
                                  {dateObj.getDate()}{" "}
                                  {dateObj.toLocaleDateString("en-IN", {
                                    month: "short",
                                  })}
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>

                      <tbody>
                        {OCCUPANCIES.map((occ) => {
                          const occColor = occColors[occ.key];
                          return (
                            <tr
                              key={occ.key}
                              className="hover:bg-slate-50/60 transition"
                            >
                              <td className="sticky left-0 bg-white px-4 py-2 border-b border-slate-100 min-w-[150px]">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">{occ.icon}</span>
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${occColor}`}
                                  >
                                    {occ.short}
                                  </span>
                                </div>
                              </td>

                              {dates.map((date) => {
                                const price =
                                  prices[activeRoomType]?.[plan.id]?.[
                                    occ.key
                                  ]?.[date] ?? 0;
                                const isEditing =
                                  editingCell?.roomType === activeRoomType &&
                                  editingCell?.planId === plan.id &&
                                  editingCell?.occupancy === occ.key &&
                                  editingCell?.date === date;

                                return (
                                  <td
                                    key={date}
                                    className="px-1 py-1.5 border-b border-l border-slate-100 text-center"
                                  >
                                    {isEditing ? (
                                      <input
                                        type="number"
                                        autoFocus
                                        value={editValue}
                                        onChange={(e) =>
                                          setEditValue(e.target.value)
                                        }
                                        onBlur={commitEdit}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") commitEdit();
                                          if (e.key === "Escape")
                                            setEditingCell(null);
                                        }}
                                        className="w-full text-center text-xs font-bold px-1 py-1 border-2 border-teal-500 rounded outline-none"
                                      />
                                    ) : (
                                      <button
                                        onClick={() =>
                                          startEdit(
                                            activeRoomType,
                                            plan.id,
                                            occ.key,
                                            date,
                                            price
                                          )
                                        }
                                        className="w-full text-center text-xs font-semibold text-slate-800 hover:bg-teal-50 hover:text-teal-700 py-1 rounded transition"
                                      >
                                        {fmtFull(price)}
                                      </button>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Legend for expanded */}
                  <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center gap-3 flex-wrap">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Legend:
                    </p>
                    {OCCUPANCIES.map((occ) => (
                      <div key={occ.key} className="flex items-center gap-1.5">
                        <span
                          className={`w-2.5 h-2.5 rounded-full border ${occColors[occ.key]}`}
                        />
                        <span className="text-[10px] font-medium text-slate-600">
                          {occ.short}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ═══ HELP FOOTER ═══ */}
      <div className="px-5 py-4 border-t border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center text-teal-700 text-sm shrink-0">
            💡
          </div>
          <div>
            <p className="text-xs font-bold text-slate-700">
              Pro Tips for Dynamic Pricing
            </p>
            <ul className="text-[10px] text-slate-500 mt-1 space-y-0.5">
              <li>• Click any rate plan above to expand and see all 5 occupancy tiers</li>
              <li>• Click individual cells to edit · Press Enter to save · Esc to cancel</li>
              <li>• Use Bulk Update for weekend surcharges or seasonal rates</li>
              <li>• Empty cells will auto-calculate from base price</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}