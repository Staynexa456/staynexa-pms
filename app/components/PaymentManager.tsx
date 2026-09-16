"use client";

import { useState, useEffect } from "react";
import {
  fetchAllPayments,
  deletePayment,
  updatePaymentMethod,
  type PaymentRecord,
} from "../db";

type Tab =
  | "Payment Gateways"
  | "Counter Payments"
  | "Cash Deposits"
  | "Direct billing"
  | "OTA Prepaid Payments";

const TABS: Tab[] = [
  "Payment Gateways",
  "Counter Payments",
  "Cash Deposits",
  "Direct billing",
  "OTA Prepaid Payments",
];

const PAYMENT_MODES = [
  "Cash",
  "Card",
  "UPI",
  "Bank Transfer",
  "Cheque",
  "OTA Prepaid",
  "Other",
];

export default function PaymentManager({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("Payment Gateways");
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Refund confirmation state
  const [refundFor, setRefundFor] = useState<PaymentRecord | null>(null);
  const [refunding, setRefunding] = useState(false);

  // Change mode state
  const [changeModeFor, setChangeModeFor] = useState<PaymentRecord | null>(null);
  const [newMode, setNewMode] = useState<string>("Cash");
  const [changing, setChanging] = useState(false);

  // Cash top-up confirmation state
  const [cashTopUpFor, setCashTopUpFor] = useState<PaymentRecord | null>(null);
  const [toppingUp, setToppingUp] = useState(false);

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const load = async () => {
    try {
      setLoading(true);
      const data = await fetchAllPayments();
      setPayments(data);
    } catch (err: any) {
      console.error(err);
      showToast(`⚠ Failed to load: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Filter payments by tab
  const filtered = payments.filter((p) => {
    const m = (p.method || "").toLowerCase();
    if (tab === "Counter Payments")
      return ["cash", "card", "upi", "bank"].some((x) => m.includes(x));
    if (tab === "OTA Prepaid Payments") return m.includes("ota");
    if (tab === "Cash Deposits") return m.includes("cash");
    if (tab === "Direct billing")
      return m.includes("bank") || m.includes("cheque");
    return true;
  });

  // ═══════════════════════════════════════════════════════════
  // ACTION HANDLERS
  // ═══════════════════════════════════════════════════════════

  const handleRefundConfirm = async () => {
    if (!refundFor) return;
    setRefunding(true);
    try {
      await deletePayment(refundFor.id);
      showToast("✅ Refund recorded successfully");
      setRefundFor(null);
      await load();
    } catch (err: any) {
      showToast(`⚠ Refund failed: ${err.message}`);
    } finally {
      setRefunding(false);
    }
  };

  const handleChangeModeConfirm = async () => {
    if (!changeModeFor) return;
    if (newMode === changeModeFor.method) {
      showToast("⚠ Select a different payment mode");
      return;
    }
    setChanging(true);
    try {
      await updatePaymentMethod(changeModeFor.id, newMode);
      showToast(`✅ Changed to ${newMode}`);
      setChangeModeFor(null);
      await load();
    } catch (err: any) {
      showToast(`⚠ Change failed: ${err.message}`);
    } finally {
      setChanging(false);
    }
  };

  const handleCashTopUpConfirm = async () => {
    if (!cashTopUpFor) return;
    setToppingUp(true);
    try {
      await updatePaymentMethod(cashTopUpFor.id, "Cash");
      showToast("✅ Transferred to cash top-up");
      setCashTopUpFor(null);
      await load();
    } catch (err: any) {
      showToast(`⚠ Transfer failed: ${err.message}`);
    } finally {
      setToppingUp(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-[90] flex flex-col">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center bg-white">
        <h2 className="text-xl font-semibold text-gray-900">
          View/Manage Payments
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-700 text-3xl leading-none w-10 h-10 flex items-center justify-center"
        >
          ×
        </button>
      </div>

      {/* Tabs */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap transition ${
              tab === t
                ? "bg-teal-500 text-white"
                : "text-gray-700 hover:bg-gray-100 border border-gray-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && (
          <p className="text-center text-gray-500 py-12">Loading payments...</p>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-24">
            <div className="text-6xl mb-4">💳</div>
            <p className="text-gray-500">No payments in this category</p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="py-3 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Log Time
                </th>
                <th className="py-3 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Action By
                </th>
                <th className="py-3 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Payment Type
                </th>
                <th className="py-3 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="py-3 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="py-3 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">
                  Amount
                </th>
                <th className="py-3 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition"
                >
                  <td className="py-3 px-2 text-gray-700">
                    {new Date(p.paid_at || p.created_at || Date.now()).toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 px-2 text-gray-700">system</td>
                  <td className="py-3 px-2 text-gray-700">{p.method} Payment</td>
                  <td className="py-3 px-2 text-gray-500">
                    {p.reference || p.note || "—"}
                  </td>
                  <td className="py-3 px-2 text-gray-500">NA</td>
                  <td className="py-3 px-2 text-right font-semibold text-gray-900">
                    ₹{p.amount.toFixed(2)}
                  </td>
                  <td className="py-3 px-2 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setRefundFor(p)}
                        className="px-3 py-1.5 bg-slate-800 text-white text-xs font-medium rounded hover:bg-slate-900 transition"
                      >
                        Refund
                      </button>
                      <button
                        onClick={() => {
                          setChangeModeFor(p);
                          setNewMode(p.method);
                        }}
                        className="px-3 py-1.5 bg-slate-800 text-white text-xs font-medium rounded hover:bg-slate-900 transition"
                      >
                        Change mode
                      </button>
                      <button
                        onClick={() => setCashTopUpFor(p)}
                        className="px-3 py-1.5 bg-slate-800 text-white text-xs font-medium rounded hover:bg-slate-900 transition"
                      >
                        Cash top-up
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* REFUND CONFIRMATION MODAL */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {refundFor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-2xl shrink-0">
                  💸
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    Refund payment?
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Do you want to refund{" "}
                    <strong>₹{refundFor.amount.toFixed(2)}</strong> for this{" "}
                    <strong>{refundFor.method}</strong> payment? This action
                    cannot be undone.
                  </p>
                  {refundFor.reference && (
                    <p className="text-xs text-gray-500 mt-3 bg-gray-50 rounded-md p-2">
                      Reference: <strong>{refundFor.reference}</strong>
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setRefundFor(null)}
                disabled={refunding}
                className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRefundConfirm}
                disabled={refunding}
                className="px-5 py-2.5 bg-rose-600 text-white rounded-lg text-sm font-semibold hover:bg-rose-700 disabled:opacity-50 transition"
              >
                {refunding ? "Processing..." : "Yes, Refund"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* CHANGE MODE MODAL */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {changeModeFor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">
                Change Payment Mode
              </h3>
              <button
                onClick={() => setChangeModeFor(null)}
                className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Amount</span>
                  <span className="font-semibold text-gray-900">
                    ₹{changeModeFor.amount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-gray-500">Current mode</span>
                  <span className="font-medium text-gray-900">
                    {changeModeFor.method}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                  New Payment Mode
                </label>
                <div className="space-y-1.5">
                  {PAYMENT_MODES.map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setNewMode(mode)}
                      className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-between border ${
                        newMode === mode
                          ? "bg-teal-50 border-teal-500 text-teal-700"
                          : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span>{mode}</span>
                      {newMode === mode && (
                        <span className="text-teal-600">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t">
              <button
                onClick={() => setChangeModeFor(null)}
                disabled={changing}
                className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleChangeModeConfirm}
                disabled={changing || newMode === changeModeFor.method}
                className="px-5 py-2.5 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-900 disabled:opacity-50 transition"
              >
                {changing ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* CASH TOP-UP CONFIRMATION MODAL */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {cashTopUpFor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-2xl shrink-0">
                  💰
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    Transfer to cash top-up?
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Do you want to transfer{" "}
                    <strong>₹{cashTopUpFor.amount.toFixed(2)}</strong> from{" "}
                    <strong>{cashTopUpFor.method}</strong> to Cash top-up? The
                    payment mode will be changed to <strong>Cash</strong>.
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setCashTopUpFor(null)}
                disabled={toppingUp}
                className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCashTopUpConfirm}
                disabled={toppingUp}
                className="px-5 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 transition"
              >
                {toppingUp ? "Transferring..." : "Yes, Transfer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-xl shadow-2xl text-sm font-medium z-[110]">
          {toast}
        </div>
      )}
    </div>
  );
}
