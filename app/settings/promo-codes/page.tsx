// app/settings/promo-codes/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../supabase";
import { useActiveHotel } from "../../lib/use-active-hotel";

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════
type PromoCode = {
  id?: string;
  hotel_id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_order_amount: number;
  valid_from?: string | null;
  valid_until?: string | null;
  is_active: boolean;
  usage_limit?: number | null;
  used_count?: number;
  description?: string | null;
  created_at?: string;
};

const EMPTY_FORM: Omit<PromoCode, "hotel_id"> = {
  code: "",
  discount_type: "percentage",
  discount_value: 10,
  min_order_amount: 0,
  valid_from: null,
  valid_until: null,
  is_active: true,
  usage_limit: null,
  description: "",
};

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════
function fmtCurrency(n: number): string {
  return `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isExpired(iso?: string | null): boolean {
  if (!iso) return false;
  return new Date(iso) < new Date();
}

// ═══════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════
export default function PromoCodesPage() {
  const { hotelId } = useActiveHotel();
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PromoCode | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // Load
  const load = useCallback(async () => {
    if (!hotelId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("promo_codes")
        .select("*")
        .eq("hotel_id", hotelId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCodes(data || []);
    } catch (err) {
      console.error("[load promo codes]", err);
      showToast("⚠ Failed to load promo codes");
    } finally {
      setLoading(false);
    }
  }, [hotelId]);

  useEffect(() => {
    load();
  }, [load]);

  // Save
  const handleSave = async () => {
    if (!editing || !hotelId) return;

    // Validation
    if (!editing.code.trim()) {
      showToast("⚠ Please enter a code");
      return;
    }
    if (!editing.discount_value || editing.discount_value <= 0) {
      showToast("⚠ Please enter a valid discount");
      return;
    }
    if (editing.discount_type === "percentage" && editing.discount_value > 100) {
      showToast("⚠ Percentage cannot exceed 100");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        hotel_id: hotelId,
        code: editing.code.trim().toUpperCase(),
        discount_type: editing.discount_type,
        discount_value: Number(editing.discount_value),
        min_order_amount: Number(editing.min_order_amount) || 0,
        valid_from: editing.valid_from || null,
        valid_until: editing.valid_until || null,
        is_active: editing.is_active,
        usage_limit: editing.usage_limit ? Number(editing.usage_limit) : null,
        description: editing.description || null,
      };

      if (editing.id) {
        const { error } = await supabase
          .from("promo_codes")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        showToast("✅ Promo code updated");
      } else {
        const { error } = await supabase.from("promo_codes").insert(payload);
        if (error) throw error;
        showToast("✅ Promo code created");
      }

      setEditing(null);
      await load();
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes("duplicate") || err.message?.includes("unique")) {
        showToast("⚠ This code already exists");
      } else {
        showToast(`⚠ ${err.message || "Failed to save"}`);
      }
    } finally {
      setSaving(false);
    }
  };

  // Delete
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this promo code?")) return;
    try {
      const { error } = await supabase.from("promo_codes").delete().eq("id", id);
      if (error) throw error;
      showToast("🗑 Code deleted");
      await load();
    } catch (err) {
      console.error(err);
      showToast("⚠ Failed to delete");
    }
  };

  // Toggle active
  const toggleActive = async (code: PromoCode) => {
    if (!code.id) return;
    try {
      const { error } = await supabase
        .from("promo_codes")
        .update({ is_active: !code.is_active })
        .eq("id", code.id);
      if (error) throw error;
      await load();
    } catch (err) {
      console.error(err);
      showToast("⚠ Failed to update");
    }
  };

  // Copy code
  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    showToast(`📋 ${code} copied`);
  };

  // Filter
  const filteredCodes = codes.filter((c) => {
    if (filter === "active") return c.is_active && !isExpired(c.valid_until);
    if (filter === "inactive") return !c.is_active || isExpired(c.valid_until);
    return true;
  });

  // Stats
  const stats = {
    total: codes.length,
    active: codes.filter((c) => c.is_active && !isExpired(c.valid_until)).length,
    expired: codes.filter((c) => isExpired(c.valid_until)).length,
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-6 mb-6 flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-2xl shadow-lg">
              🎟️
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Promo Codes</h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Create coupon codes guests can apply at checkout
              </p>
            </div>
          </div>
          <button
            onClick={() => setEditing({ ...EMPTY_FORM, hotel_id: hotelId || "" })}
            className="px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl text-sm font-bold shadow-lg hover:opacity-90 transition flex items-center gap-2"
          >
            <span className="text-lg">+</span>
            Create Code
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Total Codes
            </p>
            <p className="text-3xl font-bold text-slate-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Active
            </p>
            <p className="text-3xl font-bold text-emerald-600">{stats.active}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Expired / Inactive
            </p>
            <p className="text-3xl font-bold text-rose-600">{stats.expired}</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white rounded-2xl border border-slate-200 p-1.5 mb-6 flex items-center gap-1 w-fit">
          {(["all", "active", "inactive"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-5 py-2 rounded-xl text-xs font-bold capitalize transition ${
                filter === f
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-slate-200 border-t-teal-500 animate-spin" />
            <p className="text-sm text-slate-500 font-semibold">Loading codes...</p>
          </div>
        ) : filteredCodes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
            <p className="text-5xl mb-4">🎟️</p>
            <p className="text-lg font-bold text-slate-800 mb-2">No promo codes yet</p>
            <p className="text-sm text-slate-500 mb-6">
              Create your first coupon code to offer discounts to guests
            </p>
            <button
              onClick={() => setEditing({ ...EMPTY_FORM, hotel_id: hotelId || "" })}
              className="px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl text-sm font-bold shadow-lg hover:opacity-90 transition"
            >
              + Create First Code
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCodes.map((code) => {
              const expired = isExpired(code.valid_until);
              const isUsable = code.is_active && !expired;
              return (
                <div
                  key={code.id}
                  className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden transition ${
                    isUsable ? "border-pink-200" : "border-slate-200 opacity-75"
                  }`}
                >
                  <div
                    className={`px-5 py-3 border-b flex items-center justify-between ${
                      isUsable
                        ? "bg-gradient-to-r from-pink-50 to-rose-50 border-pink-100"
                        : "bg-slate-50 border-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => copyCode(code.code)}
                        className="text-base font-mono font-bold text-slate-900 tracking-wider hover:text-pink-600 transition flex items-center gap-2"
                        title="Click to copy"
                      >
                        {code.code}
                        <span className="text-xs opacity-50">📋</span>
                      </button>
                      {expired && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 uppercase tracking-wider">
                          Expired
                        </span>
                      )}
                      {!code.is_active && !expired && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 uppercase tracking-wider">
                          Inactive
                        </span>
                      )}
                      {isUsable && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 uppercase tracking-wider">
                          ✓ Active
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleActive(code)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${
                          code.is_active ? "bg-emerald-500" : "bg-slate-300"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                            code.is_active ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Discount
                      </p>
                      <p className="text-xl font-bold text-pink-600">
                        {code.discount_type === "percentage"
                          ? `${code.discount_value}% OFF`
                          : `${fmtCurrency(code.discount_value)} OFF`}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Min Order
                      </p>
                      <p className="text-sm font-semibold text-slate-800">
                        {code.min_order_amount > 0 ? fmtCurrency(code.min_order_amount) : "No minimum"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Valid Until
                      </p>
                      <p className={`text-sm font-semibold ${expired ? "text-rose-600" : "text-slate-800"}`}>
                        {code.valid_until ? fmtDate(code.valid_until) : "No expiry"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Usage
                      </p>
                      <p className="text-sm font-semibold text-slate-800">
                        {code.used_count || 0}
                        {code.usage_limit ? ` / ${code.usage_limit}` : " uses"}
                      </p>
                    </div>
                  </div>

                  {code.description && (
                    <div className="px-5 pb-3">
                      <p className="text-xs text-slate-500 italic">"{code.description}"</p>
                    </div>
                  )}

                  <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                    <button
                      onClick={() => setEditing(code)}
                      className="px-5 py-2 rounded-xl text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100 transition uppercase tracking-wider"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleDelete(code.id!)}
                      className="px-5 py-2 rounded-xl text-xs font-bold text-rose-700 border border-rose-200 hover:bg-rose-50 transition uppercase tracking-wider"
                    >
                      🗑 Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* EDIT MODAL */}
      {editing && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-pink-500 to-rose-500 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl">
                  🎟️
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {editing.id ? "Edit Promo Code" : "Create Promo Code"}
                  </h2>
                  <p className="text-[11px] text-white/80">
                    {editing.id ? "Update discount details" : "Set up a new coupon"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditing(null)}
                disabled={saving}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center disabled:opacity-50"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Code */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                  Coupon Code *
                </label>
                <input
                  type="text"
                  value={editing.code}
                  onChange={(e) =>
                    setEditing({ ...editing, code: e.target.value.toUpperCase().replace(/\s/g, "") })
                  }
                  placeholder="e.g., WELCOME10"
                  maxLength={20}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-base font-mono font-bold tracking-wider focus:border-pink-500 outline-none transition uppercase"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Guests will type this code at checkout. Uppercase letters and numbers only.
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={editing.description || ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  placeholder="e.g., Welcome offer for new guests"
                  maxLength={100}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-pink-500 outline-none transition"
                />
              </div>

              {/* Discount Type */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                  Discount Type *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditing({ ...editing, discount_type: "percentage" })}
                    className={`p-4 rounded-xl border-2 transition text-center ${
                      editing.discount_type === "percentage"
                        ? "border-pink-500 bg-pink-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="text-2xl mb-1">%</div>
                    <p className="text-xs font-bold text-slate-800">Percentage</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">e.g., 10% off</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing({ ...editing, discount_type: "fixed" })}
                    className={`p-4 rounded-xl border-2 transition text-center ${
                      editing.discount_type === "fixed"
                        ? "border-pink-500 bg-pink-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="text-2xl mb-1">₹</div>
                    <p className="text-xs font-bold text-slate-800">Fixed Amount</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">e.g., ₹500 off</p>
                  </button>
                </div>
              </div>

              {/* Discount Value */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                  Discount Value * {editing.discount_type === "percentage" ? "(%)" : "(₹)"}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                    {editing.discount_type === "percentage" ? "%" : "₹"}
                  </span>
                  <input
                    type="number"
                    min="1"
                    max={editing.discount_type === "percentage" ? 100 : undefined}
                    value={editing.discount_value}
                    onChange={(e) =>
                      setEditing({ ...editing, discount_value: Number(e.target.value) })
                    }
                    className="w-full pl-9 pr-4 py-3 border border-slate-200 rounded-xl text-lg font-bold focus:border-pink-500 outline-none"
                  />
                </div>
                {editing.discount_type === "percentage" && editing.discount_value > 100 && (
                  <p className="text-[10px] text-rose-500 font-bold mt-1">
                    ⚠ Percentage cannot exceed 100%
                  </p>
                )}
              </div>

              {/* Min Order */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                  Minimum Order Amount (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={editing.min_order_amount}
                    onChange={(e) =>
                      setEditing({ ...editing, min_order_amount: Number(e.target.value) })
                    }
                    className="w-full pl-9 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-pink-500 outline-none"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Set 0 for no minimum requirement
                </p>
              </div>

              {/* Validity Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                    Valid From
                  </label>
                  <input
                    type="date"
                    value={editing.valid_from || ""}
                    onChange={(e) =>
                      setEditing({ ...editing, valid_from: e.target.value || null })
                    }
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-pink-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                    Valid Until
                  </label>
                  <input
                    type="date"
                    value={editing.valid_until || ""}
                    onChange={(e) =>
                      setEditing({ ...editing, valid_until: e.target.value || null })
                    }
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-pink-500 outline-none"
                  />
                </div>
              </div>

              {/* Usage Limit */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                  Usage Limit
                </label>
                <input
                  type="number"
                  min="1"
                  value={editing.usage_limit || ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      usage_limit: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="Leave empty for unlimited"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-pink-500 outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Maximum number of times this code can be used
                </p>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Active</p>
                  <p className="text-[11px] text-slate-500">
                    Only active codes work at checkout
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing({ ...editing, is_active: !editing.is_active })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    editing.is_active ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                      editing.is_active ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Preview */}
              <div className="p-4 bg-gradient-to-br from-pink-50 to-rose-50 border border-pink-200 rounded-xl">
                <p className="text-[10px] font-bold text-pink-700 uppercase tracking-wider mb-2">
                  Preview
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-mono font-bold text-pink-700 bg-white px-2.5 py-1 rounded-lg border border-pink-200">
                    {editing.code || "YOURCODE"}
                  </span>
                  <span className="text-xs text-pink-800">
                    {editing.discount_type === "percentage"
                      ? `${editing.discount_value}% off`
                      : `${fmtCurrency(editing.discount_value)} off`}
                    {editing.min_order_amount > 0 &&
                      ` on orders over ${fmtCurrency(editing.min_order_amount)}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
              <button
                onClick={() => setEditing(null)}
                disabled={saving}
                className="px-6 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-white transition uppercase tracking-wider disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl text-xs font-bold shadow-lg hover:opacity-90 disabled:opacity-50 transition uppercase tracking-wider"
              >
                {saving ? "Saving..." : editing.id ? "✓ Update" : "+ Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl text-sm font-semibold z-[200] shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}
