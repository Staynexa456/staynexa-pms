"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  rooms,
  roomCategories,
  baseRates,
  rateOverrides,
} from "../data";
import { fetchBookings } from "../db";
import type { Booking } from "../types";
import { getPaid, getBalance } from "../types";

// ─── DATE HELPERS ───
function getDates(startDate: string, days: number): Date[] {
  const out: Date[] = [];
  const start = new Date(startDate);
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(d);
  }
  return out;
}
function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function shortFmt(d: Date) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return { day: days[d.getDay()], date: d.getDate(), month: months[d.getMonth()] };
}
function bookingSpansDate(b: Booking, date: Date): boolean {
  const dateStr = fmt(date);
  return b.checkIn <= dateStr && b.checkOut > dateStr;
}
function getRate(category: string, plan: string, date: Date): number {
  const key = `${fmt(date)}_${category}_${plan}`;
  if (rateOverrides[key] !== undefined) return rateOverrides[key];
  return baseRates[category]?.[plan] ?? 0;
}

export default function InventoryPage() {
  const [startDate, setStartDate] = useState("2026-09-12");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const daysToShow = 7;
  const dates = getDates(startDate, daysToShow);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchBookings();
      setBookings(data);
    } catch (err) {
      console.error("Inventory load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const shiftDates = (offset: number) => {
    const d = parseISO(startDate);
    d.setDate(d.getDate() + offset);
    setStartDate(fmt(d));
  };

  // Occupancy for a specific date
  const getOccupancyForDate = (date: Date) => {
    const totalRooms = rooms.length;
    const occupied = bookings.filter(
      (b) =>
        b.status !== "CANCELLED" &&
        b.status !== "BLOCKED" &&
        bookingSpansDate(b, date)
    ).length;
    const blocked = bookings.filter(
      (b) => b.status === "BLOCKED" && bookingSpansDate(b, date)
    ).length;
    const available = totalRooms - occupied - blocked;
    const occupancyPct =
      totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0;
    return { totalRooms, occupied, blocked, available, occupancyPct };
  };

  const totalCollected = bookings.reduce((sum, b) => sum + getPaid(b), 0);
  const totalOutstanding = bookings.reduce((sum, b) => sum + getBalance(b), 0);
  const totalValue = bookings.reduce((sum, b) => sum + b.amount, 0);

  return (
    <div className="p-6 lg:p-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-navy">
            Inventory &amp; Rates
          </h1>
          <p className="text-muted mt-1 text-sm">
            Manage occupancy, availability, and daily prices ·{" "}
            <button onClick={load} className="text-gold-dark font-medium hover:underline">
              {loading ? "loading…" : "🔄 Refresh"}
            </button>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftDates(-7)}
            className="px-3 py-2 border border-cream-dark rounded-lg text-sm font-medium text-navy hover:bg-cream transition"
          >
            ← Prev
          </button>
          <button
            onClick={() => setStartDate("2026-09-12")}
            className="px-4 py-2 border border-cream-dark rounded-lg text-sm font-medium text-navy hover:bg-cream transition"
          >
            This week
          </button>
          <button
            onClick={() => shiftDates(7)}
            className="px-3 py-2 border border-cream-dark rounded-lg text-sm font-medium text-navy hover:bg-cream transition"
          >
            Next →
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-cream-dark rounded-xl p-5 shadow-sm">
          <p className="text-xs text-muted uppercase tracking-wide">Total Rooms</p>
          <p className="font-serif text-2xl font-semibold text-navy mt-1">
            {rooms.length}
          </p>
        </div>
        <div className="bg-white border border-cream-dark rounded-xl p-5 shadow-sm border-l-4 border-l-emerald-500">
          <p className="text-xs text-muted uppercase tracking-wide">Collected</p>
          <p className="font-serif text-2xl font-semibold text-emerald-600 mt-1">
            ₹{totalCollected.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="bg-white border border-cream-dark rounded-xl p-5 shadow-sm border-l-4 border-l-rose-500">
          <p className="text-xs text-muted uppercase tracking-wide">Outstanding</p>
          <p className="font-serif text-2xl font-semibold text-rose-500 mt-1">
            ₹{totalOutstanding.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="bg-white border border-cream-dark rounded-xl p-5 shadow-sm border-l-4 border-l-gold">
          <p className="text-xs text-muted uppercase tracking-wide">Total Value</p>
          <p className="font-serif text-2xl font-semibold text-navy mt-1">
            ₹{totalValue.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      {/* LOADING */}
      {loading && (
        <div className="bg-white border border-cream-dark rounded-xl p-12 text-center mb-6">
          <p className="text-navy font-medium">⏳ Loading occupancy from database…</p>
        </div>
      )}

      {/* OCCUPANCY TABLE */}
      {!loading && (
        <div className="bg-white border border-cream-dark rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-navy text-cream">
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider w-48">
                    Occupancy Metrics
                  </th>
                  {dates.map((d, i) => {
                    const s = shortFmt(d);
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <th
                        key={i}
                        className={`text-center px-3 py-3 text-xs font-semibold uppercase tracking-wider ${
                          isWeekend ? "text-gold-light" : ""
                        }`}
                      >
                        <div className="text-[10px] opacity-70">{s.day}</div>
                        <div>
                          {s.date} {s.month}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-cream-dark">
                  <td className="px-4 py-3 text-sm font-medium text-navy">
                    Occupancy (%)
                  </td>
                  {dates.map((d, i) => {
                    const o = getOccupancyForDate(d);
                    const color =
                      o.occupancyPct >= 80
                        ? "text-emerald-600"
                        : o.occupancyPct >= 50
                        ? "text-amber-600"
                        : o.occupancyPct > 0
                        ? "text-rose-500"
                        : "text-muted";
                    return (
                      <td key={i} className="text-center px-3 py-3">
                        <span className={`font-bold text-base ${color}`}>
                          {o.occupancyPct}%
                        </span>
                      </td>
                    );
                  })}
                </tr>
                <tr className="border-b border-cream-dark">
                  <td className="px-4 py-3 text-sm font-medium text-navy">
                    Total Available
                  </td>
                  {dates.map((d, i) => {
                    const o = getOccupancyForDate(d);
                    return (
                      <td
                        key={i}
                        className="text-center px-3 py-3 text-navy font-semibold"
                      >
                        {o.available}
                      </td>
                    );
                  })}
                </tr>
                <tr className="border-b border-cream-dark">
                  <td className="px-4 py-3 text-sm font-medium text-navy">
                    Total Booked
                  </td>
                  {dates.map((d, i) => {
                    const o = getOccupancyForDate(d);
                    return (
                      <td
                        key={i}
                        className="text-center px-3 py-3 text-navy font-semibold"
                      >
                        {o.occupied}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-navy">
                    Blocked
                  </td>
                  {dates.map((d, i) => {
                    const o = getOccupancyForDate(d);
                    return (
                      <td
                        key={i}
                        className="text-center px-3 py-3 text-blue-600 font-semibold"
                      >
                        {o.blocked}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RATE MANAGER */}
      {!loading && roomCategories.map((cat) => (
        <div
          key={cat.name}
          className="bg-white border border-cream-dark rounded-xl shadow-sm overflow-hidden mb-4"
        >
          <div className="flex items-center justify-between px-5 py-3 bg-cream/40 border-b border-cream-dark">
            <div className="flex items-center gap-3">
              <h3 className="font-serif text-base font-semibold text-navy">
                {cat.name}
              </h3>
              <span className="text-xs text-muted bg-white px-2 py-0.5 rounded-full border border-cream-dark">
                {cat.totalRooms} rooms
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-cream-dark bg-cream/20">
                  <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted w-32">
                    Rate plan
                  </th>
                  {dates.map((d, i) => {
                    const s = shortFmt(d);
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <th
                        key={i}
                        className={`text-center px-3 py-2 text-[10px] font-semibold uppercase tracking-wider ${
                          isWeekend ? "text-gold-dark" : "text-muted"
                        }`}
                      >
                        {s.day} {s.date} {s.month}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {cat.ratePlans.map((plan) => (
                  <tr
                    key={plan.code}
                    className="border-b border-cream-dark last:border-b-0 hover:bg-cream/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-bold text-navy">
                      {plan.label}
                    </td>
                    {dates.map((d, i) => {
                      const rate = getRate(cat.name, plan.code, d);
                      const base = baseRates[cat.name]?.[plan.code] ?? 0;
                      const isOverridden = rate !== base;
                      return (
                        <td key={i} className="text-center px-2 py-2">
                          <input
                            type="number"
                            defaultValue={rate}
                            className={`w-24 text-center px-2 py-1.5 border rounded-md text-sm font-medium outline-none transition ${
                              isOverridden
                                ? "border-gold bg-gold/5 text-gold-dark font-semibold"
                                : "border-cream-dark text-navy hover:border-gold focus:border-gold"
                            }`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
