// app/admin/payments/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { fetchAllPayments } from "../../lib/platform-admin";

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      const data = await fetchAllPayments();
      setPayments(data);
      setLoading(false);
    }
    load();
  }, []);

  const total = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const today = payments.filter(p => {
    const d = new Date(p.created_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });
  const todayTotal = today.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const filtered = search
    ? payments.filter(p => {
        const s = search.toLowerCase();
        return (
          p.booking?.hotel?.name?.toLowerCase().includes(s) ||
          p.booking?.guest?.name?.toLowerCase().includes(s) ||
          p.booking?.booking_ref?.toLowerCase().includes(s)
        );
      })
    : payments;

  if (loading) {
    return (
      <div className="p-8">
        <div className="w-12 h-12 mx-auto rounded-full border-4 border-purple-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">All Payments</h1>
        <p className="text-sm text-slate-400 mt-1">
          Every payment across all hotels
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Revenue</p>
          <p className="text-3xl font-bold text-emerald-400 mt-2">₹{total.toLocaleString("en-IN")}</p>
          <p className="text-xs text-slate-500 mt-1">{payments.length} transactions</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Today</p>
          <p className="text-3xl font-bold text-purple-400 mt-2">₹{todayTotal.toLocaleString("en-IN")}</p>
          <p className="text-xs text-slate-500 mt-1">{today.length} transactions</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Average Payment</p>
          <p className="text-3xl font-bold text-white mt-2">
            ₹{payments.length > 0 ? Math.round(total / payments.length).toLocaleString("en-IN") : 0}
          </p>
          <p className="text-xs text-slate-500 mt-1">per transaction</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by hotel, guest, booking ref..."
          className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 outline-none focus:border-purple-500"
        />
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-950">
              <tr>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Hotel</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Guest</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ref</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Method</th>
                <th className="text-right px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.slice(0, 100).map((p) => (
                <tr key={p.id} className="hover:bg-slate-800/40 transition">
                  <td className="px-5 py-4 text-xs text-slate-400">
                    {new Date(p.created_at).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-5 py-4 text-xs font-semibold text-white">
                    {p.booking?.hotel?.name || "—"}
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-300">
                    {p.booking?.guest?.name || "—"}
                  </td>
                  <td className="px-5 py-4 text-xs font-mono text-slate-400">
                    {p.booking?.booking_ref || "—"}
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-800 text-slate-300 uppercase">
                      {p.method || "—"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right text-emerald-400 font-bold">
                    ₹{Number(p.amount).toLocaleString("en-IN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
