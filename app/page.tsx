"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getActiveHotelId } from "./active-hotel";
import { 
  fetchDashboardStatsForDate, 
  fetchRevenueStats, 
  fetchTodayOperations,
  fetchHousekeepingRooms,
} from "./db";

type Kpi = "newBookings" | "inHouse" | "arrivals" | "departures" | "cancellations" | "onHold" | "noShows" | "magicLink";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [revenue, setRevenue] = useState<any>(null);
  const [ops, setOps] = useState<any>(null);
  const [hkStats, setHkStats] = useState<{ clean: number; dirty: number; maintenance: number; inspected: number; total: number }>({
    clean: 0, dirty: 0, maintenance: 0, inspected: 0, total: 0,
  });
  const [rooms, setRooms] = useState<any[]>([]);

  const today = new Date().toISOString().slice(0, 10);
  const todayPretty = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const hotelId = getActiveHotelId() || undefined;

      const [statsData, revenueData, opsData, roomsData] = await Promise.all([
        fetchDashboardStatsForDate(hotelId, today),
        fetchRevenueStats(hotelId),
        fetchTodayOperations(hotelId),
        fetchHousekeepingRooms(hotelId),
      ]);

      setStats(statsData);
      setRevenue(revenueData);
      setOps(opsData);
      setRooms(roomsData);

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

  const occupancyPct = stats && hkStats.total > 0
    ? Math.round(((stats.inHouse || 0) / hkStats.total) * 100)
    : 0;

  const formatCurrency = (n: number) => 
    `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-teal-500 border-t-transparent animate-spin" />
          <p className="text-gray-600 text-sm font-medium">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] p-6">
      {/* HEADER */}
      <div className="mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            🏛 Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">{todayPretty}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/calendar"
            className="px-4 py-2 bg-black text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition"
          >
            📅 Go to Calendar
          </Link>
          <button
            onClick={loadAll}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* TOP KPI ROW */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider opacity-80">Arrivals Today</span>
            <span className="text-2xl">🛬</span>
          </div>
          <p className="text-3xl font-bold">{ops?.arrivals?.length || 0}</p>
          <p className="text-xs opacity-80 mt-1">{formatCurrency(ops?.arrivalsRevenue || 0)} expected</p>
        </div>

        <div className="bg-gradient-to-br from-rose-500 to-red-600 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider opacity-80">Departures Today</span>
            <span className="text-2xl">🛫</span>
          </div>
          <p className="text-3xl font-bold">{ops?.departures?.length || 0}</p>
          <p className="text-xs opacity-80 mt-1">Expected check-outs</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider opacity-80">In-House</span>
            <span className="text-2xl">🏨</span>
          </div>
          <p className="text-3xl font-bold">{stats?.inHouse || 0}</p>
          <p className="text-xs opacity-80 mt-1">Currently staying</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-fuchsia-600 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider opacity-80">Occupancy</span>
            <span className="text-2xl">📊</span>
          </div>
          <p className="text-3xl font-bold">{occupancyPct}%</p>
          <p className="text-xs opacity-80 mt-1">{stats?.inHouse || 0} / {hkStats.total} rooms</p>
        </div>
      </div>

      {/* REVENUE + HOUSEKEEPING ROW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Revenue Card */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">💰</span>
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Revenue</h2>
            </div>
            <Link href="/reports" className="text-[11px] font-bold text-teal-600 hover:text-teal-800 uppercase tracking-wide">
              View Reports →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Today</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(revenue?.todayRevenue || 0)}</p>
              <p className="text-[10px] text-gray-400 mt-1">{revenue?.todayBookings || 0} new bookings</p>
            </div>
            <div className="border-l border-gray-100 pl-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">This Week</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(revenue?.weekRevenue || 0)}</p>
              <p className="text-[10px] text-gray-400 mt-1">Sun - Today</p>
            </div>
            <div className="border-l border-gray-100 pl-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">This Month</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(revenue?.monthRevenue || 0)}</p>
              <p className="text-[10px] text-gray-400 mt-1">{revenue?.monthBookings || 0} bookings</p>
            </div>
          </div>
        </div>

        {/* Housekeeping Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">🧹</span>
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Housekeeping</h2>
            </div>
            <Link href="/housekeeping" className="text-[11px] font-bold text-teal-600 hover:text-teal-800 uppercase tracking-wide">
              Manage →
            </Link>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-gray-600 font-medium">Clean</span>
              </div>
              <span className="text-sm font-bold text-gray-900">{hkStats.clean}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-xs text-gray-600 font-medium">Dirty</span>
              </div>
              <span className="text-sm font-bold text-gray-900">{hkStats.dirty}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-xs text-gray-600 font-medium">Inspected</span>
              </div>
              <span className="text-sm font-bold text-gray-900">{hkStats.inspected}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-xs text-gray-600 font-medium">Maintenance</span>
              </div>
              <span className="text-sm font-bold text-gray-900">{hkStats.maintenance}</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECOND ROW: PENDING PAYMENTS + RECENT BOOKINGS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Pending Payment */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Pending Payments</h2>
            </div>
          </div>
          <p className="text-3xl font-bold text-rose-600">{formatCurrency(ops?.pendingAmount || 0)}</p>
          <p className="text-xs text-gray-500 mt-2">
            {ops?.pendingPayment?.length || 0} booking{(ops?.pendingPayment?.length || 0) !== 1 ? "s" : ""} with balance due
          </p>
          {ops?.pendingPayment?.length > 0 && (
            <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
              {ops.pendingPayment.slice(0, 5).map((b: any) => (
                <div key={b.id} className="flex items-center justify-between text-xs border-b border-gray-100 pb-2 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-800 truncate">{b.guestName}</p>
                    <p className="text-gray-400">Room {b.roomNumber}</p>
                  </div>
                  <span className="font-bold text-rose-600">{formatCurrency(b.balanceDue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Bookings */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">📋</span>
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Recent Bookings</h2>
            </div>
            <Link href="/calendar" className="text-[11px] font-bold text-teal-600 hover:text-teal-800 uppercase tracking-wide">
              View All →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">Guest</th>
                  <th className="text-left px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">Room</th>
                  <th className="text-left px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">Check-in</th>
                  <th className="text-left px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">Status</th>
                  <th className="text-right px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(ops?.recentBookings || []).map((b: any) => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-gray-800">{b.guestName}</p>
                      <p className="text-[10px] text-gray-400">{b.guestPhone || "No phone"}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-700">{b.roomNumber}</td>
                    <td className="px-5 py-3 text-gray-600 text-xs">{b.check_in}</td>
                    <td className="px-5 py-3">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${
                        b.status === "CHECKED-IN" ? "bg-emerald-100 text-emerald-700" :
                        b.status === "CONFIRMED" ? "bg-amber-100 text-amber-700" :
                        b.status === "CHECKED-OUT" ? "bg-gray-100 text-gray-600" :
                        "bg-gray-100 text-gray-600"
                      }`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-gray-800">
                      {formatCurrency((Number(b.amount) || 0) + (Number(b.tax) || 0))}
                    </td>
                  </tr>
                ))}
                {(ops?.recentBookings || []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-gray-400 text-sm">
                      No bookings yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* QUICK NAVIGATION */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/calendar" className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:shadow-md hover:border-teal-300 transition group">
          <div className="text-3xl mb-2 group-hover:scale-110 transition">📅</div>
          <p className="text-sm font-bold text-gray-800">Calendar</p>
          <p className="text-[10px] text-gray-400 mt-1">Manage bookings</p>
        </Link>
        <Link href="/housekeeping" className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:shadow-md hover:border-teal-300 transition group">
          <div className="text-3xl mb-2 group-hover:scale-110 transition">🧹</div>
          <p className="text-sm font-bold text-gray-800">Housekeeping</p>
          <p className="text-[10px] text-gray-400 mt-1">Room cleaning status</p>
        </Link>
        <Link href="/guests" className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:shadow-md hover:border-teal-300 transition group">
          <div className="text-3xl mb-2 group-hover:scale-110 transition">👤</div>
          <p className="text-sm font-bold text-gray-800">Guests</p>
          <p className="text-[10px] text-gray-400 mt-1">Guest directory</p>
        </Link>
        <Link href="/reports" className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:shadow-md hover:border-teal-300 transition group">
          <div className="text-3xl mb-2 group-hover:scale-110 transition">📈</div>
          <p className="text-sm font-bold text-gray-800">Reports</p>
          <p className="text-[10px] text-gray-400 mt-1">Sales & analytics</p>
        </Link>
      </div>
    </div>
  );
}