"use client";

import React, { useEffect, useState, useMemo } from "react";
import { fetchBookings, fetchRooms, type Room } from "../db";
import type { Booking } from "../types";
import { getPaid, getBalance } from "../types";

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function dayLabel(iso: string): string {
  const today = todayISO();
  if (iso === today) return "Today";
  if (iso === addDaysISO(today, 1)) return "Tomorrow";
  return fmtDate(iso);
}

function monthLabel(iso: string): string {
  const d = new Date(iso);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return months[d.getMonth()];
}

function pctChange(current: number, previous: number): { value: number; isUp: boolean } {
  if (previous === 0) return { value: current > 0 ? 100 : 0, isUp: current > 0 };
  const change = ((current - previous) / previous) * 100;
  return { value: Math.abs(Math.round(change * 100) / 100), isUp: change >= 0 };
}

function rupee(n: number): string {
  if (n >= 100000) return `Rs.${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `Rs.${(n / 1000).toFixed(1)}k`;
  return `Rs.${n.toFixed(0)}`;
}

const WEATHER_BY_MONTH: Record<number, { icon: string; temp: string; desc: string }> = {
  0: { icon: "☀️", temp: "18°C - 28°C", desc: "Mostly sunny" },
  1: { icon: "☀️", temp: "20°C - 30°C", desc: "Sunny" },
  2: { icon: "☀️", temp: "24°C - 33°C", desc: "Sunny" },
  3: { icon: "☀️", temp: "26°C - 35°C", desc: "Hot" },
  4: { icon: "⛅", temp: "25°C - 33°C", desc: "Partly cloudy" },
  5: { icon: "🌧️", temp: "22°C - 28°C", desc: "Rainy" },
  6: { icon: "🌧️", temp: "20°C - 26°C", desc: "Heavy rain" },
  7: { icon: "🌧️", temp: "20°C - 26°C", desc: "Rainy" },
  8: { icon: "⛅", temp: "21°C - 28°C", desc: "Partly cloudy" },
  9: { icon: "☀️", temp: "19°C - 28°C", desc: "12+ rainy days" },
  10: { icon: "⛅", temp: "19°C - 28°C", desc: "9-11 rainy days" },
  11: { icon: "☀️", temp: "16°C - 26°C", desc: "Mostly sunny" },
};

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export default function ReportsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"reservations" | "performance">("performance");

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

  const today = todayISO();
  const yesterday = yesterdayISO();

  const todayBookings = useMemo(
    () => bookings.filter((b) => b.checkIn === today || b.status === "CHECKED-IN"),
    [bookings, today]
  );
  const yesterdayBookings = useMemo(
    () => bookings.filter((b) => b.checkIn === yesterday || (b.checkIn <= yesterday && b.checkOut > yesterday)),
    [bookings, yesterday]
  );

  const todayOccupied = useMemo(() => {
    return bookings.filter(
      (b) => b.status === "CHECKED-IN" || (b.checkIn <= today && b.checkOut > today && b.status !== "CANCELLED" && b.status !== "BLOCKED")
    ).length;
  }, [bookings, today]);

  const todayOccupancy = rooms.length ? Math.round((todayOccupied / rooms.length) * 100) : 0;
  const yesterdayOccupied = yesterdayBookings.filter((b) => b.status !== "CANCELLED" && b.status !== "BLOCKED").length;
  const yesterdayOccupancy = rooms.length ? Math.round((yesterdayOccupied / rooms.length) * 100) : 0;
  const occupancyChange = pctChange(todayOccupancy, yesterdayOccupancy);

  const todayRevenue = todayBookings.reduce((s, b) => s + b.amount, 0);
  const yesterdayRevenue = yesterdayBookings.reduce((s, b) => s + b.amount, 0);
  const revenueChange = pctChange(todayRevenue, yesterdayRevenue);

  const todayPickup = todayBookings.length;
  const yesterdayPickup = yesterdayBookings.length;
  const pickupChange = pctChange(todayPickup, yesterdayPickup);

  const avgPreBookingDays = useMemo(() => {
    if (bookings.length === 0) return 0;
    const total = bookings.reduce((s, b) => {
      const made = new Date(b.bookingMadeOn).getTime();
      const checkin = new Date(b.checkIn).getTime();
      return s + Math.max(0, Math.round((checkin - made) / 86400000));
    }, 0);
    return Math.round(total / bookings.length);
  }, [bookings]);

  const dailyTrends = useMemo(() => {
    const days = [0, 1, 2, 3].map((i) => addDaysISO(today, i));
    return days.map((iso) => {
      const dayBookings = bookings.filter((b) => b.checkIn <= iso && b.checkOut > iso && b.status !== "CANCELLED" && b.status !== "BLOCKED");
      const rates = dayBookings.map((b) => b.amount);
      const minRate = rates.length ? Math.min(...rates) : 1773;
      const maxRate = rates.length ? Math.max(...rates) : 2712;
      const typical = rates.length ? Math.round(rates.reduce((s, r) => s + r, 0) / rates.length) : 2003;
      const demandLevel = dayBookings.length > rooms.length * 0.7 ? "high" : dayBookings.length > rooms.length * 0.4 ? "medium" : "low";
      return { iso, label: dayLabel(iso), typical, minRate, maxRate, demandLevel };
    });
  }, [bookings, rooms, today]);

  const monthlyTrends = useMemo(() => {
    const current = new Date();
    const months = [0, 1, 2, 3].map((i) => {
      const d = new Date(current.getFullYear(), current.getMonth() + i, 1);
      return d;
    });

    return months.map((d) => {
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
      const monthBookings = bookings.filter((b) => b.checkIn >= monthStart && b.checkIn <= monthEnd);
      const avgRate = monthBookings.length
        ? Math.round(monthBookings.reduce((s, b) => s + b.amount, 0) / monthBookings.length)
        : 2200;
      const weather = WEATHER_BY_MONTH[d.getMonth()];
      return {
        key: d.toISOString(),
        label: monthLabel(d.toISOString()),
        avgRate,
        minRate: Math.round(avgRate * 0.8),
        maxRate: Math.round(avgRate * 1.2),
        weather,
        demandLevel: monthBookings.length > 3 ? "Busy" : "Moderate",
        priceLabel: avgRate > 2500 ? "Most expensive" : avgRate > 2000 ? "Pricier" : "Least expensive",
      };
    });
  }, [bookings]);

  const pickupBySource = useMemo(() => {
    const map: Record<string, { rooms: number; revenue: number }> = {};
    const last7 = addDaysISO(today, -7);
    const recentBookings = bookings.filter((b) => b.bookingMadeOn >= last7);

    for (const b of recentBookings) {
      if (!map[b.source]) map[b.source] = { rooms: 0, revenue: 0 };
      map[b.source].rooms += 1;
      map[b.source].revenue += b.amount;
    }
    return Object.entries(map)
      .map(([source, data]) => ({ source, ...data }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [bookings, today]);

  const revenueBySource = useMemo(() => {
    const map: Record<string, number> = {};
    for (const b of bookings) {
      map[b.source] = (map[b.source] || 0) + b.amount;
    }
    return Object.entries(map)
      .map(([source, revenue]) => ({ source, revenue }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [bookings]);

  const revenueByRoomType = useMemo(() => {
    const map: Record<string, number> = {};
    for (const b of bookings) {
      map[b.roomType] = (map[b.roomType] || 0) + b.amount;
    }
    return Object.entries(map)
      .map(([roomType, revenue]) => ({ roomType, revenue }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [bookings]);

  const totalRevenue = bookings.reduce((s, b) => s + b.amount, 0);
  const collected = bookings.reduce((s, b) => s + getPaid(b), 0);
  const outstanding = bookings.reduce((s, b) => s + getBalance(b), 0);

  const dateLine = `Here is what going on with your property on ${fmtDate(today)}`;

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-10 h-10 mx-auto rounded-full border-4 border-gold border-t-transparent animate-spin" />
          <p className="text-navy font-medium mt-4">Loading analytics…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
        <div>
          <h1 className="font-serif text-4xl font-semibold text-navy tracking-tight">
            Good morning
          </h1>
          <p className="text-muted mt-1 text-sm">{dateLine}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-gray-100 p-1 rounded-md flex border border-cream-dark">
            <button
              onClick={() => setTab("reservations")}
              className={`px-4 py-1.5 text-sm font-medium rounded transition ${
                tab === "reservations" ? "bg-slate-800 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Reservations
            </button>
            <button
              onClick={() => setTab("performance")}
              className={`px-4 py-1.5 text-sm font-medium rounded transition ${
                tab === "performance" ? "bg-slate-800 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Performance
            </button>
          </div>
        </div>
      </div>

      {tab === "performance" && (
        <>
          <div className="bg-gray-50 border border-cream-dark rounded-2xl p-5 flex gap-4 items-start mb-6 shadow-sm">
            <div className="text-2xl">🚀</div>
            <div className="flex-1">
              <h3 className="font-bold text-navy">The New Stayflexi is Here</h3>
              <p className="text-sm text-muted mt-1 mb-3">
                AI-powered, faster, smarter, and fully redesigned for modern hoteliers. Experience it now!
              </p>
              <button className="bg-navy text-cream text-xs font-bold px-4 py-2 rounded-md tracking-wide hover:bg-navy-light transition">
                Access New UI
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <BigKpi label="Today's occupancy" value={`${todayOccupancy}%`} change={occupancyChange} changeLabel="Since yesterday" />
            <BigKpi label="Today's revenue" value={rupee(todayRevenue)} change={revenueChange} changeLabel="Since yesterday" />
            <BigKpi label="Today's pickup" value={`${todayPickup} rooms`} change={pickupChange} changeLabel="Since yesterday" />
            <BigKpi label="Pre-booking window" value={`${avgPreBookingDays} days`} change={{ value: 0, isUp: true }} changeLabel="for last 30 days" hideChange />
          </div>

          <div className="flex justify-between items-center mb-4">
            <h2 className="font-serif text-2xl text-navy">Bangalore division daily demand trends</h2>
            <div className="text-xs text-muted flex items-center gap-2">
              Filter by rating
              <span className="text-gold">★★★</span>
              <span className="text-gray-300">☆☆</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {dailyTrends.map((d) => (
              <div key={d.iso} className="bg-white border border-cream-dark rounded-2xl p-4 shadow-sm">
                <p className="text-center text-xs uppercase tracking-widest text-muted font-semibold mb-3">
                  {d.label}
                </p>
                <div className="text-center mb-3">
                  <span className="inline-block bg-gold-light/40 text-gold-dark text-xs font-bold px-3 py-1 rounded-full">
                    Rs.{d.typical}.00 is typical
                  </span>
                </div>
                <div className="relative h-2 bg-gray-100 rounded-full mb-2 overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 bg-rose-300" style={{ width: "33%" }} />
                  <div className="absolute left-1/3 top-0 bottom-0 bg-amber-300" style={{ width: "34%" }} />
                  <div className="absolute left-2/3 top-0 bottom-0 bg-emerald-300" style={{ width: "33%" }} />
                </div>
                <p className="text-xs text-center text-muted mb-4">
                  Usually Rs.{d.minRate}.00 - Rs.{d.maxRate}.00 per night
                </p>
                <button className="text-xs text-blue-600 font-medium underline w-full text-center">
                  View hotels
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center mb-4">
            <h2 className="font-serif text-2xl text-navy">Bangalore division monthly demand trends</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {monthlyTrends.map((m) => (
              <div key={m.key} className="bg-white border border-cream-dark rounded-2xl p-4 shadow-sm">
                <p className="text-center text-xs uppercase tracking-widest text-muted font-semibold mb-3">
                  {m.label}
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{m.weather.icon}</span>
                    <div>
                      <p className="font-semibold text-navy">{m.weather.temp}</p>
                      <p className="text-muted">{m.weather.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">👥</span>
                    <div>
                      <p className="font-semibold text-navy">{m.demandLevel}</p>
                      <p className="text-muted">{m.label} is popular with visitors</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg text-emerald-600">$$$</span>
                    <div>
                      <p className="font-semibold text-navy">{m.priceLabel}</p>
                      <p className="text-muted">
                        Hotels usually cost Rs.{m.minRate}.00 - Rs.{m.maxRate}.00 per night
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white border border-cream-dark rounded-2xl shadow-sm p-6">
              <h3 className="font-serif text-xl text-navy mb-1">Rooms pickup by source</h3>
              <p className="text-xs text-muted mb-4">Data is for past 7 days</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cream-dark">
                    <th className="text-left py-2 text-[10px] uppercase tracking-widest text-muted font-semibold">Source</th>
                    <th className="text-right py-2 text-[10px] uppercase tracking-widest text-muted font-semibold">Room pickup</th>
                  </tr>
                </thead>
                <tbody>
                  {pickupBySource.length === 0 && (
                    <tr>
                      <td colSpan={2} className="py-6 text-center text-muted text-xs">No pickup in last 7 days</td>
                    </tr>
                  )}
                  {pickupBySource.map((s) => (
                    <tr key={s.source} className="border-b border-cream-dark last:border-b-0">
                      <td className="py-2.5 font-semibold text-navy uppercase text-xs">{s.source}</td>
                      <td className="py-2.5 text-right text-navy font-medium">{s.rooms}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-white border border-cream-dark rounded-2xl shadow-sm p-6">
              <h3 className="font-serif text-xl text-navy mb-1">Revenue pickup by source</h3>
              <p className="text-xs text-muted mb-4">Data is for past 7 days</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cream-dark">
                    <th className="text-left py-2 text-[10px] uppercase tracking-widest text-muted font-semibold">Source</th>
                    <th className="text-right py-2 text-[10px] uppercase tracking-widest text-muted font-semibold">Revenue (Rs.)</th>
                  </tr>
                </thead>
                <tbody>
                  {pickupBySource.length === 0 && (
                    <tr>
                      <td colSpan={2} className="py-6 text-center text-muted text-xs">No revenue pickup</td>
                    </tr>
                  )}
                  {pickupBySource.map((s) => (
                    <tr key={s.source} className="border-b border-cream-dark last:border-b-0">
                      <td className="py-2.5 font-semibold text-navy uppercase text-xs">{s.source}</td>
                      <td className="py-2.5 text-right text-navy font-medium">{s.revenue.toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white border border-cream-dark rounded-2xl shadow-sm p-6">
              <h3 className="font-serif text-xl text-navy mb-1">Revenue generated by source</h3>
              <p className="text-xs text-muted mb-4">Data is for past 7 days</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cream-dark">
                    <th className="text-left py-2 text-[10px] uppercase tracking-widest text-muted font-semibold">Source</th>
                    <th className="text-right py-2 text-[10px] uppercase tracking-widest text-muted font-semibold">Revenue (Rs.)</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueBySource.length === 0 && (
                    <tr>
                      <td colSpan={2} className="py-6 text-center text-muted text-xs">No data</td>
                    </tr>
                  )}
                  {revenueBySource.map((s) => (
                    <tr key={s.source} className="border-b border-cream-dark last:border-b-0">
                      <td className="py-2.5 font-semibold text-navy uppercase text-xs">{s.source}</td>
                      <td className="py-2.5 text-right text-navy font-medium">{s.revenue.toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-white border border-cream-dark rounded-2xl shadow-sm p-6">
              <h3 className="font-serif text-xl text-navy mb-1">Revenue generated by roomtype</h3>
              <p className="text-xs text-muted mb-4">Data is for past 7 days</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cream-dark">
                    <th className="text-left py-2 text-[10px] uppercase tracking-widest text-muted font-semibold">Roomtype</th>
                    <th className="text-right py-2 text-[10px] uppercase tracking-widest text-muted font-semibold">Revenue (Rs.)</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueByRoomType.length === 0 && (
                    <tr>
                      <td colSpan={2} className="py-6 text-center text-muted text-xs">No data</td>
                    </tr>
                  )}
                  {revenueByRoomType.map((s) => (
                    <tr key={s.roomType} className="border-b border-cream-dark last:border-b-0">
                      <td className="py-2.5 font-semibold text-navy text-xs">{s.roomType}</td>
                      <td className="py-2.5 text-right text-navy font-medium">{s.revenue.toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "reservations" && (
        <>
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
              <p className="text-xs text-muted uppercase tracking-wide">Total Rooms</p>
              <p className="font-serif text-2xl font-semibold text-navy mt-1">{rooms.length}</p>
            </div>
          </div>

          <div className="bg-white border border-cream-dark rounded-2xl shadow-sm p-6">
            <h3 className="font-serif text-lg text-navy mb-4">Booking Status</h3>
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

function BigKpi({
  label,
  value,
  change,
  changeLabel,
  hideChange,
}: {
  label: string;
  value: string;
  change: { value: number; isUp: boolean };
  changeLabel: string;
  hideChange?: boolean;
}) {
  return (
    <div className="bg-white border border-cream-dark rounded-2xl p-5 shadow-sm">
      {!hideChange && change.value !== 0 && (
        <p className={`text-xs font-bold mb-1 ${change.isUp ? "text-emerald-600" : "text-rose-500"}`}>
          {change.isUp ? "+" : "-"}{change.value}%
        </p>
      )}
      <p className="text-xs text-muted mb-2">{changeLabel}</p>
      <p className="font-serif text-4xl font-semibold text-navy">{value}</p>
      <p className="text-xs text-navy/70 mt-2 font-medium">{label}</p>
    </div>
  );
}
