"use client";

import React, { useState } from "react";
import {
  bookings,
  rooms,
  statusColors,
  statusLabels,
  type Booking,
} from "../data";

// Get N dates starting from a base date
function getDates(startDate: string, days: number): Date[] {
  const dates: Date[] = [];
  const start = new Date(startDate);
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shortFmt(d: Date): { day: string; date: number; month: string } {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return { day: days[d.getDay()], date: d.getDate(), month: months[d.getMonth()] };
}

function bookingSpansDate(b: Booking, date: Date): boolean {
  const dateStr = fmt(date);
  return b.checkIn <= dateStr && b.checkOut > dateStr;
}

// ─── LEGEND ITEMS ───
const legendItems: { label: string; color: string }[] = [
  { label: "Confirmed", color: "bg-amber-400" },
  { label: "Checked-in", color: "bg-emerald-500" },
  { label: "Checked-out / Due out", color: "bg-rose-500" },
  { label: "Blocked", color: "bg-blue-500" },
  { label: "Cancelled", color: "bg-gray-300" },
];

export default function CalendarPage() {
  const [startDate, setStartDate] = useState("2026-09-12");
  const daysToShow = 14;
  const dates = getDates(startDate, daysToShow);

  const shiftDates = (offset: number) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + offset);
    setStartDate(fmt(d));
  };

  return (
    <div className="p-6 lg:p-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-navy">Calendar</h1>
          <p className="text-muted mt-1 text-sm">
            Tape chart view · {rooms.length} rooms · {bookings.length} bookings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftDates(-7)}
            className="px-3 py-2 border border-cream-dark rounded-lg text-sm font-medium text-navy hover:bg-cream transition"
          >
            ← Prev week
          </button>
          <button
            onClick={() => setStartDate("2026-09-12")}
            className="px-4 py-2 bg-navy text-cream rounded-lg text-sm font-medium hover:bg-navy-light transition"
          >
            Today
          </button>
          <button
            onClick={() => shiftDates(7)}
            className="px-3 py-2 border border-cream-dark rounded-lg text-sm font-medium text-navy hover:bg-cream transition"
          >
            Next week →
          </button>
        </div>
      </div>

      {/* LEGEND — by STATUS now */}
      <div className="flex flex-wrap gap-4 mb-4 text-xs items-center">
        <span className="text-muted font-medium">Status:</span>
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${item.color}`} />
            <span className="text-navy/70">{item.label}</span>
          </div>
        ))}
      </div>

      {/* TAPE CHART */}
      <div className="bg-white border border-cream-dark rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[1400px]">
            {/* HEADER ROW */}
            <div className="flex border-b border-cream-dark bg-cream-dark/40">
              <div className="w-32 shrink-0 px-4 py-3 text-xs font-semibold text-navy uppercase tracking-wide border-r border-cream-dark">
                Rooms
              </div>
              {dates.map((d, i) => {
                const s = shortFmt(d);
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const isToday = fmt(d) === "2026-09-13";
                return (
                  <div
                    key={i}
                    className={`flex-1 min-w-[80px] px-2 py-2 text-center border-r border-cream-dark ${
                      isWeekend ? "bg-gold/10" : ""
                    } ${isToday ? "bg-gold/20" : ""}`}
                  >
                    <div className="text-[10px] font-medium text-muted uppercase">
                      {s.day}
                    </div>
                    <div
                      className={`text-sm font-semibold ${
                        isToday
                          ? "text-gold-dark"
                          : isWeekend
                          ? "text-gold-dark"
                          : "text-navy"
                      }`}
                    >
                      {s.date} {s.month}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ROOM ROWS */}
            {rooms.map((room) => (
              <div
                key={room.number}
                className="flex border-b border-cream-dark last:border-b-0 hover:bg-cream/30 transition-colors"
              >
                <div className="w-32 shrink-0 px-4 py-3 border-r border-cream-dark flex flex-col justify-center">
                  <div className="text-sm font-bold text-navy">{room.number}</div>
                  <div className="text-[10px] text-muted truncate">
                    {room.type}
                  </div>
                </div>

                <div className="flex flex-1 relative">
                  {dates.map((d, i) => {
                    const currentBookings = bookings.filter(
                      (b) =>
                        b.roomNumber === room.number && bookingSpansDate(b, d)
                    );
                    return (
                      <div
                        key={i}
                        className="flex-1 min-w-[80px] h-14 border-r border-cream-dark relative"
                      >
                        {currentBookings.map((b) => {
                          const isFirstDay = fmt(d) === b.checkIn;
                          if (!isFirstDay) return null;

                          const startIdx = dates.findIndex(
                            (dd) => fmt(dd) === b.checkIn
                          );
                          const endIdx = dates.findIndex(
                            (dd) => fmt(dd) === b.checkOut
                          );
                          const span =
                            endIdx === -1
                              ? dates.length - startIdx
                              : endIdx - startIdx;

                          return (
                            <div
                              key={b.id}
                              className={`absolute top-2 left-1 h-10 ${statusColors[b.status]} rounded-md shadow-sm flex items-center px-2 cursor-pointer hover:opacity-90 z-10 overflow-hidden`}
                              style={{
                                width: `calc(${span} * 100% - 0.5rem)`,
                                minWidth: "100%",
                              }}
                              title={`${b.guest} · ${b.id} · ${statusLabels[b.status]} · ${b.checkIn} → ${b.checkOut}`}
                            >
                              <div className="flex flex-col truncate leading-tight">
                                <span className="text-[11px] font-semibold truncate">
                                  {b.guest}
                                </span>
                                <span className="text-[9px] font-medium uppercase tracking-wide opacity-90">
                                  {statusLabels[b.status]}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
        <div className="bg-white border border-cream-dark rounded-xl p-4 shadow-sm">
          <p className="text-xs text-muted uppercase tracking-wide">Total Rooms</p>
          <p className="font-serif text-2xl font-semibold text-navy mt-1">
            {rooms.length}
          </p>
        </div>
        <div className="bg-white border border-cream-dark rounded-xl p-4 shadow-sm border-l-4 border-l-amber-400">
          <p className="text-xs text-muted uppercase tracking-wide">Confirmed</p>
          <p className="font-serif text-2xl font-semibold text-navy mt-1">
            {bookings.filter((b) => b.status === "CONFIRMED").length}
          </p>
        </div>
        <div className="bg-white border border-cream-dark rounded-xl p-4 shadow-sm border-l-4 border-l-emerald-500">
          <p className="text-xs text-muted uppercase tracking-wide">In-house</p>
          <p className="font-serif text-2xl font-semibold text-navy mt-1">
            {bookings.filter((b) => b.status === "CHECKED-IN").length}
          </p>
        </div>
        <div className="bg-white border border-cream-dark rounded-xl p-4 shadow-sm border-l-4 border-l-rose-500">
          <p className="text-xs text-muted uppercase tracking-wide">Due out</p>
          <p className="font-serif text-2xl font-semibold text-navy mt-1">
            {bookings.filter((b) => b.status === "PENDING DEPARTURE").length}
          </p>
        </div>
        <div className="bg-white border border-cream-dark rounded-xl p-4 shadow-sm border-l-4 border-l-blue-500">
          <p className="text-xs text-muted uppercase tracking-wide">Blocked</p>
          <p className="font-serif text-2xl font-semibold text-navy mt-1">
            {bookings.filter((b) => b.status === "BLOCKED").length}
          </p>
        </div>
      </div>
    </div>
  );
}
