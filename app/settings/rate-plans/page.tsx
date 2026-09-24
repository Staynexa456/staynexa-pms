"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useActiveHotel } from "../../lib/use-active-hotel";
import {
  fetchRatePlanSettings,
  upsertRatePlanSetting,
  deleteRatePlanSetting,
  defaultRatePlans,
  type RatePlanSetting,
} from "../../lib/rate-plan-settings";
import { fetchInventory } from "../../lib/inventory";
import SettingsLayout, {
  SettingCard,
  SettingRow,
  Toggle,
  Input,
  TextArea,
  Select,
} from "../../components/settings/SettingsLayout";

export default function RatePlansPage() {
  const { hotelId, loading: hotelLoading } = useActiveHotel();
  const [plans, setPlans] = useState<RatePlanSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<RatePlanSetting | null>(null);
  const [roomTypes, setRoomTypes] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  const load = useCallback(async () => {
    if (!hotelId) { setLoading(false); return; }
    try {
      setLoading(true);
      const [plansData, inventory] = await Promise.all([
        fetchRatePlanSettings(hotelId),
        fetchInventory(hotelId),
      ]);

      let finalPlans = plansData;
      // Seed defaults if no plans exist
      if (plansData.length === 0) {
        const defaults = defaultRatePlans(hotelId);
        for (const p of defaults) {
          await upsertRatePlanSetting(hotelId, p);
        }
        finalPlans = await fetchRatePlanSettings(hotelId);
      }

      setPlans(finalPlans);
      setRoomTypes(Array.from(new Set(inventory.map((r) => r.room_type))));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [hotelId]);

  useEffect(() => {
    if (hotelLoading) return;
    load();
  }, [load, hotelLoading]);

  const handleSave = async (data: RatePlanSetting) => {
    if (!hotelId) return;
    try {
      await upsertRatePlanSetting(hotelId, data);
      showToast(`✅ ${data.name} saved`);
      setEditing(null);
      await load();
    } catch (err: any) {
      showToast(`⚠ ${err?.message || "Failed to save"}`);
    }
  };

  const handleDelete = async (code: string) => {
    if (!hotelId) return;
    if (!confirm(`Delete rate plan "${code}"? This cannot be undone.`)) return;
    try {
      await deleteRatePlanSetting(hotelId, code);
      showToast(`🗑 Deleted ${code}`);
      await load();
    } catch (err: any) {
      showToast(`⚠ ${err?.message || "Failed to delete"}`);
    }
  };

  const handleAddNew = () => {
    setEditing({
      hotel_id: hotelId || "",
      code: "",
      name: "",
      display_name: "",
      description: "",
      rate_difference: 0,
      min_length_of_stay: 1,
      pay_at_property: false,
      policy_name: "Cancellation Policy",
      hide_on_booking_engine: false,
      hard_dependency: false,
      applicable_room_types: [],
      is_active: true,
      display_order: plans.length,
    });
  };

  if (hotelLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-14 h-14 rounded-full border-4 border-slate-200 border-t-teal-600 animate-spin" />
      </div>
    );
  }

  return (
    <SettingsLayout
      title="Rate Plans"
      subtitle="Configure EP, CP, MAP, AP rate plans"
      icon="🏷️"
    >
      {/* Header Actions */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={handleAddNew}
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-sm transition flex items-center gap-2"
        >
          <span className="text-base">+</span> Add new rate plan
        </button>
        <button
          disabled
          className="px-4 py-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl text-sm font-bold transition flex items-center gap-2 cursor-not-allowed opacity-60"
          title="Coming soon"
        >
          <span className="text-base">↕</span> Reorder rate plan
        </button>
      </div>

      {/* Info banner */}
      <div className="mb-6 p-4 bg-teal-50 border border-teal-200 rounded-2xl flex items-start gap-3">
        <span className="text-xl">💡</span>
        <div>
          <p className="text-sm font-bold text-teal-800">About rate plans</p>
          <p className="text-xs text-teal-700 mt-0.5 leading-relaxed">
            Create or edit rate plans. The <strong>rate difference</strong> indicates how much higher/lower the plan rate will be compared to the base tariff of the room type.
          </p>
        </div>
      </div>

      {/* Rate plan cards */}
      <div className="space-y-4">
        {plans.length === 0 && (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
            <p className="text-5xl mb-3">🏷️</p>
            <p className="font-bold text-slate-700">No rate plans yet</p>
            <p className="text-sm text-slate-500 mt-1">Click "Add new rate plan" to get started</p>
          </div>
        )}

        {plans.map((plan) => (
          <div
            key={plan.id || plan.code}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white text-xs font-bold shadow-md">
                  {plan.display_name || plan.code}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{plan.name}</h3>
                  {plan.description && (
                    <p className="text-[11px] text-slate-500">{plan.description}</p>
                  )}
                </div>
                {!plan.is_active && (
                  <span className="text-[10px] font-bold px-2 py-1 bg-slate-200 text-slate-600 rounded-full uppercase">
                    Inactive
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEditing(plan)}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-teal-100 text-slate-600 hover:text-teal-700 flex items-center justify-center transition"
                  title="Edit"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleDelete(plan.code)}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 flex items-center justify-center transition"
                  title="Delete"
                >
                  🗑
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Rate Difference
                </p>
                <p className="text-sm font-bold text-slate-800">
                  {plan.rate_difference >= 0 ? "+" : ""}
                  {plan.rate_difference.toFixed(1)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Min Length of Stay
                </p>
                <p className="text-sm font-bold text-slate-800">{plan.min_length_of_stay} night{plan.min_length_of_stay > 1 ? "s" : ""}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Pay at Property
                </p>
                <p className="text-sm font-bold text-slate-800">{plan.pay_at_property ? "ON" : "OFF"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Policy
                </p>
                <p className="text-sm font-bold text-slate-800 truncate">{plan.policy_name || "—"}</p>
              </div>

              <div className="md:col-span-2 lg:col-span-4 pt-3 border-t border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Applicable Room Types ({plan.applicable_room_types.length || "All"})
                </p>
                <p className="text-xs text-slate-600 truncate">
                  {plan.applicable_room_types.length === 0
                    ? "All room types"
                    : plan.applicable_room_types.join(", ")}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editing && (
        <RatePlanModal
          initial={editing}
          roomTypes={roomTypes}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl text-sm font-semibold z-[100] shadow-2xl">
          {toast}
        </div>
      )}
    </SettingsLayout>
  );
}

// ═══════════════════════════════════════════════
// MODAL
// ═══════════════════════════════════════════════

function RatePlanModal({
  initial,
  roomTypes,
  onClose,
  onSave,
}: {
  initial: RatePlanSetting;
  roomTypes: string[];
  onClose: () => void;
  onSave: (data: RatePlanSetting) => Promise<void>;
}) {
  const [data, setData] = useState<RatePlanSetting>(initial);
  const [saving, setSaving] = useState(false);

  const update = (patch: Partial<RatePlanSetting>) => {
    setData((prev) => ({ ...prev, ...patch }));
  };

  const toggleRoomType = (type: string) => {
    const current = data.applicable_room_types || [];
    const next = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    update({ applicable_room_types: next });
  };

  const handleSave = async () => {
    if (!data.code.trim()) {
      alert("Rate plan code required (e.g., EP, CP)");
      return;
    }
    if (!data.name.trim()) {
      alert("Rate plan name required");
      return;
    }
    setSaving(true);
    try {
      await onSave(data);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-slate-900 to-slate-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-xl">
              🏷️
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">
                {initial.id ? "Edit Rate Plan" : "New Rate Plan"}
              </h3>
              <p className="text-slate-300 text-xs mt-0.5">
                {initial.id ? `Editing ${initial.code}` : "Create a new rate plan"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white text-3xl leading-none">
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Code + Display Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Code *
              </label>
              <input
                type="text"
                value={data.code}
                onChange={(e) => update({ code: e.target.value.toUpperCase() })}
                placeholder="e.g., EP"
                maxLength={10}
                disabled={!!initial.id}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500 font-bold disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Display Name
              </label>
              <input
                type="text"
                value={data.display_name || ""}
                onChange={(e) => update({ display_name: e.target.value })}
                placeholder="e.g., EP"
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500"
              />
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Name *
            </label>
            <input
              type="text"
              value={data.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="e.g., European Plan (Room Only)"
              className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Description
            </label>
            <input
              type="text"
              value={data.description || ""}
              onChange={(e) => update({ description: e.target.value })}
              placeholder="e.g., Room Only"
              className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500"
            />
          </div>

          {/* Rate difference + LOS */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Rate Difference (₹)
              </label>
              <input
                type="number"
                value={data.rate_difference}
                onChange={(e) => update({ rate_difference: Number(e.target.value) || 0 })}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">+/- amount vs base tariff</p>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Min Length of Stay
              </label>
              <input
                type="number"
                value={data.min_length_of_stay}
                onChange={(e) => update({ min_length_of_stay: Number(e.target.value) || 1 })}
                min={1}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">Minimum nights required</p>
            </div>
          </div>

          {/* Policy */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Cancellation Policy
            </label>
            <input
              type="text"
              value={data.policy_name || ""}
              onChange={(e) => update({ policy_name: e.target.value })}
              placeholder="e.g., Cancellation Policy"
              className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500"
            />
          </div>

          {/* Toggles */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div>
                <p className="text-sm font-semibold text-slate-700">Pay at property</p>
                <p className="text-[10px] text-slate-500">Allow guest to pay on arrival</p>
              </div>
              <input
                type="checkbox"
                checked={data.pay_at_property}
                onChange={(e) => update({ pay_at_property: e.target.checked })}
                className="w-5 h-5 accent-teal-600"
              />
            </label>
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div>
                <p className="text-sm font-semibold text-slate-700">Hard dependency</p>
                <p className="text-[10px] text-slate-500">Requires base plan to be selected</p>
              </div>
              <input
                type="checkbox"
                checked={data.hard_dependency}
                onChange={(e) => update({ hard_dependency: e.target.checked })}
                className="w-5 h-5 accent-teal-600"
              />
            </label>
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div>
                <p className="text-sm font-semibold text-slate-700">Hide on booking engine</p>
                <p className="text-[10px] text-slate-500">Don't show on public website</p>
              </div>
              <input
                type="checkbox"
                checked={data.hide_on_booking_engine}
                onChange={(e) => update({ hide_on_booking_engine: e.target.checked })}
                className="w-5 h-5 accent-teal-600"
              />
            </label>
          </div>

          {/* Room Types */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
              Applicable Room Types
            </label>
            <p className="text-[10px] text-slate-400 mb-2">
              Select which room types this plan applies to. Leave empty for all.
            </p>
            <div className="flex flex-wrap gap-2">
              {roomTypes.length === 0 && (
                <p className="text-xs text-slate-400">No room types configured yet</p>
              )}
              {roomTypes.map((type) => {
                const isSelected = (data.applicable_room_types || []).includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleRoomType(type)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition ${
                      isSelected
                        ? "bg-teal-500 border-teal-500 text-white"
                        : "bg-white border-slate-200 text-slate-600 hover:border-teal-300"
                    }`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active toggle */}
          <label className="flex items-center justify-between gap-3 cursor-pointer p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <p className="text-sm font-semibold text-slate-700">Active</p>
              <p className="text-[10px] text-slate-500">Enable or disable this rate plan</p>
            </div>
            <input
              type="checkbox"
              checked={data.is_active}
              onChange={(e) => update({ is_active: e.target.checked })}
              className="w-5 h-5 accent-teal-600"
            />
          </label>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-600 hover:bg-white transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !data.code.trim() || !data.name.trim()}
            className="px-6 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-teal-500/30 disabled:opacity-50 transition"
          >
            {saving ? "Saving..." : initial.id ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}