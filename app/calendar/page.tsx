"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { statusLabels } from "../data";
import type { Booking, Guest, Payment } from "../types";
import { getPaid, getBalance } from "../types";
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
  holdBooking,
  releaseHold,
  lockBooking,
  unlockBooking,
  markNoShow,
  unassignRoom,
  moveReservation,
  sendMagicLink,
  type Room,
} from "../db";
import CreateReservationModal, { type ReservationFormData } from "../create-reservation-modal";
import GuestInfoPanel from "../components/GuestInfoPanel";
import FolioModal from "../components/FolioModal";

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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
function nightsBetween(a: string, b: string): number {
  return Math.max(1, daysBetween(a, b));
}
function todayISO(): string {
  return fmt(new Date());
}

type ViewMode = "full" | "room";
type DateRangeFilter = "All" | "Today" | "This Week" | "Next 7 Days" | "Next 14 Days" | "This Month";

const RANGE_OPTIONS: DateRangeFilter[] = ["All", "Today", "This Week", "Next 7 Days", "Next 14 Days", "This Month"];

const legendItems = [
  { label: "Confirmed", color: "bg-amber-400" },
  { label: "Checked-in", color: "bg-emerald-500" },
  { label: "Checked-out / Due out", color: "bg-rose-500" },
  { label: "Blocked", color: "bg-blue-500" },
  { label: "Cancelled", color: "bg-gray-300" },
  { label: "On hold", color: "bg-purple-400" },
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
  "Hold booking", "Set to no show", "Lock booking", "Unlock booking", "Unassign room",
  "Modify checkin", "Modify checkout", "Split Room", "Move Room", "Send magic link", "Cancel booking",
];

const CELL_WIDTH = 80;
const ROW_HEIGHT = 56;
const DRAG_THRESHOLD = 5;

// Type for pending confirmation action
type PendingAction = {
  type: string;
  booking: Booking;
  title: string;
  message: string;
  confirmLabel: string;
  confirmColor: "red" | "green" | "amber" | "purple" | "blue" | "gray";
  onConfirm?: () => void | Promise<void>;
} | null;

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

  const [guestPanelFor, setGuestPanelFor] = useState<Booking | null>(null);
  const [folioFor, setFolioFor] = useState<Booking | null>(null);
  const [holdsPanelOpen, setHoldsPanelOpen] = useState(false);
  const [moveRoomTarget, setMoveRoomTarget] = useState<Booking | null>(null);
  const [moveRoomNewRoom, setMoveRoomNewRoom] = useState<string>("");

  // Universal confirmation modal state
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionRunning, setActionRunning] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<{ roomNumber: string; checkIn: string; checkOut: string } | null>(null);

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
    setTimeout(() => setToast(null), 2800);
  };

  const activeBookings = useMemo(
    () => bookings.filter((b) => b.status !== "ON-HOLD" && b.status !== "CANCELLED"),
    [bookings]
  );
  const holdBookings = useMemo(() => bookings.filter((b) => b.status === "ON-HOLD"), [bookings]);
  const unassignedBookings = useMemo(
    () => bookings.filter((b) => b.status === "CONFIRMED" && !b.roomNumber),
    [bookings]
  );

  const loadFromDb = useCallback(async () => {
    try {
      setLoading(true);
      const [bookingsData, roomsData] = await Promise.all([fetchBookings(), fetchRooms()]);
      setBookings(bookingsData);
      setRooms(roomsData);
      setSelected((prev) => {
        if (!prev) return null;
        return bookingsData.find((b) => b.id === prev.id) || prev;
      });
    } catch (err) {
      console.error("Failed to load bookings:", err);
      showToast("⚠ Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFromDb(); }, [loadFromDb]);

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
      return dates.filter((d) => { const s = fmt(d); return s >= today && s <= weekFromNow; });
    }
    if (dateRangeFilter === "Next 14 Days") {
      const twoWeeks = addDays(today, 14);
      return dates.filter((d) => { const s = fmt(d); return s >= today && s <= twoWeeks; });
    }
    if (dateRangeFilter === "This Month") {
      const m = new Date().getMonth();
      return dates.filter((dt) => dt.getMonth() === m);
    }
    return dates;
  })();

  const visibleRooms = viewMode === "room" && rooms.length > 0 ? [rooms[0]] : rooms;

  function getBlockedBooking(roomNumber: string, date: Date): Booking | null {
    const dateStr = fmt(date);
    return bookings.find(
      (b) => b.roomNumber === roomNumber && b.status === "BLOCKED" && b.checkIn <= dateStr && b.checkOut > dateStr
    ) || null;
  }

  // ═══ UNIVERSAL CONFIRMATION DISPATCHER ═══
  const askAction = (action: PendingAction) => {
    setShowModifyMenu(false);
    setPendingAction(action);
  };

  const runPendingAction = async () => {
    if (!pendingAction) return;
    setActionRunning(true);
    const { type, booking, onConfirm } = pendingAction;

    try {
      // If a custom onConfirm is defined (for UI-only actions), run it
      if (onConfirm) {
        await onConfirm();
        setActionRunning(false);
        setPendingAction(null);
        return;
      }

      // Otherwise, execute the action by type
      switch (type) {
        case "CHECK_IN": {
          const notes = `${booking.notes ? booking.notes + " · " : ""}Checked in at ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
          await updateBookingStatus(booking.id, "CHECKED-IN", notes);
          showToast(`✅ ${booking.primaryGuest.name} checked in`);
          break;
        }
        case "CHECK_OUT": {
          const balance = getBalance(booking);
          if (balance > 0) {
            showToast(`⚠ Cannot check-out · ₹${balance.toFixed(2)} balance due`);
            setActionRunning(false);
            setPendingAction(null);
            return;
          }
          const notes = `${booking.notes ? booking.notes + " · " : ""}Checked out at ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
          await updateBookingStatus(booking.id, "CHECKED-OUT", notes);
          showToast(`🚪 ${booking.primaryGuest.name} checked out`);
          setSelected(null);
          break;
        }
        case "HOLD": {
          await holdBooking(booking.id, "Moved to holds");
          showToast(`⏸ ${booking.primaryGuest.name} moved to On-Hold`);
          setSelected(null);
          break;
        }
        case "NO_SHOW": {
          await markNoShow(booking.id);
          showToast(`🚫 Marked as no-show`);
          setSelected(null);
          break;
        }
        case "LOCK": {
          await lockBooking(booking.id);
          showToast(`🔒 Booking locked`);
          break;
        }
        case "UNLOCK": {
          await unlockBooking(booking.id);
          showToast(`🔓 Booking unlocked`);
          break;
        }
        case "UNASSIGN": {
          await unassignRoom(booking.id);
          showToast(`🚪 Room unassigned`);
          setSelected(null);
          break;
        }
        case "CANCEL": {
          await updateBookingStatus(booking.id, "CANCELLED", booking.notes);
          showToast(`🚫 Booking cancelled`);
          setSelected(null);
          break;
        }
        case "MAGIC_LINK": {
          const link = await sendMagicLink(booking.id);
          await navigator.clipboard.writeText(link);
          showToast(`✨ Magic link copied!`);
          break;
        }
        case "RELEASE_HOLD": {
          await releaseHold(booking.id);
          showToast(`✅ ${booking.primaryGuest.name} restored`);
          setHoldsPanelOpen(false);
          break;
        }
        case "UNBLOCK": {
          await updateBookingStatus(booking.id, "CANCELLED", booking.notes);
          showToast(`🔓 Room ${booking.roomNumber} unblocked`);
          break;
        }
      }
      await loadFromDb();
    } catch (err: any) {
      console.error("[runPendingAction]", err);
      showToast(`⚠ ${err?.message || "Action failed"}`);
    } finally {
      setActionRunning(false);
      setPendingAction(null);
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

  const handleCellClick = (roomNumber: string, date: Date) => {
    const blocked = getBlockedBooking(roomNumber, date);
    if (blocked) {
      askAction({
        type: "UNBLOCK", booking: blocked,
        title: "Unblock room?",
        message: `Do you want to continue to unblock Room ${roomNumber}? Reason: "${blocked.notes || "no reason"}".`,
        confirmLabel: "Yes, Unblock",
        confirmColor: "blue",
      });
      return;
    }
    setCreatePrefill({ roomNumber, checkIn: fmt(date), checkOut: fmt(new Date(date.getTime() + 86400000)) });
    setCreateOpen(true);
  };

  const handleCreateSubmit = async (data: ReservationFormData) => {
    try {
      await createReservation({
        roomNumber: data.roomNumber, checkIn: data.checkIn, checkOut: data.checkOut,
        ratePlan: data.ratePlan, source: data.source.toLowerCase().replace(/\s+/g, ""),
        primaryGuest: data.primaryGuest, adults: data.adults, children: data.children,
        infants: data.infants, amount: data.amount, tax: data.tax, notes: data.notes,
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

  // ═══ MODIFY DROPDOWN — Every option opens a confirmation ═══
  const handleModifyOption = (label: string) => {
    if (!selected) return;
    setShowModifyMenu(false);

    const b = selected;
    const gname = b.primaryGuest?.name || "guest";

    switch (label) {
      case "Hold booking":
        askAction({
          type: "HOLD", booking: b,
          title: "Hold booking?",
          message: `Do you want to move "${gname}" to On-Hold? The booking will disappear from the calendar and appear in the Holds panel.`,
          confirmLabel: "Yes, Hold Booking",
          confirmColor: "purple",
        });
        break;

      case "Set to no show":
        askAction({
          type: "NO_SHOW", booking: b,
          title: "Mark as no-show?",
          message: `Do you want to continue to mark "${gname}" as a no-show? This will cancel the booking.`,
          confirmLabel: "Yes, Mark No-Show",
          confirmColor: "red",
        });
        break;

      case "Lock booking":
        askAction({
          type: "LOCK", booking: b,
          title: "Lock booking?",
          message: `Do you want to lock this booking? Locked bookings cannot be edited until unlocked.`,
          confirmLabel: "Yes, Lock Booking",
          confirmColor: "amber",
        });
        break;

      case "Unlock booking":
        askAction({
          type: "UNLOCK", booking: b,
          title: "Unlock booking?",
          message: `Do you want to unlock this booking? It will become editable again.`,
          confirmLabel: "Yes, Unlock",
          confirmColor: "green",
        });
        break;

      case "Unassign room":
        askAction({
          type: "UNASSIGN", booking: b,
          title: "Unassign room?",
          message: `Do you want to continue to unassign Room ${b.roomNumber} from "${gname}"? The booking will move to the Holds panel as unassigned.`,
          confirmLabel: "Yes, Unassign Room",
          confirmColor: "amber",
        });
        break;

      case "Move Room":
        setMoveRoomTarget(b);
        setMoveRoomNewRoom("");
        break;

      case "Send magic link":
        askAction({
          type: "MAGIC_LINK", booking: b,
          title: "Send magic link?",
          message: `Do you want to generate a magic link for "${gname}"? The link will be copied to your clipboard.`,
          confirmLabel: "Yes, Generate Link",
          confirmColor: "blue",
        });
        break;

      case "Cancel booking":
        askAction({
          type: "CANCEL", booking: b,
          title: "Cancel booking?",
          message: `Do you want to continue to cancel this booking for "${gname}"? This action cannot be undone.`,
          confirmLabel: "Yes, Cancel Booking",
          confirmColor: "red",
        });
        break;

      case "Modify checkin":
      case "Modify checkout":
      case "Split Room":
        showToast(`⚙ ${label} — coming soon`);
        break;

      default:
        showToast(`⚙ ${label} — not yet implemented`);
    }
  };

  // ═══ DRAG & DROP ═══
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
          bookingId: d.bookingId, currentX: point.clientX, currentY: point.clientY,
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
          // Ask for confirmation before moving via drag
          const b = bookings.find((bb) => bb.id === d.bookingId);
          if (b) {
            askAction({
              type: "DRAG_MOVE",
              booking: b,
              title: "Move reservation?",
              message: `Do you want to move "${b.primaryGuest.name}" to Room ${dragVisual.previewRoom} on ${prettyDate(dragVisual.previewCheckIn)}?`,
              confirmLabel: "Yes, Move",
              confirmColor: "green",
              onConfirm: async () => {
                await updateBookingRoomAndDates(d.bookingId, dragVisual.previewRoom, dragVisual.previewCheckIn, dragVisual.previewCheckOut);
                showToast(`📅 Moved to Room ${dragVisual.previewRoom}`);
                await loadFromDb();
              },
            });
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
  }, [dragVisual, bookings, loadFromDb, rooms]);

  const todayStr = todayISO();

  // ═══ CONFIRMATION MODAL COLOR MAP ═══
  const confirmColorMap: Record<string, { bg: string; hover: string; iconBg: string; icon: string }> = {
    red:    { bg: "bg-rose-600",    hover: "hover:bg-rose-700",    iconBg: "bg-rose-100",    icon: "⚠" },
    green:  { bg: "bg-emerald-600", hover: "hover:bg-emerald-700", iconBg: "bg-emerald-100", icon: "✓" },
    amber:  { bg: "bg-amber-500",   hover: "hover:bg-amber-600",   iconBg: "bg-amber-100",   icon: "🔒" },
    purple: { bg: "bg-purple-600",  hover: "hover:bg-purple-700",  iconBg: "bg-purple-100",  icon: "⏸" },
    blue:   { bg: "bg-blue-600",    hover: "hover:bg-blue-700",    iconBg: "bg-blue-100",    icon: "✨" },
    gray:   { bg: "bg-slate-700",   hover: "hover:bg-slate-800",   iconBg: "bg-slate-100",   icon: "ℹ" },
  };

  return (
    <div className="p-6 lg:p-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
        <div>
          <h1 className="font-serif text-4xl font-semibold text-navy tracking-tight">Front Office · Calendar</h1>
          <p className="text-muted mt-1 text-sm">
            {rooms.length} rooms · {activeBookings.length} bookings
            {holdBookings.length > 0 && ` · ${holdBookings.length} on hold`} ·{" "}
            <button onClick={loadFromDb} className="text-gold-dark font-medium hover:underline">
              {loading ? "Loading…" : "🔄 Refresh"}
            </button>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-cream-dark p-1 rounded-lg flex border border-cream-dark">
            <button onClick={() => setViewMode("full")} className={`px-4 py-1.5 text-xs font-medium rounded transition ${viewMode === "full" ? "bg-slate-800 text-white shadow-sm" : "text-navy/70 hover:text-navy"}`}>Full view</button>
            <button onClick={() => setViewMode("room")} className={`px-4 py-1.5 text-xs font-medium rounded transition ${viewMode === "room" ? "bg-slate-800 text-white shadow-sm" : "text-navy/70 hover:text-navy"}`}>Room view</button>
          </div>

          <button onClick={() => setHoldsPanelOpen(true)} className="relative px-4 py-2 border border-purple-300 bg-purple-50 text-purple-700 rounded-lg text-sm font-semibold hover:bg-purple-100 transition flex items-center gap-2">
            ⏸ Holds & Enquiries
            {(holdBookings.length + unassignedBookings.length) > 0 && (
              <span className="absolute -top-2 -right-2 bg-purple-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {holdBookings.length + unassignedBookings.length}
              </span>
            )}
          </button>

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

      {/* LEGEND */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs items-center">
        <div className="relative">
          <button onClick={() => setFiltersOpen(!filtersOpen)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-navy/10 shadow-sm hover:border-gold transition">
            <span className="text-[10px] uppercase tracking-wider text-muted font-semibold">Filters</span>
            <span className="text-navy font-medium">{dateRangeFilter}</span>
            <span className="text-navy/50">▾</span>
          </button>
          {filtersOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setFiltersOpen(false)} />
              <div className="absolute top-full left-0 mt-2 z-50 bg-white border border-cream-dark rounded-lg shadow-xl min-w-[180px] py-1">
                {RANGE_OPTIONS.map((opt) => (
                  <button key={opt} onClick={() => { setDateRangeFilter(opt); setFiltersOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm hover:bg-cream transition-colors flex items-center justify-between ${dateRangeFilter === opt ? "text-gold-dark font-semibold bg-cream/60" : "text-navy/80"}`}>
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
        <span className="ml-auto text-gold-dark font-medium text-[11px]">👆 Click empty cell · 🖱 Drag · ⏸ Hold from booking panel</span>
      </div>

      {/* CALENDAR GRID */}
      {loading && (
        <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(11,18,32,0.06)] border border-navy/5 p-12 text-center">
          <p className="text-navy font-medium">⏳ Loading bookings…</p>
        </div>
      )}

      {!loading && rooms.length > 0 && (
        <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(11,18,32,0.06)] border border-navy/5 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[1400px]">
              <div className="flex border-b border-navy/10 bg-gradient-to-b from-cream/60 to-cream-dark/30">
                <div className="w-36 shrink-0 px-4 py-3 text-[10px] font-semibold text-navy uppercase tracking-widest border-r border-navy/10 flex items-center gap-2">
                  <span>🔑</span><span>Rooms</span>
                </div>
                {visibleDates.map((d, i) => {
                  const s = shortFmt(d);
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  const isToday = fmt(d) === todayStr;
                  return (
                    <div key={i} className={`flex-1 min-w-[80px] px-2 py-2 text-center border-r border-navy/5 ${isWeekend ? "bg-gold/5" : ""} ${isToday ? "bg-gold/15" : ""}`}>
                      <div className="text-[10px] font-medium text-muted uppercase tracking-wider">{s.day}</div>
                      <div className={`text-sm font-semibold ${isToday || isWeekend ? "text-gold-dark" : "text-navy"}`}>{s.date} {s.month}</div>
                    </div>
                  );
                })}
              </div>

              {visibleRooms.map((room) => (
                <div key={room.id} className="flex border-b border-navy/5 last:border-b-0 hover:bg-gradient-to-r hover:from-gold/5 hover:to-transparent transition-all duration-200" style={{ height: ROW_HEIGHT }}>
                  <div className="w-36 shrink-0 px-4 py-2 border-r border-navy/5 flex items-center gap-2">
                    <span className="text-gold-dark text-sm">🔑</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-navy">{room.room_number}</div>
                      <div className="text-[10px] text-muted truncate">{room.room_type}</div>
                    </div>
                  </div>
                  <div className="flex flex-1 relative">
                    {visibleDates.map((d, i) => {
                      const currentBookings = activeBookings.filter((b) => b.roomNumber === room.room_number && bookingSpansDate(b, d));
                      const blocked = getBlockedBooking(room.room_number, d);
                      const isEmpty = currentBookings.length === 0 && !blocked;
                      const isToday = fmt(d) === todayStr;
                      return (
                        <div
                          key={i}
                          className={`flex-1 min-w-[80px] border-r border-navy/5 relative group ${isEmpty ? "cursor-pointer hover:bg-emerald-50/60" : blocked ? "cursor-pointer" : ""}`}
                          style={{ height: ROW_HEIGHT }}
                          onClick={() => { if (isEmpty) handleCellClick(room.room_number, d); }}
                        >
                          {isToday && <div className="absolute top-0 bottom-0 left-1/2 w-[2px] bg-red-500/70 pointer-events-none z-20" />}
                          {blocked && (
                            <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-300 border-r border-slate-400 flex items-center justify-center cursor-pointer hover:from-slate-300 hover:to-slate-400 transition" title={`Blocked · ${blocked.notes || "no reason"}`}>
                              <span className="text-slate-500 text-2xl">🔒</span>
                            </div>
                          )}
                          {isEmpty && <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"><span className="text-emerald-500 text-2xl font-light">+</span></div>}
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
                                className={`absolute top-2.5 left-1 h-11 ${statusBarClass[b.status]} rounded-lg flex items-center px-3 z-10 overflow-hidden cursor-grab active:cursor-grabbing select-none transition-all duration-200 ${isDragging ? "opacity-40 scale-95" : "hover:scale-[1.02] hover:-translate-y-0.5"}`}
                                style={{ width: `calc(${span} * 100% - 0.6rem)`, minWidth: "100%" }}
                              >
                                <div className="flex flex-col truncate leading-tight w-full pointer-events-none">
                                  <span className="text-[11.5px] font-semibold truncate tracking-tight">{b.primaryGuest.name}</span>
                                  <span className="text-[9px] font-medium uppercase tracking-wider opacity-85 mt-0.5">{statusLabels[b.status]}</span>
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

      {/* RESERVATION PANEL */}
      {selected && (
        <div className="fixed inset-y-0 right-0 w-[420px] bg-white shadow-2xl border-l border-navy/10 z-40 flex flex-col">
          <div className="bg-gradient-to-r from-amber-400 to-amber-500 p-5 text-white flex justify-between items-start">
            <div>
              <p className="text-[10px] uppercase tracking-widest opacity-80">Booking · {selected.id.slice(0, 8)}</p>
              <h2 className="text-xl font-bold mt-1">{selected.primaryGuest.name}</h2>
              <p className="text-sm opacity-90">{selected.primaryGuest.phone}</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded transition">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-5 border-b border-navy/10">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-navy">Reservation</h3>
                <span className="text-xs bg-rose-100 text-rose-700 px-2 py-1 rounded font-medium uppercase">{selected.source}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 text-xs mb-1">Dates</p>
                  <p className="font-medium text-navy">{prettyDate(selected.checkIn)} → {prettyDate(selected.checkOut)}</p>
                  <p className="text-[10px] text-muted">{nightsBetween(selected.checkIn, selected.checkOut)} nights</p>
                </div>
                <div><p className="text-gray-500 text-xs mb-1">Room type</p><p className="font-medium text-navy">{selected.roomType}</p></div>
                <div><p className="text-gray-500 text-xs mb-1">Booked Room</p><p className="font-medium text-navy">{selected.roomNumber}</p></div>
                <div><p className="text-gray-500 text-xs mb-1">Booking source</p><p className="font-medium text-navy uppercase text-xs">{selected.source}</p></div>
              </div>
              <div className="flex gap-2 mt-4">
                {/* View Folio — with confirmation */}
                <button
                  onClick={() => askAction({
                    type: "OPEN_FOLIO", booking: selected,
                    title: "Open Folio?",
                    message: `Do you want to view the folio (bill) for "${selected.primaryGuest.name}"?`,
                    confirmLabel: "Yes, View Folio",
                    confirmColor: "gray",
                    onConfirm: () => setFolioFor(selected),
                  })}
                  className="flex-1 px-3 py-2 border border-navy/20 rounded-lg text-xs font-medium text-navy hover:bg-cream transition"
                >
                  📄 View folio
                </button>
                {/* Print Reg Card — with confirmation */}
                <button
                  onClick={() => askAction({
                    type: "PRINT_REG", booking: selected,
                    title: "Print Registration Card?",
                    message: `Do you want to print the registration card for "${selected.primaryGuest.name}"?`,
                    confirmLabel: "Yes, Print",
                    confirmColor: "gray",
                    onConfirm: () => {
                      showToast("🖨 Printing registration card…");
                    },
                  })}
                  className="flex-1 px-3 py-2 border border-navy/20 rounded-lg text-xs font-medium text-navy hover:bg-cream transition"
                >
                  🖨 Print reg card
                </button>
                {/* Edit Guest Info — with confirmation */}
                <button
                  onClick={() => askAction({
                    type: "EDIT_GUEST", booking: selected,
                    title: "Edit guest info?",
                    message: `Do you want to edit the guest information for "${selected.primaryGuest.name}"?`,
                    confirmLabel: "Yes, Edit",
                    confirmColor: "gray",
                    onConfirm: () => setGuestPanelFor(selected),
                  })}
                  className="flex-1 px-3 py-2 border border-navy/20 rounded-lg text-xs font-medium text-navy hover:bg-cream transition"
                >
                  ✏️ Edit guest info
                </button>
              </div>
            </div>

            <div className="p-5 border-b border-navy/10">
              <h3 className="font-semibold text-navy mb-3">Front Desk Actions</h3>
              {selected.status === "CONFIRMED" && (
                <button
                  onClick={() => askAction({
                    type: "CHECK_IN", booking: selected,
                    title: "Confirm Check-In",
                    message: `Do you want to continue to check-in "${selected.primaryGuest.name}" to Room ${selected.roomNumber}?`,
                    confirmLabel: "Yes, Check-In",
                    confirmColor: "green",
                  })}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-lg font-semibold mb-2 transition"
                >
                  ✅ Check-In Guest
                </button>
              )}
              {selected.status === "CHECKED-IN" && (
                <button
                  onClick={() => askAction({
                    type: "CHECK_OUT", booking: selected,
                    title: "Confirm Check-Out",
                    message: `Do you want to continue to check-out "${selected.primaryGuest.name}" from Room ${selected.roomNumber}?`,
                    confirmLabel: "Yes, Check-Out",
                    confirmColor: "red",
                  })}
                  className="w-full bg-rose-500 hover:bg-rose-600 text-white py-3 rounded-lg font-semibold mb-2 transition"
                >
                  🚪 Check-Out Guest
                </button>
              )}
              {selected.status === "BLOCKED" && (
                <button
                  onClick={() => askAction({
                    type: "UNBLOCK", booking: selected,
                    title: "Unblock room?",
                    message: `Do you want to continue to unblock Room ${selected.roomNumber}?`,
                    confirmLabel: "Yes, Unblock",
                    confirmColor: "blue",
                  })}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-semibold mb-2 transition"
                >
                  🔓 Unblock Room
                </button>
              )}

              {/* Add Payment — with confirmation */}
              <button
                onClick={() => askAction({
                  type: "ADD_PAYMENT", booking: selected,
                  title: "Add payment?",
                  message: `Do you want to record a payment for "${selected.primaryGuest.name}"? A payment window will open.`,
                  confirmLabel: "Yes, Add Payment",
                  confirmColor: "green",
                  onConfirm: () => showToast("💰 Payment modal — coming soon"),
                })}
                className="w-full border border-emerald-300 bg-emerald-50 text-emerald-700 py-2 rounded-lg font-medium mb-2 hover:bg-emerald-100 transition text-sm"
              >
                💰 Add Payment
              </button>

              <div className="relative mt-3">
                <button onClick={() => setShowModifyMenu(!showModifyMenu)} className="w-full border border-navy/20 text-navy py-2.5 rounded-lg font-medium flex justify-between px-3 items-center hover:bg-cream transition text-sm">
                  <span>⚙ More Actions</span>
                  <span className="text-xs">{showModifyMenu ? "▲" : "▼"}</span>
                </button>
                {showModifyMenu && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-navy/15 rounded-lg shadow-xl z-50 text-sm overflow-hidden max-h-80 overflow-y-auto">
                    {modifyOptions.map((opt) => (
                      <button key={opt} onClick={() => handleModifyOption(opt)} className="w-full text-left px-4 py-2.5 hover:bg-cream transition-colors text-navy/85">{opt}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 border-b border-navy/10">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-navy">Primary Guest</h3>
                <button
                  onClick={() => askAction({
                    type: "EDIT_GUEST", booking: selected,
                    title: "Edit guest info?",
                    message: `Do you want to edit the guest information for "${selected.primaryGuest.name}"?`,
                    confirmLabel: "Yes, Edit",
                    confirmColor: "gray",
                    onConfirm: () => setGuestPanelFor(selected),
                  })}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  Edit
                </button>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Name</span><span className="font-medium text-navy">{selected.primaryGuest.name}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Phone</span><span className="font-medium text-navy">{selected.primaryGuest.phone}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Email</span><span className="font-medium text-navy text-xs">{selected.primaryGuest.email || "—"}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Pincode</span><span className="font-medium text-navy">{selected.primaryGuest.pincode || "—"}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">City</span><span className="font-medium text-navy">{selected.primaryGuest.city || "—"}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">State</span><span className="font-medium text-navy">{selected.primaryGuest.state || "—"}</span></div>
              </div>
            </div>

            <div className="p-5">
              <h3 className="font-semibold text-navy mb-2">Guests</h3>
              <p className="text-sm text-navy/70">{selected.adults} Adults · {selected.children} Children · {selected.infants || 0} Infants</p>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ UNIVERSAL CONFIRMATION MODAL ═══════════════ */}
      {pendingAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-full ${confirmColorMap[pendingAction.confirmColor].iconBg} flex items-center justify-center text-2xl shrink-0`}>
                  {confirmColorMap[pendingAction.confirmColor].icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-navy mb-2">{pendingAction.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{pendingAction.message}</p>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setPendingAction(null)}
                disabled={actionRunning}
                className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={runPendingAction}
                disabled={actionRunning}
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition ${confirmColorMap[pendingAction.confirmColor].bg} ${confirmColorMap[pendingAction.confirmColor].hover} disabled:opacity-50`}
              >
                {actionRunning ? "Processing..." : pendingAction.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GUEST INFO PANEL */}
      {guestPanelFor && (
        <GuestInfoPanel
          booking={guestPanelFor}
          onClose={() => setGuestPanelFor(null)}
          onSave={(updatedGuest) => handleSaveGuest(guestPanelFor, updatedGuest)}
        />
      )}

      {/* FOLIO MODAL */}
      {folioFor && (
        <FolioModal
          booking={folioFor}
          onClose={() => setFolioFor(null)}
        />
      )}

      {/* MOVE ROOM MODAL */}
      {moveRoomTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-[500px] p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-navy">Move Reservation</h3>
              <button onClick={() => setMoveRoomTarget(null)} className="text-gray-500 hover:text-gray-800 text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <div className="bg-cream/60 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted">Guest</span><span className="font-semibold">{moveRoomTarget.primaryGuest.name}</span></div>
                <div className="flex justify-between"><span className="text-muted">Current Room</span><span className="font-semibold">{moveRoomTarget.roomNumber}</span></div>
                <div className="flex justify-between"><span className="text-muted">Dates</span><span className="font-semibold">{moveRoomTarget.checkIn} → {moveRoomTarget.checkOut}</span></div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Select New Room</label>
                <select
                  value={moveRoomNewRoom}
                  onChange={(e) => setMoveRoomNewRoom(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-teal-500"
                >
                  <option value="">-- Choose a room --</option>
                  {rooms.filter((r) => r.room_number !== moveRoomTarget.roomNumber).map((r) => (
                    <option key={r.id} value={r.room_number}>{r.room_number} — {r.room_type}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setMoveRoomTarget(null)} className="px-4 py-2 border rounded-lg text-navy hover:bg-cream">Cancel</button>
              <button
                onClick={() => {
                  if (!moveRoomNewRoom) {
                    alert("Please select a room");
                    return;
                  }
                  askAction({
                    type: "MOVE_ROOM", booking: moveRoomTarget,
                    title: "Confirm move?",
                    message: `Do you want to move "${moveRoomTarget.primaryGuest.name}" from Room ${moveRoomTarget.roomNumber} to Room ${moveRoomNewRoom}?`,
                    confirmLabel: "Yes, Move",
                    confirmColor: "green",
                    onConfirm: async () => {
                      try {
                        await moveReservation(moveRoomTarget.id, moveRoomNewRoom);
                        showToast(`📅 Moved to Room ${moveRoomNewRoom}`);
                        setMoveRoomTarget(null);
                        setSelected(null);
                        await loadFromDb();
                      } catch (err: any) {
                        showToast(`⚠ ${err.message || "Move failed"}`);
                      }
                    },
                  });
                }}
                className="px-5 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700"
              >
                Move Reservation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE RESERVATION MODAL */}
      {createOpen && (
        <CreateReservationModal
          initialRoom={createPrefill?.roomNumber}
          initialCheckIn={createPrefill?.checkIn}
          initialCheckOut={createPrefill?.checkOut}
          onClose={() => { setCreateOpen(false); setCreatePrefill(null); }}
          onSubmit={handleCreateSubmit}
        />
      )}

      {/* TOAST */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-navy text-cream px-6 py-3 rounded-xl shadow-2xl text-sm font-medium z-[100]">
          {toast}
        </div>
      )}

      {/* HOLDS PANEL */}
      {holdsPanelOpen && (
        <div className="fixed inset-y-0 right-0 w-[440px] bg-white shadow-2xl border-l border-purple-200 z-50 flex flex-col">
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-5 text-white flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold">⏸ Holds & Enquiries</h2>
              <p className="text-xs opacity-90">
                {holdBookings.length} on hold · {unassignedBookings.length} unassigned
              </p>
            </div>
            <button onClick={() => setHoldsPanelOpen(false)} className="text-white/80 hover:text-white text-xl">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">

            {/* ON-HOLD BOOKINGS */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-700 mb-2">
                ⏸ On Hold ({holdBookings.length})
              </h3>
              {holdBookings.length === 0 && (
                <p className="text-xs text-muted py-3 px-2 bg-gray-50 rounded-lg text-center">No held bookings</p>
              )}
              {holdBookings.map((b) => (
                <div key={b.id} className="border border-purple-200 rounded-xl p-4 bg-purple-50/50 mb-2">
                  <div className="flex justify-between items-start mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-navy text-sm truncate">{b.primaryGuest?.name || "—"}</p>
                      <p className="text-xs text-muted">{b.primaryGuest?.phone || "—"}</p>
                    </div>
                    <span className="text-[10px] bg-purple-200 text-purple-800 px-2 py-0.5 rounded font-bold uppercase shrink-0 ml-2">Hold</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-navy/70 mb-3">
                    <div>📅 {prettyDate(b.checkIn)}</div>
                    <div>→ {prettyDate(b.checkOut)}</div>
                    <div>🔑 Room {b.roomNumber || "—"}</div>
                    <div>💰 ₹{b.amount.toLocaleString("en-IN")}</div>
                  </div>
                  {b.notes && (
                    <div className="text-[11px] text-navy/60 bg-white border border-purple-100 rounded-md p-2 mb-2 italic">
                      📝 {b.notes}
                    </div>
                  )}
                  <button
                    onClick={() => askAction({
                      type: "RELEASE_HOLD", booking: b,
                      title: "Release hold?",
                      message: `Do you want to release "${b.primaryGuest?.name}" back to the calendar?`,
                      confirmLabel: "Yes, Release",
                      confirmColor: "green",
                    })}
                    className="w-full bg-purple-600 text-white text-xs py-2 rounded-lg hover:bg-purple-700 font-semibold"
                  >
                    ▶ Release to Calendar
                  </button>
                </div>
              ))}
            </div>

            {/* UNASSIGNED BOOKINGS */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-2">
                🚪 Unassigned Rooms ({unassignedBookings.length})
              </h3>
              {unassignedBookings.length === 0 && (
                <p className="text-xs text-muted py-3 px-2 bg-gray-50 rounded-lg text-center">No unassigned bookings</p>
              )}
              {unassignedBookings.map((b) => (
                <div key={b.id} className="border border-amber-200 rounded-xl p-4 bg-amber-50/40 mb-2">
                  <div className="flex justify-between items-start mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-navy text-sm truncate">{b.primaryGuest?.name || "—"}</p>
                      <p className="text-xs text-muted">{b.primaryGuest?.phone || "—"}</p>
                    </div>
                    <span className="text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded font-bold uppercase shrink-0 ml-2">Unassigned</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-navy/70 mb-3">
                    <div>📅 {prettyDate(b.checkIn)}</div>
                    <div>→ {prettyDate(b.checkOut)}</div>
                    <div>🔑 No room</div>
                    <div>💰 ₹{b.amount.toLocaleString("en-IN")}</div>
                  </div>
                  <button
                    onClick={() => { setMoveRoomTarget(b); setMoveRoomNewRoom(""); }}
                    className="w-full bg-amber-600 text-white text-xs py-2 rounded-lg hover:bg-amber-700 font-semibold"
                  >
                    🔑 Assign Room
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
