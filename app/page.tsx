"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { fetchBookings } from "./db";
import type { Booking } from "./types";
import { getPaid, getBalance } from "./types";

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

function computeStats(bookings: Booking[]) {
  const today = todayISO();
  return {
    newBookings: bookings.filter((b) => b.bookingMadeOn === today).length || bookings.length,
    inHouse: bookings.filter((b) => b.status === "CHECKED-IN").length,
    arrivals: bookings.filter((b) => b.checkIn === today && b.status === "CONFIRMED").length,
    departures: bookings.filter((b) => b.checkOut === today).length,
    cancellations: bookings.filter((b) => b.status === "CANCELLED").length,
    onHold: 0,
    noShows: 0,
    magicLink: 0,
  };
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export default function DashboardPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [dashboardTab, setDashboardTab] = useState<"reservations" | "performance">("reservations");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchBookings();
      setBookings(data);
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = computeStats(bookings);

  const statsData = [
    { label: "New bookings", value: stats.newBookings, color: "border-t-teal-300" },
    { label: "In-house", value: stats.inHouse, color: "border-t-green-300" },
    { label: "Arrivals", value: stats.arrivals, color: "border-t-yellow-300" },
    { label: "Departures", value: stats.departures, color: "border-t-indigo-400" },
    { label: "Cancellations", value: stats.cancellations, color: "border-t-red-400" },
    { label: "On hold", value: stats.onHold, color: "border-t-slate-500" },
    { label: "No shows", value: stats.noShows, color: "border-t-gray-300" },
    { label: "Magic link", value: stats.magicLink, color: "border-t-pink-300" },
  ];

  const totalOutstanding = bookings.reduce((sum, b) => sum + getBalance(b), 0);
  const totalCollected = bookings.reduce((sum, b) => sum + getPaid(b), 0);
  const totalRevenue = bookings.reduce((sum, b) => sum + b.amount, 0);

  // ─── Performance tab metrics ───
  const today = todayISO();
  const yesterday = yesterdayISO();

  const todayBookings = bookings.filter((b) => b.checkIn === today || b.status === "CHECKED-IN");
  const yesterdayBookings = bookings.filter(
    (b) => b.checkIn === yesterday || (b.checkIn <= yesterday && b.checkOut > yesterday)
  );

  const todayRevenue = todayBookings.reduce((s, b) => s + b.amount, 0);
  const yesterdayRevenue = yesterdayBookings.reduce((s, b) => s + b.amount, 0);
  const revenueChange = pctChange(todayRevenue, yesterdayRevenue);

  const todayPickup = todayBookings.length;
  const yesterdayPickup = yesterdayBookings.length;
  const pickupChange = pctChange(todayPickup, yesterdayPickup);

  const avgPreBookingDays = bookings.length
    ? Math.round(
        bookings.reduce((s, b) => {
          const made = new Date(b.bookingMadeOn).getTime();
          const checkin = new Date(b.checkIn).getTime();
          return s + Math.max(0, Math.round((checkin - made) / 86400000));
        }, 0) / bookings.length
      )
    : 0;

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* ═══════════════ HEADER ═══════════════ */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
        <div>
          <h1 className="font-serif text-4xl font-semibold text-navy">
            Good evening
          </h1>
          <p className="text-muted mt-1 text-sm md:text-base">
            Here is what going on with your property on{" "}
            <span className="font-semibold text-navy underline decoration-gold decoration-2 underline-offset-4">
              {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
          </p>
        </div>

        {/* TABS */}
        <div className="flex items-center gap-1 bg-cream-dark p-1 rounded-lg">
          <button
            onClick={() => setDashboardTab("reservations")}
            className={`px-5 py-2 text-sm font-medium rounded-md transition ${
              dashboardTab === "reservations"
                ? "bg-navy text-cream shadow-sm"
                : "text-navy/60 hover:text-navy"
            }`}
          >
            Reservations
          </button>
          <button
            onClick={() => setDashboardTab("performance")}
            className={`px-5 py-2 text-sm font-medium rounded-md transition ${
              dashboardTab === "performance"
                ? "bg-navy text-cream shadow-sm"
                : "text-navy/60 hover:text-navy"
            }`}
          >
            Performance
          </button>
        </div>
      </div>

      {/* ═══════════════ RESERVATIONS TAB ═══════════════ */}
      {dashboardTab === "reservations" && (
        <>
          {/* BANNER */}
          <div className="bg-white border border-cream-dark rounded-xl p-4 flex gap-4 items-start mb-6 shadow-sm">
            <div className="text-xl">🚀</div>
            <div className="flex-1">
              <h3 className="font-serif text-base font-semibold text-navy">
                Welcome to Staynexa PMS
              </h3>
              <p className="text-xs text-muted mt-1 mb-3">
                Live data from your database · Click{" "}
                <button onClick={load} className="text-gold-dark underline font-medium">
                  {loading ? "loading…" : "refresh"}
                </button>{" "}
                to update
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted uppercase tracking-wide">Collected</p>
              <p className="font-serif text-lg font-semibold text-emerald-600">
                ₹{totalCollected.toLocaleString("en-IN")}
              </p>
            </div>
          </div>

          {/* STATS CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
            {statsData.map((stat, idx) => (
              <div
                key={idx}
                className={`bg-white rounded-lg p-4 flex flex-col justify-between h-28 border-t-4 ${stat.color} shadow-sm`}
              >
                <span className="font-serif text-3xl font-semibold text-navy leading-none">
                  {stat.value}
                </span>
                <span className="text-xs text-muted font-medium tracking-wide">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>

          {/* LOADING */}
          {loading && (
            <div className="bg-white border border-cream-dark rounded-xl p-12 text-center mb-6">
              <p className="text-navy font-medium">⏳ Loading bookings from database…</p>
            </div>
          )}

          {/* BOOKINGS LIST */}
          {!loading && (
            <>
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
                <input
                  type="text"
                  placeholder="Type and press enter to add tags and search"
                  className="w-full md:w-1/2 p-2.5 border border-cream-dark rounded-lg text-sm outline-none focus:border-gold transition-colors bg-white"
                />
                <div className="flex gap-2 items-center text-sm">
                  <span className="text-muted text-xs">Sort by</span>
                  <select className="border border-cream-dark rounded-lg p-2 outline-none text-navy/80 bg-white text-sm">
                    <option>Booking Date</option>
                    <option>Guest Name</option>
                  </select>
                  <button className="border border-navy text-navy px-3 py-2 rounded-lg text-sm font-medium hover:bg-navy hover:text-cream transition">
                    Download report
                  </button>
                </div>
              </div>

              <div className="bg-white border border-cream-dark rounded-xl shadow-sm divide-y divide-cream-dark">
                {bookings.length === 0 && (
                  <div className="p-12 text-center text-muted">
                    No bookings yet. Add one from the Calendar page.
                  </div>
                )}
                {bookings.slice(0, 20).map((b) => (
                  <div
                    key={b.id}
                    className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-center text-sm hover:bg-cream/40 transition-colors"
                  >
                    <div className="md:col-span-2">
                      <p className="font-semibold text-navy">{b.primaryGuest.name}</p>
                      <p className="text-muted text-xs mt-0.5">{b.primaryGuest.phone}</p>
                    </div>
                    <div className="md:col-span-3">
                      <p className="text-navy/70 text-xs">{b.id}</p>
                      <div className="mt-1 flex items-center">
                        {b.source === "agoda" && <span className="text-[10px] font-bold text-red-500">agoda</span>}
                        {b.source === "makemytrip" && (
                          <span className="text-[10px] font-bold text-red-600">
                            make<span className="text-blue-600">MyTrip</span>
                          </span>
                        )}
                        {b.source === "expedia" && <span className="text-[10px] font-bold text-blue-800">Expedia</span>}
                        {b.source === "goibibo" && <span className="text-[10px] font-bold text-orange-500">goibibo</span>}
                        {b.source === "booking" && <span className="text-[10px] font-bold text-indigo-600">Booking.com</span>}
                        {b.source === "direct" && <span className="text-[10px] font-bold text-gray-500">Direct</span>}
                      </div>
                    </div>
                    <div className="md:col-span-3">
                      <p className="text-navy/70 text-xs">
                        {b.checkIn} → {b.checkOut}
                      </p>
                    </div>
                    <div className="md:col-span-2 md:text-right">
                      <div className="flex items-center md:justify-end gap-1 text-navy font-medium text-xs">
                        🔑 {b.roomNumber} · {b.roomType}
                      </div>
                      <p className="text-muted text-xs mt-0.5">
                        ({b.adults} / {b.children})
                      </p>
                    </div>
                    <div className="md:col-span-2 md:text-right">
                      <p className={`text-xs font-bold ${b.status === "PENDING DEPARTURE" ? "text-red-500" : "text-navy/70"}`}>
                        {b.status}
                      </p>
                      <p className="text-xs text-navy mt-0.5">
                        Total <span className="font-semibold">₹{b.amount.toLocaleString("en-IN")}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* SUMMARY CARDS */}
          {!loading && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="bg-white border border-cream-dark rounded-xl shadow-sm p-5">
                <h3 className="font-serif text-base font-semibold text-navy mb-3">
                  Total Bookings
                </h3>
                <p className="font-serif text-3xl font-semibold text-navy">{bookings.length}</p>
                <p className="text-xs text-muted mt-1">Across all dates</p>
              </div>

              <div className="bg-white border border-cream-dark rounded-xl shadow-sm p-5">
                <h3 className="font-serif text-base font-semibold text-navy mb-3">
                  Outstanding
                </h3>
                <p className="font-serif text-3xl font-semibold text-rose-500">
                  ₹{totalOutstanding.toLocaleString("en-IN")}
                </p>
                <p className="text-xs text-muted mt-1">Pending collection</p>
              </div>

              <div className="bg-white border border-cream-dark rounded-xl shadow-sm p-5">
                <h3 className="font-serif text-base font-semibold text-navy mb-3">
                  Collected
                </h3>
                <p className="font-serif text-3xl font-semibold text-emerald-600">
                  ₹{totalCollected.toLocaleString("en-IN")}
                </p>
                <p className="text-xs text-muted mt-1">From all bookings</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══════════════ PERFORMANCE TAB ═══════════════ */}
      {dashboardTab === "performance" && (
        <>
          {/* Big KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white border border-cream-dark rounded-xl p-5 shadow-sm">
              <p className="text-xs font-bold mb-1 text-navy/60">Today</p>
              <p className="text-xs text-muted mb-2">Reservations</p>
              <p className="font-serif text-4xl font-semibold text-navy">{todayPickup}</p>
              <p className="text-xs text-navy/70 mt-2 font-medium">Today&apos;s pickup</p>
            </div>

            <div className="bg-white border border-cream-dark rounded-xl p-5 shadow-sm">
              {revenueChange.value !== 0 && (
                <p className={`text-xs font-bold mb-1 ${revenueChange.isUp ? "text-emerald-600" : "text-rose-500"}`}>
                  {revenueChange.isUp ? "+" : "-"}{revenueChange.value}%
                </p>
              )}
              <p className="text-xs text-muted mb-2">Since yesterday</p>
              <p className="font-serif text-4xl font-semibold text-navy">{rupee(todayRevenue)}</p>
              <p className="text-xs text-navy/70 mt-2 font-medium">Today&apos;s revenue</p>
            </div>

            <div className="bg-white border border-cream-dark rounded-xl p-5 shadow-sm">
              {pickupChange.value !== 0 && (
                <p className={`text-xs font-bold mb-1 ${pickupChange.isUp ? "text-emerald-600" : "text-rose-500"}`}>
                  {pickupChange.isUp ? "+" : "-"}{pickupChange.value}%
                </p>
              )}
              <p className="text-xs text-muted mb-2">Since yesterday</p>
              <p className="font-serif text-4xl font-semibold text-navy">{todayPickup} rooms</p>
              <p className="text-xs text-navy/70 mt-2 font-medium">Today&apos;s pickup</p>
            </div>

            <div className="bg-white border border-cream-dark rounded-xl p-5 shadow-sm">
              <p className="text-xs text-muted mb-2">for last 30 days</p>
              <p className="font-serif text-4xl font-semibold text-navy">{avgPreBookingDays} days</p>
              <p className="text-xs text-navy/70 mt-2 font-medium">Pre-booking window</p>
            </div>
          </div>

          {/* KPIs summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white border border-cream-dark rounded-xl p-5 shadow-sm border-l-4 border-l-emerald-500">
              <p className="text-xs text-muted uppercase tracking-wide">Total Collected</p>
              <p className="font-serif text-3xl font-semibold text-emerald-600 mt-1">
                ₹{totalCollected.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="bg-white border border-cream-dark rounded-xl p-5 shadow-sm border-l-4 border-l-rose-500">
              <p className="text-xs text-muted uppercase tracking-wide">Total Outstanding</p>
              <p className="font-serif text-3xl font-semibold text-rose-500 mt-1">
                ₹{totalOutstanding.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="bg-white border border-cream-dark rounded-xl p-5 shadow-sm border-l-4 border-l-gold">
              <p className="text-xs text-muted uppercase tracking-wide">Total Revenue</p>
              <p className="font-serif text-3xl font-semibold text-navy mt-1">
                ₹{totalRevenue.toLocaleString("en-IN")}
              </p>
            </div>
          </div>

          {/* Full reports CTA */}
          <div className="bg-navy rounded-2xl p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-gold/80 font-semibold mb-2">
                Detailed analytics
              </p>
              <h3 className="font-serif text-3xl text-cream mb-2">
                Explore all reports
              </h3>
              <p className="text-cream/70 text-sm max-w-lg">
                Access 40+ reports covering property, front desk, payments, taxes, POS, channel manager, and more.
              </p>
            </div>
            <Link
              href="/reports"
              className="px-6 py-3.5 bg-gradient-to-b from-gold-light to-gold text-navy rounded-xl font-semibold text-sm shadow-lg shadow-gold/30 hover:-translate-y-0.5 transition-all whitespace-nowrap"
            >
              Open Reports →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
