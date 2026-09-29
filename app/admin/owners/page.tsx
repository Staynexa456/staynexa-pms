// app/admin/owners/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { fetchOwnersWithHotels } from "../../lib/platform-admin";

export default function AdminOwnersPage() {
  const [owners, setOwners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const data = await fetchOwnersWithHotels();
      setOwners(data);
      setLoading(false);
    }
    load();
  }, []);

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
        <h1 className="text-3xl font-bold text-white">Hotel Owners</h1>
        <p className="text-sm text-slate-400 mt-1">
          {owners.length} owners across the platform
        </p>
      </div>

      <div className="space-y-3">
        {owners.map((owner) => (
          <div key={owner.user_id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === owner.user_id ? null : owner.user_id)}
              className="w-full p-5 flex items-center gap-4 hover:bg-slate-800/40 transition text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold shrink-0">
                {owner.name?.charAt(0).toUpperCase() || "O"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-white">{owner.name || "Unknown"}</p>
                <p className="text-xs text-slate-500">{owner.email}</p>
                {owner.phone && <p className="text-[10px] text-slate-600">{owner.phone}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-bold text-purple-400">{owner.hotels.length}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                  {owner.hotels.length === 1 ? "Hotel" : "Hotels"}
                </p>
              </div>
              <span className="text-slate-500 text-lg shrink-0">
                {expanded === owner.user_id ? "▲" : "▼"}
              </span>
            </button>

            {expanded === owner.user_id && (
              <div className="border-t border-slate-800 p-5 bg-slate-950/50">
                {owner.hotels.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">
                    No hotels assigned yet
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {owner.hotels.map((h: any) => (
                      <Link
                        key={h.id}
                        href={`/admin/hotels/${h.id}`}
                        className="p-4 bg-slate-900 border border-slate-800 rounded-xl hover:border-purple-500 transition flex items-center gap-3"
                      >
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold shrink-0">
                          {h.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-white truncate">{h.name}</p>
                          <p className="text-[10px] text-slate-500 truncate">
                            {h.city || "—"}{h.state ? `, ${h.state}` : ""}
                          </p>
                        </div>
                        {h.is_active && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                            ACTIVE
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
