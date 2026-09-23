"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useActiveHotel } from "../lib/use-active-hotel";
import { useRateGrid } from "../lib/use-rate-grid";
import RateCalendarGrid from "../components/RateCalendarGrid";
import { upsertRate, bulkUpsertRates } from "../lib/rate-plans";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function RatesPage() {
  const { hotelId, loading: hotelLoading } = useActiveHotel();
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(addDays(todayISO(), 14));
  const [toast, setToast] = useState<string | null>(null);

  const { grid, loading, error, refresh, setGrid } = useRateGrid(
    hotelId,
    startDate,
    endDate
  );

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  // ═══ Single cell edit ═══
  const handleCellEdit = async (
    roomType: string,
    ratePlanId: string,
    date: string,
    newPrice: number
  ) => {
    if (!hotelId || !grid) return;

    // Optimistic update
    const newPrices = { ...grid.prices };
    if (!newPrices[roomType]) newPrices[roomType] = {};
    if (!newPrices[roomType][ratePlanId]) newPrices[roomType][ratePlanId] = {};
    newPrices[roomType][ratePlanId][date] = newPrice;
    setGrid({ ...grid, prices: newPrices });

    try {
      await upsertRate(hotelId, roomType, ratePlanId, date, newPrice);
      showToast(`✅ Rate updated to ₹${newPrice}`);
    } catch (err) {
      console.error(err);
      showToast("⚠ Failed to update rate");
      refresh();
    }
  };

  // ═══ Bulk edit ═══
  const handleBulkEdit = async (
    roomType: string,
    ratePlanId: string,
    dates: string[],
    newPrice: number
  ) => {
    if (!hotelId || !grid) return;

    // Optimistic update
    const newPrices = { ...grid.prices };
    if (!newPrices[roomType]) newPrices[roomType] = {};
    if (!newPrices[roomType][ratePlanId]) newPrices[roomType][ratePlanId] = {};
    dates.forEach((d) => {
      newPrices[roomType][ratePlanId][d] = newPrice;
    });
    setGrid({ ...grid, prices: newPrices });

    try {
      await bulkUpsertRates(hotelId, roomType, ratePlanId, dates, newPrice);
      showToast(`✅ ${dates.length} dates updated`);
    } catch (err) {
      console.error(err);
      showToast("⚠ Bulk update failed");
      refresh();
    }
  };

  // ═══ Date presets ═══
  const applyPreset = (days: number) => {
    setStartDate(todayISO());
    setEndDate(addDays(todayISO(), days));
  };

  if (hotelLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full border-4 border-slate-200 border-t-teal-600 animate-spin" />
          <p className="text-slate-500 font-semibold text-sm">
            Loading rates...
          </p>
        </div>
      </div>
    );
  }

  if (error || !grid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-md p-8">
          <p className="text-5xl mb-4">⚠️</p>
          <h2 className="text-xl font-bold text-slate-800 mb-2">
            Failed to load rates
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            {error || "Unknown error"}
          </p>
          <button
            onClick={refresh}
            className="px-6 py-3 bg-teal-600 text-white rounded-xl text-sm font-semibold"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-[1800px] mx-auto p-6 lg:p-8">

        {/* ═══ HERO HEADER ═══ */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 mb-6 shadow-xl">
          <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-teal-500/20 to-cyan-500/10 rounded-full blur-3xl -mr-24 -mt-24" />
          <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-2xl shadow-lg shadow-teal-500/30">
                🏷️
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Rate Plan Management
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  Dynamic pricing for {grid.roomTypes.length} room types · {grid.ratePlans.length} plans
                </p>
              </div>
            </div>
            <button
              onClick={refresh}
              className="flex items-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white rounded-xl text-sm font-semibold border border-white/10 transition shrink-0"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* ═══ FILTER BAR ═══ */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 mb-6 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
            {[
              { k: "week", l: "7 Days", days: 6 },
              { k: "15d", l: "15 Days", days: 14 },
              { k: "month", l: "30 Days", days: 29 },
            ].map((opt) => (
              <button
                key={opt.k}
                onClick={() => applyPreset(opt.days)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition text-slate-600 hover:bg-white hover:text-slate-900"
              >
                {opt.l}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-700 outline-none w-[110px]"
            />
            <span className="text-slate-400 text-xs">→</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-700 outline-none w-[110px]"
            />
          </div>
          <span className="text-xs text-slate-400 font-medium ml-auto">
            {grid.dates.length} days
          </span>
        </div>

        {/* ═══ RATE CALENDAR GRID ═══ */}
        <RateCalendarGrid
          roomTypes={grid.roomTypes}
          ratePlans={grid.ratePlans}
          dates={grid.dates}
          prices={grid.prices}
          basePrices={grid.basePrices}
          onCellEdit={handleCellEdit}
          onBulkEdit={handleBulkEdit}
        />

        {/* ═══ FOOTER ═══ */}
        <div className="mt-6 bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 text-white">
          <div>
            <p className="text-sm font-bold">💡 Pro Tip</p>
            <p className="text-xs text-slate-400 mt-1">
              Use Bulk Update for weekend surcharges or seasonal pricing. Click any cell to
              edit individual dates.
            </p>
          </div>
          <Link
            href="/inventory"
            className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition border border-white/10"
          >
            View Inventory →
          </Link>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl text-sm font-semibold z-[100] shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}