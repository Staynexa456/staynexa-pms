// app/admin/subscriptions/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  fetchPlans,
  fetchHotelSubscriptions,
  fetchSubscriptionStats,
  upsertPlan,
  deletePlan,
  assignPlanToHotel,
  type SubscriptionPlan,
  type HotelSubscription,
} from "../../lib/subscriptions";

export default function SubscriptionsPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [hotels, setHotels] = useState<HotelSubscription[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"plans" | "hotels">("plans");
  const [planModal, setPlanModal] = useState<Partial<SubscriptionPlan> | null>(null);
  const [assignModal, setAssignModal] = useState<HotelSubscription | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [p, h, s] = await Promise.all([
      fetchPlans(),
      fetchHotelSubscriptions(),
      fetchSubscriptionStats(),
    ]);
    setPlans(p);
    setHotels(h);
    setStats(s);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSavePlan = async () => {
    if (!planModal?.name || !planModal?.code) {
      setMessage("⚠️ Name and code required");
      return;
    }
    try {
      await upsertPlan(planModal);
      setMessage(`✓ Plan "${planModal.name}" saved`);
      setPlanModal(null);
      await load();
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage(`⚠️ ${err.message}`);
    }
  };

  const handleDeletePlan = async (plan: SubscriptionPlan) => {
    if (!confirm(`Delete plan "${plan.name}"?`)) return;
    try {
      await deletePlan(plan.id);
      setMessage(`✓ Plan deleted`);
      await load();
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage(`⚠️ ${err.message}`);
    }
  };

  const handleAssignPlan = async (hotelId: string, planCode: string, months: number, amount: number) => {
    try {
      await assignPlanToHotel({
        hotel_id: hotelId,
        plan_code: planCode,
        duration_months: months,
        amount_paid: amount,
      });
      setMessage(`✓ Plan assigned successfully`);
      setAssignModal(null);
      await load();
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage(`⚠️ ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-purple-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Subscriptions</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage plans and assign them to hotels
          </p>
        </div>
        {activeTab === "plans" && (
          <button
            onClick={() => setPlanModal({ is_active: true, features: [], monthly_price: 0, yearly_price: 0, max_rooms: 10, max_bookings_per_month: 100, max_users: 2 })}
            className="px-5 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl text-sm font-bold hover:opacity-90 transition"
          >
            + Create Plan
          </button>
        )}
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-xl mb-6 text-sm font-bold ${
          message.startsWith("✓")
            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
            : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
        }`}>
          {message}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Plans</p>
            <p className="text-2xl font-bold text-white mt-1">{stats.totalPlans}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Hotels</p>
            <p className="text-2xl font-bold text-white mt-1">{stats.totalHotels}</p>
          </div>
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-4">
            <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Expiring Soon</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">{stats.expiringSoon}</p>
            <p className="text-[10px] text-slate-500 mt-1">within 7 days</p>
          </div>
          <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-4">
            <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Expired</p>
            <p className="text-2xl font-bold text-rose-400 mt-1">{stats.expired}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Active Plans</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{stats.activePlans}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("plans")}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold transition ${
            activeTab === "plans"
              ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
              : "bg-slate-900 text-slate-400 hover:bg-slate-800"
          }`}
        >
          📋 Plans ({plans.length})
        </button>
        <button
          onClick={() => setActiveTab("hotels")}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold transition ${
            activeTab === "hotels"
              ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
              : "bg-slate-900 text-slate-400 hover:bg-slate-800"
          }`}
        >
          🏨 Hotel Subscriptions ({hotels.length})
        </button>
      </div>

      {/* ─── Plans Tab ─── */}
      {activeTab === "plans" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`bg-slate-900 border rounded-2xl p-5 flex flex-col ${
                plan.is_popular
                  ? "border-purple-500 shadow-lg shadow-purple-500/20"
                  : "border-slate-800"
              }`}
            >
              {plan.is_popular && (
                <span className="self-start text-[9px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white uppercase tracking-wider mb-2">
                  Most Popular
                </span>
              )}
              <h3 className="text-xl font-bold text-white">{plan.name}</h3>
              <p className="text-xs text-slate-500 mb-3 min-h-[32px]">{plan.description}</p>

              <div className="mb-4">
                <p className="text-3xl font-bold text-white">
                  ₹{plan.monthly_price.toLocaleString("en-IN")}
                  <span className="text-sm text-slate-500 font-normal">/mo</span>
                </p>
                {plan.yearly_price > 0 && (
                  <p className="text-xs text-emerald-400 mt-1">
                    or ₹{plan.yearly_price.toLocaleString("en-IN")}/year
                  </p>
                )}
              </div>

              <div className="text-[11px] text-slate-400 mb-4 flex gap-3 flex-wrap">
                <span>🛏️ {plan.max_rooms} rooms</span>
                <span>📅 {plan.max_bookings_per_month} bookings</span>
                <span>👥 {plan.max_users} users</span>
              </div>

              <ul className="space-y-1.5 mb-4 flex-1">
                {plan.features.slice(0, 5).map((f, i) => (
                  <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
                {plan.features.length > 5 && (
                  <li className="text-[10px] text-slate-500 italic">
                    +{plan.features.length - 5} more features
                  </li>
                )}
              </ul>

              <div className="flex gap-2 pt-4 border-t border-slate-800">
                <button
                  onClick={() => setPlanModal(plan)}
                  className="flex-1 py-2 rounded-lg text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeletePlan(plan)}
                  className="px-3 py-2 rounded-lg text-xs font-bold bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Hotels Tab ─── */}
      {activeTab === "hotels" && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-950">
                <tr>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Hotel</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Owner</th>
                  <th className="text-center px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Plan</th>
                  <th className="text-center px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Expires</th>
                  <th className="text-center px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {hotels.map((h) => {
                  const expiryDate = h.subscription_expires_at
                    ? new Date(h.subscription_expires_at).toLocaleDateString("en-IN")
                    : "—";

                  let statusColor = "bg-slate-700 text-slate-300";
                  let statusText = "No Plan";

                  if (h.is_expired) {
                    statusColor = "bg-rose-500/20 text-rose-400";
                    statusText = "EXPIRED";
                  } else if (h.days_until_expiry !== null && h.days_until_expiry <= 7) {
                    statusColor = "bg-amber-500/20 text-amber-400";
                    statusText = `${h.days_until_expiry}d LEFT`;
                  } else if (h.current_plan) {
                    statusColor = "bg-emerald-500/20 text-emerald-400";
                    statusText = "ACTIVE";
                  }

                  return (
                    <tr key={h.hotel_id} className="hover:bg-slate-800/40">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold">
                            {h.hotel_name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">{h.hotel_name}</p>
                            <p className="text-[10px] text-slate-500">{h.city || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-400">
                        {h.owner_email || "—"}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-400 uppercase">
                          {h.current_plan || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center text-xs text-slate-400">
                        {expiryDate}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${statusColor}`}>
                          {statusText}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => setAssignModal(h)}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:opacity-90 transition"
                        >
                          Change Plan
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Plan Modal ─── */}
      {planModal && (
        <PlanEditModal
          plan={planModal}
          onSave={handleSavePlan}
          onChange={setPlanModal}
          onClose={() => setPlanModal(null)}
        />
      )}

      {/* ─── Assign Modal ─── */}
      {assignModal && (
        <AssignPlanModal
          hotel={assignModal}
          plans={plans}
          onAssign={handleAssignPlan}
          onClose={() => setAssignModal(null)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// PLAN EDIT MODAL
// ═══════════════════════════════════════════════
function PlanEditModal({
  plan,
  onSave,
  onChange,
  onClose,
}: {
  plan: Partial<SubscriptionPlan>;
  onSave: () => void;
  onChange: (p: Partial<SubscriptionPlan>) => void;
  onClose: () => void;
}) {
  const [featureInput, setFeatureInput] = useState("");

  const addFeature = () => {
    if (!featureInput.trim()) return;
    onChange({
      ...plan,
      features: [...(plan.features || []), featureInput.trim()],
    });
    setFeatureInput("");
  };

  const removeFeature = (idx: number) => {
    const updated = [...(plan.features || [])];
    updated.splice(idx, 1);
    onChange({ ...plan, features: updated });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">
              {plan.id ? "Edit Plan" : "Create Plan"}
            </h3>
            <p className="text-xs text-slate-500">Configure plan details and features</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white flex items-center justify-center"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Plan Name *
              </label>
              <input
                type="text"
                value={plan.name || ""}
                onChange={(e) => onChange({ ...plan, name: e.target.value })}
                placeholder="Pro"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Code *
              </label>
              <input
                type="text"
                value={plan.code || ""}
                onChange={(e) => onChange({ ...plan, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
                placeholder="pro"
                disabled={!!plan.id}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:border-purple-500 disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
              Description
            </label>
            <input
              type="text"
              value={plan.description || ""}
              onChange={(e) => onChange({ ...plan, description: e.target.value })}
              placeholder="Most popular for growing hotels"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:border-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Monthly Price (₹)
              </label>
              <input
                type="number"
                value={plan.monthly_price || 0}
                onChange={(e) => onChange({ ...plan, monthly_price: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Yearly Price (₹)
              </label>
              <input
                type="number"
                value={plan.yearly_price || 0}
                onChange={(e) => onChange({ ...plan, yearly_price: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Max Rooms
              </label>
              <input
                type="number"
                value={plan.max_rooms || 0}
                onChange={(e) => onChange({ ...plan, max_rooms: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Max Bookings/Mo
              </label>
              <input
                type="number"
                value={plan.max_bookings_per_month || 0}
                onChange={(e) => onChange({ ...plan, max_bookings_per_month: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Max Users
              </label>
              <input
                type="number"
                value={plan.max_users || 0}
                onChange={(e) => onChange({ ...plan, max_users: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Features */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">
              Features
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={featureInput}
                onChange={(e) => setFeatureInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addFeature()}
                placeholder="e.g. WhatsApp Notifications"
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:border-purple-500"
              />
              <button
                onClick={addFeature}
                disabled={!featureInput.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 disabled:opacity-50"
              >
                Add
              </button>
            </div>
            <div className="space-y-1.5">
              {(plan.features || []).map((f, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 bg-slate-950 border border-slate-800 rounded-lg"
                >
                  <span className="text-xs text-slate-300 flex items-center gap-2">
                    <span className="text-emerald-400">✓</span> {f}
                  </span>
                  <button
                    onClick={() => removeFeature(i)}
                    className="text-rose-400 hover:text-rose-300 text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={plan.is_active !== false}
                onChange={(e) => onChange({ ...plan, is_active: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-xs text-slate-300">Active</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={plan.is_popular === true}
                onChange={(e) => onChange({ ...plan, is_popular: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-xs text-slate-300">Mark as Popular</span>
            </label>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-800 flex gap-3">
          <button
            onClick={onClose}
            className="px-5 py-3 border border-slate-700 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:opacity-90"
          >
            {plan.id ? "Update Plan" : "Create Plan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// ASSIGN PLAN MODAL
// ═══════════════════════════════════════════════
function AssignPlanModal({
  hotel,
  plans,
  onAssign,
  onClose,
}: {
  hotel: HotelSubscription;
  plans: SubscriptionPlan[];
  onAssign: (hotelId: string, planCode: string, months: number, amount: number) => void;
  onClose: () => void;
}) {
  const [planCode, setPlanCode] = useState(hotel.current_plan || "free");
  const [months, setMonths] = useState(1);
  const [amount, setAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("manual");

  const selectedPlan = plans.find((p) => p.code === planCode);
  const suggestedAmount = selectedPlan
    ? months === 12
      ? selectedPlan.yearly_price
      : selectedPlan.monthly_price * months
    : 0;

  useEffect(() => {
    setAmount(suggestedAmount);
  }, [planCode, months, suggestedAmount]);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Assign Plan</h3>
            <p className="text-xs text-slate-500">{hotel.hotel_name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white flex items-center justify-center"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Current plan info */}
          {hotel.current_plan && (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
              <p className="text-[10px] text-slate-500 uppercase font-bold">Current Plan</p>
              <p className="text-sm font-bold text-white mt-0.5">
                {hotel.current_plan.toUpperCase()} ·{" "}
                {hotel.subscription_expires_at
                  ? `Expires ${new Date(hotel.subscription_expires_at).toLocaleDateString("en-IN")}`
                  : "No expiry"}
              </p>
            </div>
          )}

          {/* Select Plan */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
              Select New Plan
            </label>
            <select
              value={planCode}
              onChange={(e) => setPlanCode(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:border-purple-500"
            >
              {plans.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name} — ₹{p.monthly_price}/mo
                </option>
              ))}
            </select>
          </div>

          {/* Duration */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
              Duration
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 3, 6, 12].map((m) => (
                <button
                  key={m}
                  onClick={() => setMonths(m)}
                  className={`py-2.5 rounded-xl text-xs font-bold transition ${
                    months === m
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                      : "bg-slate-950 border border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  {m} {m === 1 ? "month" : "months"}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
              Amount Paid (₹)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:border-purple-500"
            />
            {suggestedAmount > 0 && (
              <p className="text-[10px] text-slate-500 mt-1">
                Suggested: ₹{suggestedAmount.toLocaleString("en-IN")}
              </p>
            )}
          </div>

          {/* Payment method */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:border-purple-500"
            >
              <option value="manual">Manual / Cash</option>
              <option value="upi">UPI</option>
              <option value="bank">Bank Transfer</option>
              <option value="razorpay">Razorpay</option>
              <option value="cashfree">Cashfree</option>
            </select>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-800 flex gap-3">
          <button
            onClick={onClose}
            className="px-5 py-3 border border-slate-700 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={() => onAssign(hotel.hotel_id, planCode, months, amount)}
            className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:opacity-90"
          >
            Assign Plan
          </button>
        </div>
      </div>
    </div>
  );
}
