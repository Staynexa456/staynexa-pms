// app/admin/hotels/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  fetchAllHotelsForAdmin,
  adminToggleHotelActive,
  adminDeleteHotel,
  type HotelSummary,
} from "../../lib/platform-admin";

export default function AdminHotelsPage() {
  const [hotels, setHotels] = useState<HotelSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");

  const load = async () => {
    setLoading(true);
    const data = await fetchAllHotelsForAdmin();
    setHotels(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleToggle = async (id: string, active: boolean) => {
    await adminToggleHotelActive(id, !active);
    await load();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This will remove all data permanently.`)) return;
    await adminDeleteHotel(id);
    await load();
  };

  const filtered = hotels.filter(h => {
    if (filter === "active" && !h.is_active) return false;
    if (filter === "inactive" && h.is_active) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        h.name?.toLowerCase().includes(s) ||
        h.owner_email?.toLowerCase().includes(s) ||
        h.city?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div className="p-8">
        <div className="w-12 h-12 mx-auto rounded-full border-4 border-purple-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">All Hotels</h1>
          <p className="text-sm text-slate-400 mt-1">
            {hotels.length} hotels across the platform
          </p>
        </div>
        <Link
          href="/admin/hotels/new"
          className="px-5 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl text-sm font-bold hover:opacity-90 transition"
        >
          + Create Hotel
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-6 flex gap-3 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, owner, city..."
          className="flex-1 min-w-[200px] px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 outline-none focus:border-purple-500"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          className="px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:border-purple-500"
        >
          <option value="all">All Hotels</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-950">
              <tr>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Hotel</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Owner</th>
                <th className="text-center px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Rooms</th>
                <th className="text-center px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Bookings</th>
                <th className="text-right px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Revenue</th>
                <th className="text-center px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-right px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.map((h) => (
                <tr key={h.id} className="hover:bg-slate-800/40 transition">
                  <td className="px-5 py-4">
                    <Link href={`/admin/hotels/${h.id}`} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {h.name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-white">{h.name}</p>
                        <p className="text-xs text-slate-500">{h.city || "—"}{h.state ? `, ${h.state}` : ""}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-xs font-semibold text-slate-300">{h.owner_email || "Unassigned"}</p>
                    {h.owner_name && <p className="text-[10px] text-slate-500">{h.owner_name}</p>}
                  </td>
                  <td className="px-5 py-4 text-center text-white font-bold">{h.rooms_count || 0}</td>
                  <td className="px-5 py-4 text-center text-white font-bold">{h.bookings_count || 0}</td>
                  <td className="px-5 py-4 text-right text-emerald-400 font-bold">
                    ₹{Math.round((h.total_revenue || 0) / 1000)}K
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      h.is_active
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-rose-500/20 text-rose-400"
                    }`}>
                      {h.is_active ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleToggle(h.id, h.is_active)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold ${
                          h.is_active
                            ? "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30"
                            : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                        }`}
                      >
                        {h.is_active ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() => handleDelete(h.id, h.name)}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-slate-800 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400"
                      >
                        Delete
                      </button>
                    </div>
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
