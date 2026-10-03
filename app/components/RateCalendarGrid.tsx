"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import type { OccupancyKey } from "../lib/use-rate-grid";

type Props = {
  roomTypes: string[];
  ratePlans: any[];
  dates: string[];
  prices: Record<string, Record<string, Record<OccupancyKey, Record<string, number>>>>;
  basePrices: Record<string, number>;
  onCellEdit: (roomType: string, ratePlanCode: string, occupancy: OccupancyKey, date: string, newPrice: number) => void;
  onBulkEdit: (roomType: string, ratePlanCode: string, occupancy: OccupancyKey, dates: string[], newPrice: number) => void;
};

const OCCUPANCIES: { key: OccupancyKey; label: string; shortLabel: string; icon: string }[] = [
  { key: "1A", label: "Single Occupancy", shortLabel: "1A", icon: "👤" },
  { key: "2A", label: "Double Occupancy", shortLabel: "2A", icon: "👥" },
  { key: "EA", label: "Extra Adult", shortLabel: "EA", icon: "➕" },
  { key: "C7-12", label: "Child (7-12 yrs)", shortLabel: "C7-12", icon: "🧒" },
  { key: "C0-6", label: "Child (0-6 yrs)", shortLabel: "C0-6", icon: "👶" },
];

const CODE_COLORS: Record<string, string> = {
  EP: "bg-slate-900 text-white",
  CP: "bg-blue-600 text-white",
  MAP: "bg-amber-600 text-white",
  AP: "bg-emerald-600 text-white",
};

function formatDate(dateStr: string): { day: string; date: string; month: string; isWeekend: boolean } {
  const d = new Date(dateStr);
  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dayOfWeek = d.getDay();
  return {
    day: days[dayOfWeek],
    date: String(d.getDate()),
    month: months[d.getMonth()],
    isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
  };
}

function fmtINR(n: number): string {
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
}: Props) {
  const [selectedRoomType, setSelectedRoomType] = useState<string>(roomTypes[0] || "");
  const [editingCell, setEditingCell] = useState<{ roomType: string; planCode: string; occupancy: OccupancyKey; date: string } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [expandedPlans, setExpandedPlans] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  // ✅ DEDUPLICATE rate plans by code for the selected room type
  const uniquePlansForRoom = useMemo(() => {
    if (!selectedRoomType) return [];

    const seenCodes = new Set<string>();
    const uniquePlans: any[] = [];

    ratePlans.forEach((rp: any) => {
      if (rp.room_type !== selectedRoomType) return;
      if (seenCodes.has(rp.code)) return;
      seenCodes.add(rp.code);
      uniquePlans.push(rp);
    });

    // ✅ Sort by code priority: EP, CP, MAP, AP
    const priority: Record<string, number> = { EP: 1, CP: 2, MAP: 3, AP: 4 };
    uniquePlans.sort((a, b) => {
      const pa = priority[a.code] || 99;
      const pb = priority[b.code] || 99;
      if (pa !== pb) return pa - pb;
      return a.code.localeCompare(b.code);
    });

    return uniquePlans;
  }, [ratePlans, selectedRoomType]);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  const handleCellClick = (
    roomType: string,
    planCode: string,
    occupancy: OccupancyKey,
    date: string
  ) => {
    const currentPrice = prices[roomType]?.[planCode]?.[occupancy]?.[date] ?? 0;
    setEditingCell({ roomType, planCode, occupancy, date });
    setEditValue(String(currentPrice));
  };

  const handleCellSave = () => {
    if (!editingCell) return;
    const newPrice = Number(editValue);
    if (!isNaN(newPrice) && newPrice >= 0) {
      onCellEdit(
        editingCell.roomType,
        editingCell.planCode,
        editingCell.occupancy,
        editingCell.date,
        newPrice
      );
    }
    setEditingCell(null);
    setEditValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleCellSave();
    } else if (e.key === "Escape") {
      setEditingCell(null);
      setEditValue("");
    }
  };

  const togglePlan = (planCode: string) => {
    setExpandedPlans((prev) => ({
      ...prev,
      [planCode]: !prev[planCode],
    }));
  };

  const getPrice = (roomType: string, planCode: string, occupancy: OccupancyKey, date: string): number => {
    return prices[roomType]?.[planCode]?.[occupancy]?.[date] ?? 0;
  };

  const isToday = (dateStr: string): boolean => {
    const today = new Date().toISOString().slice(0, 10);
    return dateStr === today;
  };

  if (!selectedRoomType || uniquePlansForRoom.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
        <p className="text-5xl mb-4 opacity-40">🏨</p>
        <p className="font-semibold text-slate-600">No room types yet</p>
        <p className="text-xs text-slate-400 mt-1">Add room types from Property Settings</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* ✅ Room Type Tabs */}
      <div className="border-b border-slate-200 bg-slate-50 p-3 flex gap-2 overflow-x-auto">
        {roomTypes.map((rt) => (
          <button
            key={rt}
            onClick={() => setSelectedRoomType(rt)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              selectedRoomType === rt
                ? "bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-md"
                : "bg-white border border-slate-200 text-slate-600 hover:border-teal-300 hover:text-teal-700"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${selectedRoomType === rt ? "bg-white" : "bg-teal-500"}`} />
            {rt}
          </button>
        ))}
      </div>

      {/* ✅ Selected Room Type Header */}
      <div className="px-5 py-4 bg-gradient-to-r from-slate-900 to-slate-800 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white">{selectedRoomType}</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {uniquePlansForRoom.length} rate plan{uniquePlansForRoom.length !== 1 ? "s" : ""} ·{" "}
            {dates.length} day{dates.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Base:</span>
          <span className="text-sm font-bold text-teal-400">{fmtINR(basePrices[selectedRoomType] || 0)}</span>
        </div>
      </div>

      {/* ✅ Rate Plans List */}
      <div className="divide-y divide-slate-100">
        {uniquePlansForRoom.map((plan: any) => {
          const isExpanded = expandedPlans[plan.code] !== false; // default expanded
          const colorClass = CODE_COLORS[plan.code] || "bg-slate-700 text-white";

          return (
            <div key={`${plan.room_type}-${plan.code}`} className="bg-white">
              {/* Plan Header */}
              <div className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-[10px] font-bold ${colorClass}`}>
                    {plan.code}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{plan.name}</p>
                    <p className="text-[10px] text-slate-500">
                      Double: {fmtINR(plan.price_2a)} · Click to view 5 occupancies
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => togglePlan(plan.code)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition flex items-center gap-1"
                >
                  {isExpanded ? "▲ Hide" : "▼ View Rates"}
                </button>
              </div>

              {/* Expanded Rate Grid */}
              {isExpanded && (
                <div className="overflow-x-auto border-t border-slate-100 bg-slate-50/50">
                  <table className="w-full min-w-max">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200">
                        <th className="sticky left-0 z-10 bg-slate-100 text-left px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[140px]">
                          Occupancy
                        </th>
                        {dates.map((d) => {
                          const f = formatDate(d);
                          const today = isToday(d);
                          return (
                            <th
                              key={d}
                              className={`px-2 py-2 text-center min-w-[90px] border-l border-slate-200 ${
                                today ? "bg-rose-50" : f.isWeekend ? "bg-amber-50/50" : ""
                              }`}
                            >
                              <div className={`text-[9px] font-bold tracking-widest ${today ? "text-rose-500" : "text-slate-400"}`}>
                                {f.day}
                              </div>
                              <div className={`text-sm font-bold ${today ? "text-rose-700" : "text-slate-800"}`}>
                                {f.date}
                              </div>
                              <div className={`text-[9px] uppercase tracking-wider ${today ? "text-rose-400" : "text-slate-400"}`}>
                                {f.month}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {OCCUPANCIES.map((occ) => (
                        <tr key={occ.key} className="hover:bg-white transition">
                          <td className="sticky left-0 z-10 bg-white px-4 py-2 border-r border-slate-200">
                            <div className="flex items-center gap-2">
                              <span className="text-base">{occ.icon}</span>
                              <div>
                                <p className="text-xs font-bold text-slate-700">{occ.shortLabel}</p>
                                <p className="text-[9px] text-slate-400">{occ.label}</p>
                              </div>
                            </div>
                          </td>
                          {dates.map((d) => {
                            const price = getPrice(selectedRoomType, plan.code, occ.key, d);
                            const isEditing =
                              editingCell?.roomType === selectedRoomType &&
                              editingCell?.planCode === plan.code &&
                              editingCell?.occupancy === occ.key &&
                              editingCell?.date === d;

                            return (
                              <td
                                key={`${plan.code}-${occ.key}-${d}`}
                                className={`border-l border-slate-100 text-center py-1.5 px-1 cursor-pointer transition ${
                                  isEditing ? "bg-teal-50" : "hover:bg-teal-50/50"
                                }`}
                                onClick={() => !isEditing && handleCellClick(selectedRoomType, plan.code, occ.key, d)}
                              >
                                {isEditing ? (
                                  <input
                                    ref={inputRef}
                                    type="number"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={handleCellSave}
                                    onKeyDown={handleKeyDown}
                                    className="w-[80px] px-2 py-1 text-xs font-bold text-center border-2 border-teal-500 rounded outline-none bg-white"
                                  />
                                ) : (
                                  <span className={`text-xs font-semibold ${price > 0 ? "text-slate-800" : "text-slate-300"}`}>
                                    {price > 0 ? `₹${price.toLocaleString("en-IN")}` : "—"}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 flex items-center justify-between">
        <span>💡 Click any cell to edit price</span>
        <span>{uniquePlansForRoom.length} plans × {OCCUPANCIES.length} occupancies × {dates.length} dates</span>
      </div>
    </div>
  );
}
