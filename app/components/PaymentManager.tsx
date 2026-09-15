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

export default function PaymentManager({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("Payment Gateways");
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const data = await fetchAllPayments();
      setPayments(data);
    } catch (err) {
      console.error(err);
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
    return true; // Payment Gateways = all
  });

  const handleRefund = async (p: PaymentRecord) => {
    if (!confirm(`Do you want to refund ₹${p.amount.toFixed(2)} for this payment?`))
      return;
    try {
      await deletePayment(p.id);
      alert("✅ Refund recorded");
      load();
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    }
  };

  const handleChangeMode = async (p: PaymentRecord) => {
    const newMode = prompt(
      `Current mode: ${p.method}\n\nEnter new payment mode:`,
      p.method
    );
    if (!newMode || newMode === p.method) return;
    try {
      await updatePaymentMethod(p.id, newMode);
      alert("✅ Payment mode updated");
      load();
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    }
  };

  const handleTransferToCash = async (p: PaymentRecord) => {
    if (
      !confirm(
        `Transfer ₹${p.amount.toFixed(2)} to cash top-up? This will change the method to "Cash".`
      )
    )
      return;
    try {
      await updatePaymentMethod(p.id, "Cash");
      alert("✅ Transferred to cash top-up");
      load();
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-[90] flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-white">
        <h2 className="text-xl font-bold text-navy">View/Manage Payments</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-700 text-3xl leading-none"
        >
          ×
        </button>
      </div>

      {/* Tabs */}
      <div className="px-6 py-3 border-b border-gray-200 bg-white flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition ${
              tab === t
                ? "bg-teal-500 text-white"
                : "text-gray-700 hover:bg-gray-100 border border-gray-200"
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
          <div className="text-center py-20">
            <div className="text-6xl mb-4">💳</div>
            <p className="text-gray-500">No payments in this category</p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="py-3 px-2 text-xs font-semibold text-gray-500 uppercase">
                  Log Time
                </th>
                <th className="py-3 px-2 text-xs font-semibold text-gray-500 uppercase">
                  Action By
                </th>
                <th className="py-3 px-2 text-xs font-semibold text-gray-500 uppercase">
                  Payment Type
                </th>
                <th className="py-3 px-2 text-xs font-semibold text-gray-500 uppercase">
                  Description
                </th>
                <th className="py-3 px-2 text-xs font-semibold text-gray-500 uppercase">
                  Status
                </th>
                <th className="py-3 px-2 text-xs font-semibold text-gray-500 uppercase text-right">
                  Amount
                </th>
                <th className="py-3 px-2 text-xs font-semibold text-gray-500 uppercase text-right">
                  Refunded
                </th>
                <th className="py-3 px-2 text-xs font-semibold text-gray-500 uppercase text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-2 text-gray-700">
                    {new Date(p.paid_at).toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 px-2 text-gray-700">system</td>
                  <td className="py-3 px-2 text-gray-700">{p.method} Payment</td>
                  <td className="py-3 px-2 text-gray-500">
                    {p.reference || p.note || "—"}
                  </td>
                  <td className="py-3 px-2 text-gray-500">NA</td>
                  <td className="py-3 px-2 text-right font-semibold text-navy">
                    ₹{p.amount.toFixed(2)}
                  </td>
                  <td className="py-3 px-2 text-right text-gray-500">0.00</td>
                  <td className="py-3 px-2 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleRefund(p)}
                        className="px-3 py-1.5 bg-slate-800 text-white text-xs font-medium rounded hover:bg-slate-900"
                      >
                        Refund
                      </button>
                      <button
                        onClick={() => handleChangeMode(p)}
                        className="px-3 py-1.5 bg-slate-800 text-white text-xs font-medium rounded hover:bg-slate-900"
                      >
                        Change payment mode
                      </button>
                      <button
                        onClick={() => handleTransferToCash(p)}
                        className="px-3 py-1.5 bg-slate-800 text-white text-xs font-medium rounded hover:bg-slate-900"
                      >
                        Transfer to cash top-up
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
