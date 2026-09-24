"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useActiveHotel } from "../lib/use-active-hotel";
import { useRateGrid } from "../lib/use-rate-grid";
import { useRateRules } from "../lib/use-rate-rules";
import RateCalendarGrid from "../components/RateCalendarGrid";
import RulesManager from "../components/RulesManager";
import RuleFormModal from "../components/RuleFormModal";
import RoomCard from "../components/RoomCard";
import AddRoomModal from "../components/AddRoomModal";
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
import {
  fetchInventory,
  createRoom,
  updateRoom,
  deleteRoom,
  bulkUpdateBasePrice,
  computeStats,
  computeRoomTypeSummary,
  getStatusColor,
  type InventoryRoom,
} from "../lib/inventory";

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

function fmtFull(n: number): string {
  return `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
}

type TabKey = "calendar" | "rules" | "inventory";

export default function RatesPage() {
  const { hotelId, loading: hotelLoading } = useActiveHotel();
  const [activeTab, setActiveTab] = useState<TabKey>("calendar");

  // ─── Rate Calendar state ───
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(addDays(todayISO(), 14));
  const [toast, setToast] = useState<string | null>(null);

  // ─── Inventory state ───
  const [rooms, setRooms] = useState<InventoryRoom[]>([]);
  const [invLoading, setInvLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<InventoryRoom | null>(null);
  const [bulkPriceModal, setBulkPriceModal] = useState<{ roomType: string; currentPrice: number } | null>(null);
  const [bulkPriceValue, setBulkPriceValue] = useState("");

  // ─── Rate grid + rules hooks ───
  const { grid, loading, error, refresh, setGrid } = useRateGrid(hotelId, startDate, endDate);
  const { rules, loading: rulesLoading, refresh: refreshRules } = useRateRules(hotelId);

  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RateRule | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  // ═══════════════════════════════════════════════
  // INVENTORY: Load
  // ═══════════════════════════════════════════════
  const loadInventory = useCallback(async () => {
    if (!hotelId) { setInvLoading(false); return; }
    try {
      setInvLoading(true);
      const data = await fetchInventory(hotelId);
      setRooms(data);
    } catch (err) {
      console.error(err);
      showToast("⚠ Failed to load inventory");
    } finally {
      setInvLoading(false);
    }
  }, [hotelId]);

  useEffect(() => {
    if (hotelLoading) return;
    loadInventory();
  }, [loadInventory, hotelLoading]);

  // ═══════════════════════════════════════════════
  // INVENTORY: Computed
  // ═══════════════════════════════════════════════
  const stats = useMemo(() => computeStats(rooms), [rooms]);
  const typeSummaries = useMemo(() => computeRoomTypeSummary(rooms), [rooms]);
  const roomTypesList = useMemo(() => typeSummaries.map((t) => t.type), [typeSummaries]);

  const filteredRooms = useMemo(() => {
    let result = rooms;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) => r.room_number.toLowerCase().includes(q) || r.room_type.toLowerCase().includes(q));
    }
    if (typeFilter !== "all") result = result.filter((r) => r.room_type === typeFilter);
    if (statusFilter !== "all") result = result.filter((r) => r.housekeeping_status === statusFilter);
    return result;
  }, [rooms, searchQuery, typeFilter, statusFilter]);

  // ═══════════════════════════════════════════════
  // INVENTORY: Handlers
  // ═══════════════════════════════════════════════
  const handleSaveRoom = async (data: { room_number: string; room_type: string; base_price: number }) => {
    if (!hotelId) return;
    try {
      if (editingRoom) {
        await updateRoom(editingRoom.id, data);
        showToast(`✅ Room ${data.room_number} updated`);
      } else {
        await createRoom({ hotel_id: hotelId, ...data });
        showToast(`✅ Room ${data.room_number} created`);
      }
      setAddModalOpen(false);
      setEditingRoom(null);
      await loadInventory();
      refresh();
    } catch (err: any) {
      console.error(err);
      showToast(`⚠ ${err?.message || "Failed to save"}`);
    }
  };

  const handleDeleteRoom = async (room: InventoryRoom) => {
    if (!confirm(`Delete Room ${room.room_number}? This will not delete bookings but will remove the room from inventory.`)) return;
    try {
      await deleteRoom(room.id);
      showToast(`🗑 Room ${room.room_number} deleted`);
      await loadInventory();
      refresh();
    } catch (err) {
      console.error(err);
      showToast("⚠ Failed to delete");
    }
  };

  const handleEditClick = (room: InventoryRoom) => { setEditingRoom(room); setAddModalOpen(true); };
  const handleAddClick = () => { setEditingRoom(null); setAddModalOpen(true); };

  const handleBulkPriceSave = async () => {
    if (!hotelId || !bulkPriceModal) return;
    const price = Number(bulkPriceValue);
    if (isNaN(price) || price < 0) { alert("Please enter a valid price"); return; }
    try {
      await bulkUpdateBasePrice(hotelId, bulkPriceModal.roomType, price);
      showToast(`✅ ${bulkPriceModal.roomType} base price → ₹${price}`);
      setBulkPriceModal(null);
      setBulkPriceValue("");
      await loadInventory();
      refresh();
    } catch (err) {
      console.error(err);
      showToast("⚠ Failed to update");
    }
  };

  // ═══════════════════════════════════════════════
  // RATE CALENDAR: Cell + Bulk Edit
  // ═══════════════════════════════════════════════
  const handleCellEdit = async (roomType: string, ratePlanId: string, occupancy: OccupancyKey, date: string, newPrice: number) => {
    if (!hotelId || !grid) return;
    const newPrices = JSON.parse(JSON.stringify(grid.prices));
    if (!newPrices[roomType]) newPrices[roomType] = {};
    if (!newPrices[roomType][ratePlanId]) newPrices[roomType][ratePlanId] = {};
    if (!newPrices[roomType][ratePlanId][occupancy]) newPrices[roomType][ratePlanId][occupancy] = {};
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

  const handleBulkEdit = async (roomType: string, ratePlanId: string, occupancy: OccupancyKey, dates: string[], newPrice: number) => {
    if (!hotelId || !grid) return;
    const newPrices = JSON.parse(JSON.stringify(grid.prices));
    if (!newPrices[roomType]) newPrices[roomType] = {};
    if (!newPrices[roomType][ratePlanId]) newPrices[roomType][ratePlanId] = {};
    if (!newPrices[roomType][ratePlanId][occupancy]) newPrices[roomType][ratePlanId][occupancy] = {};
    dates.forEach((d) => { newPrices[roomType][ratePlanId][occupancy][d] = newPrice; });
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

  // ═══════════════════════════════════════════════
  // RULES: Handlers
  // ═══════════════════════════════════════════════
  const handleAddRule = () => { setEditingRule(null); setRuleModalOpen(true); };
  const handleEditRule = (rule: RateRule) => { setEditingRule(rule); setRuleModalOpen(true); };

  const handleSaveRule = async (ruleData: Omit<RateRule, "id" | "created_at" | "updated_at">) => {
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
      showToast(`✓ Rule ${rule.is_active ? "deactivated" : "activated"}: ${rule.name}`);
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

  // ═══════════════════════════════════════════════
  // LOADING
  // ═══════════════════════════════════════════════
  if (hotelLoading || (loading && activeTab !== "inventory")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full border-4 border-slate-200 border-t-teal-600 animate-spin" />
          <p className="text-slate-500 font-semibold text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (activeTab !== "inventory" && (error || !grid)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-md p-8">
          <p className="text-5xl mb-4">⚠️</p>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Failed to load rates</h2>
          <p className="text-sm text-slate-500 mb-6">{error || "Unknown error"}</p>
          <button onClick={refresh} className="px-6 py-3 bg-teal-600 text-white rounded-xl text-sm font-semibold">Try Again</button>
        </div>
      </div>
    );
  }

  const activeRulesCount = rules.filter((r) => r.is_active).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-[1800px] mx-auto p-6 lg:p-8">

        {/* ═══ HERO ═══ */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 mb-6 shadow-xl">
          <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-teal-500/20 to-cyan-500/10 rounded-full blur-3xl -mr-24 -mt-24" />
          <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-2xl shadow-lg shadow-teal-500/30">
                🏷️
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Rate Plan & Inventory Management
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  Per-person dynamic pricing · Auto-apply rules · Room inventory
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {activeTab === "inventory" && (
                <button
                  onClick={handleAddClick}
                  className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-teal-500/30 transition shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Room
                </button>
              )}
              <button
                onClick={() => { refresh(); refreshRules(); loadInventory(); }}
                className="flex items-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white rounded-xl text-sm font-semibold border border-white/10 transition shrink-0"
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        </div>

        {/* ═══ TABS ═══ */}
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
            {activeRulesCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 bg-white/30 rounded-full">{activeRulesCount}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("inventory")}
            className={`flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition ${
              activeTab === "inventory"
                ? "bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-lg shadow-teal-500/30"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            🏨 Inventory
            {rooms.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 bg-white/30 rounded-full">{rooms.length}</span>
            )}
          </button>
        </div>

        {/* ═══════════════════════════════════════════ */}
        {/* TAB: RATE CALENDAR                          */}
        {/* ═══════════════════════════════════════════ */}
        {activeTab === "calendar" && (
          <>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 mb-6 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                {[
                  { k: "week", l: "7 Days", days: 6 },
                  { k: "15d", l: "15 Days", days: 14 },
                  { k: "month", l: "30 Days", days: 29 },
                ].map((opt) => (
                  <button key={opt.k} onClick={() => applyPreset(opt.days)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-white hover:text-slate-900 transition">
                    {opt.l}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent text-xs font-medium text-slate-700 outline-none w-[110px]" />
                <span className="text-slate-400 text-xs">→</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent text-xs font-medium text-slate-700 outline-none w-[110px]" />
              </div>
              <span className="text-xs text-slate-400 font-medium ml-auto">{grid?.dates.length || 0} days</span>
            </div>

            {grid && (
              <RateCalendarGrid
                roomTypes={grid.roomTypes}
                ratePlans={grid.ratePlans}
                dates={grid.dates}
                prices={grid.prices}
                basePrices={grid.basePrices}
                onCellEdit={handleCellEdit}
                onBulkEdit={handleBulkEdit}
              />
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* TAB: RULES & AUTOMATION                     */}
        {/* ═══════════════════════════════════════════ */}
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

        {/* ═══════════════════════════════════════════ */}
        {/* TAB: INVENTORY                              */}
        {/* ═══════════════════════════════════════════ */}
        {activeTab === "inventory" && (
          <>
            {invLoading ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-slate-200 border-t-teal-600 animate-spin" />
                <p className="text-sm text-slate-500 font-semibold">Loading inventory...</p>
              </div>
            ) : (
              <>
                {/* Inventory Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Rooms</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{stats.totalRooms}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{stats.totalRoomTypes} room types</p>
                  </div>
                  <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-4">
                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Clean</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.clean}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">ready to book</p>
                  </div>
                  <div className="bg-white rounded-2xl border border-rose-200 shadow-sm p-4">
                    <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Dirty</p>
                    <p className="text-2xl font-bold text-rose-600 mt-1">{stats.dirty}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">needs cleaning</p>
                  </div>
                  <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-4">
                    <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Maintenance</p>
                    <p className="text-2xl font-bold text-amber-600 mt-1">{stats.maintenance}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">out of service</p>
                  </div>
                </div>

                {/* Room Type Breakdown */}
                {typeSummaries.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-bold text-slate-700">Room Type Breakdown</h3>
                        <p className="text-[10px] text-slate-400">{typeSummaries.length} categories · Avg ₹{Math.round(stats.avgBasePrice).toLocaleString("en-IN")}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {typeSummaries.map((t) => (
                        <div key={t.type} className="p-4 bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200 hover:border-teal-300 transition group">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                              <span className="text-sm font-bold text-slate-800">{t.type}</span>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-900 text-white rounded-full">{t.count} rooms</span>
                          </div>

                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Base Price</span>
                            <span className="text-lg font-bold text-teal-700">{fmtFull(t.basePrice)}</span>
                          </div>

                          <div className="flex items-center gap-1 mb-3">
                            {t.clean > 0 && <div className="h-1.5 bg-emerald-500 rounded-full" style={{ flex: t.clean }} title={`${t.clean} Clean`} />}
                            {t.dirty > 0 && <div className="h-1.5 bg-rose-500 rounded-full" style={{ flex: t.dirty }} title={`${t.dirty} Dirty`} />}
                            {t.inspected > 0 && <div className="h-1.5 bg-sky-500 rounded-full" style={{ flex: t.inspected }} title={`${t.inspected} Inspected`} />}
                            {t.maintenance > 0 && <div className="h-1.5 bg-amber-500 rounded-full" style={{ flex: t.maintenance }} title={`${t.maintenance} Maintenance`} />}
                          </div>

                          <button
                            onClick={() => { setBulkPriceModal({ roomType: t.type, currentPrice: t.basePrice }); setBulkPriceValue(String(t.basePrice)); }}
                            className="w-full text-[10px] font-bold py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-700 transition"
                          >
                            ✏️ Edit Base Price
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Filter Bar */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 mb-6 flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[200px] max-w-md">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </span>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search room number or type..."
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 focus:border-teal-500 rounded-xl text-sm outline-none transition"
                    />
                  </div>

                  <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-teal-500">
                    <option value="all">All Types ({rooms.length})</option>
                    {typeSummaries.map((t) => (<option key={t.type} value={t.type}>{t.type} ({t.count})</option>))}
                  </select>

                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-teal-500">
                    <option value="all">All Status</option>
                    <option value="CLEAN">Clean ({stats.clean})</option>
                    <option value="DIRTY">Dirty ({stats.dirty})</option>
                    <option value="INSPECTED">Inspected ({stats.inspected})</option>
                    <option value="MAINTENANCE">Maintenance ({stats.maintenance})</option>
                  </select>

                  <div className="flex items-center gap-0.5 bg-slate-100 rounded-xl p-1 ml-auto">
                    <button onClick={() => setViewMode("grid")} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${viewMode === "grid" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>⊞ Grid</button>
                    <button onClick={() => setViewMode("table")} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${viewMode === "table" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>☰ Table</button>
                  </div>
                </div>

                {/* Content */}
                {filteredRooms.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-24 text-center">
                    <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-5">
                      <span className="text-4xl opacity-40">🏨</span>
                    </div>
                    <p className="text-lg font-bold text-slate-700">{rooms.length === 0 ? "No rooms yet" : "No matches"}</p>
                    <p className="text-sm text-slate-400 mt-2 mb-6">{rooms.length === 0 ? "Add your first room to get started" : "Try changing filters"}</p>
                    {rooms.length === 0 && (
                      <button onClick={handleAddClick} className="px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-teal-500/30">
                        + Add First Room
                      </button>
                    )}
                  </div>
                ) : viewMode === "grid" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filteredRooms.map((room) => (
                      <RoomCard key={room.id} room={room} onEdit={handleEditClick} onDelete={handleDeleteRoom} onRefresh={loadInventory} />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-900 text-white">
                          <tr>
                            <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider">Room #</th>
                            <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider">Type</th>
                            <th className="text-right px-5 py-3 text-[10px] font-bold uppercase tracking-wider">Base Price</th>
                            <th className="text-center px-5 py-3 text-[10px] font-bold uppercase tracking-wider">Status</th>
                            <th className="text-right px-5 py-3 text-[10px] font-bold uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredRooms.map((room) => {
                            const sc = getStatusColor(room.housekeeping_status);
                            return (
                              <tr key={room.id} className="hover:bg-slate-50 transition">
                                <td className="px-5 py-3 text-sm font-bold text-slate-800">{room.room_number}</td>
                                <td className="px-5 py-3 text-sm text-slate-600">{room.room_type}</td>
                                <td className="px-5 py-3 text-right text-sm font-bold text-slate-800">{fmtFull(room.base_price)}</td>
                                <td className="px-5 py-3 text-center">
                                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full ${sc.bg} ${sc.text} border ${sc.border}`}>
                                    <span className={`w-1 h-1 rounded-full ${sc.dot}`} />
                                    {room.housekeeping_status}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <button onClick={() => handleEditClick(room)} className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition">✏️</button>
                                    <button onClick={() => handleDeleteRoom(room)} className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition">🗑</button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ═══ FOOTER ═══ */}
        <div className="mt-6 bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 text-white">
          <div>
            <p className="text-sm font-bold">💡 Unified Pricing + Inventory</p>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Base prices set in Inventory automatically generate 5 occupancy tiers in the Rate Calendar. Rules apply in priority order for weekend surcharges, seasonal multipliers, and length-of-stay discounts.
            </p>
          </div>
          <button
            onClick={() => setActiveTab(activeTab === "inventory" ? "calendar" : "inventory")}
            className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition border border-white/10 shrink-0"
          >
            {activeTab === "inventory" ? "View Rate Calendar →" : "View Inventory →"}
          </button>
        </div>
      </div>

      {/* ═══ MODALS ═══ */}
      {ruleModalOpen && grid && (
        <RuleFormModal
          hotelId={hotelId!}
          roomTypes={grid.roomTypes}
          ratePlans={grid.ratePlans}
          editingRule={editingRule}
          onClose={() => { setRuleModalOpen(false); setEditingRule(null); }}
          onSave={handleSaveRule}
        />
      )}

      {addModalOpen && hotelId && (
        <AddRoomModal
          hotelId={hotelId}
          existingRoomTypes={roomTypesList}
          editingRoom={editingRoom}
          onClose={() => { setAddModalOpen(false); setEditingRoom(null); }}
          onSave={handleSaveRoom}
        />
      )}

      {bulkPriceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-teal-500 to-emerald-500 px-6 py-4 flex items-center justify-between text-white">
              <div>
                <h3 className="text-lg font-bold">Update Base Price</h3>
                <p className="text-xs text-white/80 mt-0.5">{bulkPriceModal.roomType}</p>
              </div>
              <button onClick={() => setBulkPriceModal(null)} className="text-3xl hover:opacity-80">×</button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">New Base Price (₹)</label>
                <input
                  type="number"
                  value={bulkPriceValue}
                  onChange={(e) => setBulkPriceValue(e.target.value)}
                  autoFocus
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-lg font-bold outline-none focus:border-teal-500"
                />
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Occupancy tiers will auto-recalculate:</p>
                <div className="grid grid-cols-5 gap-1.5 text-center">
                  {[
                    { label: "1A", pct: 85 },
                    { label: "2A", pct: 100 },
                    { label: "Extra", pct: 35 },
                    { label: "C7-12", pct: 25 },
                    { label: "C0-6", pct: 15 },
                  ].map((o) => (
                    <div key={o.label} className="bg-white rounded-md py-1.5">
                      <p className="text-[9px] font-bold text-slate-400">{o.label}</p>
                      <p className="text-xs font-bold text-teal-700">₹{Math.round(((Number(bulkPriceValue) || 0) * o.pct) / 100)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setBulkPriceModal(null)} className="px-5 py-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-600 hover:bg-white">Cancel</button>
              <button onClick={handleBulkPriceSave} disabled={!bulkPriceValue} className="px-6 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-teal-500/30 disabled:opacity-50">Update All</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl text-sm font-semibold z-[100] shadow-2xl">{toast}</div>
      )}
    </div>
  );
}