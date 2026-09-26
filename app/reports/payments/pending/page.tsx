// app/reports/payments/pending/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useActiveHotel } from "../../../lib/use-active-hotel";
import { supabase } from "../../../supabase";

type PendingPayment = {
  id: string;
  gateway: string;
  gateway_order_id: string;
  amount: number;
  status: string;
  created_at: string;
  booking_id: string;
  booking_ref: string;
  guest_name: string;
  guest_phone: string;
  room_number: string;
  room_type: string;
  check_in: string;
  check_out: string;
};

export default function PendingPaymentsPage() {
  const { hotelId, loading: hotelLoading } = useActiveHotel();
  const [pending, setPending] = useState<PendingPayment[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // 🚨 আপডেটেড লজিক (ডিজাইন নয়)
  const loadPending = useCallback(async () => {
    if (!hotelId) { setLoading(false); return; }
    try {
      setLoading(true);

      const { data: transactions, error } = await supabase
        .from("payment_transactions")
        .select("*")
        .eq("hotel_id", hotelId)
        .in("status", ["pending_verification", "created"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      const enriched: PendingPayment[] = [];

      for (const tx of transactions || []) {
        if (!tx.booking_id) continue;

        const { data: booking } = await supabase
          .from("bookings")
          .select("booking_ref, check_in, check_out, primary_guest_id, room_id")
          .eq("id", tx.booking_id)
          .maybeSingle();

        if (!booking) continue;

        const { data: guest } = await supabase
          .from("guests")
          .select("name, phone")
          .eq("id", booking.primary_guest_id)
          .maybeSingle();

        const { data: room } = await supabase
          .from("rooms")
          .select("room_number, room_type")
          .eq("id", booking.room_id)
          .maybeSingle();

        enriched.push({
          id: tx.id,
          gateway: tx.gateway,
          gateway_order_id: tx.gateway_order_id,
          amount: tx.amount,
          status: tx.status,
          created_at: tx.created_at,
          booking_id: tx.booking_id,
          booking_ref: booking.booking_ref,
          guest_name: guest?.name || "Guest",
          guest_phone: guest?.phone || "",
          room_number: room?.room_number || "—",
          room_type: room?.room_type || "—",
          check_in: booking.check_in,
          check_out: booking.check_out,
        });
      }

      setPending(enriched);
    } catch (err) {
      console.error("Failed to load pending payments:", err);
      showToast("⚠ Failed to load pending payments");
    } finally {
      setLoading(false);
    }
  }, [hotelId]);

  useEffect(() => {
    if (hotelLoading) return;
    loadPending();
  }, [loadPending, hotelLoading]);

  const handleVerify = async (tx: PendingPayment, action: "verify" | "reject") => {
    setProcessing(tx.id);
    try {
      const res = await fetch("/api/payments/admin-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, transactionId: tx.id, bookingId: tx.booking_id, hotelId }),
      });

      const data = await res.json();

      if (data.success) {
        showToast(action === "verify" ? "✅ Payment verified — Booking confirmed" : "❌ Payment rejected");
        await loadPending();
      } else {
        showToast(`⚠ ${data.error || "Failed"}`);
      }
    } catch (err: any) {
      console.error(err);
      showToast("⚠ Failed to process");
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  const formatTime = (iso: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  if (hotelLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-14 h-14 rounded-full border-4 border-slate-200 border-t-teal-600 animate-spin" />
      </div>
    );
  }

  // 👇👇👇 এই JSX/HTML ডিজাইন আপনার আগের কোডের মতোই ১০০% অপরিবর্তিত 👇👇👇
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => (window.location.href = "/reports/payments")} className="w-10 h-10 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center transition text-slate-600">←</button>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-2xl shadow-lg shadow-amber-500/20">⏳</div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Pending Payment Verification</h1>
              <p className="text-sm text-slate-500">Verify UPI / manual payments from guests before confirming bookings</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Pending Count</p>
            <p className="text-3xl font-bold text-amber-600">{pending.length}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Pending Amount</p>
            <p className="text-3xl font-bold text-slate-900">₹{pending.reduce((sum, p) => sum + (p.amount || 0), 0).toLocaleString("en-IN")}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Refresh</p>
            <button onClick={loadPending} className="mt-1 text-sm font-bold text-teal-600 hover:text-teal-700">🔄 Reload Now</button>
          </div>
        </div>

        {/* Pending Payments */}
        {pending.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
            <p className="text-5xl mb-4">✓</p>
            <h2 className="text-xl font-bold text-slate-800 mb-2">All caught up!</h2>
            <p className="text-sm text-slate-500">No pending payments to verify at the moment.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map((tx) => (
              <div key={tx.id} className="bg-white rounded-2xl border-2 border-amber-200 shadow-sm overflow-hidden hover:shadow-md transition">
                <div className="px-5 py-3 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500 text-white uppercase tracking-wider">{tx.gateway === "upi_qr" ? "UPI QR" : tx.gateway.toUpperCase()}</span>
                    <span className="text-xs text-slate-600 font-medium">Received: {formatTime(tx.created_at)}</span>
                  </div>
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">⏳ Pending Verification</span>
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Guest</p>
                    <p className="text-base font-bold text-slate-900">{tx.guest_name}</p>
                    {tx.guest_phone && <a href={`tel:${tx.guest_phone}`} className="text-sm text-teal-600 hover:text-teal-700 font-medium">📞 {tx.guest_phone}</a>}
                    <p className="text-xs text-slate-500 mt-2">Ref: <span className="font-mono">{tx.booking_ref}</span></p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Booking Details</p>
                    <p className="text-sm text-slate-700 font-medium">🚪 Room {tx.room_number} — {tx.room_type}</p>
                    <p className="text-xs text-slate-500 mt-1">📅 {formatDate(tx.check_in)} → {formatDate(tx.check_out)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Amount</p>
                    <p className="text-3xl font-bold text-slate-900">₹{(tx.amount || 0).toLocaleString("en-IN")}</p>
                  </div>
                </div>
                <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button onClick={() => handleVerify(tx, "reject")} disabled={processing === tx.id} className="px-5 py-2.5 rounded-xl text-xs font-bold text-rose-700 border-2 border-rose-300 hover:bg-rose-50 transition uppercase tracking-wider disabled:opacity-50">❌ Reject</button>
                  <button onClick={() => handleVerify(tx, "verify")} disabled={processing === tx.id} className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 transition shadow-md shadow-emerald-500/20 uppercase tracking-wider disabled:opacity-50">{processing === tx.id ? "Processing..." : "✅ Verify & Confirm"}</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl text-sm font-semibold z-[100] shadow-2xl">{toast}</div>
        )}
      </div>
    </div>
  );
}
