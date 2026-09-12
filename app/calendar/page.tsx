"use client";

import React, { useState } from "react";
import {
  bookings as seedBookings,
  rooms,
  statusColors,
  statusLabels,
  type Booking,
} from "../data";

// ─── DATE HELPERS ───
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
function prettyDate(iso: string): string {
  const d = new Date(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
function prettyDateTime(iso: string): string {
  const d = new Date(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm} ${d.getHours() >= 12 ? "PM" : "AM"}`;
}
function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(checkIn).getTime();
  const b = new Date(checkOut).getTime();
  return Math.max(1, Math.round((b - a) / (1000 * 60 * 60 * 24)));
}

// ─── LEGEND ───
const legendItems = [
  { label: "Confirmed", color: "bg-amber-400" },
  { label: "Checked-in", color: "bg-emerald-500" },
  { label: "Checked-out / Due out", color: "bg-rose-500" },
  { label: "Blocked", color: "bg-blue-500" },
  { label: "Cancelled", color: "bg-gray-300" },
];

// ─── MODIFY OPTIONS (matching Stayflexi) ───
const modifyOptions = [
  { label: "Hold booking", enabled: true },
  { label: "Set to no show", enabled: true },
  { label: "Lock booking", enabled: true },
  { label: "Unassign room", enabled: true },
  { label: "Modify checkin", enabled: true },
  { label: "Modify checkout", enabled: true },
  { label: "Split Room", enabled: true },
  { label: "Move Room", enabled: true },
  { label: "Send magic link", enabled: true },
];

export default function CalendarPage() {
  const [startDate, setStartDate] = useState("2026-09-12");
  const [bookings, setBookings] = useState<Booking[]>(seedBookings);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Modify dropdown state
  const [showModifyMenu, setShowModifyMenu] = useState(false);

  // Notes editing
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");

  // Add guest
  const [newGuest, setNewGuest] = useState("");

  const daysToShow = 14;
  const dates = getDates(startDate, daysToShow);

  const shiftDates = (offset: number) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + offset);
    setStartDate(fmt(d));
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const updateStatus = (id: string, newStatus: Booking["status"], message: string) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: newStatus } : b))
    );
    if (selected?.id === id) setSelected({ ...selected, status: newStatus });
    showToast(message);
  };

  const updateField = <K extends keyof Booking>(id: string, field: K, value: Booking[K], message: string) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, [field]: value } : b))
    );
    if (selected?.id === id) setSelected({ ...selected, [field]: value });
    showToast(message);
  };

  // Settle dues
  const settleDues = (b: Booking) => {
    updateField(b.id, "paid", b.amount, `💰 Dues settled · ₹${(b.amount - b.paid).toLocaleString("en-IN")}`);
  };

  // Add guest to guest list
  const addGuest = (b: Booking) => {
    if (!newGuest.trim()) return;
    const list = [...(b.guestList || [b.guest]), newGuest.trim()];
    updateField(b.id, "guestList", list, `👤 ${newGuest} added to guests`);
    setNewGuest("");
  };

  // Save notes
  const saveNotes = (b: Booking) => {
    updateField(b.id, "notes", notesDraft, "📝 Notes updated");
    setEditingNotes(false);
  };

  // Handle modify option click
  const handleModifyOption = (label: string) => {
    if (!selected) return;
    setShowModifyMenu(false);
    // Special cases
    if (label === "Send magic link") {
      showToast("✨ Magic link sent to guest");
      return;
    }
    if (label === "Set to no show") {
      updateStatus(selected.id, "CANCELLED", "🚫 Marked as no-show");
      return;
    }
    if (label === "Lock booking") {
      showToast("🔒 Booking locked");
      return;
    }
    if (label === "Hold booking") {
      showToast("⏸ Booking on hold");
      return;
    }
    if (label === "Unassign room") {
      showToast("🚪 Room unassigned");
      return;
    }
    // Generic
    showToast(`✔ ${label} applied`);
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
          <button onClick={() => shiftDates(-7)} className="px-3 py-2 border border-cream-dark rounded-lg text-sm font-medium text-navy hover:bg-cream transition">← Prev week</button>
          <button onClick={() => setStartDate("2026-09-12")} className="px-4 py-2 border border-cream-dark rounded-lg text-sm font-medium text-navy hover:bg-cream transition">Today</button>
          <button onClick={() => shiftDates(7)} className="px-3 py-2 border border-cream-dark rounded-lg text-sm font-medium text-navy hover:bg-cream transition">Next week →</button>
        </div>
      </div>

      {/* LEGEND */}
      <div className="flex flex-wrap gap-4 mb-4 text-xs items-center">
        <span className="text-muted font-medium">Status:</span>
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${item.color}`} />
            <span className="text-navy/70">{item.label}</span>
          </div>
        ))}
        <span className="ml-auto text-gold-dark font-medium">💡 Click any booking to open details</span>
      </div>

      {/* TAPE CHART */}
      <div className="bg-white border border-cream-dark rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[1400px]">
            <div className="flex border-b border-cream-dark bg-cream-dark/40">
              <div className="w-32 shrink-0 px-4 py-3 text-xs font-semibold text-navy uppercase tracking-wide border-r border-cream-dark">Rooms</div>
              {dates.map((d, i) => {
                const s = shortFmt(d);
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const isToday = fmt(d) === "2026-09-12";
                return (
                  <div key={i} className={`flex-1 min-w-[80px] px-2 py-2 text-center border-r border-cream-dark ${isWeekend ? "bg-gold/10" : ""} ${isToday ? "bg-gold/20" : ""}`}>
                    <div className="text-[10px] font-medium text-muted uppercase">{s.day}</div>
                    <div className={`text-sm font-semibold ${isToday ? "text-gold-dark" : isWeekend ? "text-gold-dark" : "text-navy"}`}>
                      {s.date} {s.month}
                    </div>
                  </div>
                );
              })}
            </div>

            {rooms.map((room) => (
              <div key={room.number} className="flex border-b border-cream-dark last:border-b-0 hover:bg-cream/30 transition-colors">
                <div className="w-32 shrink-0 px-4 py-3 border-r border-cream-dark flex flex-col justify-center">
                  <div className="text-sm font-bold text-navy">{room.number}</div>
                  <div className="text-[10px] text-muted truncate">{room.type}</div>
                </div>
                <div className="flex flex-1 relative">
                  {dates.map((d, i) => {
                    const currentBookings = bookings.filter(
                      (b) => b.roomNumber === room.number && bookingSpansDate(b, d)
                    );
                    return (
                      <div key={i} className="flex-1 min-w-[80px] h-14 border-r border-cream-dark relative">
                        {currentBookings.map((b) => {
                          const isFirstDay = fmt(d) === b.checkIn;
                          if (!isFirstDay) return null;
                          const startIdx = dates.findIndex((dd) => fmt(dd) === b.checkIn);
                          const endIdx = dates.findIndex((dd) => fmt(dd) === b.checkOut);
                          const span = endIdx === -1 ? dates.length - startIdx : endIdx - startIdx;
                          return (
                            <button
                              key={b.id}
                              onClick={() => setSelected(b)}
                              className={`absolute top-2 left-1 h-10 ${statusColors[b.status]} rounded-md shadow-sm flex items-center px-2 hover:opacity-90 hover:scale-[1.02] transition-all z-10 overflow-hidden text-left`}
                              style={{ width: `calc(${span} * 100% - 0.5rem)`, minWidth: "100%" }}
                            >
                              <div className="flex flex-col truncate leading-tight w-full">
                                <span className="text-[11px] font-semibold truncate">{b.guest}</span>
                                <span className="text-[9px] font-medium uppercase tracking-wide opacity-90">{statusLabels[b.status]}</span>
                              </div>
                            </button>
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
          <p className="font-serif text-2xl font-semibold text-navy mt-1">{rooms.length}</p>
        </div>
        <div className="bg-white border border-cream-dark rounded-xl p-4 shadow-sm border-l-4 border-l-amber-400">
          <p className="text-xs text-muted uppercase tracking-wide">Confirmed</p>
          <p className="font-serif text-2xl font-semibold text-navy mt-1">{bookings.filter((b) => b.status === "CONFIRMED").length}</p>
        </div>
        <div className="bg-white border border-cream-dark rounded-xl p-4 shadow-sm border-l-4 border-l-emerald-500">
          <p className="text-xs text-muted uppercase tracking-wide">In-house</p>
          <p className="font-serif text-2xl font-semibold text-navy mt-1">{bookings.filter((b) => b.status === "CHECKED-IN").length}</p>
        </div>
        <div className="bg-white border border-cream-dark rounded-xl p-4 shadow-sm border-l-4 border-l-rose-500">
          <p className="text-xs text-muted uppercase tracking-wide">Due out</p>
          <p className="font-serif text-2xl font-semibold text-navy mt-1">{bookings.filter((b) => b.status === "PENDING DEPARTURE").length}</p>
        </div>
        <div className="bg-white border border-cream-dark rounded-xl p-4 shadow-sm border-l-4 border-l-blue-500">
          <p className="text-xs text-muted uppercase tracking-wide">Blocked</p>
          <p className="font-serif text-2xl font-semibold text-navy mt-1">{bookings.filter((b) => b.status === "BLOCKED").length}</p>
        </div>
      </div>

      {/* ───── RESERVATION DETAILS PANEL (Stayflexi-style) ───── */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-navy/40 backdrop-blur-sm z-40" onClick={() => { setSelected(null); setShowModifyMenu(false); setEditingNotes(false); }} />
          <aside className="fixed top-0 right-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-cream-dark flex justify-between items-center bg-white sticky top-0 z-10">
              <h2 className="font-serif text-xl font-semibold text-navy">Reservation details</h2>
              <button
                onClick={() => { setSelected(null); setShowModifyMenu(false); setEditingNotes(false); }}
                className="text-2xl text-muted hover:text-navy leading-none"
              >×</button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* ─── SECTION 1: RESERVATION ─── */}
              <div className="p-6 border-b border-cream-dark">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="font-serif text-lg font-semibold text-navy">Reservation</h3>
                    {selected.source === "goibibo" && (
                      <span className="text-sm font-bold text-orange-500">goibibo</span>
                    )}
                    {selected.source === "agoda" && (
                      <span className="text-sm font-bold text-red-500">agoda</span>
                    )}
                    {selected.source === "makemytrip" && (
                      <span className="text-sm font-bold text-red-600">make<span className="text-blue-600">MyTrip</span></span>
                    )}
                    {selected.source === "expedia" && (
                      <span className="text-sm font-bold text-blue-800">Expedia</span>
                    )}
                    {selected.source === "booking" && (
                      <span className="text-sm font-bold text-indigo-600">Booking.com</span>
                    )}
                  </div>

                  {/* MODIFY BUTTON */}
                  <div className="relative">
                    <button
                      onClick={() => setShowModifyMenu(!showModifyMenu)}
                      className="px-4 py-1.5 border border-cream-dark rounded-lg text-sm font-medium text-navy hover:bg-cream transition flex items-center gap-1.5"
                    >
                      ✏️ Modify
                    </button>
                    {showModifyMenu && (
                      <div className="absolute top-full right-0 mt-2 z-20 bg-white border border-cream-dark rounded-lg shadow-xl min-w-[200px] py-1">
                        {modifyOptions.map((opt) => (
                          <button
                            key={opt.label}
                            onClick={() => handleModifyOption(opt.label)}
                            className="w-full text-left px-4 py-2 text-sm text-navy/80 hover:bg-cream transition-colors"
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-xs text-navy/70 mb-4">
                  {selected.id}
                  {selected.otaId && ` ( OTA ID : ${selected.otaId}`}
                  {selected.otaPin && ` , PIN : ${selected.otaPin} )`}
                  {selected.otaId && !selected.otaPin && ` )`}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                  <Row label="Dates" value={`${prettyDateTime(selected.checkIn)} - ${prettyDateTime(selected.checkOut)} ( ${nightsBetween(selected.checkIn, selected.checkOut)} Night${nightsBetween(selected.checkIn, selected.checkOut) > 1 ? "s" : ""} )`} />
                  <Row label="Room type" value={`${selected.roomType} ( ${selected.ratePlan} )`} />
                  <Row label="Booked Room No.(s)" value={selected.roomNumber} />
                  <Row label="Booking made on" value={prettyDateTime(selected.bookingMadeOn)} />
                  <Row label="Booking source" value={selected.source.toUpperCase()} />
                  {selected.otaId && <Row label="OTA Booking Id" value={selected.otaId} />}
                  {selected.otaPin && <Row label="Reservation PIN" value={selected.otaPin} />}
                </div>

                {/* ACTION BUTTONS */}
                <div className="flex flex-wrap gap-2 mt-5">
                  <button
                    onClick={() => updateStatus(selected.id, "CHECKED-OUT", `🚪 ${selected.guest} checked out`)}
                    className="px-4 py-2 border border-cream-dark rounded-lg text-xs font-medium text-navy hover:bg-cream transition"
                  >
                    Checkout
                  </button>
                  <button
                    onClick={() => showToast("📄 Opening folio…")}
                    className="px-4 py-2 border border-cream-dark rounded-lg text-xs font-medium text-navy hover:bg-cream transition"
                  >
                    View folio
                  </button>
                  <button
                    onClick={() => showToast(`✉️ Confirmation emailed to ${selected.email || selected.guest}`)}
                    className="px-4 py-2 border border-cream-dark rounded-lg text-xs font-medium text-navy hover:bg-cream transition"
                  >
                    Email booking confirmation
                  </button>
                  <button
                    onClick={() => showToast("🖨 Printing registration card…")}
                    className="px-4 py-2 border border-cream-dark rounded-lg text-xs font-medium text-navy hover:bg-cream transition"
                  >
                    Print registration card
                  </button>
                </div>
              </div>

              {/* ─── SECTION 2: GUESTS ─── */}
              <div className="p-6 border-b border-cream-dark">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-serif text-lg font-semibold text-navy">Guests</h3>
                  <button
                    onClick={() => {
                      const list = [...(selected.guestList || [selected.guest])];
                      if (!list.includes("New Guest")) list.push("New Guest");
                      updateField(selected.id, "guestList", list, "👤 Guest added");
                    }}
                    className="px-4 py-1.5 border border-cream-dark rounded-lg text-sm font-medium text-navy hover:bg-cream transition"
                  >
                    + Add Guests
                  </button>
                </div>
                <p className="text-sm text-navy/80 mb-4">
                 
