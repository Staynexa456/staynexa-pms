"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getActiveHotelId } from "../../../active-hotel";
import { fetchNightAudit, type NightAuditReport } from "../../../lib/night-audit";

function fmtINR(n: number): string {
  return `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

const typeColors: Record<string, { bg: string; text: string; label: string; icon: string }> = {
  BOOKING: { bg: "bg-blue-100", text: "text-blue-700", label: "Booking", icon: "📅" },
  CHECKIN: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Check-In", icon: "✅" },
  CHECKOUT: { bg: "bg-rose-100", text: "text-rose-700", label: "Check-Out", icon: "🚪" },
  PAYMENT: { bg: "bg-teal-100", text: "text-teal-700", label: "Payment", icon: "💰" },
  REFUND: { bg: "bg-orange-100", text: "text-orange-700", label: "Refund", icon: "↩️" },
  CANCEL: { bg: "bg-slate-100", text: "text-slate-700", label: "Cancelled", icon: "❌" },
  ADDON: { bg: "bg-amber-100", text: "text-amber-700", label: "Addon", icon: "➕" },
};

export default function NightAuditPage() {
  const router = useRouter();
  const [businessDate, setBusinessDate] = useState(() =>
    new Date().toISOString().split("T")[0]
  );
  const [report, setReport] = useState<NightAuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const hotelId = getActiveHotelId();
      if (!hotelId) {
        setError("No active hotel selected");
        setLoading(false);
        return;
      }
      const data = await fetchNightAudit(hotelId, businessDate);
      setReport(data);
    } catch (err: any) {
      console.error("[NightAudit]", err);
      setError(err?.message || "Failed to load night audit");
    } finally {
      setLoading(false);
    }
  }, [businessDate]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePrint = () => {
    window.print();
  };

  const handleLockDay = () => {
    if (!confirm(`Lock business date ${businessDate}? This will prevent further changes to today's transactions.`)) {
      return;
    }
    showToast("🔒 Business date locked (demo)");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-slate-200 border-t-teal-600 animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading Night Audit...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <p className="text-5xl mb-4">⚠️</p>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Could not load</h2>
          <p className="text-sm text-slate-500 mb-6">{error || "Unknown error"}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={load}
              className="px-6 py-3 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700"
            >
              Try Again
            </button>
            <Link
              href="/reports/property"
              className="px-6 py-3 bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold"
            >
              Back
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { roomStats, revenue, payments, cashDrawer, transactions } = report;

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* ═══ HEADER ═══ */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 print:static">
        <div className="px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="text-slate-500 hover:text-slate-900 transition"
            >
              ← Back
            </button>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <h1 className="text-xl font-bold text-slate-900">🌙 Night Audit Report</h1>
              <p className="text-xs text-slate-500 mt-0.5">{report.hotelName}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase">
                Business Date
              </span>
              <input
                type="date"
                value={businessDate}
                onChange={(e) => setBusinessDate(e.target.value)}
                className="bg-transparent text-sm font-semibold text-slate-700 outline-none"
              />
            </div>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition"
            >
              🖨 Print
            </button>
            <button
              onClick={handleLockDay}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition"
            >
              🔒 Lock Day
            </button>
          </div>
        </div>
      </div>

      {/* ═══ CONTENT ═══ */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6 space-y-6">

        {/* Business Date Banner */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-700 rounded-2xl p-6 text-white">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Business Date
          </p>
          <h2 className="text-2xl font-bold mt-1">{fmtDate(report.businessDate)}</h2>
          <p className="text-xs text-slate-400 mt-2">
            Report generated at{" "}
            {new Date(report.generatedAt).toLocaleTimeString("en-IN")}
          </p>
        </div>

        {/* Room Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Occupancy
            </p>
            <p className="text-2xl font-bold text-teal-600 mt-1">
              {roomStats.occupancyRate.toFixed(1)}%
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              {roomStats.occupiedRooms} of {roomStats.totalRooms} rooms
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              ADR
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {fmtINR(roomStats.adr)}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">Avg Daily Rate</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              RevPAR
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {fmtINR(roomStats.revpar)}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">Revenue per available</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Room Nights
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {roomStats.roomNights}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              {roomStats.availableRooms} available · {roomStats.outOfOrder} OOO
            </p>
          </div>
        </div>

        {/* Revenue + Payments */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
              <span>💵</span>
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                Revenue Breakdown
              </h3>
            </div>
            <div className="p-5 space-y-3">
              <Row label="Room Revenue" value={fmtINR(revenue.roomRevenue)} />
              <Row label="Room Tax" value={fmtINR(revenue.roomTax)} />
              <Row label="Addon Revenue" value={fmtINR(revenue.addonRevenue)} />
              <Row label="Addon Tax" value={fmtINR(revenue.addonTax)} />
              <div className="border-t border-slate-100 pt-3">
                <Row label="Total Revenue" value={fmtINR(revenue.totalRevenue)} bold />
              </div>
              {revenue.refunds > 0 && (
                <Row label="Refunds" value={`- ${fmtINR(revenue.refunds)}`} red />
              )}
              <div className="border-t border-slate-100 pt-3">
                <Row
                  label="Net Revenue"
                  value={fmtINR(revenue.netRevenue)}
                  bold
                  big
                  highlight
                />
              </div>
            </div>
          </div>

          {/* Payments Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
              <span>💳</span>
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                Payment Collection
              </h3>
            </div>
            <div className="p-5 space-y-3">
              <Row label="Cash" value={fmtINR(payments.cash)} />
              <Row label="UPI" value={fmtINR(payments.upi)} />
              <Row label="Card" value={fmtINR(payments.card)} />
              <Row label="Bank Transfer" value={fmtINR(payments.bankTransfer)} />
              {payments.other > 0 && (
                <Row label="Other" value={fmtINR(payments.other)} />
              )}
              <div className="border-t border-slate-100 pt-3">
                <Row
                  label="Total Collected"
                  value={fmtINR(payments.total)}
                  bold
                  big
                  highlight
                />
              </div>
              <p className="text-[10px] text-slate-400 text-right pt-1">
                {payments.count} transactions
              </p>
            </div>
          </div>
        </div>

        {/* Cash Drawer Reconciliation */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100 flex items-center gap-2">
            <span>💰</span>
            <h3 className="text-sm font-bold text-amber-800 uppercase tracking-wider">
              Cash Drawer Reconciliation
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase">
                  Opening Balance
                </p>
                <p className="text-xl font-bold text-slate-900 mt-1">
                  {fmtINR(cashDrawer.openingBalance)}
                </p>
              </div>
              <div className="p-4 bg-emerald-50 rounded-xl">
                <p className="text-[10px] font-bold text-emerald-600 uppercase">
                  Cash Received
                </p>
                <p className="text-xl font-bold text-emerald-700 mt-1">
                  + {fmtINR(cashDrawer.cashReceived)}
                </p>
              </div>
              <div className="p-4 bg-rose-50 rounded-xl">
                <p className="text-[10px] font-bold text-rose-600 uppercase">
                  Refunds / Expenses
                </p>
                <p className="text-xl font-bold text-rose-700 mt-1">
                  - {fmtINR(cashDrawer.cashRefunds + cashDrawer.expenses)}
                </p>
              </div>
              <div className="p-4 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl">
                <p className="text-[10px] font-bold text-white/80 uppercase">
                  Expected Closing
                </p>
                <p className="text-xl font-bold text-white mt-1">
                  {fmtINR(cashDrawer.expectedClosing)}
                </p>
              </div>
            </div>
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-amber-800">
                  ⚠ Please count the cash drawer and enter actual amount
                </p>
                <p className="text-[10px] text-amber-700 mt-0.5">
                  The difference will be recorded for audit purposes
                </p>
              </div>
              <button
                onClick={() => showToast("💰 Reconciliation dialog coming soon")}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600"
              >
                Enter Actual
              </button>
            </div>
          </div>
        </div>

        {/* Operation Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
            <p className="text-2xl font-bold text-blue-600">{report.newBookings}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
              New Bookings
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
            <p className="text-2xl font-bold text-emerald-600">{report.arrivalsCompleted}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
              Checked-In
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
            <p className="text-2xl font-bold text-rose-600">{report.departuresCompleted}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
              Checked-Out
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
            <p className="text-2xl font-bold text-slate-600">{report.cancellations}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
              Cancellations
            </p>
          </div>
        </div>

        {/* Transactions Log */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>📋</span>
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                Transaction Log
              </h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-1 bg-slate-100 text-slate-600 rounded-full">
              {transactions.length} entries
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-5 py-3 text-[10px] font-bold uppercase text-slate-500">
                    Time
                  </th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold uppercase text-slate-500">
                    Type
                  </th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold uppercase text-slate-500">
                    Guest
                  </th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold uppercase text-slate-500">
                    Room
                  </th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold uppercase text-slate-500">
                    Description
                  </th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold uppercase text-slate-500">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400 text-sm">
                      No transactions recorded for this date
                    </td>
                  </tr>
                ) : (
                  transactions.map((t) => {
                    const c = typeColors[t.type] || typeColors.BOOKING;
                    return (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3 text-xs text-slate-500 font-mono">
                          {t.time}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full uppercase ${c.bg} ${c.text}`}
                          >
                            {c.icon} {c.label}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm font-semibold text-slate-800">
                          {t.guestName}
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-600">
                          {t.roomNumber || "—"}
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-600">
                          {t.description}
                        </td>
                        <td className="px-5 py-3 text-right text-sm font-bold text-slate-800">
                          {t.amount > 0 ? fmtINR(t.amount) : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tomorrow Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tomorrow Arrivals */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>🛬</span>
                <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-wider">
                  Tomorrow's Arrivals
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-1 bg-white text-emerald-700 rounded-full">
                {report.tomorrowArrivals.length}
              </span>
            </div>
            <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
              {report.tomorrowArrivals.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">
                  No arrivals scheduled
                </p>
              ) : (
                report.tomorrowArrivals.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-emerald-50/50 rounded-lg"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {a.guestName}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Room {a.roomNumber || "—"} ({a.roomType || "—"}) · {a.adults}A
                        {a.children > 0 ? ` ${a.children}C` : ""}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-1 bg-white text-emerald-700 rounded-full">
                      {a.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Tomorrow Departures */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>🛫</span>
                <h3 className="text-sm font-bold text-rose-800 uppercase tracking-wider">
                  Tomorrow's Departures
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-1 bg-white text-rose-700 rounded-full">
                {report.tomorrowDepartures.length}
              </span>
            </div>
            <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
              {report.tomorrowDepartures.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">
                  No departures scheduled
                </p>
              ) : (
                report.tomorrowDepartures.map((d, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-rose-50/50 rounded-lg"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {d.guestName}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Room {d.roomNumber || "—"} ({d.roomType || "—"})
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-1 bg-white text-rose-700 rounded-full">
                      {d.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-900 rounded-2xl p-6 flex items-center justify-between text-white print:bg-white print:text-slate-900">
          <div>
            <p className="text-sm font-bold">End of Night Audit</p>
            <p className="text-xs text-slate-400 mt-1">
              Report generated by Staynexa PMS · {report.hotelName}
            </p>
          </div>
          <Link
            href="/reports/property"
            className="px-5 py-2 bg-white text-slate-900 rounded-lg text-sm font-bold hover:bg-slate-100 print:hidden"
          >
            All Reports →
          </Link>
        </div>

      </div>

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl text-sm font-semibold shadow-2xl z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// Row Helper
// ═══════════════════════════════════════════════
function Row({
  label,
  value,
  bold,
  red,
  big,
  highlight,
}: {
  label: string;
  value: string;
  bold?: boolean;
  red?: boolean;
  big?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={`text-sm ${
          bold ? "font-semibold text-slate-700" : "text-slate-600"
        }`}
      >
        {label}
      </span>
      <span
        className={`${
          big ? "text-lg" : "text-sm"
        } font-bold ${
          red
            ? "text-rose-600"
            : highlight
            ? "text-teal-700"
            : "text-slate-800"
        }`}
      >
        {value}
      </span>
    </div>
  );
}