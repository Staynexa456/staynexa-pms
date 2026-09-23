"use client";

import React from "react";
import Link from "next/link";
import { useHotelStats } from "./lib/use-hotel-stats";

function fmtINR(n: number): string {
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function fmtFull(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export default function DashboardPage() {
  const { stats, loading, error, refresh } = useHotelStats();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-slate-200 border-t-teal-600 animate-spin" />
          <p className="text-slate-500 font-medium text-sm">Loading dashboard...</p>
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
          <p className="text-sm text-slate-500 mb-6">{error || "Unknown error"}</p>
          <button onClick={refresh} className="px-6 py-3 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8">
      {/* ═══ HEADER ═══ */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long", day: "numeric", month: "long", year: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50">
            🔄 Refresh
          </button>
          <Link href="/calendar" className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800">
            📅 Calendar
          </Link>
        </div>
      </div>

      {/* ═══ TOP KPI CARDS ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Arrivals */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-lg">🛬</div>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Arrivals Today</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{stats.arrivalCount}</p>
          <p className="text-xs text-slate-500 mt-1">
            {stats.pendingCheckins.length} pending · {stats.arrivalCount - stats.pendingCheckins.length} checked-in
          </p>
        </div>

        {/* Departures */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-lg">🛫</div>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Departures</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{stats.departureCount}</p>
          <p className="text-xs text-slate-500 mt-1">
            {stats.pendingCheckouts.length} pending · {stats.departureCount - stats.pendingCheckouts.length} checked-out
          </p>
        </div>

        {/* In-House */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center text-lg">👥</div>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">In-House</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{stats.inHouseCount}</p>
          <p className="text-xs text-slate-500 mt-1">Currently staying</p>
        </div>

        {/* Occupancy */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-lg">📊</div>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Occupancy</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{stats.occupancyRate.toFixed(0)}%</p>
          <p className="text-xs text-slate-500 mt-1">
            {stats.occupiedRooms} of {stats.totalRooms} rooms
          </p>
        </div>
      </div>

      {/* ═══ OCCUPANCY + REVENUE ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Live Occupancy */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Live Occupancy</h3>
          <p className="text-xs text-slate-400 mb-6">Real-time room status</p>

          <div className="flex items-center justify-center mb-6">
            <div className="relative w-40 h-40">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="80" cy="80" r="70" stroke="#e2e8f0" strokeWidth="12" fill="none" />
                <circle
                  cx="80" cy="80" r="70"
                  stroke="#0d9488" strokeWidth="12" fill="none"
                  strokeDasharray={`${(stats.occupancyRate / 100) * 440} 440`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-3xl font-bold text-slate-900">{stats.occupancyRate.toFixed(0)}%</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Occupied</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
            <div className="text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Available</p>
              <p className="text-xl font-bold text-emerald-600">{stats.availableRooms}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Total Rooms</p>
              <p className="text-xl font-bold text-slate-800">{stats.totalRooms}</p>
            </div>
          </div>
        </div>

        {/* Revenue Overview */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Revenue Overview</h3>
              <p className="text-xs text-slate-400">Weekly performance</p>
            </div>
            <Link href="/reports/property" className="text-xs font-bold text-teal-600 hover:text-teal-800">REPORTS →</Link>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Today</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{fmtINR(stats.todayCollection)}</p>
              <p className="text-[10px] text-slate-400 mt-1">Collected</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">This Week</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{fmtINR(stats.weekCollection)}</p>
              <p className="text-[10px] text-slate-400 mt-1">Collected</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">This Month</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{fmtINR(stats.monthCollection)}</p>
              <p className="text-[10px] text-slate-400 mt-1">Collected</p>
            </div>
          </div>

          {/* Progress Bars */}
          <div className="mt-6 space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium text-slate-600">Today's Collection</span>
                <span className="text-xs font-bold text-slate-800">{fmtFull(stats.todayCollection)}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600"
                  style={{ width: `${Math.min(100, stats.monthCollection > 0 ? (stats.todayCollection / stats.monthCollection) * 100 : 0)}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium text-slate-600">This Month's Collection</span>
                <span className="text-xs font-bold text-slate-800">{fmtFull(stats.monthCollection)}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-teal-400 to-teal-600"
                  style={{ width: `${Math.min(100, stats.monthCollection > 0 ? 100 : 0)}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ HOUSEKEEPING + PENDING PAYMENTS ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Housekeeping */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Housekeeping Status</h3>
              <p className="text-xs text-slate-400">Room cleaning overview</p>
            </div>
            <Link href="/housekeeping" className="text-xs font-bold text-teal-600">MANAGE →</Link>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className="text-center p-3 bg-emerald-50 rounded-xl">
              <p className="text-[9px] font-bold text-emerald-600 uppercase">Clean</p>
              <p className="text-xl font-bold text-emerald-700 mt-1">{stats.cleanRooms}</p>
            </div>
            <div className="text-center p-3 bg-rose-50 rounded-xl">
              <p className="text-[9px] font-bold text-rose-600 uppercase">Dirty</p>
              <p className="text-xl font-bold text-rose-700 mt-1">{stats.dirtyRooms}</p>
            </div>
            <div className="text-center p-3 bg-sky-50 rounded-xl">
              <p className="text-[9px] font-bold text-sky-600 uppercase">Inspect</p>
              <p className="text-xl font-bold text-sky-700 mt-1">{stats.inspectedRooms}</p>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-xl">
              <p className="text-[9px] font-bold text-amber-600 uppercase">Maint.</p>
              <p className="text-xl font-bold text-amber-700 mt-1">{stats.maintenanceRooms}</p>
            </div>
          </div>

          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-500">Overall Cleanliness</span>
            <span className="text-xs font-bold text-slate-800">{stats.cleanlinessPercent.toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600"
              style={{ width: `${stats.cleanlinessPercent}%` }} />
          </div>
        </div>

        {/* Pending Payments */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Pending Payments</h3>
              <p className="text-xs text-slate-400">Awaiting collection</p>
            </div>
            <span className="inline-flex items-center px-2.5 py-1 bg-rose-100 text-rose-700 text-[10px] font-bold rounded-full">
              {stats.inHouseGuests.filter(g => g.balance > 0).length}
            </span>
          </div>

          <div className="mb-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Outstanding</p>
            <p className="text-3xl font-bold text-rose-600 mt-1">{fmtFull(stats.totalPending)}</p>
          </div>

          <div className="space-y-2 max-h-40 overflow-y-auto">
            {stats.inHouseGuests.filter(g => g.balance > 0).slice(0, 5).map((g) => (
              <div key={g.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 truncate">{g.guestName}</p>
                  <p className="text-[10px] text-slate-400">Room {g.roomNumber || "—"}</p>
                </div>
                <p className="text-sm font-bold text-rose-600">{fmtFull(g.balance)}</p>
              </div>
            ))}
            {stats.inHouseGuests.filter(g => g.balance > 0).length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">No pending payments</p>
            )}
          </div>
        </div>
      </div>

      {/* ═══ TODAY'S ARRIVALS + DEPARTURES ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Arrivals */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-700">🛬 Today's Arrivals</h3>
            <span className="text-xs font-semibold text-slate-500">{stats.arrivalsToday.length} total</span>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {stats.arrivalsToday.map((b) => (
              <div key={b.id} className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 truncate">{b.guestName}</p>
                  <p className="text-[10px] text-slate-500">Room {b.roomNumber || "—"} · {b.adults}A{b.children > 0 ? ` ${b.children}C` : ""}</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-white text-emerald-700 border border-emerald-200">
                  {b.status}
                </span>
              </div>
            ))}
            {stats.arrivalsToday.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">No arrivals today</p>
            )}
          </div>
        </div>

        {/* Departures */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-700">🛫 Today's Departures</h3>
            <span className="text-xs font-semibold text-slate-500">{stats.departuresToday.length} total</span>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {stats.departuresToday.map((b) => (
              <div key={b.id} className="flex items-center justify-between p-3 bg-rose-50 rounded-lg border border-rose-100">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 truncate">{b.guestName}</p>
                  <p className="text-[10px] text-slate-500">Room {b.roomNumber || "—"}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-white text-rose-700 border border-rose-200">
                    {b.status}
                  </span>
                  {b.balance > 0 && (
                    <p className="text-[10px] font-bold text-rose-600 mt-1">Due {fmtFull(b.balance)}</p>
                  )}
                </div>
              </div>
            ))}
            {stats.departuresToday.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">No departures today</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}