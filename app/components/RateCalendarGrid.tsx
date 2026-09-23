"use client";

import React, { useState } from "react";

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
  prices: Record<string, Record<string, Record<string, number>>>;
  basePrices: Record<string, number>;
  onCellEdit: (
    roomType: string,
    ratePlanId: string,
    date: string,
    newPrice: number
  ) => void;
  onBulkEdit: (
    roomType: string,
    ratePlanId: string,
    dates: string[],
    newPrice: number
  ) => void;
}) {
  const [editingCell, setEditingCell] = useState<{
    roomType: string;
    planId: string;
    date: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");

  // Bulk edit state
  const [bulkRoomType, setBulkRoomType] = useState(roomTypes[0] || "");
  const [bulkPlanId, setBulkPlanId] = useState(ratePlans[0]?.id || "");
  const [bulkStart, setBulkStart] = useState(dates[0] || "");
  const [bulkEnd, setBulkEnd] = useState(dates[dates.length - 1] || "");
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);

  const startEdit = (roomType: string, planId: string, date: string, current: number) => {
    setEditingCell({ roomType, planId, date });
    setEditValue(String(current));
  };

  const commitEdit = () => {
    if (!editingCell) return;
    const num = Number(editValue);
    if (isNaN(num) || num < 0) {
      setEditingCell(null);
      return;
    }
    onCellEdit(editingCell.roomType, editingCell.planId, editingCell.date, num);
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

    if (
      !confirm(
        `Update ${affectedDates.length} dates for "${bulkRoomType}" (${ratePlans.find((p) => p.id === bulkPlanId)?.code || ""}) to ₹${price}?`
      )
    ) {
      return;
    }

    onBulkEdit(bulkRoomType, bulkPlanId, affectedDates, price);
    setBulkOpen(false);
    setBulkPrice("");
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* ═══ Bulk Edit Bar ═══ */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚡</span>
          <div>
            <h3 className="text-sm font-bold text-slate-700">Rate Calendar</h3>
            <p className="text-[10px] text-slate-400">
              Click any cell to edit, or use bulk update below
            </p>
          </div>
        </div>

        <button
          onClick={() => setBulkOpen(!bulkOpen)}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm"
        >
          ⚡ Bulk Update
        </button>
      </div>

      {/* ═══ Bulk Update Panel ═══ */}
      {bulkOpen && (
        <div className="p-5 bg-gradient-to-br from-amber-50 to-orange-50 border-b-2 border-amber-200">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
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
                From Date
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
                To Date
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
                New Price (₹)
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

      {/* ═══ Rate Grid ═══ */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="sticky left-0 z-20 bg-slate-900 text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider min-w-[180px]">
                Room Type / Rate Plan
              </th>
              {dates.map((d) => {
                const dateObj = new Date(d);
                const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                const isToday = d === new Date().toISOString().split("T")[0];
                return (
                  <th
                    key={d}
                    className={`text-center px-3 py-2 min-w-[90px] text-[10px] font-bold uppercase tracking-wider border-l border-slate-700 ${
                      isToday ? "bg-rose-600" : isWeekend ? "bg-slate-800" : ""
                    }`}
                  >
                    <div>{dateObj.toLocaleDateString("en-IN", { weekday: "short" })}</div>
                    <div className="text-xs text-white/80 font-semibold mt-0.5">
                      {dateObj.getDate()}{" "}
                      {dateObj.toLocaleDateString("en-IN", { month: "short" })}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {roomTypes.map((roomType) => (
              <React.Fragment key={roomType}>
                {/* Room Type Header Row */}
                <tr className="bg-slate-100">
                  <td
                    colSpan={dates.length + 1}
                    className="sticky left-0 px-4 py-2 border-b-2 border-slate-300"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-teal-500" />
                      <span className="text-sm font-bold text-slate-800">
                        {roomType}
                      </span>
                      <span className="text-[10px] text-slate-500 ml-2">
                        Base: {fmtFull(basePrices[roomType] || 0)}
                      </span>
                    </div>
                  </td>
                </tr>

                {/* Rate Plan Rows */}
                {ratePlans.map((plan) => (
                  <tr
                    key={`${roomType}-${plan.id}`}
                    className="hover:bg-slate-50 transition"
                  >
                    <td className="sticky left-0 bg-white px-4 py-2.5 border-b border-slate-100 min-w-[180px]">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-900 text-white rounded">
                          {plan.code}
                        </span>
                        <span className="text-xs text-slate-600 truncate max-w-[120px]">
                          {plan.name}
                        </span>
                      </div>
                    </td>

                    {dates.map((date) => {
                      const price =
                        prices[roomType]?.[plan.id]?.[date] ??
                        basePrices[roomType] ??
                        0;
                      const isEditing =
                        editingCell?.roomType === roomType &&
                        editingCell?.planId === plan.id &&
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
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={commitEdit}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitEdit();
                                if (e.key === "Escape") setEditingCell(null);
                              }}
                              className="w-full text-center text-xs font-bold px-1 py-1 border-2 border-teal-500 rounded outline-none"
                            />
                          ) : (
                            <button
                              onClick={() =>
                                startEdit(roomType, plan.id, date, price)
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
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}