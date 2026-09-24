"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useActiveHotel } from "../../lib/use-active-hotel";
import {
  fetchTaxRates,
  createTaxRate,
  updateTaxRate,
  deleteTaxRate,
  defaultTaxRates,
  type TaxRate,
} from "../../lib/tax-rates";
import SettingsLayout from "../../components/settings/SettingsLayout";

export default function TaxesPage() {
  const { hotelId, loading: hotelLoading } = useActiveHotel();
  const [taxes, setTaxes] = useState<TaxRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<TaxRate | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  const load = useCallback(async () => {
    if (!hotelId) { setLoading(false); return; }
    try {
      setLoading(true);
      let data = await fetchTaxRates(hotelId);
      // Seed default GST rates if none exist
      if (data.length === 0) {
        const defaults = defaultTaxRates(hotelId);
        for (const tax of defaults) {
          await createTaxRate(hotelId, tax);
        }
        data = await fetchTaxRates(hotelId);
      }
      setTaxes(data);
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

  const handleSave = async (data: TaxRate) => {
    if (!hotelId) return;
    try {
      if (data.id) {
        await updateTaxRate(data.id, data);
        showToast(`✅ ${data.name} updated`);
      } else {
        await createTaxRate(hotelId, data as Omit<TaxRate, "id" | "hotel_id">);
        showToast(`✅ ${data.name} created`);
      }
      setEditing(null);
      await load();
    } catch (err: any) {
      showToast(`⚠ ${err?.message || "Failed to save"}`);
    }
  };

  const handleDelete = async (tax: TaxRate) => {
    if (!tax.id) return;
    if (!confirm(`Delete "${tax.name}"?`)) return;
    try {
      await deleteTaxRate(tax.id);
      showToast(`🗑 Deleted`);
      await load();
    } catch (err: any) {
      showToast(`⚠ ${err?.message || "Failed to delete"}`);
    }
  };

  const handleAddNew = () => {
    setEditing({
      hotel_id: hotelId || "",
      name: "",
      tax_type: "GST",
      percentage: 0,
      apply_to: "room",
      min_amount: 0,
      max_amount: null,
      hsn_code: "",
      is_active: true,
      display_order: taxes.length,
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
      title="Taxes & Fees"
      subtitle="Configure GST, service charges, and other taxes"
      icon="💰"
    >
      {/* Header actions */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Tax Rates</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {taxes.length} {taxes.length === 1 ? "rate" : "rates"} configured · Applied to room bills
          </p>
        </div>
        <button
          onClick={handleAddNew}
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-sm transition flex items-center gap-2"
        >
          <span className="text-base">+</span> Add tax rate
        </button>
      </div>

      {/* Info banner */}
      <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
        <span className="text-xl">💡</span>
        <div>
          <p className="text-sm font-bold text-amber-800">India GST Defaults</p>
          <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
            Default GST slabs added: 12% (up to ₹7,500) and 18% (above ₹7,500). Edit as needed for your property.
          </p>
        </div>
      </div>

      {/* Tax list */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {taxes.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-5xl mb-3">💰</p>
            <p className="font-bold text-slate-700">No taxes configured</p>
            <p className="text-sm text-slate-500 mt-1">Click "Add tax rate" to get started</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="text-right px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Rate
                </th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Apply To
                </th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Range
                </th>
                <th className="text-center px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-right px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {taxes.map((tax) => (
                <tr key={tax.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-5 py-4">
                    <p className="text-sm font-bold text-slate-800">{tax.name}</p>
                    {tax.hsn_code && (
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        HSN: {tax.hsn_code}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-700 uppercase">
                      {tax.tax_type}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <p className="text-lg font-bold text-teal-700">{tax.percentage}%</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs font-semibold text-slate-600 capitalize">
                      {tax.apply_to}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-xs text-slate-500">
                      ₹{tax.min_amount?.toLocaleString("en-IN") || 0}
                      {tax.max_amount ? ` — ₹${tax.max_amount.toLocaleString("en-IN")}` : " +"}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span
                      className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${
                        tax.is_active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {tax.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditing(tax)}
                        className="w-8 h-8 rounded-lg hover:bg-teal-50 text-slate-500 hover:text-teal-600 flex items-center justify-center transition"
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(tax)}
                        className="w-8 h-8 rounded-lg hover:bg-rose-50 text-slate-500 hover:text-rose-600 flex items-center justify-center transition"
                        title="Delete"
                      >
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {editing && (
        <TaxModal
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

function TaxModal({
  initial,
  onClose,
  onSave,
}: {
  initial: TaxRate;
  onClose: () => void;
  onSave: (data: TaxRate) => Promise<void>;
}) {
  const [data, setData] = useState<TaxRate>(initial);
  const [saving, setSaving] = useState(false);

  const update = (patch: Partial<TaxRate>) => {
    setData((prev) => ({ ...prev, ...patch }));
  };

  const handleSave = async () => {
    if (!data.name.trim()) { alert("Tax name required"); return; }
    if (data.percentage < 0) { alert("Percentage must be positive"); return; }
    setSaving(true);
    try {
      await onSave(data);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-slate-900 to-slate-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-xl">
              💰
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">
                {initial.id ? "Edit Tax Rate" : "New Tax Rate"}
              </h3>
              <p className="text-slate-300 text-xs mt-0.5">
                {initial.id ? `Editing ${initial.name}` : "Add a new tax"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white text-3xl leading-none">
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Tax Name *
            </label>
            <input
              type="text"
              value={data.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="e.g., GST 12%"
              className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Tax Type
              </label>
              <select
                value={data.tax_type}
                onChange={(e) => update({ tax_type: e.target.value as any })}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500 bg-white"
              >
                <option value="GST">GST</option>
                <option value="Service">Service</option>
                <option value="Luxury">Luxury</option>
                <option value="Custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Percentage *
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={data.percentage}
                  onChange={(e) => update({ percentage: Number(e.target.value) || 0 })}
                  step="0.01"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500 pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Apply To
            </label>
            <select
              value={data.apply_to}
              onChange={(e) => update({ apply_to: e.target.value as any })}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500 bg-white"
            >
              <option value="room">Room Charges</option>
              <option value="food">Food & Beverage</option>
              <option value="all">All Charges</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Min Amount (₹)
              </label>
              <input
                type="number"
                value={data.min_amount}
                onChange={(e) => update({ min_amount: Number(e.target.value) || 0 })}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Max Amount (₹)
              </label>
              <input
                type="number"
                value={data.max_amount ?? ""}
                onChange={(e) => update({ max_amount: e.target.value === "" ? null : Number(e.target.value) })}
                placeholder="No limit"
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
              HSN / SAC Code
            </label>
            <input
              type="text"
              value={data.hsn_code || ""}
              onChange={(e) => update({ hsn_code: e.target.value })}
              placeholder="e.g., 996311"
              className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500 font-mono"
            />
          </div>

          <label className="flex items-center justify-between gap-3 cursor-pointer p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <p className="text-sm font-semibold text-slate-700">Active</p>
              <p className="text-[10px] text-slate-500">Enable this tax rate</p>
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