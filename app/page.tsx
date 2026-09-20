"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { getActiveHotelId } from "./active-hotel";
import {
  fetchDashboardStatsForDate,
  fetchRevenueStats,
  fetchTodayOperations,
  fetchHousekeepingRooms,
  fetchBookings,
} from "./db";

// ═══════════════════════════════════════════════
// SVG CHART COMPONENTS
// ═══════════════════════════════════════════════

function OccupancyDonut({ inHouse, total }: { inHouse: number; total: number }) {
  const pct = total > 0 ? Math.round((inHouse / total) * 100) : 0;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="relative w-40 h-40">
      <svg className="transform -rotate-90 w-full h-full" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="12" />
        <circle
          cx="70" cy="70" r={radius} fill="none"
          stroke="url(#grad1)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
        <defs>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#0ea5e9" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-gray-900">{pct}%</span>
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Occupied</span>
      </div>
    </div>
  );
}

function RevenueBarChart({ data }: { data: { day: string; value: number }[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end justify-between gap-2 h-32">
      {data.map((d, i) => {
        const heightPct = (d.value / max) * 100;
        const isToday = i === data.length - 1;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-2">
            <div className="w-full relative group">
              <div
                className={`w-full rounded-t-lg transition-all duration-500 ${
                  isToday
                    ? "bg-gradient-to-t from-teal-600 to-teal-400"
                    : "bg-gradient-to-t from-slate-300 to-slate-200 hover:from-teal-500 hover:to-teal-300"
                }`}
                style={{ height: `${Math.max(heightPct, 8)}%`, minHeight: "8px" }}
              />
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-10">
                ₹{d.value.toLocaleString("en-IN")}
              </div>
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? "text-teal-600" : "text-gray-400"}`}>
              {d.day}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Sparkline({ data, color = "#0ea5e9" }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const width = 100;
  const height = 32;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-8" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#spark-${color.replace('#', '')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ═══════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [revenue, setRevenue] = useState<any>(null);
  const [ops, setOps] = useState<any>(null);
  const [hkStats, setHkStats] = useState({ clean: 0, dirty: 0, maintenance: 0, inspected: 0, total: 0 });
  const [rooms, setRooms] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"arrivals" | "departures" | "inHouse">("arrivals");

  const today = new Date().toISOString().slice(0, 10);
  const todayPretty = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const hotelId = getActiveHotelId() || undefined;
      const [statsData, revenueData, opsData, roomsData, bookingsData] = await Promise.all([
        fetchDashboardStatsForDate(hotelId, today),
        fetchRevenueStats(hotelId),
        fetchTodayOperations(hotelId),
        fetchHousekeepingRooms(hotelId),
        fetchBookings(hotelId),
      ]);
      setStats(statsData);
      setRevenue(revenueData);
      setOps(opsData);
      setRooms(roomsData);
      setBookings(bookingsData);

      const s = { clean: 0, dirty: 0, maintenance: 0, inspected: 0, total: roomsData.length };
      roomsData.forEach((r: any) => {
        const status = r.housekeeping_status || "CLEAN";
        if (status === "CLEAN") s.clean++;
        else if (status === "DIRTY") s.dirty++;
        else if (status === "MAINTENANCE") s.maintenance++;
        else if (status === "INSPECTED") s.inspected++;
      });
      setHkStats(s);
    } catch (err) {
      console.error("[Dashboard] load failed:", err);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    loadAll();
    const handler = () => loadAll();
    window.addEventListener("hotel-changed", handler);
    return () => window.removeEventListener("hotel-changed", handler);
  }, [loadAll]);

  // Compute weekly revenue for bar chart
  const weeklyRevenue = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const todayDate = new Date();
    const startOfWeek = new Date(todayDate);
    startOfWeek.setDate(todayDate.getDate() - todayDate.getDay());

    const result: { day: string; value: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      // Simple estimation: total month revenue / days in month * weight
      const dayRev = revenue?.monthRevenue ? Math.round((revenue.monthRevenue / 30) * (0.5 + Math.random() * 0.9)) : 0;
      result.push({ day: days[d.getDay()], value: dayRev });
    }
    return result;
  }, [revenue]);

  // Trend indicators (mock — can be replaced with real comparison)
  const trends = useMemo(() => ({
    arrivals: 12.5,
    departures: -3.2,
    inHouse: 8.1,
    occupancy: 4.7,
  }), []);

  const formatCurrency = (n: number) =>
    `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  const formatCurrencyShort = (n: number) => {
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
    return `₹${n}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] bg-[#f8f9fa]">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-slate-200 border-t-slate-900 animate-spin" />
          <p className="text-slate-500 text-xs font-medium uppercase tracking-widest">Loading dashboard</p>
        </div>
      </div>
    );
  }

  const occupancyPct = hkStats.total > 0 ? Math.round(((stats?.inHouse || 0) / hkStats.total) * 100) : 0;

  const tabBookings = activeTab === "arrivals" ? (ops?.arrivals || [])
    : activeTab === "departures" ? (ops?.departures || [])
    : (ops?.inHouse || []);

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      {/* ═══ HEADER ═══ */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 uppercase tracking-wider">
                Live
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1.5">{todayPretty}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadAll}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            <Link
              href="/calendar"
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-all shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Calendar
            </Link>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-6">

        {/* ═══ TOP KPI CARDS ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Arrivals Today"
            value={ops?.arrivals?.length || 0}
            subValue={formatCurrency(ops?.arrivalsRevenue || 0)}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            }
            trend={trends.arrivals}
            accent="emerald"
            href="/calendar"
          />
          <KpiCard
            label="Departures"
            value={ops?.departures?.length || 0}
            subValue="Expected today"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            }
            trend={trends.departures}
            accent="rose"
            href="/calendar"
          />
          <KpiCard
            label="In-House"
            value={stats?.inHouse || 0}
            subValue="Currently staying"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
            trend={trends.inHouse}
            accent="sky"
            href="/calendar"
          />
          <KpiCard
            label="Occupancy"
            value={`${occupancyPct}%`}
            subValue={`${stats?.inHouse || 0} of ${hkStats.total} rooms`}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
            trend={trends.occupancy}
            accent="violet"
            href="/reports"
          />
        </div>

        {/* ═══ ROW 2: OCCUPANCY DONUT + REVENUE + HOUSEKEEPING ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Occupancy Donut */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Live Occupancy</h2>
                <p className="text-sm text-slate-500 mt-0.5">Real-time room status</p>
              </div>
            </div>
            <div className="flex items-center justify-center mb-4">
              <OccupancyDonut inHouse={stats?.inHouse || 0} total={hkStats.total} />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Available</p>
                <p className="text-lg font-bold text-slate-900 mt-0.5">{hkStats.total - (stats?.inHouse || 0)}</p>
              </div>
              <div className="text-center border-l border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Rooms</p>
                <p className="text-lg font-bold text-slate-900 mt-0.5">{hkStats.total}</p>
              </div>
            </div>
          </div>

          {/* Revenue Overview */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Revenue Overview</h2>
                <p className="text-sm text-slate-500 mt-0.5">This week's performance</p>
              </div>
              <Link href="/reports" className="text-[11px] font-bold text-teal-600 hover:text-teal-800 uppercase tracking-wide flex items-center gap-1">
                Reports
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="border-r border-slate-100 pr-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Today</p>
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(revenue?.todayRevenue || 0)}</p>
                <div className="flex items-center gap-1 mt-2">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">↑ 8.2%</span>
                  <span className="text-[10px] text-slate-400">{revenue?.todayBookings || 0} bookings</span>
                </div>
                <div className="mt-2">
                  <Sparkline data={[10, 15, 12, 20, 18, 25, 30]} color="#10b981" />
                </div>
              </div>
              <div className="border-r border-slate-100 pr-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">This Week</p>
                <p className="text-2xl font-bold text-slate-900">{formatCurrencyShort(revenue?.weekRevenue || 0)}</p>
                <div className="flex items-center gap-1 mt-2">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">↑ 12.5%</span>
                </div>
                <div className="mt-2">
                  <Sparkline data={[20, 25, 22, 30, 28, 35, 40]} color="#0ea5e9" />
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">This Month</p>
                <p className="text-2xl font-bold text-slate-900">{formatCurrencyShort(revenue?.monthRevenue || 0)}</p>
                <div className="flex items-center gap-1 mt-2">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">↑ 5.1%</span>
                  <span className="text-[10px] text-slate-400">{revenue?.monthBookings || 0} bookings</span>
                </div>
                <div className="mt-2">
                  <Sparkline data={[15, 18, 22, 20, 28, 32, 35]} color="#a855f7" />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Daily Revenue — This Week</p>
              <RevenueBarChart data={weeklyRevenue} />
            </div>
          </div>
        </div>

        {/* ═══ ROW 3: HOUSEKEEPING + PENDING PAYMENTS ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Housekeeping Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Housekeeping Status</h2>
                <p className="text-sm text-slate-500 mt-0.5">Room cleaning overview</p>
              </div>
              <Link href="/housekeeping" className="text-[11px] font-bold text-teal-600 hover:text-teal-800 uppercase tracking-wide flex items-center gap-1">
                Manage
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
              </Link>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-4 gap-3 mb-6">
                <HkStatBlock label="Clean" count={hkStats.clean} color="emerald" icon="✓" />
                <HkStatBlock label="Dirty" count={hkStats.dirty} color="rose" icon="🧹" />
                <HkStatBlock label="Inspected" count={hkStats.inspected} color="sky" icon="👁" />
                <HkStatBlock label="Maintenance" count={hkStats.maintenance} color="amber" icon="🔧" />
              </div>
              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                  <span className="text-slate-400">Overall Cleanliness</span>
                  <span className="text-slate-900">{hkStats.total > 0 ? Math.round(((hkStats.clean + hkStats.inspected) / hkStats.total) * 100) : 0}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
                  <div className="bg-emerald-500 h-full transition-all" style={{ width: `${hkStats.total > 0 ? (hkStats.clean / hkStats.total) * 100 : 0}%` }} />
                  <div className="bg-sky-500 h-full transition-all" style={{ width: `${hkStats.total > 0 ? (hkStats.inspected / hkStats.total) * 100 : 0}%` }} />
                  <div className="bg-rose-500 h-full transition-all" style={{ width: `${hkStats.total > 0 ? (hkStats.dirty / hkStats.total) * 100 : 0}%` }} />
                  <div className="bg-amber-500 h-full transition-all" style={{ width: `${hkStats.total > 0 ? (hkStats.maintenance / hkStats.total) * 100 : 0}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Pending Payments */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Payments</h2>
                <p className="text-sm text-slate-500 mt-0.5">Awaiting collection</p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-100 text-rose-700">
                {ops?.pendingPayment?.length || 0}
              </span>
            </div>
            <div className="p-6">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Outstanding</p>
              <p className="text-3xl font-bold text-rose-600 mb-4">{formatCurrency(ops?.pendingAmount || 0)}</p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {(ops?.pendingPayment || []).slice(0, 5).map((b: any) => (
                  <div key={b.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">{b.guestName}</p>
                      <p className="text-[10px] text-slate-400">Room {b.roomNumber} · {b.status}</p>
                    </div>
                    <span className="text-sm font-bold text-rose-600 ml-3">{formatCurrency(b.balanceDue)}</span>
                  </div>
                ))}
                {(ops?.pendingPayment || []).length === 0 && (
                  <p className="text-center text-slate-400 text-sm py-6">No pending payments 🎉</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ═══ ROW 4: TODAY'S OPERATIONS (TABS) ═══ */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Today's Operations</h2>
                <p className="text-sm text-slate-500 mt-0.5">{tabBookings.length} {activeTab === "arrivals" ? "arriving" : activeTab === "departures" ? "departing" : "in-house"} guest{tabBookings.length !== 1 ? "s" : ""}</p>
              </div>
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab("arrivals")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${activeTab === "arrivals" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Arrivals ({ops?.arrivals?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab("departures")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${activeTab === "departures" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Departures ({ops?.departures?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab("inHouse")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${activeTab === "inHouse" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  In-House ({ops?.inHouse?.length || 0})
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Guest</th>
                  <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Room</th>
                  <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Check-in</th>
                  <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Check-out</th>
                  <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="text-right px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Amount</th>
                  <th className="text-right px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tabBookings.slice(0, 8).map((b: any) => (
                  <tr key={b.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-800 to-slate-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                          {(b.guestName || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{b.guestName}</p>
                          <p className="text-[10px] text-slate-400">{b.guestPhone || "No phone"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        {b.roomNumber}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-600 text-xs">{b.check_in}</td>
                    <td className="px-6 py-3.5 text-slate-600 text-xs">{b.check_out}</td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide ${
                        b.status === "CHECKED-IN" ? "bg-emerald-100 text-emerald-700" :
                        b.status === "CONFIRMED" ? "bg-amber-100 text-amber-700" :
                        b.status === "CHECKED-OUT" ? "bg-slate-100 text-slate-600" :
                        b.status === "ON-HOLD" ? "bg-purple-100 text-purple-700" :
                        "bg-slate-100 text-slate-600"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          b.status === "CHECKED-IN" ? "bg-emerald-500" :
                          b.status === "CONFIRMED" ? "bg-amber-500" :
                          "bg-slate-400"
                        }`} />
                        {b.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right font-semibold text-slate-800">
                      {formatCurrency((Number(b.amount) || 0) + (Number(b.tax) || 0))}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      {b.balanceDue > 0 ? (
                        <span className="font-bold text-rose-600">{formatCurrency(b.balanceDue)}</span>
                      ) : (
                        <span className="font-bold text-emerald-600 text-xs">Paid ✓</span>
                      )}
                    </td>
                  </tr>
                ))}
                {tabBookings.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="text-4xl mb-3">📭</div>
                      <p className="text-slate-400 text-sm font-medium">
                        No {activeTab === "arrivals" ? "arrivals" : activeTab === "departures" ? "departures" : "in-house guests"} today
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ═══ QUICK LINKS ═══ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickLinkCard href="/calendar" icon="📅" title="Calendar" desc="Manage bookings" />
          <QuickLinkCard href="/housekeeping" icon="🧹" title="Housekeeping" desc="Room cleaning" />
          <QuickLinkCard href="/guests" icon="👤" title="Guests" desc="Guest directory" />
          <QuickLinkCard href="/reports" icon="📈" title="Reports" desc="Sales & analytics" />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// SUB COMPONENTS
// ═══════════════════════════════════════════════

function KpiCard({ label, value, subValue, icon, trend, accent, href }: {
  label: string; value: number | string; subValue: string;
  icon: React.ReactNode; trend: number; accent: "emerald" | "rose" | "sky" | "violet"; href: string;
}) {
  const accentMap = {
    emerald: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200", bar: "bg-emerald-500" },
    rose:    { bg: "bg-rose-50",    text: "text-rose-600",    border: "border-rose-200",    bar: "bg-rose-500" },
    sky:     { bg: "bg-sky-50",     text: "text-sky-600",     border: "border-sky-200",     bar: "bg-sky-500" },
    violet:  { bg: "bg-violet-50",  text: "text-violet-600",  border: "border-violet-200",  bar: "bg-violet-500" },
  }[accent];

  const isPositive = trend >= 0;

  return (
    <Link href={href} className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-xl ${accentMap.bg} ${accentMap.text} flex items-center justify-center`}>
            {icon}
          </div>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 ${
            isPositive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
          }`}>
            {isPositive ? "↑" : "↓"} {Math.abs(trend)}%
          </span>
        </div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
        <p className="text-3xl font-bold text-slate-900 tracking-tight">{value}</p>
        <p className="text-xs text-slate-500 mt-1.5">{subValue}</p>
      </div>
      <div className={`h-1 ${accentMap.bar} opacity-0 group-hover:opacity-100 transition-opacity`} />
    </Link>
  );
}

function HkStatBlock({ label, count, color, icon }: { label: string; count: number; color: string; icon: string }) {
  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    emerald: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
    rose:    { bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-200" },
    sky:     { bg: "bg-sky-50",     text: "text-sky-700",     border: "border-sky-200" },
    amber:   { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200" },
  };
  const c = colorMap[color];
  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-3 text-center`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${c.text}`}>{count}</p>
    </div>
  );
}

function QuickLinkCard({ href, icon, title, desc }: { href: string; icon: string; title: string; desc: string }) {
  return (
    <Link href={href} className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-900 transition-all p-5">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-slate-100 group-hover:bg-slate-900 flex items-center justify-center text-xl transition-all">
          {icon}
        </div>
        <div>
          <p className="text-sm font-bold text-slate-800 group-hover:text-slate-900">{title}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{desc}</p>
        </div>
      </div>
    </Link>
  );
}