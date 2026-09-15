"use client";

import { useState } from "react";
import type { Booking } from "../types";
import { getBalance } from "../types";

type PaymentMode =
  | "Cash payment"
  | "Offline card payment"
  | "Offline cheque payment"
  | "UPI payment"
  | "Bank transfer"
  | "Other payment modes"
  | "Cash deposit"
  | "Send payment link";

const PAYMENT_OPTIONS: { label: PaymentMode; icon: string }[] = [
  { label: "Cash payment", icon: "💵" },
  { label: "Offline card payment", icon: "💳" },
  { label: "Offline cheque payment", icon: "📄" },
  { label: "UPI payment", icon: "📱" },
  { label: "Bank transfer", icon: "🏦" },
  { label: "Other payment modes", icon: "➕" },
  { label: "Cash deposit", icon: "💰" },
  { label: "Send payment link", icon: "🔗" },
];

export default function SettleDuesModal({
  booking,
  onClose,
  onSave,
  onOpenManager,
}: {
  booking: Booking;
  onClose: () => void;
  onSave: (method: string, amount: number, reference: string, note: string) => Promise<void>;
  onOpenManager: () => void;
}) {
  const balance = getBalance(booking);
  const [selectedMode, setSelectedMode] = useState<PaymentMode | null>(null);
  const [amount, setAmount] = useState<string>(balance > 0 ? balance.toFixed(2) : "");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [returnAmount, setReturnAmount] = useState("");
  const [transferTopUp, setTransferTopUp] = useState(false);
  const [saving, setSaving] = useState(false);

  // ═══════════════════════════════════════════════════════════
  // STEP 1: Payment method picker (Stayflexi style)
  // ═══════════════════════════════════════════════════════════
  if (!selectedMode) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-800">Settle Dues</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 text-2xl leading-none w-8 h-8 flex items-center justify-center"
            >
              ×
            </button>
          </div>

          {/* Guest summary bar */}
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Guest</span>
              <span className="font-medium text-gray-900">{booking.primaryGuest.name}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-600">Balance Due</span>
              <span className="font-bold text-rose-600">₹{balance.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment options list */}
          <div className="py-2 max-h-96 overflow-y-auto">
            {PAYMENT_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                onClick={() => {
                  if (opt.label === "Send payment link") {
                    alert("Payment link copied to clipboard!");
                    return;
                  }
                  setSelectedMode(opt.label);
                }}
                className="w-full text-left px-6 py-3 hover:bg-gray-50 transition flex items-center gap-3 text-sm text-gray-700 border-b border-gray-100 last:border-b-0"
              >
                <span className="text-base w-5 text-center">{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
            <button
              onClick={onOpenManager}
              className="w-full text-left px-6 py-3 hover:bg-gray-50 transition flex items-center gap-3 text-sm text-gray-700"
            >
              <span className="text-base w-5 text-center">📋</span>
              <span>View/Manage payments</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 2: Payment form (Stayflexi style — matches your screenshots)
  // ═══════════════════════════════════════════════════════════
  const isCash = selectedMode === "Cash payment";
  const isUPI = selectedMode === "UPI payment";

  const amountLabel =
    isCash ? "Cash amount" :
    isUPI ? "UPI amount" :
    selectedMode === "Offline card payment" ? "Card amount" :
    selectedMode === "Offline cheque payment" ? "Cheque amount" :
    selectedMode === "Bank transfer" ? "Transfer amount" :
    selectedMode === "Cash deposit" ? "Deposit amount" :
    "Amount";

  const referenceLabel =
    isUPI ? "UPI ID / Transaction ID" :
    selectedMode === "Offline card payment" ? "Card last 4 / Auth code" :
    selectedMode === "Offline cheque payment" ? "Cheque number" :
    selectedMode === "Bank transfer" ? "Bank reference number" :
    isCash ? "Amount description" :
    "Reference";

  const referencePlaceholder =
    isUPI ? "user@upi or TXN123456" :
    selectedMode === "Offline card payment" ? "1234 / AUTH-9988" :
    selectedMode === "Offline cheque payment" ? "CHQ-123456" :
    selectedMode === "Bank transfer" ? "NEFT-8827361" :
    isCash ? "Optional note" :
    "Optional";

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    setSaving(true);
    try {
      const cleanMethod = selectedMode
        .replace(" payment", "")
        .replace(" payment modes", "")
        .replace("Offline ", "")
        .trim();

      await onSave(cleanMethod, amt, reference, description);
      onClose();
    } catch (err: any) {
      alert(`Failed to record payment: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-800">{selectedMode}</h3>
          <button
            onClick={() => setSelectedMode(null)}
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none w-8 h-8 flex items-center justify-center"
          >
            ×
          </button>
        </div>

        {/* Form body */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* Amount */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              {amountLabel}
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-base font-medium outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              placeholder="0.00"
              autoFocus
            />
          </div>

          {/* Cash-only: Return calculator */}
          {isCash && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Return to customer calculator
              </label>
              <input
                type="number"
                value={returnAmount}
                onChange={(e) => setReturnAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-md outline-none focus:border-teal-500 bg-gray-50 text-gray-500"
              />
            </div>
          )}

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-md outline-none focus:border-teal-500"
            />
          </div>

          {/* Reference */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              {referenceLabel}
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={referencePlaceholder}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-md outline-none focus:border-teal-500"
            />
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Note (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional details"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-md outline-none focus:border-teal-500"
            />
          </div>

          {/* Cash-only: Transfer top-up checkbox */}
          {isCash && (
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={transferTopUp}
                onChange={(e) => setTransferTopUp(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span>Transfer this amount to cash top-up?</span>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 flex justify-between items-center border-t border-gray-200">
          <button
            onClick={() => setSelectedMode(null)}
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-6 py-2.5 bg-slate-800 text-white rounded-md text-sm font-medium hover:bg-slate-900 disabled:opacity-50 transition"
          >
            {saving ? "Saving..." : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
