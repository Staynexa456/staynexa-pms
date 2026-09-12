"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  bookings as seedBookings,
  rooms,
  statusColors,
  statusLabels,
  type Booking,
} from "../data";
import type { Guest, Payment, BookingStatus } from "../types";
import { getPaid, getBalance, emptyGuest } from "../types";

// ─── HELPERS ───
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
function addDays(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return fmt(d);
}
function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
}
function shortFmt(d: Date) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return { day: days[d.getDay()], date: d.getDate(), month: months[d.getMonth()] };
}
function bookingSpansDate(b: Booking, date: Date): boolean {
  const s = fmt(date);
  return b.checkIn <= s && b.checkOut > s;
}
function prettyDate(iso: string): string {
  if (!iso) return "—";
  const d = parseISO(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
function prettyDateTime(iso: string, time = "12:00 PM"): string {
  return `${prettyDate(iso)}, ${time}`;
}
function nightsBetween(a: string, b: string): number {
  return Math.max(1, daysBetween(a, b));
}

const legendItems = [
  { label: "Confirmed", color: "bg-amber-400" },
  { label: "Checked-in", color: "bg-emerald-500" },
  { label: "Checked-out / Due out", color: "bg-rose-500" },
  { label: "Blocked", color: "bg-blue-500" },
  { label: "Cancelled", color: "bg-gray-300" },
];

const modifyOptions = [
  "Hold booking", "Set to no show", "Lock booking", "Unassign room",
  "Modify checkin", "Modify checkout", "Split Room", "Move Room", "Send magic link",
];

const CELL_WIDTH = 80;
const ROW_HEIGHT = 56;
const DRAG_THRESHOLD = 5;

export default function CalendarPage() {
  const [startDate, setStartDate] = useState("2026-09-12");
  const [bookings, setBookings] = useState<Booking[]>(seedBookings);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showModifyMenu, setShowModifyMenu] = useState(false);

  // Modals
  const [paymentModalFor, setPaymentModalFor] = useState<Booking | null>(null);
  const [folioFor, setFolioFor] = useState<Booking | null>(null);
  const [regCardFor, setRegCardFor] = useState<Booking | null>(null);
  const [guestFormFor, setGuestFormFor] = useState<Booking | null>(null);

  // Notes
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");

  // Drag
  const dragRef = useRef<{
    bookingId: string;
    startX: number;
    startY: number;
    originRoom: string;
    originCheckIn: string;
    originCheckOut: string;
    hasMoved: boolean;
  } | null>(null);
  const [dragVisual, setDragVisual] = useState<{
    bookingId: string;
    currentX: number;
    currentY: number;
    previewRoom: string;
    previewCheckIn: string;
    previewCheckOut: string;
  } | null>(null);

  const daysToShow = 14;
  const dates = getDates(startDate, daysToShow);

  const shiftDates = (offset: number) => {
    const d = parseISO(startDate);
    d.setDate(d.getDate() + offset);
    setStartDate(fmt(d));
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // ─── STATE UPDATERS ───
  const updateBooking = (id: string, patch: Partial<Booking>, message?: string) => {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    setSelected((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
    if (message) showToast(message);
  };

  const handleCheckIn = (b: Booking) => {
    updateBooking(
      b.id,
      {
        status: "CHECKED-IN",
        notes: `${b.notes ? b.notes + " · " : ""}Checked in at ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`,
      },
      `✅ ${b.primaryGuest.name} checked into Room ${b.roomNumber}`
    );
  };

  const handleCheckOut = (b: Booking) => {
    const balance = getBalance(b);
    if (balance > 0) {
      showToast(`⚠ Cannot check-out · ₹${balance.toFixed(2)} balance due. Settle first.`);
      return;
    }
    updateBooking(
      b.id,
      {
        status: "CHECKED-OUT",
        notes: `${b.notes ? b.notes + " · " : ""}Checked out at ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`,
      },
      `🚪 ${b.primaryGuest.name} checked out`
    );
  };

  const handleAddPayment = (b: Booking, payment: Payment) => {
    const updated = { ...b, payments: [...b.payments, payment] };
    updateBooking(b.id, { payments: updated.payments }, `💰 ₹${payment.amount.toFixed(2)} recorded`);
  };

  const handleSaveNotes = (b: Booking) => {
    updateBooking(b.id, { notes: notesDraft }, "📝 Notes updated");
    setEditingNotes(false);
  };

  const handleAddGuest = (b: Booking, g: Guest) => {
    const updated = [...b.additionalGuests, g];
    updateBooking(b.id, { additionalGuests: updated }, `👤 ${g.name} added`);
  };

  const handleModifyOption = (label: string) => {
    if (!selected) return;
    setShowModifyMenu(false);
    if (label === "Send magic link") showToast("✨ Magic link sent");
    else if (label === "Set to no show") updateBooking(selected.id, { status: "CANCELLED" }, "🚫 Marked as no-show");
    else if (label === "Lock booking") showToast("🔒 Booking locked");
    else if (label === "Hold booking") showToast("⏸ Booking on hold");
    else if (label === "Unassign room") showToast("🚪 Room unassigned");
    else showToast(`✔ ${label} applied`);
  };

  // ─── DRAG ───
  const onBarMouseDown = (e: React.MouseEvent | React.TouchEvent, b: Booking) => {
    const point = "touches" in e ? e.touches[0] : e;
    dragRef.current = {
      bookingId: b.id,
      startX: point.clientX,
      startY: point.clientY,
      originRoom: b.roomNumber,
      originCheckIn: b.checkIn,
      originCheckOut: b.checkOut,
      hasMoved: false,
    };
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const point = "touches" in e ? e.touches[0] : e;
      const dx = point.clientX - d.startX;
      const dy = point.clientY - d.startY;
      if (!d.hasMoved && Math.hypot(dx, dy) > DRAG_THRESHOLD) d.hasMoved = true;
      if (d.hasMoved) {
        const daysOffset = Math.round(dx / CELL_WIDTH);
        const roomsOffset = Math.round(dy / ROW_HEIGHT);
        const roomIdx = rooms.findIndex((r) => r.number === d.originRoom);
        const newRoomIdx = Math.max(0, Math.min(rooms.length - 1, roomIdx + roomsOffset));
        const nights = daysBetween(d.originCheckIn, d.originCheckOut);
        const newCheckIn = addDays(d.originCheckIn, daysOffset);
        const newCheckOut = addDays(newCheckIn, nights);
        setDragVisual({
          bookingId: d.bookingId,
          currentX: point.clientX,
          currentY: point.clientY,
          previewRoom: rooms[newRoomIdx].number,
          previewCheckIn: newCheckIn,
          previewCheckOut: newCheckOut,
        });
      }
    };
    const handleUp = () => {
      const d = dragRef.current;
      if (!d) return;
      if (d.hasMoved && dragVisual) {
        const changed = dragVisual.previewRoom !== d.originRoom || dragVisual.previewCheckIn !== d.originCheckIn;
        if (changed) {
          updateBooking(
            d.bookingId,
            { roomNumber: dragVisual.previewRoom, checkIn: dragVisual.previewCheckIn, checkOut: dragVisual.previewCheckOut },
            `📅 Moved to Room ${dragVisual.previewRoom} · ${prettyDate(dragVisual.previewCheckIn)}`
          );
        }
      }
      if (!d.hasMoved) {
        const booking = bookings.find((b) => b.id === d.bookingId);
        if (booking) setSelected(booking);
      }
      dragRef.current = null;
      setDragVisual(null);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleMove);
    window.addEventListener("touchend", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleUp);
    };
  }, [dragVisual, bookings]);

  return (
    <div className="p-6 lg:p-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-navy">Front Office · Calendar</h1>
          <p className="text-muted mt-1 text-sm">
            {rooms.length} rooms · {bookings.length} bookings · Click any booking to manage
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => shiftDates(-7)} className="px-3 py-2 border border-cream-dark rounded-lg text-sm font-medium text-navy hover:bg-cream transition">← Prev</button>
          <button onClick={() => setStartDate("2026-09-12")} className="px-4 py-2 border border-cream-dark rounded-lg text-sm font-medium text-navy hover:bg-cream transition">Today</button>
          <button onClick={() => shiftDates(7)} className="px-3 py-2 border border-cream-dark rounded-lg text-sm font-medium text-navy hover:bg-cream transition">Next →</button>
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
        <span className="ml-auto text-gold-dark font-medium">🖱 Drag to move · 👆 Click to manage</span>
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
                    <div className={`text-sm font-semibold ${isToday || isWeekend ? "text-gold-dark" : "text-navy"}`}>
                      {s.date} {s.month}
                    </div>
                  </div>
                );
              })}
            </div>

            {rooms.map((room) => (
              <div key={room.number} className="flex border-b border-cream-dark last:border-b-0 hover:bg-cream/30 transition-colors" style={{ height: ROW_HEIGHT }}>
                <div className="w-32 shrink-0 px-4 py-2 border-r border-cream-dark flex flex-col justify-center">
                  <div className="text-sm font-bold text-navy">{room.number}</div>
                  <div className="text-[10px] text-muted truncate">{room.type}</div>
                </div>
                <div className="flex flex-1 relative">
                  {dates.map((d, i) => {
                    const currentBookings = bookings.filter((b) => b.roomNumber === room.number && bookingSpansDate(b, d));
                    return (
                      <div key={i} className="flex-1 min-w-[80px] border-r border-cream-dark relative" style={{ height: ROW_HEIGHT }}>
                        {currentBookings.map((b) => {
                          const isFirstDay = fmt(d) === b.checkIn;
                          if (!isFirstDay) return null;
                          const startIdx = dates.findIndex((dd) => fmt(dd) === b.checkIn);
                          const endIdx = dates.findIndex((dd) => fmt(dd) === b.checkOut);
                          const span = endIdx === -1 ? dates.length - startIdx : endIdx - startIdx;
                          const isDragging = dragVisual?.bookingId === b.id;
                          return (
                            <div
                              key={b.id}
                              onMouseDown={(e) => onBarMouseDown(e, b)}
                              onTouchStart={(e) => onBarMouseDown(e, b)}
                              className={`absolute top-2 left-1 h-10 ${statusColors[b.status]} rounded-md shadow-sm flex items-center px-2 z-10 overflow-hidden cursor-grab active:cursor-grabbing select-none transition-opacity ${
                                isDragging ? "opacity-30" : "hover:scale-[1.02] hover:shadow-md"
                              }`}
                              style={{ width: `calc(${span} * 100% - 0.5rem)`, minWidth: "100%" }}
                            >
                              <div className="flex flex-col truncate leading-tight w-full pointer-events-none">
                                <span className="text-[11px] font-semibold truncate">{b.primaryGuest.name}</span>
                                <span className="text-[9px] font-medium uppercase tracking-wide opacity-90">{statusLabels[b.status]}</span>
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

      {/* DRAG GHOST */}
      {dragVisual && (
        <div className="fixed z-[100] pointer-events-none" style={{ left: dragVisual.currentX + 10, top: dragVisual.currentY + 10 }}>
          <div className="bg-navy text-cream px-3 py-1.5 rounded-md shadow-2xl text-xs font-semibold">
            → Room {dragVisual.previewRoom} · {prettyDate(dragVisual.previewCheckIn)}
          </div>
        </div>
      )}

      {/* ═══════════ RESERVATION DETAILS PANEL ═══════════ */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-navy/40 backdrop-blur-sm z-40" onClick={() => { setSelected(null); setShowModifyMenu(false); setEditingNotes(false); }} />
          <aside className="fixed top-0 right-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
            {/* Header */}
            <div className={`px-6 py-4 flex justify-between items-center ${statusColors[selected.status].split(" ")[0]} text-white`}>
              <div>
                <p className="text-xs uppercase tracking-widest opacity-80">Booking · {selected.id}</p>
                <h2 className="font-serif text-2xl font-semibold mt-0.5">{selected.primaryGuest.name}</h2>
                <p className="text-sm opacity-90">{selected.primaryGuest.phone}</p>
              </div>
              <button onClick={() => { setSelected(null); setShowModifyMenu(false); setEditingNotes(false); }} className="text-2xl text-white/80 hover:text-white leading-none">×</button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* RESERVATION */}
              <div className="p-6 border-b border-cream-dark">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="font-serif text-lg font-semibold text-navy">Reservation</h3>
                    {selected.source === "goibibo" && <span className="text-sm font-bold text-orange-500">goibibo</span>}
                    {selected.source === "agoda" && <span className="text-sm font-bold text-red-500">agoda</span>}
                    {selected.source === "makemytrip" && <span className="text-sm font-bold text-red-600">make<span className="text-blue-600">MyTrip</span></span>}
                    {selected.source === "expedia" && <span className="text-sm font-bold text-blue-800">Expedia</span>}
                    {selected.source === "booking" && <span className="text-sm font-bold text-indigo-600">Booking.com</span>}
                  </div>
                  <div className="relative">
                    <button onClick={() => setShowModifyMenu(!showModifyMenu)} className="px-4 py-1.5 border border-cream-dark rounded-lg text-sm font-medium text-navy hover:bg-cream transition">✏️ Modify</button>
                    {showModifyMenu && (
                      <div className="absolute top-full right-0 mt-2 z-20 bg-white border border-cream-dark rounded-lg shadow-xl min-w-[200px] py-1">
                        {modifyOptions.map((opt) => (
                          <button key={opt} onClick={() => handleModifyOption(opt)} className="w-full text-left px-4 py-2 text-sm text-navy/80 hover:bg-cream transition-colors">{opt}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                  <Row label="Dates" value={`${prettyDateTime(selected.checkIn)} - ${prettyDateTime(selected.checkOut, "11:00 AM")} (${nightsBetween(selected.checkIn, selected.checkOut)}N)`} />
                  <Row label="Room type" value={`${selected.roomType} ( ${selected.ratePlan} )`} />
                  <Row label="Booked Room" value={selected.roomNumber} />
                  <Row label="Booking source" value={selected.source.toUpperCase()} />
                  {selected.otaId && <Row label="OTA ID" value={selected.otaId} />}
                  {selected.otaPin && <Row label="PIN" value={selected.otaPin} />}
                </div>

                <div className="flex flex-wrap gap-2 mt-5">
                  <button onClick={() => setFolioFor(selected)} className="px-4 py-2 border border-cream-dark rounded-lg text-xs font-medium text-navy hover:bg-cream transition">View folio</button>
                  <button onClick={() => setRegCardFor(selected)} className="px-4 py-2 border border-cream-dark rounded-lg text-xs font-medium text-navy hover:bg-cream transition">Print reg card</button>
                  <button onClick={() => showToast(`✉️ Emailed to ${selected.primaryGuest.email}`)} className="px-4 py-2 border border-cream-dark rounded-lg text-xs font-medium text-navy hover:bg-cream transition">Email</button>
                </div>
              </div>

              {/* FRONT DESK ACTIONS */}
              <div className="p-6 border-b border-cream-dark bg-cream/30">
                <h3 className="font-serif text-lg font-semibold text-navy mb-4">Front Desk Actions</h3>
                <div className="space-y-2">
                  {selected.status === "CONFIRMED" && (
                    <button onClick={() => handleCheckIn(selected)} className="w-full py-3 rounded-lg bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition">
                      ✅ Check-In Guest
                    </button>
                  )}
                  {(selected.status === "CHECKED-IN" || selected.status === "PENDING DEPARTURE") && (
                    <>
                      {getBalance(selected) > 0 && (
                        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-xs text-amber-800 mb-2">
                          ⚠ Balance ₹{getBalance(selected).toFixed(2)} due before check-out
                        </div>
                      )}
                      <button onClick={() => handleCheckOut(selected)} className={`w-full py-3 rounded-lg text-white font-semibold transition ${getBalance(selected) > 0 ? "bg-rose-300 cursor-not-allowed" : "bg-rose-500 hover:bg-rose-600"}`}>
                        🚪 Check-Out Guest
                      </button>
                    </>
                  )}
                  {selected.status === "BLOCKED" && (
                    <button onClick={() => updateBooking(selected.id, { status: "CONFIRMED" }, `🔓 Room unblocked`)} className="w-full py-3 rounded-lg bg-blue-500 text-white font-semibold hover:bg-blue-600 transition">
                      🔓 Unblock Room
                    </button>
                  )}
                  {(selected.status === "CHECKED-OUT" || selected.status === "CANCELLED") && (
                    <div className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-sm text-gray-600 text-center">
                      ✓ Booking is {selected.status.toLowerCase()}
                    </div>
                  )}
                </div>
              </div>

              {/* PRIMARY GUEST DETAILS */}
              <div className="p-6 border-b border-cream-dark">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-serif text-lg font-semibold text-navy">Primary Guest</h3>
                  <button onClick={() => setGuestFormFor(selected)} className="px-3 py-1.5 border border-cream-dark rounded-lg text-xs font-medium text-navy hover:bg-cream transition">✏️ Edit</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                  <Row label="Name" value={selected.primaryGuest.name} />
                  <Row label="Phone" value={selected.primaryGuest.phone || "—"} />
                  <Row label="Email" value={selected.primaryGuest.email || "—"} />
                  <Row label="Pincode" value={selected.primaryGuest.pincode || "—"} />
                  <Row label="City" value={selected.primaryGuest.city || "—"} />
                  <Row label="State" value={selected.primaryGuest.state || "—"} />
                  <Row label="Address" value={selected.primaryGuest.address || "—"} />
                  <Row label="ID" value={selected.primaryGuest.idType ? `${selected.primaryGuest.idType} · ${selected.primaryGuest.idNumber || "—"}` : "—"} />
                </div>
              </div>

              {/* ADDITIONAL GUESTS */}
              <div className="p-6 border-b border-cream-dark">
                <h3 className="font-serif text-lg font-semibold text-navy mb-4">Additional Guests ({selected.additionalGuests.length})</h3>
                <p className="text-sm text-navy/80 mb-4">{selected.adults} Adults , {selected.children} Children , {selected.infants || 0} Infants</p>
                {selected.additionalGuests.length > 0 && (
                  <div className="space-y-3 mb-4">
                    {selected.additionalGuests.map((g, i) => (
                      <div key={i} className="border border-cream-dark rounded-lg p-3 text-sm">
                        <p className="font-semibold text-navy">{g.name}</p>
                        <p className="text-xs text-muted">{g.phone} · {g.city}, {g.state}</p>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => setGuestFormFor(selected)} className="w-full py-2.5 rounded-lg border border-cream-dark text-navy font-medium text-sm hover:bg-cream transition">
                  + Add Guest
                </button>
              </div>

              {/* PAYMENT DETAILS */}
              <div className="p-6 border-b border-cream-dark">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-serif text-lg font-semibold text-navy">Payment details</h3>
                  {getBalance(selected) > 0 && (
                    <button onClick={() => setPaymentModalFor(selected)} className="px-4 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-semibold hover:bg-emerald-600 transition">
                      $ Add Payment
                    </button>
                  )}
                </div>
                <div className="space-y-2 text-sm mb-4">
                  <Row label="Total amount" value={`₹${selected.amount.toFixed(2)}`} />
                  <Row label="Tax included" value={`₹${selected.tax.toFixed(2)}`} />
                  <Row label="Total paid" value={`₹${getPaid(selected).toFixed(2)}`} />
                  <Row label="Balance due" value={`₹${getBalance(selected).toFixed(2)}`} valueClass={getBalance(selected) > 0 ? "text-rose-500 font-bold" : "text-emerald-600 font-bold"} />
                </div>

                {selected.payments.length > 0 && (
                  <>
                    <p className="text-xs text-muted uppercase tracking-wide mb-2">Payment history</p>
                    <div className="space-y-2">
                      {selected.payments.map((p) => (
                        <div key={p.id} className="flex justify-between items-center bg-cream/40 rounded-lg px-3 py-2 text-xs">
                          <div>
                            <p className="font-semibold text-navy">₹{p.amount.toFixed(2)} · {p.method}</p>
                            <p className="text-muted">{prettyDate(p.date)}{p.reference && ` · ${p.reference}`}</p>
                          </div>
                          <span className="text-emerald-600">✓</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* NOTES */}
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-serif text-lg font-semibold text-navy">Notes</h3>
                  {!editingNotes && (
                    <button onClick={() => { setEditingNotes(true); setNotesDraft(selected.notes || ""); }} className="px-4 py-1.5 border border-cream-dark rounded-lg text-sm font-medium text-navy hover:bg-cream transition">
                      {selected.notes ? "Edit" : "+ Add"}
                    </button>
                  )}
                </div>
                {editingNotes ? (
                  <div className="space-y-2">
                    <textarea value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} rows={3} className="w-full p-3 border border-cream-dark rounded-lg text-sm outline-none focus:border-gold" placeholder="Add notes…" />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditingNotes(false)} className="px-3 py-1.5 text-sm text-navy/60">Cancel</button>
                      <button onClick={() => handleSaveNotes(selected)} className="px-4 py-1.5 bg-navy text-cream rounded-lg text-sm font-medium">Save</button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted whitespace-pre-wrap">{selected.notes ? selected.notes : "No notes"}</p>
                )}
              </div>
            </div>
          </aside>
        </>
      )}

      {/* TOAST */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-navy text-cream px-6 py-3 rounded-full shadow-2xl z-[60] text-sm font-medium">
          {toast}
        </div>
      )}

      {/* ─── PAYMENT MODAL ─── */}
      {paymentModalFor && (
        <PaymentModal
          booking={paymentModalFor}
          onClose={() => setPaymentModalFor(null)}
          onSubmit={(payment) => {
            handleAddPayment(paymentModalFor, payment);
            setPaymentModalFor(null);
          }}
        />
      )}

      {/* ─── GUEST FORM MODAL ─── */}
      {guestFormFor && (
        <GuestFormModal
          booking={guestFormFor}
          onClose={() => setGuestFormFor(null)}
          onSavePrimary={(g) => {
            updateBooking(guestFormFor.id, { primaryGuest: g }, "👤 Primary guest updated");
            setGuestFormFor(null);
          }}
          onAddGuest={(g) => {
            handleAddGuest(guestFormFor, g);
            setGuestFormFor(null);
          }}
        />
      )}

      {/* ─── FOLIO MODAL ─── */}
      {folioFor && (
        <FolioModal
          booking={folioFor}
          onClose={() => setFolioFor(null)}
          onAddPayment={() => {
            setPaymentModalFor(folioFor);
            setFolioFor(null);
          }}
          onCheckout={() => {
            handleCheckOut(folioFor);
            setFolioFor(null);
            setSelected(null);
          }}
        />
      )}

      {/* ─── REG CARD MODAL ─── */}
      {regCardFor && <RegCardModal booking={regCardFor} onClose={() => setRegCardFor(null)} />}
    </div>
  );
}

// ─── Row ───
function Row({ label, value, valueClass = "" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="grid grid-cols-2 gap-2 py-1">
      <span className="text-muted">{label}</span>
      <span className={`text-navy font-medium ${valueClass}`}>{value}</span>
    </div>
  );
}

// ─── PAYMENT MODAL ───
function PaymentModal({
  booking,
  onClose,
  onSubmit,
}: {
  booking: Booking;
  onClose: () => void;
  onSubmit: (p: Payment) => void;
}) {
  const balance = getBalance(booking);
  const [amount, setAmount] = useState(balance.toFixed(2));
  const [method, setMethod] = useState<Payment["method"]>("Cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const submit = () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return alert("Enter a valid amount");
    if (amt > balance + 0.01) return alert(`Amount exceeds balance ₹${balance.toFixed(2)}`);
    onSubmit({
      id: `P${Date.now()}`,
      amount: amt,
      method,
      date: new Date().toISOString().slice(0, 10),
      reference: reference || undefined,
      note: note || undefined,
    });
  };

  return (
    <>
      <div className="fixed inset-0 bg-navy/50 backdrop-blur-sm z-[70]" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl z-[80] w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-serif text-xl font-semibold text-navy">Record Payment</h2>
          <button onClick={onClose} className="text-2xl text-muted hover:text-navy leading-none">×</button>
        </div>
        <p className="text-sm text-muted mb-6">Balance due: <span className="font-semibold text-rose-500">₹{balance.toFixed(2)}</span></p>
        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-muted font-semibold mb-1 block">Amount (₹)</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-3 py-2.5 border border-cream-dark rounded-lg text-sm outline-none focus:border-gold" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted font-semibold mb-1 block">Method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value as Payment["method"])} className="w-full px-3 py-2.5 border border-cream-dark rounded-lg text-sm outline-none focus:border-gold">
              <option>Cash</option>
              <option>Card</option>
              <option>UPI</option>
              <option>Bank Transfer</option>
              <option>OTA Prepaid</option>
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted font-semibold mb-1 block">Reference (optional)</label>
            <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="TXN ID, receipt number…" className="w-full px-3 py-2.5 border border-cream-dark rounded-lg text-sm outline-none focus:border-gold" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted font-semibold mb-1 block">Note (optional)</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any remarks" className="w-full px-3 py-2.5 border border-cream-dark rounded-lg text-sm outline-none focus:border-gold" />
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-6">
          <button onClick={onClose} className="px-4 py-2.5 border border-cream-dark rounded-lg font-medium text-navy hover:bg-cream">Cancel</button>
          <button onClick={submit} className="px-6 py-2.5 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600">Record Payment</button>
        </div>
      </div>
    </>
  );
}

// ─── GUEST FORM MODAL (with pincode autofill) ───
function GuestFormModal({
  booking,
  onClose,
  onSavePrimary,
  onAddGuest,
}: {
  booking: Booking;
  onClose: () => void;
  onSavePrimary: (g: Guest) => void;
  onAddGuest: (g: Guest) => void;
}) {
  const [mode, setMode] = useState<"primary" | "additional">("additional");
  const [g, setG] = useState<Guest>({ ...emptyGuest });
  const [loadingPin, setLoadingPin] = useState(false);

  // Pincode autofill
  const lookupPincode = async (pincode: string) => {
    if (pincode.length !== 6) return;
    setLoadingPin(true);
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await res.json();
      if (data?.[0]?.Status === "Success" && data[0].PostOffice?.length > 0) {
        const po = data[0].PostOffice[0];
        setG((prev) => ({
          ...prev,
          city: po.District || prev.city,
          state: po.State || prev.state,
        }));
      }
    } catch (err) {
      console.warn("Pincode lookup failed", err);
    } finally {
      setLoadingPin(false);
    }
  };

  const submit = () => {
    if (!g.name.trim()) return alert("Name is required");
    if (mode === "primary") onSavePrimary(g);
    else onAddGuest(g);
  };

  return (
    <>
      <div className="fixed inset-0 bg-navy/50 backdrop-blur-sm z-[70]" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl z-[80] w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-cream-dark flex justify-between items-center sticky top-0 bg-white z-10">
          <h2 className="font-serif text-xl font-semibold text-navy">
            {mode === "primary" ? "Edit Primary Guest" : "Add Guest"}
          </h2>
          <button onClick={onClose} className="text-2xl text-muted hover:text-navy leading-none">×</button>
        </div>
        <div className="p-6 space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-2 mb-2">
            <button onClick={() => { setMode("additional"); setG({ ...emptyGuest }); }} className={`flex-1 py-2 rounded-lg text-sm font-medium ${mode === "additional" ? "bg-navy text-cream" : "bg-cream text-navy"}`}>Additional Guest</button>
            <button onClick={() => { setMode("primary"); setG({ ...booking.primaryGuest }); }} className={`flex-1 py-2 rounded-lg text-sm font-medium ${mode === "primary" ? "bg-navy text-cream" : "bg-cream text-navy"}`}>Primary Guest</button>
          </div>

          <Field label="Full Name *">
            <input type="text" value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm outline-none focus:border-gold" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <input type="tel" value={g.phone} onChange={(e) => setG({ ...g, phone: e.target.value })} className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm outline-none focus:border-gold" />
            </Field>
            <Field label="Email">
              <input type="email" value={g.email} onChange={(e) => setG({ ...g, email: e.target.value })} className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm outline-none focus:border-gold" />
            </Field>
          </div>

          <Field label="Address">
            <input type="text" value={g.address} onChange={(e) => setG({ ...g, address: e.target.value })} placeholder="Street, building, area" className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm outline-none focus:border-gold" />
          </Field>

          <Field label="Pincode (auto-fills city & state)">
            <input
              type="text"
              maxLength={6}
              value={g.pincode}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "");
                setG({ ...g, pincode: v });
                if (v.length === 6) lookupPincode(v);
              }}
              placeholder="e.g. 560001"
              className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm outline-none focus:border-gold"
            />
            {loadingPin && <p className="text-xs text-gold-dark mt-1">🔄 Looking up…</p>}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="City">
              <input type="text" value={g.city} onChange={(e) => setG({ ...g, city: e.target.value })} className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm outline-none focus:border-gold" />
            </Field>
            <Field label="State">
              <input type="text" value={g.state} onChange={(e) => setG({ ...g, state: e.target.value })} className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm outline-none focus:border-gold" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="ID Type">
              <select value={g.idType || ""} onChange={(e) => setG({ ...g, idType: e.target.value as Guest["idType"] })} className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm outline-none focus:border-gold">
                <option value="">— Select —</option>
                <option>Aadhaar</option>
                <option>PAN</option>
                <option>Passport</option>
                <option>Driving License</option>
                <option>Voter ID</option>
              </select>
            </Field>
            <Field label="ID Number">
              <input type="text" value={g.idNumber || ""} onChange={(e) => setG({ ...g, idNumber: e.target.value })} className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm outline-none focus:border-gold" />
            </Field>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-cream-dark flex gap-2 justify-end sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2.5 border border-cream-dark rounded-lg font-medium text-navy hover:bg-cream">Cancel</button>
          <button onClick={submit} className="px-6 py-2.5 bg-navy text-cream rounded-lg font-semibold hover:bg-navy-light">
            {mode === "primary" ? "Save Guest" : "Add Guest"}
          </button>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wide text-muted font-semibold mb-1 block">{label}</label>
      {children}
    </div>
  );
}

// ─── FOLIO MODAL ───
function FolioModal({
  booking,
  onClose,
  onAddPayment,
  onCheckout,
}: {
  booking: Booking;
  onClose: () => void;
  onAddPayment: () => void;
  onCheckout: () => void;
}) {
  const nights = nightsBetween(booking.checkIn, booking.checkOut);
  const ratePerNight = booking.amount / nights;
  const subTotal = booking.amount - booking.tax;
  const cgst = booking.tax / 2;
  const sgst = booking.tax / 2;
  const balance = getBalance(booking);

  return (
    <>
      <div className="fixed inset-0 bg-navy/50 backdrop-blur-sm z-[70]" onClick={onClose} />
      <div className="fixed inset-4 md:inset-8 lg:inset-16 bg-white rounded-2xl shadow-2xl z-[80] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-cream-dark flex justify-between items-center">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted">Tax Invoice</p>
            <h2 className="font-serif text-xl font-semibold text-navy">Folio · {booking.id}</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="px-4 py-2 border border-cream-dark rounded-lg text-sm font-medium text-navy hover:bg-cream transition">🖨 Print</button>
            <button onClick={onClose} className="text-2xl text-muted hover:text-navy leading-none px-2">×</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-widest text-muted font-semibold mb-2">Bill to</p>
            <h3 className="font-serif text-2xl font-semibold text-navy">{booking.primaryGuest.name}</h3>
            <p className="text-sm text-navy/70 mt-1">{booking.primaryGuest.phone}</p>
            {booking.primaryGuest.address && <p className="text-sm text-navy/70">{booking.primaryGuest.address}, {booking.primaryGuest.city} {booking.primaryGuest.pincode}</p>}
          </div>
          <div className="border border-cream-dark rounded-lg overflow-hidden mb-6">
            <div className="grid grid-cols-12 bg-navy text-cream text-xs font-semibold uppercase tracking-wider px-4 py-2">
              <div className="col-span-2">Date</div>
              <div className="col-span-5">Description</div>
              <div className="col-span-1 text-right">Qty</div>
              <div className="col-span-2 text-right">Rate</div>
              <div className="col-span-2 text-right">Amount</div>
            </div>
            {Array.from({ length: nights }).map((_, i) => (
              <div key={i} className="grid grid-cols-12 px-4 py-3 border-b border-cream-dark last:border-b-0 text-sm">
                <div className="col-span-2 text-navy/70">{prettyDate(addDays(booking.checkIn, i))}</div>
                <div className="col-span-5 text-navy font-medium">Room Charge · {booking.ratePlan}</div>
                <div className="col-span-1 text-right text-navy">1</div>
                <div className="col-span-2 text-right text-navy">₹{ratePerNight.toFixed(2)}</div>
                <div className="col-span-2 text-right font-semibold text-navy">₹{ratePerNight.toFixed(2)}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted">Sub-total</span><span className="text-navy font-medium">₹{subTotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted">CGST</span><span className="text-navy font-medium">₹{cgst.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted">SGST</span><span className="text-navy font-medium">₹{sgst.toFixed(2)}</span></div>
              <div className="flex justify-between border-t border-cream-dark pt-2"><span className="text-navy font-semibold">Total</span><span className="text-navy font-serif text-xl font-semibold">₹{booking.amount.toFixed(2)}</span></div>
              <div className="flex justify-between text-emerald-600"><span>Paid</span><span className="font-semibold">₹{getPaid(booking).toFixed(2)}</span></div>
              <div className={`flex justify-between border-t border-cream-dark pt-2 ${balance > 0 ? "text-rose-500" : "text-emerald-600"}`}><span className="font-semibold">Balance due</span><span className="font-serif text-xl font-semibold">₹{balance.toFixed(2)}</span></div>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-cream-dark bg-cream/30 flex gap-2 justify-end">
          {balance > 0 && <button onClick={onAddPayment} className="px-5 py-2.5 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600">$ Add Payment</button>}
          {(booking.status === "CHECKED-IN" || booking.status === "PENDING DEPARTURE") && (
            <button onClick={onCheckout} disabled={balance > 0} className={`px-5 py-2.5 rounded-lg font-semibold ${balance > 0 ? "bg-rose-200 text-rose-500 cursor-not-allowed" : "bg-rose-500 text-white hover:bg-rose-600"}`}>🚪 Check-Out</button>
          )}
          <button onClick={onClose} className="px-5 py-2.5 border border-cream-dark rounded-lg text-navy font-medium hover:bg-cream">Close</button>
        </div>
      </div>
    </>
  );
}

// ─── REG CARD MODAL ───
function RegCardModal({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 bg-navy/50 backdrop-blur-sm z-[90]" onClick={onClose} />
      <div className="fixed inset-4 md:inset-16 lg:inset-24 bg-white rounded-2xl shadow-2xl z-[100] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-cream-dark flex justify-between items-center bg-navy text-cream">
          <h2 className="font-serif text-xl font-semibold">Registration Card</h2>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="px-4 py-1.5 border border-cream/30 rounded-lg text-sm font-medium hover:bg-white/10">🖨 Print</button>
            <button onClick={onClose} className="text-2xl leading-none text-cream/80 hover:text-white px-2">×</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-2xl mx-auto border-2 border-navy rounded-lg p-6">
            <div className="text-center border-b-2 border-navy pb-4 mb-6">
              <h1 className="font-serif text-3xl font-bold text-navy">Staynexa</h1>
              <p className="text-xs uppercase tracking-widest text-muted mt-1">Vishara Elite Hotel</p>
            </div>
            <h2 className="text-center font-serif text-lg font-semibold text-navy mb-6 underline">Guest Registration Card</h2>
            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
              <div><p className="text-xs text-muted uppercase">Guest</p><p className="font-semibold text-navy mt-1">{booking.primaryGuest.name}</p></div>
              <div><p className="text-xs text-muted uppercase">Phone</p><p className="font-semibold text-navy mt-1">{booking.primaryGuest.phone}</p></div>
              <div><p className="text-xs text-muted uppercase">Address</p><p className="font-semibold text-navy mt-1">{booking.primaryGuest.address || "—"}</p></div>
              <div><p className="text-xs text-muted uppercase">City / State</p><p className="font-semibold text-navy mt-1">{booking.primaryGuest.city}, {booking.primaryGuest.state} {booking.primaryGuest.pincode}</p></div>
              <div><p className="text-xs text-muted uppercase">ID</p><p className="font-semibold text-navy mt-1">{booking.primaryGuest.idType} {booking.primaryGuest.idNumber}</p></div>
              <div><p className="text-xs text-muted uppercase">Room</p><p className="font-semibold text-navy mt-1">{booking.roomNumber} ({booking.roomType})</p></div>
              <div><p className="text-xs text-muted uppercase">Check-in</p><p className="font-semibold text-navy mt-1">{prettyDate(booking.checkIn)}</p></div>
              <div><p className="text-xs text-muted uppercase">Check-out</p><p className="font-semibold text-navy mt-1">{prettyDate(booking.checkOut)}</p></div>
            </div>
            <div className="mt-12 grid grid-cols-2 gap-8">
              <div className="border-t border-navy pt-2 text-xs text-muted">Guest Signature</div>
              <div className="border-t border-navy pt-2 text-xs text-muted">Authorized Signature</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
