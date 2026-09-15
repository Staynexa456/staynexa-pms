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
  { label: "Offline cheque payment", icon: "🧾" },
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
  // STEP 1: Choose payment method
  // ═══════════════════════════════════════════════════════════
  if (!selectedMode) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-bold text-navy">Settle Dues</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
          </div>
          <div className="p-4">
            <div className="bg-cream/60 rounded-lg p-3 mb-4 text-sm">
              <div className="flex justify-between"><span className="text-muted">Guest</span><span className="font-semibold">{booking.primaryGuest.name}</span></div>
              <div className="flex justify-between mt-1"><span className="text-muted">Balance Due</span><span className="font-bold text-rose-600">₹{balance.toFixed(2)}</span></div>
            </div>
            <div className="space-y-1 max-h-96 overflow-y-auto">
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
                  className="w-full text-left px-4 py-3 hover:bg-cream rounded-lg transition flex items-center gap-3 text-sm font-medium text-navy"
                >
                  <span className="text-lg">{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
              <div className="border-t border-gray-200 mt-2 pt-2">
                <button
                  onClick={onOpenManager}
                  className="w-full text-left px-4 py-3 hover:bg-cream rounded-lg transition flex items-center gap-3 text-sm font-medium text-navy"
                >
                  <span className="text-lg">📋</span>
                  <span>View/Manage payments</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 2: Payment form (adapts to mode)
  // ═══════════════════════════════════════════════════════════
  const isCash = selectedMode === "Cash payment";
  const isUPI = selectedMode === "UPI payment";
  const isCard = selectedMode === "Offline card payment";
  const isCheque = selectedMode === "Offline cheque payment";
  const isBank = selectedMode === "Bank transfer";
  const isOther = selectedMode === "Other payment modes";
  const isDeposit = selectedMode === "Cash deposit";

  // Field labels adapt to mode
  const amountLabel =
    isCash ? "Cash amount"
    : isUPI ? "UPI amount"
    : isCard ? "Card amount"
    : isCheque ? "Cheque amount"
    : isBank ? "Transfer amount"
    : isDeposit ? "Deposit amount"
    : "Amount";

  const referenceLabel =
    isUPI ? "UPI ID / Transaction ID"
    : isCard ? "Card last 4 digits / Auth code"
    : isCheque ? "Cheque number"
    : isBank ? "Bank reference number"
    : isCash ? "Amount description"
    : "Reference";

  const referencePlaceholder =
    isUPI ? "user@upi or TXN123456"
    : isCard ? "1234 / AUTH-9988"
    : isCheque ? "CHQ-123456"
    : isBank ? "NEFT-8827361"
    : isCash ? "Optional note"
    : "Optional";

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    setSaving(true);
    try {
      // Clean method name for DB (remove " payment")
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-bold text-navy">{selectedMode}</h3>
          <button onClick={() => setSelectedMode(null)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              {amountLabel}
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-3 border border-gray-300 rounded-lg text-lg font-semibold outline-none focus:border-teal-500"
              placeholder="0.00"
              autoFocus
            />
          </div>

          {/* Cash-only: Return calculator */}
          {isCash && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Return to customer calculator
              </label>
              <input
                type="number"
                value={returnAmount}
                onChange={(e) => setReturnAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:border-teal-500 bg-gray-50"
              />
              {returnAmount && amount && parseFloat(returnAmount) > 0 && (
                <p className="text-xs text-emerald-600 mt-1">
                  Change to give: ₹{Math.max(0, parseFloat(returnAmount) - parseFloat(amount)).toFixed(2)}
                </p>
              )}
            </div>
          )}

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:border-teal-500"
            />
          </div>

          {/* Reference (label adapts by mode) */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              {referenceLabel}
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={referencePlaceholder}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:border-teal-500"
            />
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Note (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional details"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:border-teal-500"
            />
          </div>

          {/* Cash-only: Transfer top-up checkbox */}
          {isCash && (
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={transferTopUp}
                onChange={(e) => setTransferTopUp(e.target.checked)}
                className="rounded"
              />
              <span>Transfer this amount to cash top-up?</span>
            </label>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 flex justify-between items-center">
          <button
            onClick={() => setSelectedMode(null)}
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-6 py-2.5 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-900 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
