"use client";

import React from "react";
import Link from "next/link";
import { useHotelStats } from "../lib/use-hotel-stats";

function fmtINR(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function fmtShort(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
}

export default function ReportsOverviewPage() {
  const { stats, loading, error, refresh } = useHotelStats();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-slate-200 border-t-teal-600 animate-spin" />
          <p className="text-slate-500 font-medium text-sm">Loading reports...</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-md p-8">
          <p className="text-5xl mb-4">⚠️</p>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Failed to load</h2>
          <p className="text-sm text-slate-500 mb-6">{error}</p>
          <button onClick={refresh} className="px-6 py-3 bg-teal-600 text-white rounded-xl text-sm font-semibold">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500 mt-1">
            {stats.totalBookings} bookings across {stats.totalRooms} rooms
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50">
            🔄 Refresh
          </button>
          <Link href="/reports/property" className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800">
            📊 Detailed Reports
          </Link>
        </div>
      </div>

      {/* TOP KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Revenue</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{fmtShort(stats.totalRevenue)}</p>
          <p className="text-[10px] text-slate-400 mt-1">{fmtINR(stats.totalRevenue)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 border-l-4 border-l-emerald-500">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Collected</p>
          <p className="text-2xl font-bold text-emerald-600 mt-2">{fmtShort(stats.totalCollected)}</p>
          <p className="text-[10px] text-slate-400 mt-1">{fmtINR(stats.totalCollected)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 border-l-4 border-l-rose-500">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Outstanding</p>
          <p className="text-2xl font-bold text-rose-600 mt-2">{fmtShort(stats.totalPending)}</p>
          <p className="text-[10px] text-slate-400 mt-1">{fmtINR(stats.totalPending)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 border-l-4 border-l-amber-500">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Occupancy</p>
          <p className="text-2xl font-bold text-amber-600 mt-2">{stats.occupancyRate.toFixed(0)}%</p>
          <p className="text-[10px] text-slate-400 mt-1">{stats.occupiedRooms}/{stats.totalRooms} rooms</p>
        </div>
      </div>

      {/* SECONDARY KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ADR (Avg Daily Rate)</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{fmtINR(stats.adr)}</p>
          <p className="text-[10px] text-slate-400 mt-1">Revenue ÷ room-nights</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">RevPAR</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{fmtINR(stats.revpar)}</p>
          <p className="text-[10px] text-slate-400 mt-1">Revenue ÷ total rooms</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Room-Nights</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.monthRoomNights}</p>
          <p className="text-[10px] text-slate-400 mt-1">Total nights booked</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Rooms</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.totalRooms}</p>
          <p className="text-[10px] text-slate-400 mt-1">In this property</p>
        </div>
      </div>

      {/* BOOKING SOURCES + STATUS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Booking Sources</h3>
          <div className="space-y-3">
            {stats.sources.map((s) => (
              <div key={s.name}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-slate-700">{s.name}</span>
                  <span className="text-xs font-semibold text-slate-500">
                    {s.count} bookings · {s.percentage.toFixed(0)}%
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-teal-400 to-teal-600"
                    style={{ width: `${s.percentage}%` }} />
                </div>
              </div>
            ))}
            {stats.sources.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">No bookings this month</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Booking Status</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-amber-50 rounded-xl">
              <p className="text-2xl font-bold text-amber-600">{stats.statusCounts.CONFIRMED || 0}</p>
              <p className="text-[10px] font-bold text-amber-700 uppercase mt-1">Confirmed</p>
            </div>
            <div className="text-center p-3 bg-emerald-50 rounded-xl">
              <p className="text-2xl font-bold text-emerald-600">{stats.statusCounts["CHECKED-IN"] || 0}</p>
              <p className="text-[10px] font-bold text-emerald-700 uppercase mt-1">Checked-in</p>
            </div>
            <div className="text-center p-3 bg-slate-100 rounded-xl">
              <p className="text-2xl font-bold text-slate-600">{stats.statusCounts["CHECKED-OUT"] || 0}</p>
              <p className="text-[10px] font-bold text-slate-700 uppercase mt-1">Checked-out</p>
            </div>
            <div className="text-center p-3 bg-rose-50 rounded-xl">
              <p className="text-2xl font-bold text-rose-600">{stats.statusCounts.CANCELLED || 0}</p>
              <p className="text-[10px] font-bold text-rose-700 uppercase mt-1">Cancelled</p>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-xl">
              <p className="text-2xl font-bold text-purple-600">{stats.statusCounts["ON-HOLD"] || 0}</p>
              <p className="text-[10px] font-bold text-purple-700 uppercase mt-1">On Hold</p>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-xl">
              <p className="text-2xl font-bold text-orange-600">{stats.statusCounts.BLOCKED || 0}</p>
              <p className="text-[10px] font-bold text-orange-700 uppercase mt-1">Blocked</p>
            </div>
          </div>
        </div>
      </div>

      {/* PAYMENT METHODS */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <h3 className="text-sm font-bold text-slate-700 mb-4">Payment Methods (This Month)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.paymentMethods.map((pm) => (
            <div key={pm.method} className="p-4 bg-slate-50 rounded-xl">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{pm.method}</p>
              <p className="text-lg font-bold text-slate-900 mt-1">{fmtShort(pm.amount)}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{pm.count} payments</p>
            </div>
          ))}
          {stats.paymentMethods.length === 0 && (
            <p className="text-sm text-slate-400 col-span-full text-center py-4">
              No payments recorded this month
            </p>
          )}
        </div>
      </div>

      {/* REPORTS HUB LINK */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-700 rounded-2xl p-6 flex items-center justify-between">
        <div>
          <h3 className="text-white font-bold text-lg">Reports Hub</h3>
          <p className="text-slate-400 text-sm mt-1">
            Access detailed reports like Master, Flash Manager, Room Revenue, and more.
          </p>
        </div>
        <Link href="/reports/property" className="px-6 py-3 bg-white text-slate-900 rounded-xl text-sm font-bold hover:bg-slate-100">
          View All Reports →
        </Link>
      </div>
    </div>
  );
}