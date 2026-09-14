"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { statusColors, statusLabels } from "../data";
import type { Booking, Guest, Payment } from "../types";
import { getPaid, getBalance, emptyGuest } from "../types";
import {
  fetchBookings,
  fetchRooms,
  updateBookingStatus,
  addPayment,
  updateBookingNotes,
  updateBookingRoomAndDates,
  createReservation,
  blockRoom,
  updateGuest,
  type Room,
} from "../db";
import CreateReservationModal, { type ReservationFormData } from "../create-reservation-modal";

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
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
function todayISO(): string {
  return fmt(new Date());
}

// ═══════════════════════════════════════════════════════════
// PINCODE LOOKUP — India Post API
// ═══════════════════════════════════════════════════════════
async function lookupPincode(pincode: string): Promise<{ city: string; state: string; area: string } | null> {
  if (pincode.length !== 6) return null;
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    const data = await res.json();
    if (data?.[0]?.Status === "Success" && data[0].PostOffice?.length > 0) {
      const po = data[0].PostOffice[0];
      return {
        city: po.District || po.Block || "",
        state: po.State || "",
        area: po.Name || "",
      };
    }
    return null;
  } catch (err) {
    console.error("Pincode lookup failed:", err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════
type ViewMode = "full" | "room";
type DateRangeFilter = "All" | "Today" | "This Week" | "Next 7 Days" | "Next 14 Days" | "This Month";
type IdType = "Aadhaar" | "PAN" | "Passport" | "Driving License" | "Voter ID";

const RANGE_OPTIONS: DateRangeFilter[] = ["All", "Today", "This Week", "Next 7 Days", "Next 14 Days", "This Month"];

const legendItems = [
  { label: "Confirmed", color: "bg-amber-400" },
  { label: "Checked-in", color: "bg-emerald-500" },
  { label: "Checked-out / Due out", color: "bg-rose-500" },
  { label: "Blocked", color: "bg-blue-500" },
  { label: "Cancelled", color: "bg-gray-300" },
];

const statusBarClass: Record<Booking["status"], string> = {
  CONFIRMED: "bar-confirmed",
  "CHECKED-IN": "bar-checkedin",
  "CHECKED-OUT": "bar-checkedout",
  "PENDING DEPARTURE": "bar-checkedout",
  BLOCKED: "bar-blocked",
  CANCELLED: "bar-cancelled",
  "ON-HOLD": "bar-onhold",
};

const modifyOptions = [
  "Hold booking", "Set to no show", "Lock booking", "Unassign room",
  "Modify checkin", "Modify checkout", "Split Room", "Move Room", "Send magic link",
];

const CELL_WIDTH = 80;
const ROW_HEIGHT = 56;
const DRAG_THRESHOLD = 5;

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export default function CalendarPage() {
  const [startDate, setStartDate] = useState(todayISO());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showModifyMenu, setShowModifyMenu] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>("full");
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>("All");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [paymentModalFor, setPaymentModalFor] = useState<Booking | null>(null);
  const [folioFor, setFolioFor] = useState<Booking | null>(null);
  const [regCardFor, setRegCardFor] = useState<Booking | null>(null);
  const [guestPanelFor, setGuestPanelFor] = useState<Booking | null>(null);
  const [checkoutConfirmFor, setCheckoutConfirmFor] = useState<Booking | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<{ roomNumber: string; checkIn: string; checkOut: string } | null>(null);

  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");

  const dragRef = useRef<{
    bookingId: string; startX: number; startY: number;
    originRoom: string; originCheckIn: string; originCheckOut: string; hasMoved: boolean;
  } | null>(null);
  const [dragVisual, setDragVisual] = useState<{
    bookingId: string; currentX: number; currentY: number;
    previewRoom: string; previewCheckIn: string; previewCheckOut: string;
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
      const [bookingsData, roomsData] = await Promise.all([fetchBookings(), fetchRooms()]);
      setBookings(bookingsData);
      setRooms(roomsData);
      setSelected((prev) => {
        if (!prev) return null;
        const fresh = bookingsData.find((b) => b.id === prev.id);
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

  const visibleDates = (() => {
    const today = todayISO();
    if (dateRangeFilter === "All") return dates;
    if (dateRangeFilter === "Today") return dates.filter((d) => fmt(d) === today);
    if (dateRangeFilter === "This Week" || dateRangeFilter === "Next 7 Days") {
      const weekFromNow = addDays(today, 7);
      return dates.filter((d) => {
        const s = fmt(d);
        return s >= today && s <= weekFromNow;
      });
    }
    if (dateRangeFilter === "Next 14 Days") {
      const twoWeeks = addDays(today, 14);
      return dates.filter((d) => {
        const s = fmt(d);
        return s >= today && s <= twoWeeks;
      });
    }
    if (dateRangeFilter === "This Month") {
      const m = new Date().getMonth();
      return dates.filter((dt) => dt.getMonth() === m);
    }
    return dates;
  })();

  const visibleRooms = viewMode === "room" && rooms.length > 0 ? [rooms[0]] : rooms;

  // ═══ ACTIONS ═══
  const handleCheckIn = async (b: Booking) => {
    const notes = `${b.notes ? b.notes + " · " : ""}Checked in at ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
    try {
      await updateBookingStatus(b.id, "CHECKED-IN", notes);
      showToast(`✅ ${b.primaryGuest.name} checked in`);
      await loadFromDb();
    } catch {
      showToast("⚠ Failed to check-in");
    }
  };

  const handleCheckOutConfirmed = async (b: Booking, checkAll: boolean) => {
    const balance = getBalance(b);
    if (balance > 0) {
      showToast(`⚠ Cannot check-out · ₹${balance.toFixed(2)} balance due`);
      return;
    }
    const notes = `${b.notes ? b.notes + " · " : ""}Checked out at ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
    try {
      await updateBookingStatus(b.id, "CHECKED-OUT", notes);
      showToast(`🚪 ${b.primaryGuest.name} checked out${checkAll ? " (all rooms)" : ""}`);
      setCheckoutConfirmFor(null);
      setSelected(null);
      await loadFromDb();
    } catch {
      showToast("⚠ Failed to check-out");
    }
  };

  const handleAddPayment = async (b: Booking, payment: Payment) => {
    try {
      await addPayment(b.id, { amount: payment.amount, method: payment.method, reference: payment.reference, note: payment.note });
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

  const handleSaveGuest = async (b: Booking, updatedGuest: Guest) => {
    try {
      await updateGuest(b.id, updatedGuest);
      showToast("👤 Guest info saved");
      setGuestPanelFor(null);
      await loadFromDb();
    } catch (err) {
      console.error(err);
      showToast("⚠ Failed to save guest");
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

  const handleCellClick = (roomNumber: string, date: Date) => {
    setCreatePrefill({ roomNumber, checkIn: fmt(date), checkOut: fmt(new Date(date.getTime() + 86400000)) });
    setCreateOpen(true);
  };

  const handleCreateSubmit = async (data: ReservationFormData) => {
    try {
      await createReservation({
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
      showToast(`✅ Reservation created`);
      setCreateOpen(false);
      setCreatePrefill(null);
      await loadFromDb();
    } catch (err) {
      console.error(err);
      showToast("⚠ Failed to create reservation");
    }
  };

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

  const onBarMouseDown = (e: React.MouseEvent | React.TouchEvent, b: Booking) => {
    e.stopPropagation();
    const point = "touches" in e ? e.touches[0] : e;
    dragRef.current = {
      bookingId: b.id, startX: point.clientX, startY: point.clientY,
      originRoom: b.roomNumber, originCheckIn: b.checkIn, originCheckOut: b.checkOut, hasMoved: false,
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
        const roomIdx = rooms.findIndex((r) => r.room_number === d.originRoom);
        const newRoomIdx = Math.max(0, Math.min(rooms.length - 1, roomIdx + roomsOffset));
        const nights = daysBetween(d.originCheckIn, d.originCheckOut);
        const newCheckIn = addDays(d.originCheckIn, daysOffset);
        const newCheckOut = addDays(newCheckIn, nights);
        setDragVisual({
          bookingId: d.bookingId,
          currentX: point.clientX, currentY: point.clientY,
          previewRoom: rooms[newRoomIdx]?.room_number || d.originRoom,
          previewCheckIn: newCheckIn, previewCheckOut: newCheckOut,
        });
      }
    };
    const handleUp = async () => {
      const d = dragRef.current;
      if (!d) return;
      if (d.hasMoved && dragVisual) {
        const changed = dragVisual.previewRoom !== d.originRoom || dragVisual.previewCheckIn !== d.originCheckIn;
        if (changed) {
          try {
            await updateBookingRoomAndDates(d.bookingId, dragVisual.previewRoom, dragVisual.previewCheckIn, dragVisual.previewCheckOut);
            showToast(`📅 Moved to Room ${dragVisual.previewRoom}`);
            await loadFromDb();
          } catch { showToast("⚠ Failed to move"); }
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
  }, [dragVisual, bookings, loadFromDb, rooms]);

  const todayStr = todayISO();

  return (
    <div className="p-6 lg:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
        <div>
          <h1 className="font-serif text-4xl font-semibold text-navy tracking-tight">Front Office · Calendar</h1>
          <p className="text-muted mt-1 text-sm">
            {rooms.length} rooms · {bookings.length} bookings ·{" "}
            <button onClick={loadFromDb} className="text-gold-dark font-medium hover:underline">
              {loading ? "Loading…" : "🔄 Refresh"}
            </button>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-cream-dark p-1 rounded-lg flex border border-cream-dark">
            <button
              onClick={() => setViewMode("full")}
              className={`px-4 py-1.5 text-xs font-medium rounded transition ${
                viewMode === "full" ? "bg-slate-800 text-white shadow-sm" : "text-navy/70 hover:text-navy"
              }`}
            >
              Full view
            </button>
            <button
              onClick={() => setViewMode("room")}
              className={`px-4 py-1.5 text-xs font-medium rounded transition ${
                viewMode === "room" ? "bg-slate-800 text-white shadow-sm" : "text-navy/70 hover:text-navy"
              }`}
            >
              Room view
            </button>
          </div>

          <button onClick={() => shiftDates(-7)} className="px-3 py-2 border border-cream-dark rounded-lg text-sm font-medium text-navy hover:bg-cream transition">← Prev</button>
          <button onClick={() => setStartDate(todayISO())} className="px-4 py-2 border border-cream-dark rounded-lg text-sm font-medium text-navy hover:bg-cream transition">Today</button>
          <button onClick={() => shiftDates(7)} className="px-3 py-2 border border-cream-dark rounded-lg text-sm font-medium text-navy hover:bg-cream transition">Next →</button>
          <button
            onClick={() => {
              if (rooms.length === 0) return;
              setCreatePrefill({ roomNumber: rooms[0].room_number, checkIn: todayISO(), checkOut: addDays(todayISO(), 1) });
              setCreateOpen(true);
            }}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-semibold hover:bg-emerald-600 transition"
          >
            + New Reservation
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4 text-xs items-center">
        <div className="relative">
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-navy/10 shadow-sm hover:border-gold transition"
          >
            <span className="text-[10px] uppercase tracking-wider text-muted font-semibold">Filters</span>
            <span className="text-navy font-medium">{dateRangeFilter}</span>
            <span className="text-navy/50">▾</span>
          </button>
          {filtersOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setFiltersOpen(false)} />
              <div className="absolute top-full left-0 mt-2 z-50 bg-white border border-cream-dark rounded-lg shadow-xl min-w-[180px] py-1">
                {RANGE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => { setDateRangeFilter(opt); setFiltersOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-cream transition-colors flex items-center justify-between ${
                      dateRangeFilter === opt ? "text-gold-dark font-semibold bg-cream/60" : "text-navy/80"
                    }`}
                  >
                    <span>{opt}</span>
                    {dateRangeFilter === opt && <span className="text-gold">✓</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <span className="text-muted font-medium uppercase tracking-wider text-[10px] ml-2">Status:</span>
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-navy/5 shadow-sm">
            <div className={`w-2 h-2 rounded-full ${item.color}`} />
            <span className="text-navy/75 text-[11px] font-medium">{item.label}</span>
          </div>
        ))}
        <span className="ml-auto text-gold-dark font-medium text-[11px]">
          👆 Click empty cell · 🖱 Drag · 📅 {viewMode === "full" ? "Full view" : "Room view"}
        </span>
      </div>

      {loading && (
        <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(11,18,32,0.06)] border border-navy/5 p-12 text-center">
          <p className="text-navy font-medium">⏳ Loading bookings…</p>
        </div>
      )}

      {!loading && rooms.length === 0 && (
        <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(11,18,32,0.06)] border border-navy/5 p-12 text-center">
          <p className="text-4xl mb-4">🏨</p>
          <p className="text-navy font-medium mb-2">No rooms in this property yet</p>
          <p className="text-muted text-sm">Create a property from the Properties page to get started.</p>
        </div>
      )}

      {!loading && rooms.length > 0 && (
        <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(11,18,32,0.06)] border border-navy/5 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[1400px]">
              <div className="flex border-b border-navy/10 bg-gradient-to-b from-cream/60 to-cream-dark/30">
                <div className="w-36 shrink-0 px-4 py-3 text-[10px] font-semibold text-navy uppercase tracking-widest border-r border-navy/10 flex items-center gap-2">
                  <span>🔑</span>
                  <span>Rooms</span>
                </div>
                {visibleDates.map((d, i) => {
                  const s = shortFmt(d);
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  const isToday = fmt(d) === todayStr;
                  return (
                    <div
                      key={i}
                      className={`flex-1 min-w-[80px] px-2 py-2 text-center border-r border-navy/5 ${isWeekend ? "bg-gold/5" : ""} ${isToday ? "bg-gold/15" : ""}`}
                    >
                      <div className="text-[10px] font-medium text-muted uppercase tracking-wider">{s.day}</div>
                      <div className={`text-sm font-semibold ${isToday || isWeekend ? "text-gold-dark" : "text-navy"}`}>
                        {s.date} {s.month}
                      </div>
                    </div>
                  );
                })}
              </div>

              {visibleRooms.map((room) => (
                <div
                  key={room.id}
                  className="flex border-b border-navy/5 last:border-b-0 hover:bg-gradient-to-r hover:from-gold/5 hover:to-transparent transition-all duration-200"
                  style={{ height: ROW_HEIGHT }}
                >
                  <div className="w-36 shrink-0 px-4 py-2 border-r border-navy/5 flex items-center gap-2">
                    <span className="text-gold-dark text-sm">🔑</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-navy">{room.room_number}</div>
                      <div className="text-[10px] text-muted truncate">{room.room_type}</div>
                    </div>
                  </div>
                  <div className="flex flex-1 relative">
                    {visibleDates.map((d, i) => {
                      const currentBookings = bookings.filter(
                        (b) => b.roomNumber === room.room_number && bookingSpansDate(b, d)
                      );
                      const isEmpty = currentBookings.length === 0;
                      const isToday = fmt(d) === todayStr;
                      return (
                        <div
                          key={i}
                          className={`flex-1 min-w-[80px] border-r border-navy/5 relative group ${isEmpty ? "cursor-pointer hover:bg-emerald-50/60" : ""}`}
                          style={{ height: ROW_HEIGHT }}
                          onClick={() => {
                            if (isEmpty) handleCellClick(room.room_number, d);
                          }}
                        >
                          {isToday && (
                            <div className="absolute top-0 bottom-0 left-1/2 w-[2px] bg-red-500/70 pointer-events-none z-20" />
                          )}

                          {isEmpty && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                              <span className="text-emerald-500 text-2xl font-light">+</span>
                            </div>
                          )}

                          {currentBookings.map((b) => {
                            const isFirstDay = fmt(d) === b.checkIn;
                            if (!isFirstDay) return null;
                            const startIdx = visibleDates.findIndex((dd) => fmt(dd) === b.checkIn);
                            const endIdx = visibleDates.findIndex((dd) => fmt(dd) === b.checkOut);
                            const span = endIdx === -1 ? visibleDates.length - startIdx : endIdx - startIdx;
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
                                <span className="absolute left-0 top-0 bottom-0 w-1 bg-white/40" />
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

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
        <div className="card p-5">
          <p className="text-xs text-muted uppercase tracking-wide">Total Rooms</p>
          <p className="font-serif text-3xl font-semibold text-navy mt-1">{rooms.length}</p>
        </div>
        <div className="card p-5 border-l-4 border-l-amber-400">
          <p className="text-xs text-muted uppercase tracking-wide">Confirmed</p>
          <p className="font-serif text-3xl font-semibold text-navy mt-1">
            {bookings.filter((b) => b.status === "CONFIRMED").length}
          </p>
        </div>
        <div className="card p-5 border-l-4 border-l-emerald-500">
          <p className="text-xs text-muted uppercase tracking-wide">In-house</p>
          <p className="font-serif text-3xl font-semibold text-navy mt-1">
            {bookings.filter((b) => b.status === "CHECKED-IN").length}
          </p>
        </div>
        <div className="card p-5 border-l-4 border-l-rose-500">
          <p className="text-xs text-muted uppercase tracking-wide">Due out</p>
          <p className="font-serif text-3xl font-semibold text-navy mt-1">
            {bookings.filter((b) => b.status === "PENDING DEPARTURE").length}
          </p>
        </div>
        <div className="card p-5 border-l-4 border-l-blue-500">
          <p className="text-xs text-muted uppercase tracking-wide">Blocked</p>
          <p className="font-serif text-3xl font-semibold text-navy mt-1">
            {bookings.filter((b) => b.status === "BLOCKED").length}
          </p>
        </div>
      </div>

      {dragVisual && (
        <div className="fixed z-[100] pointer-events-none" style={{ left: dragVisual.currentX + 10, top: dragVisual.currentY + 10 }}>
          <div className="bg-navy text-cream px-3 py-1.5 rounded-md shadow-2xl text-xs font-semibold">
            → Room {dragVisual.previewRoom} · {prettyDate(dragVisual.previewCheckIn)}
          </div>
        </div>
      )}

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
                  <button onClick={() => setGuestPanelFor(selected)} className="px-4 py-2 border border-cream-dark rounded-lg text-xs font-medium text-navy hover:bg-cream transition">Edit guest info</button>
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
                      <button
                        onClick={() => setCheckoutConfirmFor(selected)}
                        className={`w-full py-3 rounded-lg text-white font-semibold transition ${getBalance(selected) > 0 ? "bg-rose-300 cursor-not-allowed" : "bg-rose-500 hover:bg-rose-600"}`}
                      >
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

      {checkoutConfirmFor && (
        <>
          <div className="fixed inset-0 bg-navy/50 backdrop-blur-sm z-[270]" onClick={() => setCheckoutConfirmFor(null)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl z-[280] w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-serif text-xl font-semibold text-navy">Check-out room</h2>
              <button onClick={() => setCheckoutConfirmFor(null)} className="text-2xl text-muted hover:text-navy">×</button>
            </div>
            <p className="text-sm text-navy/80 mb-4">Do you want to continue to check-out?</p>
            <label className="flex items-start gap-3 mb-6 cursor-pointer">
              <input type="checkbox" defaultChecked className="mt-0.5 w-4 h-4 accent-gold" />
              <span className="text-xs text-navy/70">
                Check-out all the rooms in booking <span className="font-mono">{checkoutConfirmFor.id}</span>
              </span>
            </label>
            {getBalance(checkoutConfirmFor) > 0 && (
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-xs text-amber-800 mb-4">
                ⚠ Balance ₹{getBalance(checkoutConfirmFor).toFixed(2)} due. Settle before checkout.
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setCheckoutConfirmFor(null)} className="px-5 py-2.5 border border-cream-dark rounded-lg font-medium text-navy hover:bg-cream">
                Cancel
              </button>
              <button
                onClick={() => handleCheckOutConfirmed(checkoutConfirmFor, true)}
                disabled={getBalance(checkoutConfirmFor) > 0}
                className={`px-6 py-2.5 rounded-lg font-semibold ${
                  getBalance(checkoutConfirmFor) > 0
                    ? "bg-rose-200 text-rose-500 cursor-not-allowed"
                    : "bg-navy text-cream hover:bg-navy-light"
                }`}
              >
                Check-out
              </button>
            </div>
          </div>
        </>
      )}

      {guestPanelFor && (
        <GuestInformationPanel
          booking={guestPanelFor}
          onClose={() => setGuestPanelFor(null)}
          onSave={(guest) => handleSaveGuest(guestPanelFor, guest)}
        />
      )}

      {createOpen && createPrefill && (
        <CreateReservationModal
          initialRoom={createPrefill.roomNumber}
          initialCheckIn={createPrefill.checkIn}
          initialCheckOut={createPrefill.checkOut}
          onClose={() => { setCreateOpen(false); setCreatePrefill(null); }}
          onSubmit={handleCreateSubmit}
          onBlockRoom={handleBlockRoom}
        />
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

      {folioFor && (
        <FolioModal
          booking={folioFor}
          onClose={() => setFolioFor(null)}
          onAddPayment={() => { setPaymentModalFor(folioFor); setFolioFor(null); }}
          onCheckout={() => { setCheckoutConfirmFor(folioFor); setFolioFor(null); setSelected(null); }}
        />
      )}

      {regCardFor && <RegCardModal booking={regCardFor} onClose={() => setRegCardFor(null)} />}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-navy text-cream px-6 py-3 rounded-full shadow-2xl z-[300] text-sm font-medium">
          {toast}
        </div>
      )}
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

// ═══════════════════════════════════════════════════════════
// GUEST INFORMATION PANEL — NOW WITH PINCODE AUTO-FILL
// ═══════════════════════════════════════════════════════════
function GuestInformationPanel({
  booking,
  onClose,
  onSave,
}: {
  booking: Booking;
  onClose: () => void;
  onSave: (guest: Guest) => void;
}) {
  const [guest, setGuest] = useState<Guest>({ ...booking.primaryGuest });
  const [idType, setIdType] = useState<IdType>((booking.primaryGuest.idType as IdType) || "Aadhaar");
  const [country, setCountry] = useState("India");
  const [gender, setGender] = useState("Male");
  const [category, setCategory] = useState("Adult");
  const [dob, setDob] = useState("");
  const [nationality, setNationality] = useState("Indian");
  const [occupation, setOccupation] = useState("");
  const [cameraUpload, setCameraUpload] = useState(true);
  const [doNotRent, setDoNotRent] = useState(false);
  const [severity, setSeverity] = useState("HIGH");
  const [reason, setReason] = useState("");
  const [showLess, setShowLess] = useState(false);

  // ─── PINCODE AUTO-FILL STATE ───
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeError, setPincodeError] = useState<string | null>(null);
  const [pincodeFound, setPincodeFound] = useState(false);

  // Auto-fill when pincode reaches 6 digits
  useEffect(() => {
    const pincode = guest.pincode?.trim() || "";
    if (pincode.length !== 6) {
      setPincodeError(null);
      setPincodeFound(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setPincodeLoading(true);
      setPincodeError(null);

      const result = await lookupPincode(pincode);
      if (cancelled) return;

      if (result) {
        setGuest((prev) => ({
          ...prev,
          city: result.city || prev.city,
          state: result.state || prev.state,
          // Only fill address if it's empty
          address: prev.address || result.area || "",
        }));
        setPincodeFound(true);
      } else {
        setPincodeError("Pincode not found. Please check and try again.");
        setPincodeFound(false);
      }
      setPincodeLoading(false);
    }, 400); // debounce 400ms

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [guest.pincode]);

  const save = () => {
    onSave({
      ...guest,
      idType: idType as Guest["idType"],
    });
  };

  return (
    <>
      <div className="fixed inset-0 bg-navy/40 backdrop-blur-sm z-[270]" onClick={onClose} />
      <aside className="fixed top-0 right-0 h-full w-full max-w-3xl bg-white shadow-2xl z-[280] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-cream-dark flex justify-between items-center">
          <h2 className="font-serif text-xl font-semibold text-navy">Guest Information</h2>
          <button onClick={onClose} className="text-2xl text-muted hover:text-navy leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Customer Name *">
              <input type="text" value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} className="input-premium" />
            </Field>
            <Field label="ID Type">
              <select value={idType} onChange={(e) => setIdType(e.target.value as IdType)} className="input-premium">
                <option>Aadhaar</option>
                <option>PAN</option>
                <option>Passport</option>
                <option>Driving License</option>
                <option>Voter ID</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="ID Number *">
              <input type="text" value={guest.idNumber || ""} onChange={(e) => setGuest({ ...guest, idNumber: e.target.value })} className="input-premium" />
            </Field>
            <Field label="Customer Email *">
              <input type="email" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} className="input-premium" />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Customer Phone *">
              <input type="tel" value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} className="input-premium" />
            </Field>
            <Field label="Address">
              <input type="text" value={guest.address} onChange={(e) => setGuest({ ...guest, address: e.target.value })} className="input-premium" />
            </Field>
          </div>

          {/* PINCODE + CITY + STATE + COUNTRY + ZIP */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="City">
              <input type="text" value={guest.city} onChange={(e) => setGuest({ ...guest, city: e.target.value })} className="input-premium" />
            </Field>
            <Field label="State">
              <select value={guest.state} onChange={(e) => setGuest({ ...guest, state: e.target.value })} className="input-premium">
                <option value="">Select...</option>
                <option>Karnataka</option>
                <option>Maharashtra</option>
                <option>Tamil Nadu</option>
                <option>Delhi</option>
                <option>Kerala</option>
                <option>Telangana</option>
                <option>Andhra Pradesh</option>
                <option>Gujarat</option>
                <option>West Bengal</option>
                <option>Rajasthan</option>
                <option>Other</option>
              </select>
            </Field>
            <Field label="Country">
              <select value={country} onChange={(e) => setCountry(e.target.value)} className="input-premium">
                <option>India</option>
                <option>USA</option>
                <option>UK</option>
                <option>UAE</option>
                <option>Singapore</option>
              </select>
            </Field>
            <Field label="Zip Code (auto-fills City & State)">
              <div className="relative">
                <input
                  type="text"
                  maxLength={6}
                  value={guest.pincode || ""}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "");
                    setGuest({ ...guest, pincode: v });
                  }}
                  placeholder="e.g. 560001"
                  className={`input-premium pr-10 ${
                    pincodeError ? "border-rose-400" : pincodeFound ? "border-emerald-400" : ""
                  }`}
                />
                {pincodeLoading && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gold-dark animate-pulse">
                    🔄
                  </span>
                )}
                {pincodeFound && !pincodeLoading && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-emerald-600">
                    ✓
                  </span>
                )}
              </div>
              {pincodeLoading && (
                <p className="text-[10px] text-gold-dark mt-1">Looking up pincode…</p>
              )}
              {pincodeFound && !pincodeLoading && (
                <p className="text-[10px] text-emerald-600 mt-1">📍 {guest.city}, {guest.state}</p>
              )}
              {pincodeError && (
                <p className="text-[10px] text-rose-500 mt-1">{pincodeError}</p>
              )}
            </Field>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Address Line 2">
              <input type="text" className="input-premium" />
            </Field>
            <Field label="Gender">
              <select value={gender} onChange={(e) => setGender(e.target.value)} className="input-premium">
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </Field>
            <Field label="Guest Category">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-premium">
                <option>Adult</option>
                <option>Child</option>
                <option>Senior</option>
              </select>
            </Field>
            <Field label="Date of Birth">
              <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="input-premium" />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nationality">
              <select value={nationality} onChange={(e) => setNationality(e.target.value)} className="input-premium">
                <option>Indian</option>
                <option>American</option>
                <option>British</option>
                <option>Other</option>
              </select>
            </Field>
            <Field label="Occupation">
              <input type="text" value={occupation} onChange={(e) => setOccupation(e.target.value)} className="input-premium" />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-navy">Camera upload ?</span>
              <button
                onClick={() => setCameraUpload(!cameraUpload)}
                className={`w-11 h-6 rounded-full transition relative ${cameraUpload ? "bg-navy" : "bg-gray-300"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition shadow-sm ${cameraUpload ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-navy">Do not Rent</span>
              <button
                onClick={() => setDoNotRent(!doNotRent)}
                className={`w-11 h-6 rounded-full transition relative ${doNotRent ? "bg-rose-500" : "bg-gray-300"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition shadow-sm ${doNotRent ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </div>
          </div>

          {doNotRent && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-rose-50 border border-rose-200 rounded-lg p-4">
              <Field label="Severity">
                <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="input-premium">
                  <option>HIGH</option>
                  <option>MEDIUM</option>
                  <option>LOW</option>
                </select>
              </Field>
              <Field label="Reason for do not rent">
                <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} className="input-premium" />
              </Field>
            </div>
          )}

          {!showLess && (
            <div className="grid grid-cols-2 gap-4 pt-2">
              <button className="py-3 border-2 border-dashed border-navy/20 rounded-lg text-sm text-navy/60 hover:border-navy/40 transition flex flex-col items-center gap-1">
                <span className="text-2xl">⬆️</span>
                <span className="font-medium">Upload front id</span>
              </button>
              <button className="py-3 border-2 border-dashed border-navy/20 rounded-lg text-sm text-navy/60 hover:border-navy/40 transition flex flex-col items-center gap-1">
                <span className="text-2xl">⬆️</span>
                <span className="font-medium">Upload Back id</span>
              </button>
            </div>
          )}

          <button onClick={() => setShowLess(!showLess)} className="text-xs text-navy/60 underline">
            {showLess ? "Show more" : "Less"}
          </button>
        </div>

        <div className="px-6 py-4 border-t border-cream-dark flex gap-3 justify-end bg-cream/30">
          <button onClick={onClose} className="px-5 py-2.5 border border-cream-dark rounded-lg font-medium text-navy hover:bg-cream">
            Cancel
          </button>
          <button onClick={save} className="px-6 py-2.5 bg-navy text-cream rounded-lg font-semibold hover:bg-navy-light">
            Save Customer
          </button>
        </div>
      </aside>

      <style jsx global>{`
        .input-premium {
          width: 100%;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid rgba(11, 18, 32, 0.1);
          background: white;
          font-size: 14px;
          color: #0F1729;
          outline: none;
          transition: all 160ms ease;
        }
        .input-premium:hover { border-color: rgba(11, 18, 32, 0.2); }
        .input-premium:focus {
          border-color: #C9A34E;
          box-shadow: 0 0 0 3px rgba(201, 163, 78, 0.15);
        }
      `}</style>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-[0.15em] text-navy/50 font-semibold block mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function PaymentModal({ booking, onClose, onSubmit }: { booking: Booking; onClose: () => void; onSubmit: (p: Payment) => void }) {
  const balance = getBalance(booking);
  const [amount, setAmount] = useState(balance.toFixed(2));
  const [method, setMethod] = useState<Payment["method"]>("Cash");
  const [reference, setReference] = useState("");

  const submit = () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return alert("Enter a valid amount");
    if (amt > balance + 0.01) return alert(`Amount exceeds balance ₹${balance.toFixed(2)}`);
    onSubmit({ id: `P${Date.now()}`, amount: amt, method, date: new Date().toISOString().slice(0, 10), reference: reference || undefined });
  };

  return (
    <>
      <div className="fixed inset-0 bg-navy/50 backdrop-blur-sm z-[290]" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl z-[300] w-full max-w-md p-6">
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

type AddOn = { id: string; name: string; type: string; amount: number; date: string };

function FolioModal({ booking, onClose, onAddPayment, onCheckout }: { booking: Booking; onClose: () => void; onAddPayment: () => void; onCheckout: () => void }) {
  const nights = nightsBetween(booking.checkIn, booking.checkOut);
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [addOnOpen, setAddOnOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const addOnTotal = addOns.reduce((s, a) => s + a.amount, 0);
  const subTotal = booking.amount - booking.tax + addOnTotal;
  const taxAmount = booking.tax + addOnTotal * 0.05;
  const grandTotal = subTotal + taxAmount;
  const balance = grandTotal - getPaid(booking);

  const handleAddOn = (addon: AddOn) => {
    setAddOns([...addOns, addon]);
    setAddOnOpen(false);
  };

  return (
    <>
      <div className="fixed inset-0 bg-navy/50 z-[290]" onClick={onClose} />
      <div className="fixed inset-4 md:inset-8 lg:inset-12 bg-white rounded-2xl shadow-2xl z-[300] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-cream-dark flex justify-between items-center bg-white">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-gold text-navy flex items-center justify-center font-serif font-bold">V</div>
            <div>
              <p className="text-sm font-semibold text-navy">Vishara Elite</p>
              <p className="text-[10px] text-muted uppercase tracking-wider">Summary invoice</p>
            </div>
          </div>
          <div className="text-xs text-muted">Tax Invoice# {booking.id}</div>
          <div className="flex items-center gap-2 relative">
            <button className="p-2 hover:bg-cream rounded transition">🔄</button>
            <button className="p-2 hover:bg-cream rounded transition">🖨</button>
            <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 hover:bg-cream rounded transition">⋯</button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute top-full right-0 mt-2 z-50 bg-white border border-cream-dark rounded-lg shadow-xl min-w-[260px] py-1">
                  {[
                    "Print Registration card", "Lock booking", "Print C form", "Unlock booking",
                    "Email folio details", "Unassign room", "Folio log", "Assign Room",
                    "Edit rate plan", "Modify checkout", "Apply Coupon code / Discount / Offer", "Split Room",
                    "Add hotel addons", "Move Room", "Tax exempt status", "Scanty Baggage",
                    "Add Company Details", "Add new room to group booking", "Download Booking Voucher",
                  ].map((label) => (
                    <button
                      key={label}
                      onClick={() => {
                        setMenuOpen(false);
                        if (label === "Add hotel addons") setAddOnOpen(true);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-navy/80 hover:bg-cream transition"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
            <button onClick={onClose} className="text-2xl text-muted hover:text-navy leading-none px-2">×</button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 overflow-hidden">
          <div className="lg:col-span-2 overflow-y-auto p-6 border-r border-cream-dark">
            <div className="flex items-center justify-between pb-4 border-b border-cream-dark mb-4">
              <div className="text-sm">
                <span className="text-muted">Bill to : </span>
                <span className="font-semibold text-navy">{booking.primaryGuest.name}</span>
                <button className="ml-2 text-xs underline text-navy/60">Guest list</button>
                <span className="ml-2 text-xl text-muted cursor-pointer">+</span>
              </div>
              <div className="flex items-center gap-2">
                <select className="text-xs border border-cream-dark rounded px-2 py-1">
                  <option>{booking.source.toUpperCase()}</option>
                </select>
                <select className="text-xs border border-cream-dark rounded px-2 py-1">
                  <option>Walk-In</option>
                </select>
                <span className={`text-[10px] font-bold px-2 py-1 rounded ${booking.status === "CHECKED-IN" ? "bg-emerald-500 text-white" : "bg-amber-400 text-navy"}`}>
                  {booking.status}
                </span>
              </div>
            </div>

            <div className="border border-cream-dark rounded-lg overflow-hidden">
              <div className="grid grid-cols-12 bg-cream/60 text-xs font-bold text-navy px-4 py-2 border-b border-cream-dark">
                <div className="col-span-1"></div>
                <div className="col-span-2">Date</div>
                <div className="col-span-3">Description</div>
                <div className="col-span-1">Type</div>
                <div className="col-span-2 text-right">Sub-total (Rs.)</div>
                <div className="col-span-1 text-right">Tax %</div>
                <div className="col-span-1 text-right">Tax (Rs.)</div>
                <div className="col-span-1 text-right">Total</div>
              </div>

              <div className="grid grid-cols-12 px-4 py-3 border-b border-cream-dark text-sm">
                <div className="col-span-1"><input type="checkbox" className="accent-gold" /></div>
                <div className="col-span-2 text-navy/70">{prettyDate(booking.checkIn)}</div>
                <div className="col-span-3 text-navy font-medium">Booking Price</div>
                <div className="col-span-1 text-navy/60 text-xs">DEBIT</div>
                <div className="col-span-2 text-right">{(booking.amount - booking.tax).toFixed(2)}</div>
                <div className="col-span-1 text-right">{((booking.tax / (booking.amount - booking.tax)) * 100).toFixed(2)}</div>
                <div className="col-span-1 text-right">{booking.tax.toFixed(2)}</div>
                <div className="col-span-1 text-right font-semibold underline">{booking.amount.toFixed(2)}</div>
              </div>

              {addOns.map((a) => (
                <div key={a.id} className="grid grid-cols-12 px-4 py-3 border-b border-cream-dark text-sm">
                  <div className="col-span-1"><input type="checkbox" className="accent-gold" /></div>
                  <div className="col-span-2 text-navy/70">{prettyDate(a.date)}</div>
                  <div className="col-span-3 text-navy font-medium">{a.name}</div>
                  <div className="col-span-1 text-navy/60 text-xs">{a.type}</div>
                  <div className="col-span-2 text-right">{a.amount.toFixed(2)}</div>
                  <div className="col-span-1 text-right">5.00</div>
                  <div className="col-span-1 text-right">{(a.amount * 0.05).toFixed(2)}</div>
                  <div className="col-span-1 text-right font-semibold underline">{(a.amount * 1.05).toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-1 overflow-y-auto">
            <div className="bg-gradient-to-r from-teal-500 to-teal-600 text-white text-center py-3 font-semibold text-sm">
              Folio summary
            </div>

            <div className="p-5 space-y-3 border-b border-cream-dark text-sm">
              <p className="text-xs font-bold text-navy uppercase tracking-wider text-center mb-2">Booking Amount Breakdown</p>
              <div className="flex justify-between"><span className="text-muted">Total without taxes</span><span>Rs. {(booking.amount - booking.tax).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Total tax amount</span><span>Rs. {booking.tax.toFixed(2)}</span></div>
              <div className="flex justify-between border-t border-cream-dark pt-2 font-semibold"><span>Total with taxes and fees</span><span>Rs. {booking.amount.toFixed(2)}</span></div>
            </div>

            <div className="p-5 space-y-3 border-b border-cream-dark text-sm">
              <p className="text-xs font-bold text-navy uppercase tracking-wider text-center mb-2">Room Taxes Breakdown</p>
              <div className="flex justify-between"><span className="text-muted">GST</span><span>Rs. {booking.tax.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted">CGST</span><span>Rs. {(booking.tax / 2).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted">SGST</span><span>Rs. {(booking.tax / 2).toFixed(2)}</span></div>
              <div className="flex justify-between border-t border-cream-dark pt-2"><span className="text-muted">Service taxes</span><span>Rs. 0.00</span></div>
            </div>

            <div className="p-5 space-y-3 border-b border-cream-dark text-sm">
              <p className="text-xs font-bold text-navy uppercase tracking-wider text-center mb-2">Payment Breakdown</p>
              <div className="flex justify-between"><span className="text-muted">Cash payment</span><span>Rs. {getPaid(booking).toFixed(2)}</span></div>
              <div className="flex justify-between border-t border-cream-dark pt-2"><span className="text-muted">Payment made</span><span>Rs. {getPaid(booking).toFixed(2)}</span></div>
              <div className="flex justify-between font-semibold text-rose-500"><span>Balance due</span><span>Rs. {balance.toFixed(2)}</span></div>
            </div>

            <div className="p-5 flex gap-2">
              <button className="flex-1 py-2.5 bg-navy text-cream rounded-lg text-xs font-bold hover:bg-navy-light">Settle dues</button>
              <button onClick={onCheckout} className="flex-1 py-2.5 bg-teal-500 text-white rounded-lg text-xs font-bold hover:bg-teal-600">Check-out</button>
            </div>
          </div>
        </div>
      </div>

      {addOnOpen && <AddOnModal onClose={() => setAddOnOpen(false)} onAdd={handleAddOn} />}
    </>
  );
}

function AddOnModal({ onClose, onAdd }: { onClose: () => void; onAdd: (addon: AddOn) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("DEBIT");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amountExclTax, setAmountExclTax] = useState("");
  const [taxPct, setTaxPct] = useState(5);
  const [error, setError] = useState<string | null>(null);

  const amount = Number(amountExclTax) || 0;
  const amountWithTax = amount * (1 + taxPct / 100);

  const submit = () => {
    if (!name.trim()) return setError("Please enter item name");
    if (amount <= 0) return setError("Please enter a valid amount");
    onAdd({
      id: `A${Date.now()}`,
      name: name.trim(),
      type,
      amount,
      date,
    });
  };

  return (
    <>
      <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-[310]" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl z-[320] w-full max-w-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-navy">Add hotel addons</h2>
          <button onClick={onClose} className="text-2xl text-muted hover:text-navy leading-none">×</button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted font-semibold block mb-1">Addons</label>
            <select className="w-full border border-cream-dark rounded px-3 py-2.5 text-sm">
              <option>Add new service</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-wide text-muted font-semibold block mb-1">Service date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full border border-cream-dark rounded px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wide text-muted font-semibold block mb-1">Service amount type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full border border-cream-dark rounded px-3 py-2.5 text-sm">
                <option>DEBIT</option>
                <option>CREDIT</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted font-semibold block mb-1">Folio item name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Minibar, Laundry, Spa"
              className={`w-full border rounded px-3 py-2.5 text-sm outline-none transition ${error && !name ? "border-rose-400" : "border-cream-dark focus:border-gold"}`}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-wide text-muted font-semibold block mb-1">Amount without tax</label>
              <input type="number" value={amountExclTax} onChange={(e) => setAmountExclTax(e.target.value)} className="w-full border border-cream-dark rounded px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wide text-muted font-semibold block mb-1">Applicable taxes</label>
              <select value={taxPct} onChange={(e) => setTaxPct(Number(e.target.value))} className="w-full border border-cream-dark rounded px-3 py-2.5 text-sm">
                <option value={0}>0%</option>
                <option value={5}>5% GST</option>
                <option value={12}>12% GST</option>
                <option value={18}>18% GST</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wide text-muted font-semibold block mb-1">Amount with tax</label>
              <input type="text" value={amountWithTax.toFixed(2)} readOnly className="w-full border border-cream-dark rounded px-3 py-2.5 text-sm bg-cream/40" />
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center mt-6">
          <button onClick={onClose} className="text-xs uppercase tracking-wider font-semibold text-navy/60 hover:text-navy">
            Cancel
          </button>
          <button onClick={submit} className="px-5 py-2.5 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-700">
            Add new hotel addon
          </button>
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
