// app/reports/payments/[type]/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useActiveHotel } from "../../../lib/use-active-hotel";
import { supabase } from "../../../supabase";

const REPORT_TITLES: Record<string, { title: string; description: string }> = {
  gateway: {
    title: "Payment Gateway Report",
    description: "All payments processed via payment gateways (Razorpay, Cashfree, etc.)",
  },
  "cash-counter": {
    title: "Cash & Counter Report",
    description: "All cash and offline payment transactions",
  },
  refunds: {
    title: "Refunds Report",
    description: "Payment gateway and cash refund information",
  },
  transfers: {
    title: "Transfers Report",
    description: "Payment settlement report for Razorpay and Cashfree",
  },
  "by-type": {
    title: "Payments by Payment Type",
    description: "Breakdown by Visa, Mastercard, UPI, etc.",
  },
  counter: {
    title: "Counter by Payment Type",
    description: "Counter transactions by cash, card, UPI",
  },
  ota: {
    title: "OTA Payment Report",
    description: "Amount guests paid to OTAs at booking creation",
  },
};

type Transaction = {
  id: string;
  gateway: string;
  gateway_order_id: string;
  gateway_payment_id: string | null;
  amount: number;
  status: string;
  created_at: string;
  booking_id: string | null;
  booking_ref?: string;
  guest_name?: string;
};

export default function PaymentReportDetailPage() {
  const params = useParams();
  const type = (params?.type as string) || "";
  const { hotelId, loading: hotelLoading } = useActiveHotel();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterGateway, setFilterGateway] = useState<string>("all");

  const report = REPORT_TITLES[type] || {
    title: "Payment Report",
    description: "Payment report data",
  };

  const loadData = useCallback(async () => {
    if (!hotelId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);

      let query = supabase
        .from("payment_transactions")
        .select("*")
        .eq("hotel_id", hotelId)
        .order("created_at", { ascending: false });

      // Filter by report type
      if (type === "gateway") {
        query = query.in("gateway", ["razorpay", "cashfree"]);
      } else if (type === "cash-counter") {
        query = query.in("gateway", ["cash", "counter", "offline"]);
      } else if (type === "refunds") {
        query = query.eq("status", "refunded");
      } else if (type === "transfers") {
        query = query.in("gateway", ["razorpay", "cashfree"]).eq("status", "paid");
      } else if (type === "by-type") {
        query = query.in("gateway", ["razorpay", "cashfree", "upi_qr"]);
      } else if (type === "counter") {
        query = query.in("gateway", ["cash", "counter", "offline"]);
      } else if (type === "ota") {
        query = query.eq("gateway", "ota");
      }

      const { data, error } = await query;
      if (error) throw error;

      // Enrich with booking + guest info
      const enriched: Transaction[] = [];

      for (const tx of data || []) {
        let booking_ref = "";
        let guest_name = "";

        if (tx.booking_id) {
          const { data: booking } = await supabase
            .from("bookings")
            .select("booking_ref, primary_guest_id")
            .eq("id", tx.booking_id)
            .maybeSingle();

          if (booking) {
            booking_ref = booking.booking_ref;
            const { data: guest } = await supabase
              .from("guests")
              .select("name")
              .eq("id", booking.primary_guest_id)
              .maybeSingle();
            guest_name = guest?.name || "Guest";
          }
        }

        enriched.push({
          ...tx,
          booking_ref,
          guest_name,
        });
      }

      setTransactions(enriched);
    } catch (err) {
      console.error("Failed to load report:", err);
    } finally {
      setLoading(false);
    }
  }, [hotelId, type]);

  useEffect(() => {
    if (hotelLoading) return;
    loadData();
  }, [loadData, hotelLoading]);

  // Filtered data
  const filtered = transactions.filter((tx) => {
    if (filterStatus !== "all" && tx.status !== filterStatus) return false;
    if (filterGateway !== "all" && tx.gateway !== filterGateway) return false;
    return true;
  });

  // Stats
  const totalAmount = filtered.reduce((sum, tx) => sum + (tx.amount || 0), 0);
  const paidCount = filtered.filter((tx) => tx.status === "paid").length;

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
      pending_verification: "bg-amber-50 text-amber-700 border-amber-200",
      created: "bg-slate-50 text-slate-600 border-slate-200",
      failed: "bg-rose-50 text-rose-700 border-rose-200",
      refunded: "bg-purple-50 text-purple-700 border-purple-200",
    };
    return map[status] || map.created;
  };

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => (window.location.href = "/reports/payments")}
              className="w-10 h-10 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center transition text-slate-600"
            >
              ←
            </button>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-2xl shadow-lg">
              📊
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{report.title}</h1>
              <p className="text-sm text-slate-500">{report.description}</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Transactions" value={filtered.length.toString()} color="slate" />
          <StatCard label="Total Amount" value={`₹${totalAmount.toLocaleString("en-IN")}`} color="teal" />
          <StatCard label="Paid" value={paidCount.toString()} color="emerald" />
          <StatCard label="Pending" value={filtered.filter((t) => t.status === "pending_verification").length.toString()} color="amber" />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 flex flex-wrap items-center gap-4">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-teal-500"
            >
              <option value="all">All Status</option>
              <option value="paid">Paid</option>
              <option value="pending_verification">Pending</option>
              <option value="failed">Failed</option>
              <option value="created">Created</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Gateway
            </label>
            <select
              value={filterGateway}
              onChange={(e) => setFilterGateway(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-teal-500"
            >
              <option value="all">All Gateways</option>
              <option value="razorpay">Razorpay</option>
              <option value="cashfree">Cashfree</option>
              <option value="upi_qr">UPI QR</option>
            </select>
          </div>

          <button
            onClick={loadData}
            className="ml-auto px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Transactions Table */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
            <p className="text-5xl mb-4">📋</p>
            <h2 className="text-xl font-bold text-slate-800 mb-2">No data yet</h2>
            <p className="text-sm text-slate-500">
              No transactions found for this report.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Guest
                    </th>
                    <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Booking Ref
                    </th>
                    <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Gateway
                    </th>
                    <th className="text-right px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="text-center px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-5 py-3 text-slate-600 text-xs whitespace-nowrap">
                        {formatDate(tx.created_at)}
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-800">
                        {tx.guest_name || "—"}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-600">
                        {tx.booking_ref || "—"}
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-slate-100 text-slate-600 uppercase">
                          {tx.gateway === "upi_qr" ? "UPI QR" : tx.gateway.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-slate-900">
                        ₹{(tx.amount || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider ${getStatusBadge(tx.status)}`}>
                          {tx.status === "pending_verification" ? "PENDING" : tx.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// STAT CARD COMPONENT
// ═══════════════════════════════════════════════
function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "slate" | "teal" | "emerald" | "amber";
}) {
  const colorMap = {
    slate: "text-slate-900",
    teal: "text-teal-600",
    emerald: "text-emerald-600",
    amber: "text-amber-600",
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className={`text-2xl font-bold ${colorMap[color]}`}>{value}</p>
    </div>
  );
}
