"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useActiveHotel } from "../lib/use-active-hotel";
import { useRateGrid } from "../lib/use-rate-grid";
import { useRateRules } from "../lib/use-rate-rules";
import RateCalendarGrid from "../components/RateCalendarGrid";
import RulesManager from "../components/RulesManager";
import RuleFormModal from "../components/RuleFormModal";
import {
  upsertRate,
  bulkUpsertRates,
  type OccupancyKey,
} from "../lib/rate-plans";
import {
  createRule,
  updateRule,
  deleteRule,
  toggleRule,
  type RateRule,
} from "../lib/rate-rules";

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
  const [activeTab, setActiveTab] = useState<"calendar" | "rules">("calendar");

  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(addDays(todayISO(), 14));
  const [toast, setToast] = useState<string | null>(null);

  const { grid, loading, error, refresh, setGrid } = useRateGrid(
    hotelId,
    startDate,
    endDate
  );

  const {
    rules,
    loading: rulesLoading,
    refresh: refreshRules,
  } = useRateRules(hotelId);

  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RateRule | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  // ═══ Rate cell edit ═══
  const handleCellEdit = async (
    roomType: string,
    ratePlanId: string,
    occupancy: OccupancyKey,
    date: string,
    newPrice: number
  ) => {
    if (!hotelId || !grid) return;
    const newPrices = JSON.parse(JSON.stringify(grid.prices));
    if (!newPrices[roomType]) newPrices[roomType] = {};
    if (!newPrices[roomType][ratePlanId]) newPrices[roomType][ratePlanId] = {};
    if (!newPrices[roomType][ratePlanId][occupancy])
      newPrices[roomType][ratePlanId][occupancy] = {};
    newPrices[roomType][ratePlanId][occupancy][date] = newPrice;
    setGrid({ ...grid, prices: newPrices });
    try {
      await upsertRate(hotelId, roomType, ratePlanId, occupancy, date, newPrice);
      showToast(`✅ Rate updated to ₹${newPrice}`);
    } catch (err) {
      console.error(err);
      showToast("⚠ Failed to update");
      refresh();
    }
  };

  // ═══ Bulk rate edit ═══
  const handleBulkEdit = async (
    roomType: string,
    ratePlanId: string,
    occupancy: OccupancyKey,
    dates: string[],
    newPrice: number
  ) => {
    if (!hotelId || !grid) return;
    const newPrices = JSON.parse(JSON.stringify(grid.prices));
    if (!newPrices[roomType]) newPrices[roomType] = {};
    if (!newPrices[roomType][ratePlanId]) newPrices[roomType][ratePlanId] = {};
    if (!newPrices[roomType][ratePlanId][occupancy])
      newPrices[roomType][ratePlanId][occupancy] = {};
    dates.forEach((d) => {
      newPrices[roomType][ratePlanId][occupancy][d] = newPrice;
    });
    setGrid({ ...grid, prices: newPrices });
    try {
      await bulkUpsertRates(hotelId, roomType, ratePlanId, occupancy, dates, newPrice);
      showToast(`✅ ${dates.length} dates updated`);
    } catch (err) {
      console.error(err);
      showToast("⚠ Bulk update failed");
      refresh();
    }
  };

  // ═══ Rule actions ═══
  const handleAddRule = () => {
    setEditingRule(null);
    setRuleModalOpen(true);
  };

  const handleEditRule = (rule: RateRule) => {
    setEditingRule(rule);
    setRuleModalOpen(true);
  };

  const handleSaveRule = async (
    ruleData: Omit<RateRule, "id" | "created_at" | "updated_at">
  ) => {
    try {
      if (editingRule) {
        await updateRule(editingRule.id, ruleData);
        showToast(`✅ Rule updated: ${ruleData.name}`);
      } else {
        await createRule(ruleData);
        showToast(`✅ Rule created: ${ruleData.name}`);
      }
      setRuleModalOpen(false);
      setEditingRule(null);
      await refreshRules();
    } catch (err) {
      console.error(err);
      showToast("⚠ Failed to save rule");
    }
  };

  const handleDeleteRule = async (rule: RateRule) => {
    if (!confirm(`Delete "${rule.name}"? This cannot be undone.`)) return;
    try {
      await deleteRule(rule.id);
      showToast(`🗑 Rule deleted: ${rule.name}`);
      await refreshRules();
    } catch (err) {
      console.error(err);
      showToast("⚠ Failed to delete");
    }
  };

  const handleToggleRule = async (rule: RateRule) => {
    try {
      await toggleRule(rule.id, !rule.is_active);
      showToast(
        `✓ Rule ${rule.is_active ? "deactivated" : "activated"}: ${rule.name}`
      );
      await refreshRules();
    } catch (err) {
      console.error(err);
      showToast("⚠ Failed to toggle");
    }
  };

  const applyPreset = (days: number) => {
    setStartDate(todayISO());
    setEndDate(addDays(todayISO(), days));
  };

  if (hotelLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full border-4 border-slate-200 border-t-teal-600 animate-spin" />
          <p className="text-slate-500 font-semibold text-sm">Loading...</p>
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
        {/* HERO */}
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
                  Per-person dynamic pricing · Auto-apply rules engine
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                refresh();
                refreshRules();
              }}
              className="flex items-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white rounded-xl text-sm font-semibold border border-white/10 transition shrink-0"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-1.5 mb-6 flex items-center gap-1">
          <button
            onClick={() => setActiveTab("calendar")}
            className={`flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition ${
              activeTab === "calendar"
                ? "bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-lg shadow-teal-500/30"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            📅 Rate Calendar
          </button>
          <button
            onClick={() => setActiveTab("rules")}
            className={`flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition ${
              activeTab === "rules"
                ? "bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-lg shadow-teal-500/30"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            🎯 Rules & Automation
            {rules.filter((r) => r.is_active).length > 0 && (
              <span className="text-[10px] px-2 py-0.5 bg-white/30 rounded-full">
                {rules.filter((r) => r.is_active).length}
              </span>
            )}
          </button>
        </div>

        {/* TAB CONTENT */}
        {activeTab === "calendar" && (
          <>
            {/* Filter bar */}
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
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-white hover:text-slate-900 transition"
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

            <RateCalendarGrid
              roomTypes={grid.roomTypes}
              ratePlans={grid.ratePlans}
              dates={grid.dates}
              prices={grid.prices}
              basePrices={grid.basePrices}
              onCellEdit={handleCellEdit}
              onBulkEdit={handleBulkEdit}
            />
          </>
        )}

        {activeTab === "rules" && (
          <RulesManager
            rules={rules}
            loading={rulesLoading}
            onEdit={handleEditRule}
            onDelete={handleDeleteRule}
            onToggle={handleToggleRule}
            onAdd={handleAddRule}
          />
        )}

        {/* FOOTER */}
        <div className="mt-6 bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 text-white">
          <div>
            <p className="text-sm font-bold">💡 Dynamic Pricing Engine</p>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Rules apply in priority order when a new booking is created. Weekend
              surcharges, seasonal multipliers, length-of-stay discounts, and
              occupancy-based pricing all work together automatically.
            </p>
          </div>
          <Link
            href="/inventory"
            className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition border border-white/10 shrink-0"
          >
            View Inventory →
          </Link>
        </div>
      </div>

      {ruleModalOpen && (
        <RuleFormModal
          hotelId={hotelId!}
          roomTypes={grid.roomTypes}
          ratePlans={grid.ratePlans}
          editingRule={editingRule}
          onClose={() => {
            setRuleModalOpen(false);
            setEditingRule(null);
          }}
          onSave={handleSaveRule}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl text-sm font-semibold z-[100] shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}