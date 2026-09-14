"use client";

import React, { useEffect, useState } from "react";
import { fetchBookings, fetchRooms, type Room } from "../db";
import type { Booking } from "../types";
import { getPaid, getBalance } from "../types";

export default function ReportsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [b, r] = await Promise.all([fetchBookings(), fetchRooms()]);
        setBookings(b);
        setRooms(r);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalRevenue = bookings.reduce((s, b) => s + b.amount, 0);
  const collected = bookings.reduce((s, b) => s + getPaid(b), 0);
  const outstanding = bookings.reduce((s, b) => s + getBalance(b), 0);

  const occupied = bookings.filter((b) => b.status === "CHECKED-IN").length;
  const occupancy = rooms.length ? Math.round((occupied / rooms.length) * 100) : 0;

  const nights = bookings.reduce((s, b) => {
    const inD = new Date(b.checkIn).getTime();
    const outD = new Date(b.checkOut).getTime();
    return s + Math.max(1, Math.round((outD - inD) / 86400000));
  }, 0);

  const adr = nights ? Math.round(totalRevenue / nights) : 0;
  const revpar = rooms.length ? Math.round(totalRevenue / rooms.length) : 0;

  // Booking source breakdown
  const sources: Record<string, number> = {};
  for (const b of bookings) {
    sources[b.source] = (sources[b.source] || 0) + 1;
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-semibold text-navy">Reports</h1>
        <p className="text-muted mt-1 text-sm">
          {bookings.length} bookings across {rooms.length} rooms
        </p>
      </div>

      {loading && (
        <div className="bg-white rounded-2xl border border-navy/5 p-12 text-center">
          <p className="text-navy font-medium">⏳ Loading analytics…</p>
        </div>
      )}

      {!loading && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white border border-cream-dark rounded-xl p-5 shadow-sm">
              <p className="text-xs text-muted uppercase tracking-wide">Total Revenue</p>
              <p className="font-serif text-2xl font-semibold text-navy mt-1">
                ₹{totalRevenue.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="bg-white border border-cream-dark rounded-xl p-5 shadow-sm border-l-4 border-l-emerald-500">
              <p className="text-xs text-muted uppercase tracking-wide">Collected</p>
              <p className="font-serif text-2xl font-semibold text-emerald-600 mt-1">
                ₹{collected.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="bg-white border border-cream-dark rounded-xl p-5 shadow-sm border-l-4 border-l-rose-500">
              <p className="text-xs text-muted uppercase tracking-wide">Outstanding</p>
              <p className="font-serif text-2xl font-semibold text-rose-500 mt-1">
                ₹{outstanding.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="bg-white border border-cream-dark rounded-xl p-5 shadow-sm border-l-4 border-l-gold">
              <p className="text-xs text-muted uppercase tracking-wide">Occupancy</p>
              <p className="font-serif text-2xl font-semibold text-navy mt-1">{occupancy}%</p>
            </div>
          </div>

          {/* ADR, RevPAR */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white border border-cream-dark rounded-xl p-5 shadow-sm">
              <p className="text-xs text-muted uppercase tracking-wide">ADR (Avg Daily Rate)</p>
              <p className="font-serif text-2xl font-semibold text-navy mt-1">₹{adr.toLocaleString("en-IN")}</p>
              <p className="text-[10px] text-muted mt-1">Revenue ÷ room-nights</p>
            </div>
            <div className="bg-white border border-cream-dark rounded-xl p-5 shadow-sm">
              <p className="text-xs text-muted uppercase tracking-wide">RevPAR</p>
              <p className="font-serif text-2xl font-semibold text-navy mt-1">₹{revpar.toLocaleString("en-IN")}</p>
              <p className="text-[10px] text-muted mt-1">Revenue ÷ total rooms</p>
            </div>
            <div className="bg-white border border-cream-dark rounded-xl p-5 shadow-sm">
              <p className="text-xs text-muted uppercase tracking-wide">Room-Nights</p>
              <p className="font-serif text-2xl font-semibold text-navy mt-1">{nights}</p>
              <p className="text-[10px] text-muted mt-1">Total nights booked</p>
            </div>
            <div className="bg-white border border-cream-dark rounded-xl p-5 shadow-sm">
              <p className="text-xs text-muted uppercase tracking-wide">Total Rooms</p>
              <p className="font-serif text-2xl font-semibold text-navy mt-1">{rooms.length}</p>
              <p className="text-[10px] text-muted mt-1">In this property</p>
            </div>
          </div>

          {/* Source Breakdown */}
          <div className="bg-white border border-cream-dark rounded-xl shadow-sm p-6 mb-6">
            <h3 className="font-serif text-lg font-semibold text-navy mb-4">Booking Sources</h3>
            {Object.keys(sources).length === 0 ? (
              <p className="text-sm text-muted">No bookings yet.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(sources)
                  .sort(([, a], [, b]) => b - a)
                  .map(([src, count]) => {
                    const pct = Math.round((count / bookings.length) * 100);
                    return (
                      <div key={src}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-navy font-medium capitalize">{src}</span>
                          <span className="text-muted">{count} bookings · {pct}%</span>
                        </div>
                        <div className="h-2 bg-cream rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-gold-light to-gold rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Status Breakdown */}
          <div className="bg-white border border-cream-dark rounded-xl shadow-sm p-6">
            <h3 className="font-serif text-lg font-semibold text-navy mb-4">Booking Status</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: "Confirmed", key: "CONFIRMED", color: "text-amber-600" },
                { label: "Checked-in", key: "CHECKED-IN", color: "text-emerald-600" },
                { label: "Checked-out", key: "CHECKED-OUT", color: "text-rose-600" },
                { label: "Due out", key: "PENDING DEPARTURE", color: "text-rose-500" },
                { label: "Blocked", key: "BLOCKED", color: "text-blue-600" },
              ].map((s) => {
                const count = bookings.filter((b) => b.status === s.key).length;
                return (
                  <div key={s.key} className="text-center">
                    <p className={`font-serif text-3xl font-semibold ${s.color}`}>{count}</p>
                    <p className="text-xs text-muted mt-1">{s.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
