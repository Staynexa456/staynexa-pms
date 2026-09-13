"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { rooms, statusColors, statusLabels } from "../data";
import type { Booking, Guest, Payment } from "../types";
import { getPaid, getBalance, emptyGuest } from "../types";
import {
  fetchBookings,
  updateBookingStatus,
  addPayment,
  updateBookingNotes,
  updateBookingRoomAndDates,
  createReservation,
  blockRoom,
} from "../db";
import CreateReservationModal, { type ReservationFormData } from "../create-reservation-modal";

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

// Status → premium gradient class
const statusBarClass: Record<Booking["status"], string> = {
  CONFIRMED: "bar-confirmed",
  "CHECKED-IN": "bar-checkedin",
  "CHECKED-OUT": "bar-checkedout",
  "PENDING DEPARTURE": "bar-checkedout",
  BLOCKED: "bar-blocked",
  CANCELLED: "bar-cancelled",
};,
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
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showModifyMenu, setShowModifyMenu] = useState(false);

  const [paymentModalFor, setPaymentModalFor] = useState<Booking | null>(null);
  const [folioFor, setFolioFor] = useState<Booking | null>(null);
  const [regCardFor, setRegCardFor] = useState<Booking | null>(null);
  const [guestFormFor, setGuestFormFor] = useState<Booking | null>(null);

  // ─── NEW: Create Reservation modal state ───
  const [createOpen, setCreateOpen] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<{
    roomNumber: string;
    checkIn: string;
    checkOut: string;
  } | null>(null);

  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");

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

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const loadFromDb = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchBookings();
      setBookings(data);
      setSelected((prev) => {
        if (!prev) return null;
        const fresh = data.find((b) => b.id === prev.id);
        return fresh || prev;
      });
    } catch (err) {
      console.error("Failed to load bookings:", err);
      showToast("⚠ Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFromDb();
  }, [loadFromDb]);

  const shiftDates = (offset: number) => {
    const d = parseISO(startDate);
    d.setDate(d.getDate() + offset);
    setStartDate(fmt(d));
  };

  // ─── ACTION HANDLERS ───
  const handleCheckIn = async (b: Booking) => {
    const notes = `${b.notes ? b.notes + " · " : ""}Checked in at ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
    try {
      await updateBookingStatus(b.id, "CHECKED-IN", notes);
      showToast(`✅ ${b.primaryGuest.name} checked into Room ${b.roomNumber}`);
      await loadFromDb();
    } catch {
      showToast("⚠ Failed to check-in");
    }
  };

  const handleCheckOut = async (b: Booking) => {
    const balance = getBalance(b);
    if (balance > 0) {
      showToast(`⚠ Cannot check-out · ₹${balance.toFixed(2)} balance due`);
      return;
    }
    const notes = `${b.notes ? b.notes + " · " : ""}Checked out at ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
    try {
      await updateBookingStatus(b.id, "CHECKED-OUT", notes);
      showToast(`🚪 ${b.primaryGuest.name} checked out`);
      await loadFromDb();
    } catch {
      showToast("⚠ Failed to check-out");
    }
  };

  const handleAddPayment = async (b: Booking, payment: Payment) => {
    try {
      await addPayment(b.id, {
        amount: payment.amount,
        method: payment.method,
        reference: payment.reference,
        note: payment.note,
      });
      showToast(`💰 ₹${payment.amount.toFixed(2)} recorded`);
      await loadFromDb();
    } catch {
      showToast("⚠ Failed to record payment");
    }
  };

  const handleSaveNotes = async (b: Booking) => {
    try {
      await updateBookingNotes(b.id, notesDraft);
      showToast("📝 Notes updated");
      setEditingNotes(false);
      await loadFromDb();
    } catch {
      showToast("⚠ Failed to save notes");
    }
  };

  const handleAddGuest = async (b: Booking, g: Guest) => {
    const guestLine = `Guest: ${g.name}${g.phone ? " · " + g.phone : ""}${g.city ? " · " + g.city : ""}`;
    const newNotes = `${b.notes ? b.notes + "\n" : ""}${guestLine}`;
    try {
      await updateBookingNotes(b.id, newNotes);
      showToast(`👤 ${g.name} added`);
      await loadFromDb();
    } catch {
      showToast("⚠ Failed to add guest");
    }
  };

  const handleModifyOption = async (label: string) => {
    if (!selected) return;
    setShowModifyMenu(false);
    if (label === "Send magic link") showToast("✨ Magic link sent");
    else if (label === "Set to no show") {
      try {
        await updateBookingStatus(selected.id, "CANCELLED", selected.notes);
        showToast("🚫 Marked as no-show");
        await loadFromDb();
      } catch { showToast("⚠ Failed"); }
    } else showToast(`✔ ${label} applied`);
  };

  // ─── NEW: Click empty cell → open Create Reservation modal ───
  const handleCellClick = (roomNumber: string, date: Date) => {
    setCreatePrefill({
      roomNumber,
      checkIn: fmt(date),
      checkOut: fmt(new Date(date.getTime() + 86400000)),
    });
    setCreateOpen(true);
  };

  // ─── NEW: Handle Create Reservation submit ───
  const handleCreateSubmit = async (data: ReservationFormData) => {
    try {
      const ref = await createReservation({
        roomNumber: data.roomNumber,
        checkIn: data.checkIn,
        checkOut: data.checkOut,
        ratePlan: data.ratePlan,
        source: data.source.toLowerCase().replace(/\s+/g, ""),
        primaryGuest: data.primaryGuest,
        adults: data.adults,
        children: data.children,
        infants: data.infants,
        amount: data.amount,
        tax: data.tax,
        notes: data.notes,
      });
      showToast(`✅ Reservation ${ref.split("_").slice(-1)[0]} created`);
      setCreateOpen(false);
      setCreatePrefill(null);
      await loadFromDb();
    } catch (err) {
      console.error(err);
      showToast("⚠ Failed to create reservation");
    }
  };

  // ─── NEW: Handle Block Room submit ───
  const handleBlockRoom = async (data: { roomNumber: string; checkIn: string; checkOut: string; reason: string }) => {
    try {
      await blockRoom(data);
      showToast(`🔒 Room ${data.roomNumber} blocked`);
      setCreateOpen(false);
      setCreatePrefill(null);
      await loadFromDb();
    } catch (err) {
      console.error(err);
      showToast("⚠ Failed to block room");
    }
  };

  // ─── DRAG ───
  const onBarMouseDown = (e: React.MouseEvent | React.TouchEvent, b: Booking) => {
    e.stopPropagation();
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
    const handleUp = async () => {
      const d = dragRef.current;
      if (!d) return;
      if (d.hasMoved && dragVisual) {
        const changed =
          dragVisual.previewRoom !== d.originRoom ||
          dragVisual.previewCheckIn !== d.originCheckIn;
        if (changed) {
          try {
            await updateBookingRoomAndDates(
              d.bookingId,
              dragVisual.previewRoom,
              dragVisual.previewCheckIn,
              dragVisual.previewCheckOut
            );
            showToast(`📅 Moved to Room ${dragVisual.previewRoom} · ${prettyDate(dragVisual.previewCheckIn)}`);
            await loadFromDb();
          } catch {
            showToast("⚠ Failed to move");
          }
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
  }, [dragVisual, bookings, loadFromDb]);

  return (
    <div className="p-6 lg:p-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-navy">Front Office · Calendar</h1>
          <p className="text-muted mt-1 text-sm">
            {rooms.length} rooms · {bookings.length} bookings ·{" "}
            <button onClick={loadFromDb} className="text-gold-dark font-medium hover:underline">
              {loading ? "Loading…" : "🔄 Refresh"}
            </button>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
  <button
    onClick={() => shiftDates(-7)}
    className="btn btn-ghost"
  >
    ← Prev
  </button>
  <button
    onClick={() => setStartDate("2026-09-12")}
    className="btn btn-ghost"
  >
    Today
  </button>
  <button
    onClick={() => shiftDates(7)}
    className="btn btn-ghost"
  >
    Next →
  </button>
  <button
    onClick={() => {
      setCreatePrefill({
        roomNumber: rooms[0].number,
        checkIn: "2026-09-13",
        checkOut: "2026-09-14",
      });
      setCreateOpen(true);
    }}
    className="btn btn-gold"
  >
    ✨ New Reservation
  </button>
  <button
    onClick={() => {
      setCreatePrefill({
        roomNumber: rooms[0].number,
        checkIn: "2026-09-13",
        checkOut: "2026-09-14",
      });
      setCreateOpen(true);
    }}
    className="btn btn-primary"
  >
    🔒 Block Room
  </button>
</div>
        

      {/* LEGEND */}
      <div className="flex flex-wrap gap-4 mb-4 text-xs items-center">
        <span className="text-muted font-medium">Status:</span>
        {legendItems.map((item) => (
  <div
    key={item.label}
    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-navy/5 shadow-sm"
  >
    <div className={`w-2 h-2 rounded-full ${item.color}`} />
    <span className="text-navy/75 text-[11px] font-medium">{item.label}</span>
  </div>
))}
          </div>
        ))}
        <span className="ml-auto text-gold-dark font-medium">👆 Click empty cell to create · 🖱 Drag to move · Click booking to manage</span>
      </div>

      {/* LOADING */}
      {loading && (
        <div className="bg-white border border-cream-dark rounded-xl p-12 text-center">
          <p className="text-navy font-medium">⏳ Loading bookings…</p>
        </div>
      )}

      {/* TAPE CHART */}
      {!loading && (
        <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(11,18,32,0.06)] border border-navy/5 overflow-hidden">
            <div className="min-w-[1400px]">
              <div className="flex border-b border-navy/10 bg-gradient-to-b from-cream/60 to-cream-dark/30">
                <div className="w-32 shrink-0 px-4 py-3 text-xs font-semibold text-navy uppercase tracking-wide border-r border-cream-dark">Rooms</div>
                {dates.map((d, i) => {
                  const s = shortFmt(d);
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  const isToday = fmt(d) === "2026-09-13";
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
                <div
  key={room.number}
  className="flex border-b border-navy/5 last:border-b-0 hover:bg-gradient-to-r hover:from-gold/5 hover:to-transparent transition-all duration-200 group/row"
  style={{ height: ROW_HEIGHT }}
>
                  <div className="w-32 shrink-0 px-4 py-2 border-r border-cream-dark flex flex-col justify-center">
                    <div className="text-sm font-bold text-navy">{room.number}</div>
                    <div className="text-[10px] text-muted truncate">{room.type}</div>
                  </div>
                  <div className="flex flex-1 relative">
                    {dates.map((d, i) => {
                      const currentBookings = bookings.filter((b) => b.roomNumber === room.number && bookingSpansDate(b, d));
                      const isEmpty = currentBookings.length === 0;
                      return (
                        <div
                          key={i}
                          className={`flex-1 min-w-[80px] border-r border-cream-dark relative group ${isEmpty ? "cursor-pointer hover:bg-emerald-50" : ""}`}
                          style={{ height: ROW_HEIGHT }}
                          onClick={() => {
                            if (isEmpty) handleCellClick(room.number, d);
                          }}
                        >
                          {/* Hover "+" indicator */}
                          {isEmpty && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                              <span className="text-emerald-500 text-2xl font-light">+</span>
                            </div>
                          )}

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
  className={`absolute top-2.5 left-1 h-11 ${statusBarClass[b.status]} rounded-lg flex items-center px-3 z-10 overflow-hidden cursor-grab active:cursor-grabbing select-none transition-all duration-200 ${
    isDragging ? "opacity-40 scale-95" : "hover:scale-[1.02] hover:-translate-y-0.5"
  }`}
  style={{ width: `calc(${span} * 100% - 0.6rem)`, minWidth: "100%" }}
>
  <div className="flex flex-col truncate leading-tight w-full pointer-events-none">
    <span className="text-[11.5px] font-semibold truncate tracking-tight">
      {b.primaryGuest.name}
    </span>
    <span className="text-[9px] font-medium uppercase tracking-wider opacity-85 mt-0.5">
      {statusLabels[b.status]}
    </span>
  </div>
  {/* Left accent strip */}
  <span className="absolute left-0 top-0 bottom-0 w-1 bg-white/40" />
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
      )}

      {/* SUMMARY */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
        <div className="card p-5">
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

      {/* DETAILS PANEL */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-navy/40 backdrop-blur-sm z-40" onClick={() => { setSelected(null); setShowModifyMenu(false); setEditingNotes(false); }} />
          <aside className="fixed top-0 right-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
            <div className={`px-6 py-4 flex justify-between items-center ${statusColors[selected.status].split(" ")[0]} text-white`}>
              <div>
                <p className="text-xs uppercase tracking-widest opacity-80">Booking · {selected.id}</p>
                <h2 className="font-serif text-2xl font-semibold mt-0.5">{selected.primaryGuest.name}</h2>
                <p className="text-sm opacity-90">{selected.primaryGuest.phone}</p>
              </div>
              <button onClick={() => { setSelected(null); setShowModifyMenu(false); setEditingNotes(false); }} className="text-2xl text-white/80 hover:text-white leading-none">×</button>
            </div>

            <div className="flex-1 overflow-y-auto">
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
                          ⚠ Balance ₹{getBalance(selected).toFixed(2)} due
                        </div>
                      )}
                      <button onClick={() => handleCheckOut(selected)} className={`w-full py-3 rounded-lg text-white font-semibold transition ${getBalance(selected) > 0 ? "bg-rose-300 cursor-not-allowed" : "bg-rose-500 hover:bg-rose-600"}`}>
                        🚪 Check-Out Guest
                      </button>
                    </>
                  )}
                  {selected.status === "BLOCKED" && (
                    <button onClick={async () => { try { await updateBookingStatus(selected.id, "CONFIRMED"); showToast("🔓 Room unblocked"); await loadFromDb(); } catch { showToast("⚠ Failed"); } }} className="w-full py-3 rounded-lg bg-blue-500 text-white font-semibold hover:bg-blue-600 transition">
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

              <div className="p-6 border-b border-cream-dark">
                <h3 className="font-serif text-lg font-semibold text-navy mb-4">Primary Guest</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                  <Row label="Name" value={selected.primaryGuest.name} />
                  <Row label="Phone" value={selected.primaryGuest.phone || "—"} />
                  <Row label="Email" value={selected.primaryGuest.email || "—"} />
                  <Row label="Pincode" value={selected.primaryGuest.pincode || "—"} />
                  <Row label="City" value={selected.primaryGuest.city || "—"} />
                  <Row label="State" value={selected.primaryGuest.state || "—"} />
                  <Row label="Address" value={selected.primaryGuest.address || "—"} />
                </div>
              </div>

              <div className="p-6 border-b border-cream-dark">
                <h3 className="font-serif text-lg font-semibold text-navy mb-4">Guests</h3>
                <p className="text-sm text-navy/80 mb-4">
                  {selected.adults} Adults , {selected.children} Children , {selected.infants || 0} Infants
                </p>
              </div>

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

      {/* ─── CREATE RESERVATION MODAL ─── */}
      {createOpen && (
        <CreateReservationModal
          initialRoom={createPrefill?.roomNumber}
          initialCheckIn={createPrefill?.checkIn}
          initialCheckOut={createPrefill?.checkOut}
          onClose={() => { setCreateOpen(false); setCreatePrefill(null); }}
          onSubmit={handleCreateSubmit}
          onBlockRoom={handleBlockRoom}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-navy text-cream px-6 py-3 rounded-full shadow-2xl z-[300] text-sm font-medium">
          {toast}
        </div>
      )}

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

      {guestFormFor && (
        <GuestFormModal
          booking={guestFormFor}
          onClose={() => setGuestFormFor(null)}
          onSavePrimary={async () => { setGuestFormFor(null); }}
          onAddGuest={(g) => {
            handleAddGuest(guestFormFor, g);
            setGuestFormFor(null);
          }}
        />
      )}

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

      {regCardFor && <RegCardModal booking={regCardFor} onClose={() => setRegCardFor(null)} />}
    </div>
  );
}

function Row({ label, value, valueClass = "" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="grid grid-cols-2 gap-2 py-1">
      <span className="text-muted">{label}</span>
      <span className={`text-navy font-medium ${valueClass}`}>{value}</span>
    </div>
  );
}

function PaymentModal({ booking, onClose, onSubmit }: { booking: Booking; onClose: () => void; onSubmit: (p: Payment) => void }) {
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
      <div className="fixed inset-0 bg-navy/50 backdrop-blur-sm z-[270]" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl z-[280] w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-serif text-xl font-semibold text-navy">Record Payment</h2>
          <button onClick={onClose} className="text-2xl text-muted hover:text-navy leading-none">×</button>
        </div>
        <p className="text-sm text-muted mb-6">Balance: <span className="font-semibold text-rose-500">₹{balance.toFixed(2)}</span></p>
        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-muted font-semibold mb-1 block">Amount (₹)</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-3 py-2.5 border border-cream-dark rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted font-semibold mb-1 block">Method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value as Payment["method"])} className="w-full px-3 py-2.5 border border-cream-dark rounded-lg text-sm">
              <option>Cash</option><option>Card</option><option>UPI</option><option>Bank Transfer</option><option>OTA Prepaid</option>
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted font-semibold mb-1 block">Reference</label>
            <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="TXN ID" className="w-full px-3 py-2.5 border border-cream-dark rounded-lg text-sm" />
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-6">
          <button onClick={onClose} className="px-4 py-2.5 border border-cream-dark rounded-lg font-medium text-navy hover:bg-cream">Cancel</button>
          <button onClick={submit} className="px-6 py-2.5 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600">Record</button>
        </div>
      </div>
    </>
  );
}

function GuestFormModal({ booking, onClose, onSavePrimary, onAddGuest }: { booking: Booking; onClose: () => void; onSavePrimary: (g: Guest) => void; onAddGuest: (g: Guest) => void }) {
  const [mode, setMode] = useState<"primary" | "additional">("additional");
  const [g, setG] = useState<Guest>({ ...emptyGuest });

  const submit = () => {
    if (!g.name.trim()) return alert("Name required");
    if (mode === "primary") onSavePrimary(g);
    else onAddGuest(g);
  };

  return (
    <>
      <div className="fixed inset-0 bg-navy/50 z-[270]" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl z-[280] w-full max-w-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-serif text-xl font-semibold text-navy">{mode === "primary" ? "Edit Primary" : "Add Guest"}</h2>
          <button onClick={onClose} className="text-2xl text-muted hover:text-navy">×</button>
        </div>
        <div className="flex gap-2 mb-4">
          <button onClick={() => { setMode("additional"); setG({ ...emptyGuest }); }} className={`flex-1 py-2 rounded-lg text-sm ${mode === "additional" ? "bg-navy text-cream" : "bg-cream text-navy"}`}>Additional</button>
          <button onClick={() => { setMode("primary"); setG({ ...booking.primaryGuest }); }} className={`flex-1 py-2 rounded-lg text-sm ${mode === "primary" ? "bg-navy text-cream" : "bg-cream text-navy"}`}>Primary</button>
        </div>
        <input type="text" value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} placeholder="Full name *" className="w-full px-3 py-2 border border-cream-dark rounded-lg mb-3" />
        <input type="tel" value={g.phone} onChange={(e) => setG({ ...g, phone: e.target.value })} placeholder="Phone" className="w-full px-3 py-2 border border-cream-dark rounded-lg mb-3" />
        <input type="email" value={g.email} onChange={(e) => setG({ ...g, email: e.target.value })} placeholder="Email" className="w-full px-3 py-2 border border-cream-dark rounded-lg mb-3" />
        <input type="text" value={g.pincode} onChange={(e) => setG({ ...g, pincode: e.target.value.replace(/\D/g, "") })} placeholder="Pincode" maxLength={6} className="w-full px-3 py-2 border border-cream-dark rounded-lg mb-3" />
        <div className="grid grid-cols-2 gap-3 mb-4">
          <input type="text" value={g.city} onChange={(e) => setG({ ...g, city: e.target.value })} placeholder="City" className="px-3 py-2 border border-cream-dark rounded-lg" />
          <input type="text" value={g.state} onChange={(e) => setG({ ...g, state: e.target.value })} placeholder="State" className="px-3 py-2 border border-cream-dark rounded-lg" />
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-cream-dark rounded-lg">Cancel</button>
          <button onClick={submit} className="px-6 py-2 bg-navy text-cream rounded-lg">{mode === "primary" ? "Save" : "Add"}</button>
        </div>
      </div>
    </>
  );
}

function FolioModal({ booking, onClose, onAddPayment, onCheckout }: { booking: Booking; onClose: () => void; onAddPayment: () => void; onCheckout: () => void }) {
  const nights = nightsBetween(booking.checkIn, booking.checkOut);
  const ratePerNight = booking.amount / nights;
  const subTotal = booking.amount - booking.tax;
  const cgst = booking.tax / 2;
  const sgst = booking.tax / 2;
  const balance = getBalance(booking);

  return (
    <>
      <div className="fixed inset-0 bg-navy/50 z-[270]" onClick={onClose} />
      <div className="fixed inset-4 md:inset-8 lg:inset-16 bg-white rounded-2xl shadow-2xl z-[280] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-cream-dark flex justify-between items-center">
          <h2 className="font-serif text-xl font-semibold text-navy">Folio · {booking.id}</h2>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="px-4 py-2 border border-cream-dark rounded-lg text-sm">🖨 Print</button>
            <button onClick={onClose} className="text-2xl text-muted">×</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <h3 className="font-serif text-2xl font-semibold text-navy mb-2">{booking.primaryGuest.name}</h3>
          <p className="text-sm text-navy/70 mb-6">{booking.primaryGuest.phone}</p>
          <div className="grid grid-cols-2 gap-4 text-sm mb-6">
            <div><p className="text-xs text-muted uppercase">Check-in</p><p className="font-semibold">{prettyDate(booking.checkIn)}</p></div>
            <div><p className="text-xs text-muted uppercase">Check-out</p><p className="font-semibold">{prettyDate(booking.checkOut)}</p></div>
            <div><p className="text-xs text-muted uppercase">Room</p><p className="font-semibold">{booking.roomNumber} · {booking.roomType}</p></div>
            <div><p className="text-xs text-muted uppercase">Rate plan</p><p className="font-semibold">{booking.ratePlan}</p></div>
          </div>
          <div className="border border-cream-dark rounded-lg overflow-hidden mb-6">
            <div className="grid grid-cols-12 bg-navy text-cream text-xs font-semibold px-4 py-2">
              <div className="col-span-2">Date</div><div className="col-span-5">Description</div><div className="col-span-1 text-right">Qty</div><div className="col-span-2 text-right">Rate</div><div className="col-span-2 text-right">Amount</div>
            </div>
            {Array.from({ length: nights }).map((_, i) => (
              <div key={i} className="grid grid-cols-12 px-4 py-3 border-b border-cream-dark text-sm">
                <div className="col-span-2 text-navy/70">{prettyDate(addDays(booking.checkIn, i))}</div>
                <div className="col-span-5 text-navy">Room Charge · {booking.ratePlan}</div>
                <div className="col-span-1 text-right">1</div>
                <div className="col-span-2 text-right">₹{ratePerNight.toFixed(2)}</div>
                <div className="col-span-2 text-right font-semibold">₹{ratePerNight.toFixed(2)}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Sub-total</span><span>₹{subTotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>CGST</span><span>₹{cgst.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>SGST</span><span>₹{sgst.toFixed(2)}</span></div>
              <div className="flex justify-between border-t border-cream-dark pt-2 font-semibold"><span>Total</span><span>₹{booking.amount.toFixed(2)}</span></div>
              <div className="flex justify-between text-emerald-600"><span>Paid</span><span>₹{getPaid(booking).toFixed(2)}</span></div>
              <div className={`flex justify-between border-t border-cream-dark pt-2 font-semibold ${balance > 0 ? "text-rose-500" : "text-emerald-600"}`}><span>Balance</span><span>₹{balance.toFixed(2)}</span></div>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-cream-dark bg-cream/30 flex gap-2 justify-end">
          {balance > 0 && <button onClick={onAddPayment} className="px-5 py-2.5 bg-emerald-500 text-white rounded-lg font-semibold">$ Add Payment</button>}
          {(booking.status === "CHECKED-IN" || booking.status === "PENDING DEPARTURE") && (
            <button onClick={onCheckout} disabled={balance > 0} className={`px-5 py-2.5 rounded-lg font-semibold ${balance > 0 ? "bg-rose-200 text-rose-500" : "bg-rose-500 text-white"}`}>🚪 Check-Out</button>
          )}
          <button onClick={onClose} className="px-5 py-2.5 border border-cream-dark rounded-lg">Close</button>
        </div>
      </div>
    </>
  );
}

function RegCardModal({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 bg-navy/50 z-[290]" onClick={onClose} />
      <div className="fixed inset-4 md:inset-16 lg:inset-24 bg-white rounded-2xl shadow-2xl z-[300] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-cream-dark flex justify-between items-center bg-navy text-cream">
          <h2 className="font-serif text-xl font-semibold">Registration Card</h2>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="px-4 py-1.5 border border-cream/30 rounded-lg text-sm">🖨 Print</button>
            <button onClick={onClose} className="text-2xl">×</button>
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
              <div><p className="text-xs text-muted uppercase">City / State</p><p className="font-semibold text-navy mt-1">{booking.primaryGuest.city}, {booking.primaryGuest.state}</p></div>
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
