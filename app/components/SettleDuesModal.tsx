"use client";

import React, { useState } from "react";

export default function SettleDuesModal({
  booking,
  onClose,
  onSave,
  onOpenManager,
}: {
  booking: any;
  onClose: () => void;
  onSave: (method: string, amount: number, reference?: string, note?: string) => Promise<void>;
  onOpenManager?: () => void;
}) {
  const amountDue = Number(booking.amount) || 0;
  const tax = Number(booking.tax) || 0;
  const paid = Number(booking.paid) || 0;
  const balanceDue = Math.max(0, amountDue + tax - paid);

  const [method, setMethod] = useState("Cash");
  const [amount, setAmount] = useState(String(balanceDue.toFixed(2)));
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    setSaving(true);
    try {
      await onSave(method, parseFloat(amount), reference, note);
      onClose();
    } catch (err: any) {
      alert(err.message || "Failed to record payment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b dark:border-slate-700 flex justify-between items-center">
          <h3 className="text-lg font-bold dark:text-white">Settle Dues</h3>
          <button onClick={onClose} className="text-gray-400 text-2xl">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Amount Due</label>
            <p className="text-2xl font-bold text-navy dark:text-white">₹{balanceDue.toFixed(2)}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Payment Method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full px-3 py-2.5 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg text-sm">
              <option>Cash</option>
              <option>Card</option>
              <option>UPI</option>
              <option>Bank Transfer</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Amount</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-3 py-2.5 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Reference (Optional)</label>
            <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} className="w-full px-3 py-2.5 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Note (Optional)</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className="w-full px-3 py-2.5 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg text-sm" />
          </div>
        </div>
        <div className="px-6 py-4 bg-gray-50 dark:bg-slate-700 flex justify-end gap-3 border-t dark:border-slate-600">
          <button onClick={onClose} className="px-5 py-2.5 border dark:border-slate-600 rounded-lg text-sm dark:text-slate-200">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="px-6 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">{saving ? "Saving..." : "Save Payment"}</button>
        </div>
      </div>
    </div>
  );
}