"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { statusLabels } from "../data";
import { getActiveHotelId } from "../active-hotel";
import type { Booking, Guest, Payment } from "../types";
import { getPaid, getBalance } from "../types";
import {
  fetchBookings,
  fetchRooms,
  fetchAddonsForBooking,
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
  recordPayment,
  modifyReservation,
  type Room,
} from "../db";
import CreateReservationModal, { type ReservationFormData } from "../create-reservation-modal";
import GuestInfoPanel from "../components/GuestInfoPanel";
import FolioModal from "../components/FolioModal";
import SettleDuesModal from "../components/SettleDuesModal";
import PaymentManager from "../components/PaymentManager";
import ModifyReservationModal from "../components/ModifyReservationModal";

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

// ═══════════════════════════════════════════════════════════
// PAYMENT DETAILS BLOCK — fetches addons and shows correct totals
// ═══════════════════════════════════════════════════════════

function PaymentDetailsBlock({
  bookingId,
  roomCharge,
  paid,
}: {
  bookingId: string;
  roomCharge: number;
  paid: number;
}) {
  const [addonsTotal, setAddonsTotal] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const addons = await fetchAddonsForBooking(bookingId);
        if (!cancelled) {
          const total = (addons || []).reduce(
            (s: number, a: any) => s + (a.amount || 0),
            0
          );
          setAddonsTotal(total);
        }
      } catch {
        if (!cancelled) setAddonsTotal(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const finalAmount = roomCharge + addonsTotal;
  const balance = Math.max(0, finalAmount - paid);

  return (
    <div className="space-y-2.5 text-sm">
      <div className="flex justify-between">
        <span className="text-gray-500">Final amount with tax</span>
        <span className="font-medium text-gray-900">
          INR {finalAmount.toLocaleString("en-IN")}
        </span>
      </div>
      {addonsTotal > 0 && (
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">
            (Room ₹{roomCharge.toLocaleString("en-IN")} + Addons ₹
            {addonsTotal.toLocaleString("en-IN")})
          </span>
          <span />
        </div>
      )}
      <div className="flex justify-between">
        <span className="text-gray-500">Payment made</span>
        <span className="font-medium text-gray-900">
          INR {paid.toLocaleString("en-IN")}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">Balance due</span>
        <span
          className={`font-medium ${
            balance > 0 ? "text-rose-600" : "text-emerald-600"
          }`}
        >
          INR {balance.toLocaleString("en-IN")}
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════

export default function CalendarPage() {
  const [startDate, setStartDate] = useState(todayISO());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showModifyMenu, setShowModifyMenu] = useState(false);
  const [calendarVersion, setCalendarVersion] = useState(0);

  const [viewMode, setViewMode] = useState<ViewMode>("full");
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>("All");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [guestPanelFor, setGuestPanelFor] = useState<Booking | null>(null);
  const [folioFor, setFolioFor] = useState<Booking | null>(null);
  const [holdsPanelOpen, setHoldsPanelOpen] = useState(false);
  const [moveRoomTarget, setMoveRoomTarget] = useState<Booking | null>(null);
  const [moveRoomNewRoom, setMoveRoomNewRoom] = useState<string>("");
  const [settleDuesFor, setSettleDuesFor] = useState<Booking | null>(null);
  const [paymentManagerOpen, setPaymentManagerOpen] = useState(false);
  const [modifyFor, setModifyFor] = useState<Booking | null>(null);

  const [notesModalFor, setNotesModalFor] = useState<Booking | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [deleteNotesConfirm, setDeleteNotesConfirm] = useState<Booking | null>(null);

  const [dateEditFor, setDateEditFor] = useState<{ booking: Booking; type: "checkin" | "checkout" } | null>(null);
  const [dateEditValue, setDateEditValue] = useState("");

  const [pendingAction, setPendingAction] = useState<any>(null);
  const [actionRunning, setActionRunning] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<{ roomNumber: string; checkIn: string; checkOut: string } | null>(null);

  const dragRef = useRef<any>(null);
  const [dragVisual, setDragVisual] = useState<any>(null);

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
      const hotelId = getActiveHotelId() || undefined;
      const [bookingsData, roomsData] = await Promise.all([
        fetchBookings(hotelId),
        fetchRooms(hotelId),
      ]);
      setBookings([...bookingsData]);
      setRooms([...roomsData]);
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

  useEffect(() => {
    loadFromDb();
    const handler = () => loadFromDb();
    window.addEventListener("hotel-changed", handler);
    return () => window.removeEventListener("hotel-changed", handler);
  }, [loadFromDb]);
  try {
    setLoading(true);
    const hotelId = getActiveHotelId() || undefined; // 👈 KEY FIX
    const [bookingsData, roomsData] = await Promise.all([
      fetchBookings(hotelId),
      fetchRooms(hotelId),
    ]);
    setBookings([...bookingsData]);
    setRooms([...roomsData]);
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

useEffect(() => {
  loadFromDb();
  const handler = () => loadFromDb();
  window.addEventListener("hotel-changed", handler);
  return () => window.removeEventListener("hotel-changed", handler);
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

  const askAction = (action: any) => {
    setShowModifyMenu(false);
    setPendingAction(action);
  };

  const runPendingAction = async () => {
    if (!pendingAction) return;
    setActionRunning(true);
    const { type, booking, onConfirm } = pendingAction;

    try {
      if (onConfirm) {
        await onConfirm();
        setActionRunning(false);
        setPendingAction(null);
        return;
      }

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
        case "LOCK": { await lockBooking(booking.id); showToast(`🔒 Booking locked`); break; }
        case "UNLOCK": { await unlockBooking(booking.id); showToast(`🔓 Booking unlocked`); break; }
        case "UNASSIGN": { await unassignRoom(booking.id); showToast(`🚪 Room unassigned`); setSelected(null); break; }
        case "CANCEL": { await updateBookingStatus(booking.id, "CANCELLED", booking.notes); showToast(`🚫 Booking cancelled`); setSelected(null); break; }
        case "MAGIC_LINK": {
          const link = await sendMagicLink(booking.id);
          await navigator.clipboard.writeText(link);
          showToast(`✨ Magic link copied!`);
          break;
        }
        case "RELEASE_HOLD": { await releaseHold(booking.id); showToast(`✅ ${booking.primaryGuest.name} restored`); setHoldsPanelOpen(false); break; }
        case "UNBLOCK": { await updateBookingStatus(booking.id, "CANCELLED", booking.notes); showToast(`🔓 Room ${booking.roomNumber} unblocked`); break; }
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

  const handleSaveNotes = async (booking: Booking) => {
    try {
      await updateBookingNotes(booking.id, notesDraft);
      showToast("📝 Notes saved");
      setNotesModalFor(null);
      setNotesDraft("");
      await loadFromDb();
    } catch (err: any) {
      showToast(`⚠ ${err.message || "Failed to save notes"}`);
    }
  };

  const handleDeleteNotes = async (booking: Booking) => {
    try {
      await updateBookingNotes(booking.id, "");
      showToast("🗑 Notes deleted");
      setDeleteNotesConfirm(null);
      await loadFromDb();
    } catch (err: any) {
      showToast(`⚠ ${err.message || "Failed to delete notes"}`);
    }
  };

  const handleSaveDateEdit = async () => {
    if (!dateEditFor) return;
    if (!dateEditValue) { alert("Please select a date"); return; }
    const bookingId = dateEditFor.booking.id;
    const type = dateEditFor.type;
    const newDate = dateEditValue;
    try {
      const data: any = {};
      if (type === "checkin") data.checkIn = newDate;
      else data.checkOut = newDate;
      await modifyReservation(bookingId, data);
      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId
            ? { ...b, ...(type === "checkin" ? { checkIn: newDate } : { checkOut: newDate }) }
            : b
        )
      );
      setSelected((prev) =>
        prev && prev.id === bookingId
          ? { ...prev, ...(type === "checkin" ? { checkIn: newDate } : { checkOut: newDate }) }
          : prev
      );
      setCalendarVersion((v) => v + 1);
      setDateEditFor(null);
      setDateEditValue("");
      showToast(`✅ ${type === "checkin" ? "Check-in" : "Check-out"} date updated`);
      loadFromDb();
    } catch (err: any) {
      showToast(`⚠ ${err.message || "Failed to update date"}`);
    }
  };

  const handleCellClick = (roomNumber: string, date: Date) => {
    const blocked = getBlockedBooking(roomNumber, date);
    if (blocked) {
      askAction({
        type: "UNBLOCK", booking: blocked,
        title: "Unblock room?",
        message: `Do you want to continue to unblock Room ${roomNumber}? Reason: "${blocked.notes || "no reason"}".`,
        confirmLabel: "Yes, Unblock", confirmColor: "blue",
      });
      return;
    }
    setCreatePrefill({ roomNumber, checkIn: fmt(date), checkOut: fmt(new Date(date.getTime() + 86400000)) });
    setCreateOpen(true);
  };

  const handleCreateSubmit = async (data: ReservationFormData) => {
    askAction({
      type: "CREATE_RESERVATION",
      booking: { id: "", primaryGuest: data.primaryGuest, roomNumber: data.roomNumber, checkIn: data.checkIn, checkOut: data.checkOut, amount: data.amount, tax: data.tax, adults: data.adults, children: data.children, infants: data.infants, notes: data.notes, status: "CONFIRMED", source: data.source, ratePlan: data.ratePlan, roomType: "", bookingMadeOn: "", payments: [], additionalGuests: [] } as any,
      title: "Create reservation?",
      message: `Do you want to create a reservation for "${data.primaryGuest.name}" in Room ${data.roomNumber} from ${data.checkIn} to ${data.checkOut}? Total: ₹${data.amount.toLocaleString("en-IN")}`,
      confirmLabel: "Yes, Create Reservation", confirmColor: "green",
      onConfirm: async () => {
        try {
          await createReservation({
            roomNumber: data.roomNumber, checkIn: data.checkIn, checkOut: data.checkOut,
            ratePlan: data.ratePlan, source: data.source.toLowerCase().replace(/\s+/g, ""),
            primaryGuest: data.primaryGuest, adults: data.adults, children: data.children,
            infants: data.infants, amount: data.amount, tax: data.tax,   notes: data.notes,
  hotelId: getActiveHotelId() || undefined,
});
          showToast("✅ Reservation created");
          setCreateOpen(false);
          setCreatePrefill(null);
          setCalendarVersion((v) => v + 1);
          await loadFromDb();
        } catch (err: any) {
          showToast(`⚠ ${err.message || "Failed to create reservation"}`);
        }
      },
    });
  };

  const handleBlockRoom = async (data: { roomNumber: string; checkIn: string; checkOut: string; reason: string }) => {
    try {
      await blockRoom(data);
      showToast(`🔒 Room ${data.roomNumber} blocked`);
      setCreateOpen(false);
      setCreatePrefill(null);
      setCalendarVersion((v) => v + 1);
      await loadFromDb();
    } catch (err) {
      showToast("⚠ Failed to block room");
    }
  };

  const handleModifyOption = (label: string) => {
    if (!selected) return;
    setShowModifyMenu(false);
    const b = selected;
    const gname = b.primaryGuest?.name || "guest";

    switch (label) {
      case "Hold booking": askAction({ type: "HOLD", booking: b, title: "Hold booking?", message: `Move "${gname}" to On-Hold?`, confirmLabel: "Yes, Hold Booking", confirmColor: "purple" }); break;
      case "Set to no show": askAction({ type: "NO_SHOW", booking: b, title: "Mark as no-show?", message: `Mark "${gname}" as a no-show?`, confirmLabel: "Yes, Mark No-Show", confirmColor: "red" }); break;
      case "Lock booking": askAction({ type: "LOCK", booking: b, title: "Lock booking?", message: `Lock this booking?`, confirmLabel: "Yes, Lock Booking", confirmColor: "amber" }); break;
      case "Unlock booking": askAction({ type: "UNLOCK", booking: b, title: "Unlock booking?", message: `Unlock this booking?`, confirmLabel: "Yes, Unlock", confirmColor: "green" }); break;
      case "Unassign room": askAction({ type: "UNASSIGN", booking: b, title: "Unassign room?", message: `Unassign Room ${b.roomNumber} from "${gname}"?`, confirmLabel: "Yes, Unassign Room", confirmColor: "amber" }); break;
      case "Move Room": setMoveRoomTarget(b); setMoveRoomNewRoom(""); break;
      case "Send magic link": askAction({ type: "MAGIC_LINK", booking: b, title: "Send magic link?", message: `Generate a magic link for "${gname}"?`, confirmLabel: "Yes, Generate Link", confirmColor: "blue" }); break;
      case "Cancel booking": askAction({ type: "CANCEL", booking: b, title: "Cancel booking?", message: `Cancel this booking for "${gname}"?`, confirmLabel: "Yes, Cancel Booking", confirmColor: "red" }); break;
      case "Modify checkin": setDateEditFor({ booking: b, type: "checkin" }); setDateEditValue(b.checkIn); break;
      case "Modify checkout": setDateEditFor({ booking: b, type: "checkout" }); setDateEditValue(b.checkOut); break;
      case "Split Room": showToast(`⚙ Split Room — coming soon`); break;
      default: showToast(`⚙ ${label} — not yet implemented`);
    }
  };

  const onBarMouseDown = (e: React.MouseEvent | React.TouchEvent, b: Booking) => {
    e.stopPropagation();
    const point = "touches" in e ? e.touches[0] : e;
    dragRef.current = { bookingId: b.id, startX: point.clientX, startY: point.clientY, originRoom: b.roomNumber, originCheckIn: b.checkIn, originCheckOut: b.checkOut, hasMoved: false };
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
        setDragVisual({ bookingId: d.bookingId, currentX: point.clientX, currentY: point.clientY, previewRoom: rooms[newRoomIdx]?.room_number || d.originRoom, previewCheckIn: newCheckIn, previewCheckOut: newCheckOut });
      }
    };
    const handleUp = async () => {
      const d = dragRef.current;
      if (!d) return;
      if (d.hasMoved && dragVisual) {
        const changed = dragVisual.previewRoom !== d.originRoom || dragVisual.previewCheckIn !== d.originCheckIn;
        if (changed) {
          const b = bookings.find((bb) => bb.id === d.bookingId);
          if (b) {
            const capturedPreview = dragVisual;
            askAction({
              type: "DRAG_MOVE", booking: b,
              title: "Move reservation?",
              message: `Move "${b.primaryGuest.name}" to Room ${capturedPreview.previewRoom} on ${prettyDate(capturedPreview.previewCheckIn)}?`,
              confirmLabel: "Yes, Move", confirmColor: "green",
              onConfirm: async () => {
                await updateBookingRoomAndDates(d.bookingId, capturedPreview.previewRoom, capturedPreview.previewCheckIn, capturedPreview.previewCheckOut);
                showToast(`📅 Moved to Room ${capturedPreview.previewRoom}`);
                setCalendarVersion((v) => v + 1);
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

  const confirmColorMap: Record<string, { bg: string; hover: string; iconBg: string; icon: string }> = {
    red: { bg: "bg-rose-600", hover: "hover:bg-rose-700", iconBg: "bg-rose-100", icon: "⚠" },
    green: { bg: "bg-emerald-600", hover: "hover:bg-emerald-700", iconBg: "bg-emerald-100", icon: "✓" },
    amber: { bg: "bg-amber-500", hover: "hover:bg-amber-600", iconBg: "bg-amber-100", icon: "🔒" },
    purple: { bg: "bg-purple-600", hover: "hover:bg-purple-700", iconBg: "bg-purple-100", icon: "⏸" },
    blue: { bg: "bg-blue-600", hover: "hover:bg-blue-700", iconBg: "bg-blue-100", icon: "✨" },
    gray: { bg: "bg-slate-700", hover: "hover:bg-slate-800", iconBg: "bg-slate-100", icon: "ℹ" },
  };

  return (
    <div className="p-6 lg:p-8">
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
            <button onClick={() => setViewMode("full")} className={`px-4 py-1.5 text-xs font-medium rounded transition ${viewMode === "full" ? "bg-slate-800 text-white" : "text-navy/70"}`}>Full view</button>
            <button onClick={() => setViewMode("room")} className={`px-4 py-1.5 text-xs font-medium rounded transition ${viewMode === "room" ? "bg-slate-800 text-white" : "text-navy/70"}`}>Room view</button>
          </div>
          <button onClick={() => setHoldsPanelOpen(true)} className="relative px-4 py-2 border border-purple-300 bg-purple-50 text-purple-700 rounded-lg text-sm font-semibold flex items-center gap-2">
            ⏸ Holds & Enquiries
            {(holdBookings.length + unassignedBookings.length) > 0 && (
              <span className="absolute -top-2 -right-2 bg-purple-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {holdBookings.length + unassignedBookings.length}
              </span>
            )}
          </button>
          <button onClick={() => shiftDates(-7)} className="px-3 py-2 border border-cream-dark rounded-lg text-sm">← Prev</button>
          <button onClick={() => setStartDate(todayISO())} className="px-4 py-2 border border-cream-dark rounded-lg text-sm">Today</button>
          <button onClick={() => shiftDates(7)} className="px-3 py-2 border border-cream-dark rounded-lg text-sm">Next →</button>
          <button onClick={() => { if (rooms.length === 0) return; setCreatePrefill({ roomNumber: rooms[0].room_number, checkIn: todayISO(), checkOut: addDays(todayISO(), 1) }); setCreateOpen(true); }} className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-semibold">+ New Reservation</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4 text-xs items-center">
        <div className="relative">
          <button onClick={() => setFiltersOpen(!filtersOpen)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-navy/10 shadow-sm">
            <span className="text-[10px] uppercase text-muted font-semibold">Filters</span>
            <span className="text-navy font-medium">{dateRangeFilter}</span>
            <span className="text-navy/50">▾</span>
          </button>
          {filtersOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setFiltersOpen(false)} />
              <div className="absolute top-full left-0 mt-2 z-50 bg-white border rounded-lg shadow-xl min-w-[180px] py-1">
                {RANGE_OPTIONS.map((opt) => (
                  <button key={opt} onClick={() => { setDateRangeFilter(opt); setFiltersOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm hover:bg-cream ${dateRangeFilter === opt ? "text-gold-dark font-semibold bg-cream/60" : "text-navy/80"}`}>{opt}</button>
                ))}
              </div>
            </>
          )}
        </div>
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-navy/5">
            <div className={`w-2 h-2 rounded-full ${item.color}`} />
            <span className="text-navy/75 text-[11px] font-medium">{item.label}</span>
          </div>
        ))}
      </div>

      {loading && (
        <div className="bg-white rounded-2xl border border-navy/5 p-12 text-center">
          <p className="text-navy font-medium">⏳ Loading bookings…</p>
        </div>
      )}

      {!loading && rooms.length > 0 && (
        <div key={`calendar-v${calendarVersion}`} className="bg-white rounded-2xl border border-navy/5 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[1400px]">
              <div className="flex border-b border-navy/10 bg-gradient-to-b from-cream/60 to-cream-dark/30">
                <div className="w-36 shrink-0 px-4 py-3 text-[10px] font-semibold text-navy uppercase border-r border-navy/10 flex items-center gap-2">
                  <span>🔑</span><span>Rooms</span>
                </div>
                {visibleDates.map((d, i) => {
                  const s = shortFmt(d);
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  const isToday = fmt(d) === todayStr;
                  return (
                    <div key={i} className={`flex-1 min-w-[80px] px-2 py-2 text-center border-r border-navy/5 ${isWeekend ? "bg-gold/5" : ""} ${isToday ? "bg-gold/15" : ""}`}>
                      <div className="text-[10px] font-medium text-muted uppercase">{s.day}</div>
                      <div className={`text-sm font-semibold ${isToday || isWeekend ? "text-gold-dark" : "text-navy"}`}>{s.date} {s.month}</div>
                    </div>
                  );
                })}
              </div>

              {visibleRooms.map((room) => {
                const sig = activeBookings.filter((b) => b.roomNumber === room.room_number).map((b) => `${b.id}:${b.checkIn}:${b.checkOut}`).join("|");
                return (
                  <div key={`${room.id}-${sig}-v${calendarVersion}`} className="flex border-b border-navy/5 last:border-b-0 hover:bg-gradient-to-r hover:from-gold/5 hover:to-transparent" style={{ height: ROW_HEIGHT }}>
                    <div className="w-36 shrink-0 px-4 py-2 border-r border-navy/5 flex items-center gap-2">
                      <span className="text-gold-dark text-sm">🔑</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-navy">{room.room_number}</div>
                        <div className="text-[10px] text-muted truncate">{room.room_type}</div>
                      </div>
                    </div>
                    <div className="flex flex-1 relative">
                      {visibleDates.map((d, i) => {
                        const current = activeBookings.filter((b) => b.roomNumber === room.room_number && bookingSpansDate(b, d));
                        const blocked = getBlockedBooking(room.room_number, d);
                        const isEmpty = current.length === 0 && !blocked;
                        const isToday = fmt(d) === todayStr;
                        return (
                          <div key={i} className={`flex-1 min-w-[80px] border-r border-navy/5 relative group ${isEmpty ? "cursor-pointer hover:bg-emerald-50/60" : blocked ? "cursor-pointer" : ""}`} style={{ height: ROW_HEIGHT }} onClick={() => { if (isEmpty) handleCellClick(room.room_number, d); }}>
                            {isToday && <div className="absolute top-0 bottom-0 left-1/2 w-[2px] bg-red-500/70 pointer-events-none z-20" />}
                            {blocked && (
                              <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-300 border-r border-slate-400 flex items-center justify-center cursor-pointer">
                                <span className="text-slate-500 text-2xl">🔒</span>
                              </div>
                            )}
                            {current.map((b) => {
                              const isFirstDay = fmt(d) === b.checkIn;
                              if (!isFirstDay) return null;
                              const startIdx = visibleDates.findIndex((dd) => fmt(dd) === b.checkIn);
                              const endIdx = visibleDates.findIndex((dd) => fmt(dd) === b.checkOut);
                              const span = endIdx === -1 ? visibleDates.length - startIdx : endIdx - startIdx;
                              const isDragging = dragVisual?.bookingId === b.id;
                              return (
                                <div key={`${b.id}-${b.checkIn}-${b.checkOut}`} onMouseDown={(e) => onBarMouseDown(e, b)} onTouchStart={(e) => onBarMouseDown(e, b)} className={`absolute top-2.5 left-1 h-11 ${statusBarClass[b.status]} rounded-lg flex items-center px-3 z-10 cursor-grab select-none ${isDragging ? "opacity-40 scale-95" : "hover:scale-[1.02]"}`} style={{ width: `calc(${span} * 100% - 0.6rem)`, minWidth: "100%" }}>
                                  <div className="flex flex-col truncate leading-tight w-full pointer-events-none">
                                    <span className="text-[11.5px] font-semibold truncate">{b.primaryGuest.name}</span>
                                    <span className="text-[9px] font-medium uppercase opacity-85 mt-0.5">{statusLabels[b.status]}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-y-0 right-0 w-[420px] bg-white shadow-2xl border-l border-gray-200 z-40 flex flex-col">
          <div className="bg-amber-400 p-5 text-white">
            <div className="flex justify-between items-start mb-1">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-widest opacity-80 truncate">BOOKING · {selected.id.slice(0, 8)}</p>
                <h2 className="text-xl font-semibold mt-1 truncate">{selected.primaryGuest.name}</h2>
                <p className="text-sm opacity-90">{selected.primaryGuest.phone}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-white/80 hover:text-white w-8 h-8 flex items-center justify-center text-2xl leading-none ml-2 shrink-0">×</button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-5 border-b border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-semibold text-gray-900">Reservation</h3>
                <button onClick={() => setModifyFor(selected)} className="px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium">✏️ Modify</button>
              </div>
              <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                <div><p className="text-gray-500 text-xs mb-1">Dates</p><p className="font-medium">{prettyDate(selected.checkIn)} → {prettyDate(selected.checkOut)}</p><p className="text-[10px] text-gray-500">{nightsBetween(selected.checkIn, selected.checkOut)} nights</p></div>
                <div><p className="text-gray-500 text-xs mb-1">Room type</p><p className="font-medium">{selected.roomType}</p></div>
                <div><p className="text-gray-500 text-xs mb-1">Booked Room</p><p className="font-medium">{selected.roomNumber}</p></div>
                <div><p className="text-gray-500 text-xs mb-1">Booking source</p><p className="font-medium uppercase text-xs">{selected.source}</p></div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-5">
                <button onClick={() => setFolioFor(selected)} className="px-3 py-2.5 border border-gray-300 rounded-md text-xs font-medium">📄 View folio</button>
                <button onClick={() => showToast("🖨 Printing…")} className="px-3 py-2.5 border border-gray-300 rounded-md text-xs font-medium">🖨 Print reg card</button>
                <button onClick={() => setGuestPanelFor(selected)} className="px-3 py-2.5 border border-gray-300 rounded-md text-xs font-medium">✏️ Edit guest info</button>
              </div>
            </div>

            <div className="p-5 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900 mb-3">Front Desk Actions</h3>
              {selected.status === "CONFIRMED" && <button onClick={() => askAction({ type: "CHECK_IN", booking: selected, title: "Confirm Check-In", message: `Check-in "${selected.primaryGuest.name}" to Room ${selected.roomNumber}?`, confirmLabel: "Yes, Check-In", confirmColor: "green" })} className="w-full bg-teal-500 text-white py-3 rounded-md font-medium mb-2 text-sm">✓ Check-In Guest</button>}
              {selected.status === "CHECKED-IN" && <button onClick={() => askAction({ type: "CHECK_OUT", booking: selected, title: "Confirm Check-Out", message: `Check-out "${selected.primaryGuest.name}"?`, confirmLabel: "Yes, Check-Out", confirmColor: "red" })} className="w-full bg-rose-500 text-white py-3 rounded-md font-medium mb-2 text-sm">🚪 Check-Out Guest</button>}
              {selected.status === "BLOCKED" && <button onClick={() => askAction({ type: "UNBLOCK", booking: selected, title: "Unblock room?", message: `Unblock Room ${selected.roomNumber}?`, confirmLabel: "Yes, Unblock", confirmColor: "blue" })} className="w-full bg-blue-500 text-white py-3 rounded-md font-medium mb-2 text-sm">🔓 Unblock Room</button>}
              <button onClick={() => askAction({ type: "ADD_PAYMENT", booking: selected, title: "Add payment?", message: `Record a payment for "${selected.primaryGuest.name}"?`, confirmLabel: "Yes, Add Payment", confirmColor: "green", onConfirm: () => setSettleDuesFor(selected) })} className="w-full border border-teal-300 bg-teal-50 text-teal-700 py-2.5 rounded-md font-medium mb-2 text-sm">💰 Add Payment</button>

              <div className="relative mt-3">
                <button onClick={() => setShowModifyMenu(!showModifyMenu)} className="w-full border border-gray-300 text-gray-700 py-2.5 rounded-md font-medium flex justify-between px-4 items-center text-sm">
                  <span>⚙ More Actions</span><span className="text-xs">{showModifyMenu ? "▲" : "▼"}</span>
                </button>
                {showModifyMenu && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg z-50 text-sm max-h-80 overflow-y-auto">
                    {modifyOptions.map((opt) => (
                      <button key={opt} onClick={() => handleModifyOption(opt)} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-b-0">{opt}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900 mb-2">Guests</h3>
              <p className="text-sm">{selected.adults} Adults · {selected.children} Children · {selected.infants || 0} Infants</p>
            </div>

            <div className="p-5 border-b border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-semibold text-gray-900">Payment details</h3>
                <button onClick={() => setSettleDuesFor(selected)} className="px-3 py-1.5 border rounded-md text-xs font-medium">💵 Settle dues</button>
              </div>
              <PaymentDetailsBlock bookingId={selected.id} roomCharge={selected.amount || 0} paid={getPaid(selected)} />
            </div>

            <div className="p-5">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-base font-semibold text-gray-900">Notes</h3>
                <button onClick={() => { setNotesModalFor(selected); setNotesDraft(selected.notes || ""); }} className="px-3 py-1.5 border rounded-md text-xs font-medium">{selected.notes ? "✏️ Edit notes" : "+ Add notes"}</button>
              </div>
              {selected.notes ? <div className="text-sm bg-gray-50 rounded-md p-3 flex justify-between items-start"><span className="flex-1 whitespace-pre-wrap">{selected.notes}</span><button onClick={() => setDeleteNotesConfirm(selected)} className="text-gray-400 hover:text-rose-600 ml-2">🗑</button></div> : <p className="text-sm text-gray-400 italic">No notes added</p>}
            </div>
          </div>
        </div>
      )}

      {pendingAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-full ${confirmColorMap[pendingAction.confirmColor].iconBg} flex items-center justify-center text-2xl shrink-0`}>{confirmColorMap[pendingAction.confirmColor].icon}</div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-navy mb-2">{pendingAction.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{pendingAction.message}</p>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
              <button onClick={() => setPendingAction(null)} disabled={actionRunning} className="px-5 py-2.5 border rounded-lg text-sm font-medium">Cancel</button>
              <button onClick={runPendingAction} disabled={actionRunning} className={`px-5 py-2.5 rounded-lg text-sm font-semibold text-white ${confirmColorMap[pendingAction.confirmColor].bg} disabled:opacity-50`}>{actionRunning ? "Processing..." : pendingAction.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}

      {notesModalFor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center"><h3 className="text-lg font-bold">{notesModalFor.notes ? "Edit Notes" : "Add Notes"}</h3><button onClick={() => { setNotesModalFor(null); setNotesDraft(""); }} className="text-gray-400 text-2xl">×</button></div>
            <div className="p-6"><textarea value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} placeholder="Add booking notes…" rows={6} className="w-full px-3 py-2.5 border rounded-lg text-sm resize-none" autoFocus /></div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t">
              <button onClick={() => { setNotesModalFor(null); setNotesDraft(""); }} className="px-5 py-2.5 border rounded-lg text-sm">Cancel</button>
              <button onClick={() => handleSaveNotes(notesModalFor)} disabled={!notesDraft.trim()} className="px-6 py-2.5 bg-slate-800 text-white rounded-lg text-sm font-semibold disabled:opacity-50">Save Notes</button>
            </div>
          </div>
        </div>
      )}

      {deleteNotesConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6"><h3 className="text-lg font-bold mb-2">Delete notes?</h3><p className="text-sm text-gray-600">Delete all notes for <strong>{deleteNotesConfirm.primaryGuest.name}</strong>?</p></div>
            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
              <button onClick={() => setDeleteNotesConfirm(null)} className="px-5 py-2.5 border rounded-lg text-sm">Cancel</button>
              <button onClick={() => handleDeleteNotes(deleteNotesConfirm)} className="px-5 py-2.5 bg-rose-600 text-white rounded-lg text-sm font-semibold">Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

      {dateEditFor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center"><h3 className="text-lg font-bold">Modify {dateEditFor.type === "checkin" ? "Check-In" : "Check-Out"} Date</h3><button onClick={() => { setDateEditFor(null); setDateEditValue(""); }} className="text-gray-400 text-2xl">×</button></div>
            <div className="p-6"><label className="block text-xs font-semibold text-gray-600 mb-2">New Date</label><input type="date" value={dateEditValue} onChange={(e) => setDateEditValue(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm" autoFocus /></div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t">
              <button onClick={() => { setDateEditFor(null); setDateEditValue(""); }} className="px-5 py-2.5 border rounded-lg text-sm">Cancel</button>
              <button onClick={handleSaveDateEdit} disabled={!dateEditValue} className="px-6 py-2.5 bg-slate-800 text-white rounded-lg text-sm font-semibold disabled:opacity-50">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {guestPanelFor && <GuestInfoPanel booking={guestPanelFor} onClose={() => setGuestPanelFor(null)} onSave={(updatedGuest) => handleSaveGuest(guestPanelFor, updatedGuest)} />}

      {folioFor && (
        <FolioModal
          booking={folioFor}
          onClose={() => setFolioFor(null)}
          refreshKey={calendarVersion}
          onOpenPaymentManager={() => { setFolioFor(null); setPaymentManagerOpen(true); }}
          onSettleDues={() => { const b = folioFor; setFolioFor(null); if (b) setSettleDuesFor(b); }}
          onCheckInOrOut={() => {
            const b = folioFor;
            setFolioFor(null);
            if (b) {
              askAction({
                type: b.status === "CHECKED-IN" ? "CHECK_OUT" : "CHECK_IN",
                booking: b,
                title: b.status === "CHECKED-IN" ? "Confirm Check-Out" : "Confirm Check-In",
                message: `Do you want to continue to ${b.status === "CHECKED-IN" ? "check-out" : "check-in"} "${b.primaryGuest.name}"?`,
                confirmLabel: b.status === "CHECKED-IN" ? "Yes, Check-Out" : "Yes, Check-In",
                confirmColor: b.status === "CHECKED-IN" ? "red" : "green",
              });
            }
          }}
          onPaymentMade={() => { setCalendarVersion((v) => v + 1); loadFromDb(); }}
          onBookingUpdate={() => { setCalendarVersion((v) => v + 1); loadFromDb(); }}
        />
      )}

      {settleDuesFor && (
        <SettleDuesModal
          booking={settleDuesFor}
          onClose={() => setSettleDuesFor(null)}
          onSave={async (method, amount, reference, note) => {
            await recordPayment({ bookingId: settleDuesFor.id, amount, method, reference, note });
            showToast(`💰 ₹${amount.toFixed(2)} recorded via ${method}`);
            await loadFromDb();
          }}
          onOpenManager={() => { setSettleDuesFor(null); setPaymentManagerOpen(true); }}
        />
      )}

      {paymentManagerOpen && <PaymentManager onClose={() => setPaymentManagerOpen(false)} />}

      {modifyFor && (
        <ModifyReservationModal
          booking={modifyFor}
          onClose={() => setModifyFor(null)}
          onSave={async (data) => {
            await modifyReservation(modifyFor.id, data);
            showToast("✅ Reservation updated");
            setModifyFor(null);
            setCalendarVersion((v) => v + 1);
            await loadFromDb();
          }}
        />
      )}

      {moveRoomTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[500px] p-6">
            <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold">Move Reservation</h3><button onClick={() => setMoveRoomTarget(null)} className="text-gray-500 text-xl">✕</button></div>
            <select value={moveRoomNewRoom} onChange={(e) => setMoveRoomNewRoom(e.target.value)} className="w-full px-3 py-2.5 border rounded-md text-sm mb-4">
              <option value="">-- Choose a room --</option>
              {rooms.filter((r) => r.room_number !== moveRoomTarget.roomNumber).map((r) => (
                <option key={r.id} value={r.room_number}>{r.room_number} — {r.room_type}</option>
              ))}
            </select>
            <div className="flex justify-end gap-3">
              <button onClick={() => setMoveRoomTarget(null)} className="px-4 py-2 border rounded-md text-sm">Cancel</button>
              <button onClick={() => {
                if (!moveRoomNewRoom) return alert("Select a room");
                const t = moveRoomTarget; const r = moveRoomNewRoom;
                setMoveRoomTarget(null);
                askAction({
                  type: "MOVE_ROOM", booking: t,
                  title: "Confirm move?",
                  message: `Move "${t.primaryGuest.name}" from Room ${t.roomNumber} to Room ${r}?`,
                  confirmLabel: "Yes, Move", confirmColor: "green",
                  onConfirm: async () => {
                    await moveReservation(t.id, r);
                    showToast(`📅 Moved to Room ${r}`);
                    setSelected(null);
                    setCalendarVersion((v) => v + 1);
                    await loadFromDb();
                  },
                });
              }} className="px-5 py-2 bg-emerald-600 text-white rounded-md text-sm font-semibold">Move Reservation</button>
            </div>
          </div>
        </div>
      )}

      {createOpen && (
        <CreateReservationModal
          initialRoom={createPrefill?.roomNumber}
          initialCheckIn={createPrefill?.checkIn}
          initialCheckOut={createPrefill?.checkOut}
          onClose={() => { setCreateOpen(false); setCreatePrefill(null); }}
          onSubmit={handleCreateSubmit}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-navy text-cream px-6 py-3 rounded-xl shadow-2xl text-sm font-medium z-[100]">{toast}</div>
      )}

      {holdsPanelOpen && (
        <div className="fixed inset-y-0 right-0 w-[440px] bg-white shadow-2xl border-l border-purple-200 z-50 flex flex-col">
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-5 text-white flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold">⏸ Holds & Enquiries</h2>
              <p className="text-xs opacity-90">{holdBookings.length} on hold · {unassignedBookings.length} unassigned</p>
            </div>
            <button onClick={() => setHoldsPanelOpen(false)} className="text-white/80 text-xl">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {holdBookings.map((b) => (
              <div key={b.id} className="border border-purple-200 rounded-xl p-4 bg-purple-50/50">
                <p className="font-semibold text-navy text-sm">{b.primaryGuest?.name || "—"}</p>
                <p className="text-xs text-muted mb-3">Room {b.roomNumber} · {prettyDate(b.checkIn)}</p>
                <button onClick={() => askAction({ type: "RELEASE_HOLD", booking: b, title: "Release hold?", message: `Release "${b.primaryGuest?.name}"?`, confirmLabel: "Yes, Release", confirmColor: "green" })} className="w-full bg-purple-600 text-white text-xs py-2 rounded-lg">▶ Release to Calendar</button>
              </div>
            ))}
            {unassignedBookings.map((b) => (
              <div key={b.id} className="border border-amber-200 rounded-xl p-4 bg-amber-50/40">
                <p className="font-semibold text-navy text-sm">{b.primaryGuest?.name || "—"}</p>
                <p className="text-xs text-muted mb-3">No room · {prettyDate(b.checkIn)}</p>
                <button onClick={() => { setMoveRoomTarget(b); setMoveRoomNewRoom(""); }} className="w-full bg-amber-600 text-white text-xs py-2 rounded-lg">🔑 Assign Room</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
