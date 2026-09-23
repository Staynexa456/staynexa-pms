"use client";

import React, { useState, useEffect } from "react";
import {
  type RateRule,
  type RuleType,
  RULE_TYPE_INFO,
  DAY_NAMES,
} from "../lib/rate-rules";
import { OCCUPANCIES } from "../lib/rate-plans";

type Props = {
  hotelId: string;
  roomTypes: string[];
  ratePlans: { id: string; code: string; name: string }[];
  editingRule?: RateRule | null;
  onClose: () => void;
  onSave: (rule: Omit<RateRule, "id" | "created_at" | "updated_at">) => Promise<void>;
};

const todayISO = () => new Date().toISOString().split("T")[0];

export default function RuleFormModal({
  hotelId,
  roomTypes,
  ratePlans,
  editingRule,
  onClose,
  onSave,
}: Props) {
  const [ruleType, setRuleType] = useState<RuleType>("seasonal");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(10);
  const [isActive, setIsActive] = useState(true);

  // Seasonal
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(todayISO());

  // Day of week
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([6, 0]); // Sat, Sun

  // LOS
  const [minNights, setMinNights] = useState(3);
  const [maxNights, setMaxNights] = useState(30);

  // Last minute
  const [advanceDays, setAdvanceDays] = useState(2);

  // Occupancy
  const [minOccupancy, setMinOccupancy] = useState(75);

  // Adjustment
  const [adjustmentType, setAdjustmentType] = useState<
    "percentage" | "fixed" | "set_price"
  >("percentage");
  const [adjustmentValue, setAdjustmentValue] = useState(10);

  // Scope
  const [scopeRoomTypes, setScopeRoomTypes] = useState<string[]>([]);
  const [scopePlanIds, setScopePlanIds] = useState<string[]>([]);
  const [scopeOccupancies, setScopeOccupancies] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);

  // ═══ Load editing rule ═══
  useEffect(() => {
    if (editingRule) {
      setRuleType(editingRule.rule_type);
      setName(editingRule.name);
      setDescription(editingRule.description || "");
      setPriority(editingRule.priority);
      setIsActive(editingRule.is_active);
      setStartDate(editingRule.start_date || todayISO());
      setEndDate(editingRule.end_date || todayISO());
      setDaysOfWeek(editingRule.days_of_week || []);
      setMinNights(editingRule.min_nights || 3);
      setMaxNights(editingRule.max_nights || 30);
      setAdvanceDays(editingRule.advance_days || 2);
      setMinOccupancy(
        editingRule.min_occupancy
          ? editingRule.min_occupancy > 1
            ? editingRule.min_occupancy
            : editingRule.min_occupancy * 100
          : 75
      );
      setAdjustmentType(editingRule.adjustment_type);
      setAdjustmentValue(editingRule.adjustment_value);
      setScopeRoomTypes(editingRule.room_types || []);
      setScopePlanIds(editingRule.rate_plan_ids || []);
      setScopeOccupancies(editingRule.occupancies || []);
    }
  }, [editingRule]);

  // ═══ Auto-fill name suggestions ═══
  useEffect(() => {
    if (editingRule || name) return;
    const suggestions: Record<RuleType, string> = {
      seasonal: "Peak Season",
      day_of_week: "Weekend Surcharge",
      los: "Long Stay Discount",
      last_minute: "Last Minute Surcharge",
      occupancy: "High Occupancy Surcharge",
    };
    setName(suggestions[ruleType]);
  }, [ruleType, editingRule]);

  const handleSave = async () => {
    if (!name.trim()) {
      alert("Please enter a rule name");
      return;
    }

    setSaving(true);
    try {
      const rule: Omit<RateRule, "id" | "created_at" | "updated_at"> = {
        hotel_id: hotelId,
        name: name.trim(),
        description: description.trim() || undefined,
        rule_type: ruleType,
        priority,
        is_active: isActive,
        adjustment_type: adjustmentType,
        adjustment_value: adjustmentValue,
        start_date: ruleType === "seasonal" ? startDate : null,
        end_date: ruleType === "seasonal" ? endDate : null,
        days_of_week: ruleType === "day_of_week" ? daysOfWeek : null,
        min_nights: ruleType === "los" ? minNights : null,
        max_nights: ruleType === "los" ? maxNights : null,
        advance_days: ruleType === "last_minute" ? advanceDays : null,
        min_occupancy:
          ruleType === "occupancy" ? minOccupancy : null,
        room_types: scopeRoomTypes.length > 0 ? scopeRoomTypes : null,
        rate_plan_ids: scopePlanIds.length > 0 ? scopePlanIds : null,
        occupancies: scopeOccupancies.length > 0 ? scopeOccupancies : null,
      };
      await onSave(rule);
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-700">
          <div className="flex items-center gap-3">
            <span className="text-2xl">
              {RULE_TYPE_INFO[ruleType].icon}
            </span>
            <div>
              <h3 className="text-white font-bold text-lg">
                {editingRule ? "Edit Rule" : "Create New Rule"}
              </h3>
              <p className="text-slate-300 text-xs mt-0.5">
                {RULE_TYPE_INFO[ruleType].description}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white text-3xl leading-none transition"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Rule Type Selector */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
              Rule Type
            </label>
            <div className="grid grid-cols-5 gap-2">
              {(Object.keys(RULE_TYPE_INFO) as RuleType[]).map((t) => {
                const info = RULE_TYPE_INFO[t];
                const isActive = ruleType === t;
                return (
                  <button
                    key={t}
                    onClick={() => setRuleType(t)}
                    disabled={!!editingRule}
                    className={`px-3 py-3 rounded-xl text-xs font-bold transition flex flex-col items-center gap-1 ${
                      isActive
                        ? "bg-gradient-to-br from-teal-500 to-emerald-500 text-white shadow-lg shadow-teal-500/30"
                        : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                    } ${editingRule ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <span className="text-xl">{info.icon}</span>
                    <span>{info.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name + Description */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Rule Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Peak Season Dec"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Priority (0 = first)
              </label>
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                min={0}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:border-teal-500"
            />
          </div>

          {/* Rule Type Specific Config */}
          <div className="p-4 bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
              ⚙ Condition
            </p>

            {ruleType === "seasonal" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-teal-500"
                  />
                </div>
              </div>
            )}

            {ruleType === "day_of_week" && (
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-2 block">
                  Applies on these days
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAY_NAMES.map((d) => {
                    const active = daysOfWeek.includes(d.value);
                    return (
                      <button
                        key={d.value}
                        onClick={() => toggleDay(d.value)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                          active
                            ? "bg-gradient-to-br from-sky-500 to-cyan-500 text-white shadow-md"
                            : "bg-white text-slate-600 border border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {ruleType === "los" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                    Minimum Nights
                  </label>
                  <input
                    type="number"
                    value={minNights}
                    onChange={(e) => setMinNights(Number(e.target.value))}
                    min={1}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                    Maximum Nights
                  </label>
                  <input
                    type="number"
                    value={maxNights}
                    onChange={(e) => setMaxNights(Number(e.target.value))}
                    min={1}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-teal-500"
                  />
                </div>
              </div>
            )}

            {ruleType === "last_minute" && (
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                  Apply if booking made within X days before check-in
                </label>
                <input
                  type="number"
                  value={advanceDays}
                  onChange={(e) => setAdvanceDays(Number(e.target.value))}
                  min={0}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-teal-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  e.g., "2" = applies to bookings made 0-2 days before arrival
                </p>
              </div>
            )}

            {ruleType === "occupancy" && (
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                  Apply when hotel occupancy ≥ X%
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={minOccupancy}
                    onChange={(e) => setMinOccupancy(Number(e.target.value))}
                    min={0}
                    max={100}
                    className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-teal-500"
                  />
                  <span className="text-xs text-slate-500">%</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Auto-applied based on real-time occupancy
                </p>
              </div>
            )}
          </div>

          {/* Adjustment */}
          <div className="p-4 bg-gradient-to-br from-teal-50 to-emerald-50 rounded-xl border border-teal-200">
            <p className="text-[10px] font-bold text-teal-600 uppercase tracking-wider mb-3">
              💰 Price Adjustment
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                  Adjustment Type
                </label>
                <select
                  value={adjustmentType}
                  onChange={(e) =>
                    setAdjustmentType(e.target.value as any)
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-teal-500 bg-white"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (₹)</option>
                  <option value="set_price">Set Fixed Price (₹)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                  {adjustmentType === "percentage"
                    ? "Percent (+ / -)"
                    : "Amount (₹)"}
                </label>
                <input
                  type="number"
                  value={adjustmentValue}
                  onChange={(e) =>
                    setAdjustmentValue(Number(e.target.value))
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-teal-500"
                />
              </div>
            </div>
            <div className="mt-3 p-3 bg-white rounded-lg border border-teal-100">
              <p className="text-[10px] text-slate-500 font-medium">
                Preview: ₹2,000 base →{" "}
                <span className="text-teal-700 font-bold text-xs">
                  {adjustmentType === "percentage"
                    ? `₹${Math.round(2000 * (1 + adjustmentValue / 100))}`
                    : adjustmentType === "fixed"
                    ? `₹${2000 + adjustmentValue}`
                    : `₹${adjustmentValue}`}
                </span>
              </p>
            </div>
          </div>

          {/* Scope */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
              🎯 Apply To (leave empty = all)
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                  Room Types
                </label>
                <div className="flex flex-wrap gap-2">
                  {roomTypes.map((rt) => {
                    const active = scopeRoomTypes.includes(rt);
                    return (
                      <button
                        key={rt}
                        onClick={() =>
                          setScopeRoomTypes((prev) =>
                            prev.includes(rt)
                              ? prev.filter((x) => x !== rt)
                              : [...prev, rt]
                          )
                        }
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition ${
                          active
                            ? "bg-slate-900 text-white"
                            : "bg-white text-slate-600 border border-slate-300"
                        }`}
                      >
                        {rt}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                  Rate Plans
                </label>
                <div className="flex flex-wrap gap-2">
                  {ratePlans.map((p) => {
                    const active = scopePlanIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() =>
                          setScopePlanIds((prev) =>
                            prev.includes(p.id)
                              ? prev.filter((x) => x !== p.id)
                              : [...prev, p.id]
                          )
                        }
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition ${
                          active
                            ? "bg-slate-900 text-white"
                            : "bg-white text-slate-600 border border-slate-300"
                        }`}
                      >
                        {p.code}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                  Occupancies
                </label>
                <div className="flex flex-wrap gap-2">
                  {OCCUPANCIES.map((occ) => {
                    const active = scopeOccupancies.includes(occ.key);
                    return (
                      <button
                        key={occ.key}
                        onClick={() =>
                          setScopeOccupancies((prev) =>
                            prev.includes(occ.key)
                              ? prev.filter((x) => x !== occ.key)
                              : [...prev, occ.key]
                          )
                        }
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition ${
                          active
                            ? "bg-slate-900 text-white"
                            : "bg-white text-slate-600 border border-slate-300"
                        }`}
                      >
                        {occ.short}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Active Toggle */}
          <label className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <span className="text-sm font-semibold text-slate-700">
              Active Rule
            </span>
          </label>
        </div>

        {/* Footer */}
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
            disabled={saving || !name.trim()}
            className="px-6 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-teal-500/30 disabled:opacity-50 transition"
          >
            {saving ? "Saving..." : editingRule ? "Update Rule" : "Create Rule"}
          </button>
        </div>
      </div>
    </div>
  );
}