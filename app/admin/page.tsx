// app/admin/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { fetchAllHotelsForAdmin, type HotelSummary } from "../lib/platform-admin";

export default function AdminDashboard() {
  const [hotels, setHotels] = useState<HotelSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await fetchAllHotelsForAdmin();
      setHotels(data);
      setLoading(false);
    }
    load();
  }, []);

  const stats = {
    totalHotels: hotels.length,
    activeHotels: hotels.filter(h => h.is_active).length,
    totalOwners: new Set(hotels.map(h => h.owner_id).filter(Boolean)).size,
    totalRevenue: hotels.reduce((sum, h) => sum + (h.total_revenue || 0), 0),
    totalRooms: hotels.reduce((sum, h) => sum + (h.rooms_count || 0), 0),
    totalBookings: hotels.reduce((sum, h) => sum + (h.bookings_count || 0), 0),
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="w-12 h-12 mx-auto rounded-full border-4 border-purple-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Platform Dashboard</h1>
        <p className="text-sm text-slate-400 mt-1">
          Monitor all hotels, owners and revenue across Staynexa
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {[
          { label: "Total Hotels", value: stats.totalHotels, icon: "🏨", color: "from-blue-500 to-blue-600" },
          { label: "Active Hotels", value: stats.activeHotels, icon: "✅", color: "from-emerald-500 to-emerald-600" },
          { label: "Total Owners", value: stats.totalOwners, icon: "👥", color: "from-purple-500 to-purple-600" },
          { label: "Total Rooms", value: stats.totalRooms, icon: "🛏️", color: "from-amber-500 to-orange-500" },
          { label: "Total Bookings", value: stats.totalBookings, icon: "📅", color: "from-pink-500 to-rose-500" },
          { label: "Total Revenue", value: `₹${Math.round(stats.totalRevenue / 1000)}K`, icon: "💰", color: "from-teal-500 to-cyan-500" },
        ].map((s, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-lg mb-3`}>
              {s.icon}
            </div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{s.label}</p>
            <p className="text-2xl font-bold text-white mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-bold text-white mb-4">Quick Actions</h2>
        <div className="flex gap-3 flex-wrap">
          <Link href="/admin/hotels" className="px-5 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl text-sm font-bold hover:opacity-90 transition">
            🏨 Manage All Hotels
          </Link>
          <Link href="/admin/owners" className="px-5 py-3 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-700 transition">
            👥 View Owners
          </Link>
          <Link href="/admin/payments" className="px-5 py-3 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-700 transition">
            💰 All Payments
          </Link>
        </div>
      </div>

      {/* Recent Hotels */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Recent Hotels</h2>
          <Link href="/admin/hotels" className="text-xs font-bold text-purple-400 hover:text-purple-300">
            View All →
          </Link>
        </div>
        <div className="divide-y divide-slate-800">
          {hotels.slice(0, 5).map((h) => (
            <Link
              key={h.id}
              href={`/admin/hotels/${h.id}`}
              className="p-4 flex items-center gap-4 hover:bg-slate-800/50 transition"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                {h.name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{h.name}</p>
                <p className="text-xs text-slate-500 truncate">
                  {h.owner_email || "No owner"} · {h.city || "—"}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-white">₹{Math.round((h.total_revenue || 0) / 1000)}K</p>
                <p className="text-[10px] text-slate-500">{h.rooms_count} rooms</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
