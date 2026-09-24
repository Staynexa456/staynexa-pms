"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useActiveHotel } from "../../lib/use-active-hotel";
import {
  fetchPolicies,
  createPolicy,
  updatePolicy,
  deletePolicy,
  defaultCancellationPolicy,
  type Policy,
  type PolicyRule,
} from "../../lib/policies";
import SettingsLayout from "../../components/settings/SettingsLayout";

const POLICY_TYPES = [
  { value: "cancellation", label: "Cancellation Policy", icon: "🚫", color: "bg-rose-100 text-rose-700" },
  { value: "amendment", label: "Amendment Policy", icon: "✏️", color: "bg-amber-100 text-amber-700" },
  { value: "terms", label: "Terms & Conditions", icon: "📜", color: "bg-blue-100 text-blue-700" },
];

export default function PoliciesPage() {
  const { hotelId, loading: hotelLoading } = useActiveHotel();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Policy | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  const load = useCallback(async () => {
    if (!hotelId) { setLoading(false); return; }
    try {
      setLoading(true);
      let data = await fetchPolicies(hotelId);

      // Seed default if empty
      if (data.length === 0) {
        const def = defaultCancellationPolicy(hotelId);
        await createPolicy(hotelId, def);
        data = await fetchPolicies(hotelId);
      }

      setPolicies(data);
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

  const handleSave = async (data: Policy) => {
    if (!hotelId) return;
    try {
      if (data.id) {
        await updatePolicy(data.id, data);
        showToast(`✅ ${data.name} updated`);
      } else {
        await createPolicy(hotelId, data as Omit<Policy, "id" | "hotel_id">);
        showToast(`✅ ${data.name} created`);
      }
      setEditing(null);
      await load();
    } catch (err: any) {
      showToast(`⚠ ${err?.message || "Failed to save"}`);
    }
  };

  const handleDelete = async (policy: Policy) => {
    if (!policy.id) return;
    if (!confirm(`Delete "${policy.name}"?`)) return;
    try {
      await deletePolicy(policy.id);
      showToast(`🗑 Deleted`);
      await load();
    } catch (err: any) {
      showToast(`⚠ ${err?.message || "Failed to delete"}`);
    }
  };

  const handleToggle = async (policy: Policy) => {
    if (!policy.id) return;
    try {
      await updatePolicy(policy.id, { is_active: !policy.is_active });
      showToast(`✓ ${policy.is_active ? "Deactivated" : "Activated"}`);
      await load();
    } catch (err: any) {
      showToast(`⚠ ${err?.message || "Failed to toggle"}`);
    }
  };

  const handleAddNew = (type: Policy["policy_type"]) => {
    setEditing({
      hotel_id: hotelId || "",
      policy_type: type,
      name: "",
      description: "",
      rules: [],
      is_active: true,
    });
  };

  const filteredPolicies = filterType === "all"
    ? policies
    : policies.filter((p) => p.policy_type === filterType);

  if (hotelLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-14 h-14 rounded-full border-4 border-slate-200 border-t-teal-600 animate-spin" />
      </div>
    );
  }

  return (
    <SettingsLayout
      title="Policies & Terms"
      subtitle="Cancellation, amendment, and terms & conditions"
      icon="🛡️"
    >
      {/* Header actions */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Hotel Policies</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {policies.length} {policies.length === 1 ? "policy" : "policies"} configured
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleAddNew("cancellation")}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-sm transition flex items-center gap-2"
          >
            <span>+</span> New Policy
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-5 overflow-x-auto">
        <button
          onClick={() => setFilterType("all")}
          className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition ${
            filterType === "all" ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          All ({policies.length})
        </button>
        {POLICY_TYPES.map((t) => {
          const count = policies.filter((p) => p.policy_type === t.value).length;
          return (
            <button
              key={t.value}
              onClick={() => setFilterType(t.value)}
              className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition flex items-center gap-2 ${
                filterType === t.value ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span>{t.icon}</span> {t.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Policy list */}
      {filteredPolicies.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
          <p className="text-5xl mb-3">🛡️</p>
          <p className="font-bold text-slate-700">No policies yet</p>
          <p className="text-sm text-slate-500 mt-1 mb-5">
            Create cancellation, amendment, or T&C policies
          </p>
          <div className="flex items-center justify-center gap-2">
            {POLICY_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => handleAddNew(t.value as Policy["policy_type"])}
                className={`px-4 py-2 rounded-xl text-xs font-bold ${t.color} hover:opacity-80 transition flex items-center gap-2`}
              >
                <span>{t.icon}</span> {t.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPolicies.map((policy) => {
            const typeInfo = POLICY_TYPES.find((t) => t.value === policy.policy_type);
            return (
              <div
                key={policy.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition"
              >
                <div className="p-5 flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl ${typeInfo?.color} flex items-center justify-center text-2xl shrink-0`}>
                    {typeInfo?.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-base font-bold text-slate-900">{policy.name}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        policy.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}>
                        {policy.is_active ? "Active" : "Inactive"}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase">
                        {typeInfo?.label}
                      </span>
                    </div>
                    {policy.description && (
                      <p className="text-xs text-slate-600 mt-1">{policy.description}</p>
                    )}
                    {policy.rules.length > 0 && (
                      <ul className="mt-3 space-y-1">
                        {policy.rules.map((rule, idx) => (
                          <li key={idx} className="text-[11px] text-slate-500 flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-slate-400" />
                            {rule.description || `${rule.type}: ${rule.value}`}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleToggle(policy)}
                      className="w-8 h-8 rounded-lg hover:bg-amber-50 text-slate-500 hover:text-amber-600 flex items-center justify-center transition"
                      title={policy.is_active ? "Deactivate" : "Activate"}
                    >
                      {policy.is_active ? "🔒" : "🔓"}
                    </button>
                    <button
                      onClick={() => setEditing(policy)}
                      className="w-8 h-8 rounded-lg hover:bg-teal-50 text-slate-500 hover:text-teal-600 flex items-center justify-center transition"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(policy)}
                      className="w-8 h-8 rounded-lg hover:bg-rose-50 text-slate-500 hover:text-rose-600 flex items-center justify-center transition"
                      title="Delete"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {editing && (
        <PolicyModal
          initial={editing}
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

function PolicyModal({
  initial,
  onClose,
  onSave,
}: {
  initial: Policy;
  onClose: () => void;
  onSave: (data: Policy) => Promise<void>;
}) {
  const [data, setData] = useState<Policy>(initial);
  const [saving, setSaving] = useState(false);

  const update = (patch: Partial<Policy>) => {
    setData((prev) => ({ ...prev, ...patch }));
  };

  const addRule = () => {
    const newRule: PolicyRule = {
      id: `r${Date.now()}`,
      type: "hours",
      value: 24,
      description: "",
    };
    update({ rules: [...data.rules, newRule] });
  };

  const updateRule = (id: string, patch: Partial<PolicyRule>) => {
    update({
      rules: data.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    });
  };

  const removeRule = (id: string) => {
    update({ rules: data.rules.filter((r) => r.id !== id) });
  };

  const handleSave = async () => {
    if (!data.name.trim()) { alert("Policy name required"); return; }
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
              🛡️
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">
                {initial.id ? "Edit Policy" : "New Policy"}
              </h3>
              <p className="text-slate-300 text-xs mt-0.5">
                {initial.id ? `Editing ${initial.name}` : "Configure a policy"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white text-3xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Policy Type *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {POLICY_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => update({ policy_type: t.value as any })}
                  className={`px-3 py-3 rounded-xl text-xs font-bold transition flex flex-col items-center gap-1 ${
                    data.policy_type === t.value
                      ? "bg-slate-900 text-white shadow-lg"
                      : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <span className="text-xl">{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Policy Name *
            </label>
            <input
              type="text"
              value={data.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="e.g., Standard Cancellation"
              className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Description
            </label>
            <textarea
              value={data.description || ""}
              onChange={(e) => update({ description: e.target.value })}
              rows={2}
              placeholder="Short description shown to guests"
              className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm resize-none outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Rules ({data.rules.length})
              </label>
              <button
                onClick={addRule}
                type="button"
                className="text-[11px] font-bold text-teal-600 hover:text-teal-800 uppercase tracking-wide"
              >
                + Add rule
              </button>
            </div>
            {data.rules.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 text-center">
                <p className="text-xs text-slate-400">No rules yet. Click "+ Add rule"</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.rules.map((rule) => (
                  <div key={rule.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl">
                    <select
                      value={rule.type}
                      onChange={(e) => updateRule(rule.id, { type: e.target.value as any })}
                      className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white outline-none focus:border-teal-500"
                    >
                      <option value="hours">Hours</option>
                      <option value="days">Days</option>
                      <option value="percent">Percent</option>
                      <option value="flat">Flat ₹</option>
                    </select>
                    <input
                      type="number"
                      value={rule.value}
                      onChange={(e) => updateRule(rule.id, { value: Number(e.target.value) || 0 })}
                      className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white outline-none focus:border-teal-500"
                    />
                    <input
                      type="text"
                      value={rule.description || ""}
                      onChange={(e) => updateRule(rule.id, { description: e.target.value })}
                      placeholder="Description"
                      className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white outline-none focus:border-teal-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeRule(rule.id)}
                      className="w-7 h-7 rounded-lg bg-white text-rose-500 hover:bg-rose-50 flex items-center justify-center transition text-sm"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <label className="flex items-center justify-between gap-3 cursor-pointer p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <p className="text-sm font-semibold text-slate-700">Active</p>
              <p className="text-[10px] text-slate-500">Show this policy on booking engine</p>
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
            disabled={saving || !data.name.trim()}
            className="px-6 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-teal-500/30 disabled:opacity-50 transition"
          >
            {saving ? "Saving..." : initial.id ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}