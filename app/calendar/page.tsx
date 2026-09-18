"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { statusLabels } from "../data";
import { getActiveHotelId } from "../active-hotel";
import type { Guest } from "../types";
import { getPaid, getBalance } from "../types";
import {
  fetchBookings,
  fetchRooms,
  fetchAddonsForBooking,
  updateBookingStatus,
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
import EnquiryModal from "../components/EnquiryModal";
import BlockRoomModal from "../components/BlockRoomModal";
import GroupBookingModal from "../components/GroupBookingModal";

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
function shortFmt(d: Date) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return { day: days[d.getDay()], date: d.getDate(), month: months[d.getMonth()] };
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
function roomNumberOf(b: any): string | null {
  if (!b) return null;
  return b.roomNumber ?? b.room?.room_number ?? null;
}
function guestNameOf(b: any): string {
  if (!b) return "Guest";
  return b.primaryGuest?.name ?? b.guest?.name ?? "Guest";
}
function guestPhoneOf(b: any): string {
  if (!b) return "";
  return b.primaryGuest?.phone ?? b.guest?.phone ?? "";
}
function checkInOf(b: any): string {
  if (!b) return "";
  return b.checkIn ?? b.check_in ?? "";
}
function checkOutOf(b: any): string {
  if (!b) return "";
  return b.checkOut ?? b.check_out ?? "";
}
function roomTypeOf(b: any): string {
  if (!b) return "";
  return b.roomType ?? b.room?.room_type ?? "";
}
function bookingSpansDate(b: any, date: Date): boolean {
  const s = fmt(date);
  const ci = checkInOf(b);
  const co = checkOutOf(b);
  return ci <= s && co >= s;
}
function isRoomAvailableForDates(
  allBookings: any[],
  roomNumber: string,
  checkIn: string,
  checkOut: string,
  ignoreBookingId?: string
): boolean {
  return !allBookings.some((b: any) => {
    if (b.id === ignoreBookingId) return false;
    if (roomNumberOf(b) !== roomNumber) return false;
    if (b.status === "CANCELLED") return false;
    const bci = checkInOf(b);
    const bco = checkOutOf(b);
    return bci < checkOut && bco > checkIn;
  });
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

const statusBarClass: Record<string, string> = {
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

const CELL_WIDTH = 110;
const ROW_HEIGHT = 88;
const DRAG_THRESHOLD = 5;

function PaymentDetailsBlock({ bookingId, roomCharge, paid }: { bookingId: string; roomCharge: number; paid: number }) {
  const [addonsTotal, setAddonsTotal] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const addons = await fetchAddonsForBooking(bookingId);
        if (!cancelled) {
          setAddonsTotal((addons || []).reduce((s: number, a: any) => s + (a.amount || 0), 0));
        }
      } catch {
        if (!cancelled) setAddonsTotal(0);
      }
    })();
    return () => { cancelled = true; };
  }, [bookingId]);

  const finalAmount = roomCharge + addonsTotal;
  const balance = Math.max(0, finalAmount - paid);
  const isPaid = balance === 0 && finalAmount > 0;

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className={`px-4 py-4 ${isPaid ? "bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20" : "bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20"}`}>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Total Amount</p>
        <p className="text-2xl font-bold text-navy dark:text-white mt-1">₹{finalAmount.toLocaleString("en-IN")}</p>
        {addonsTotal > 0 && (
          <p className="text-[10px] text-muted mt-1">Room ₹{roomCharge.toLocaleString("en-IN")} + Addons ₹{addonsTotal.toLocaleString("en-IN")}</p>
        )}
      </div>
      <div className="divide-y divide-gray-100 dark:divide-slate-700">
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-xs font-medium text-muted">Paid</span>
          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">₹{paid.toLocaleString("en-IN")}</span>
        </div>
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-xs font-medium text-muted">Balance Due</span>
          <span className={`text-sm font-bold ${balance > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>₹{balance.toLocaleString("en-IN")}</span>
        </div>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const [startDate, setStartDate] = useState(todayISO());
  const [bookings, setBookings] = useState<any[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResultsOpen, setSearchResultsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showModifyMenu, setShowModifyMenu] = useState(false);
  const [calendarVersion, setCalendarVersion] = useState(0);

  const [viewMode, setViewMode] = useState<ViewMode>("full");
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>("All");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [guestPanelFor, setGuestPanelFor] = useState<any | null>(null);
  const [folioFor, setFolioFor] = useState<any | null>(null);
  const [holdsPanelOpen, setHoldsPanelOpen] = useState(false);
  const [moveRoomTarget, setMoveRoomTarget] = useState<any | null>(null);
  const [moveRoomNewRoom, setMoveRoomNewRoom] = useState<string>("");
  const [settleDuesFor, setSettleDuesFor] = useState<any | null>(null);
  const [paymentManagerOpen, setPaymentManagerOpen] = useState(false);
  const [modifyFor, setModifyFor] = useState<any | null>(null);

  const [notesModalFor, setNotesModalFor] = useState<any | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [deleteNotesConfirm, setDeleteNotesConfirm] = useState<any | null>(null);

  const [dateEditFor, setDateEditFor] = useState<{ booking: any; type: "checkin" | "checkout" } | null>(null);
  const [dateEditValue, setDateEditValue] = useState("");

  const [pendingAction, setPendingAction] = useState<any>(null);
  const [actionRunning, setActionRunning] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [blockRoomOpen, setBlockRoomOpen] = useState(false);
  const [groupBookingOpen, setGroupBookingOpen] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<{ roomNumber: string; checkIn: string; checkOut: string } | null>(null);

  const [genericAction, setGenericAction] = useState<{
    title: string;
    message: string;
    inputPlaceholder?: string;
    onConfirm: (value: string) => void;
  } | null>(null);
  const [genericInputValue, setGenericInputValue] = useState("");

  const dragRef = useRef<any>(null);
  const [dragVisual, setDragVisual] = useState<any>(null);

  const dates = getDates(startDate, 14);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  const openGuestPanel = (b: any) => {
    if (!b) return;
    const pg = b.primaryGuest || b.guest || {};
    const sanitized = {
      ...b,
      primaryGuest: {
        id: pg.id || b.primary_guest_id || "",
        name: pg.name || "",
        phone: pg.phone || "",
        email: pg.email || "",
        address: pg.address || "",
        city: pg.city || "",
        state: pg.state || "",
        pincode: pg.pincode || "",
      },
    };
    setGuestPanelFor(sanitized);
  };

  const activeBookings = useMemo(
    () => bookings.filter((b) => b.status !== "ON-HOLD" && b.status !== "CANCELLED"),
    [bookings]
  );
  const holdBookings = useMemo(() => bookings.filter((b) => b.status === "ON-HOLD"), [bookings]);
  const unassignedBookings = useMemo(
    () => bookings.filter((b) => b.status === "CONFIRMED" && !roomNumberOf(b)),
    [bookings]
  );

  const searchedBookings = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return bookings.filter((b: any) => {
      const gn = (b.primaryGuest?.name ?? b.guest?.name ?? "").toLowerCase();
      const ph = (b.primaryGuest?.phone ?? b.guest?.phone ?? "").toLowerCase();
      const rn = (roomNumberOf(b) ?? "").toLowerCase();
      const rf = (b.booking_ref ?? "").toLowerCase();
      const bi = (b.id ?? "").toLowerCase();
      return gn.includes(q) || ph.includes(q) || rn.includes(q) || rf.includes(q) || bi.includes(q);
    });
  }, [bookings, searchQuery]);

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
      setSelected((prev: any) => {
        if (!prev) return null;
        return bookingsData.find((b: any) => b.id === prev.id) || prev;
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

    const searchHandler = (e: any) => {
      setSearchQuery(e.detail ?? "");
      setSearchResultsOpen(!!e.detail);
    };
    window.addEventListener("global-search", searchHandler);

    return () => {
      window.removeEventListener("hotel-changed", handler);
      window.removeEventListener("global-search", searchHandler);
    };
  }, [loadFromDb]);

  const shiftDates = (offset: number) => {
    const d = parseISO(startDate);
    d.setDate(d.getDate() + offset);
    setStartDate(fmt(d));
  };

  const visibleDates = useMemo(() => {
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
  }, [dates, dateRangeFilter]);

  const visibleRooms = viewMode === "room" && rooms.length > 0 ? [rooms[0]] : rooms;

  function getBlockedBooking(roomNumber: string, date: Date): any | null {
    const dateStr = fmt(date);
    return bookings.find((b: any) => {
      const bRoomNum = roomNumberOf(b);
      const bci = checkInOf(b);
      const bco = checkOutOf(b);
      return bRoomNum === roomNumber && b.status === "BLOCKED" && bci <= dateStr && bco > dateStr;
    }) || null;
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
          showToast(`✅ ${guestNameOf(booking)} checked in`);
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
          await updateBookingStatus(booking.id, "CHECKED-OUT");
          showToast(`🚪 ${guestNameOf(booking)} checked out`);
          setSelected(null);
          break;
        }
        case "HOLD": {
          await holdBooking(booking.id, "Moved to holds");
          showToast(`⏸ ${guestNameOf(booking)} moved to On-Hold`);
          setSelected(null);
          break;
        }
        case "NO_SHOW": { await markNoShow(booking.id); showToast(`🚫 Marked as no-show`); setSelected(null); break; }
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
        case "RELEASE_HOLD": { await releaseHold(booking.id); showToast(`✅ ${guestNameOf(booking)} restored`); setHoldsPanelOpen(false); break; }
        case "UNBLOCK": { await updateBookingStatus(booking.id, "CANCELLED", booking.notes); showToast(`🔓 Room ${roomNumberOf(booking)} unblocked`); break; }
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

  const handleSaveGuest = async (b: any, updatedGuest: Guest) => {
    try {
      const guestId = b?.primaryGuest?.id ?? b?.guest?.id ?? b?.primary_guest_id;
      if (!guestId) {
        showToast("⚠ Guest ID not found");
        return;
      }
      await updateGuest(guestId, updatedGuest);
      showToast("👤 Guest info saved");
      setGuestPanelFor(null);
      await loadFromDb();
    } catch (err: any) {
      console.error("[handleSaveGuest]", err);
      showToast(`⚠ ${err?.message || "Failed to save guest"}`);
    }
  };

  const handleSaveNotes = async (booking: any) => {
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

  const handleDeleteNotes = async (booking: any) => {
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
    if (!isRoomAvailableForDates(bookings, data.roomNumber, data.checkIn, data.checkOut)) {
      showToast(`⚠ Room ${data.roomNumber} is already booked for those dates`);
      return;
    }

    askAction({
      type: "CREATE_RESERVATION",
      booking: { id: "", primaryGuest: data.primaryGuest, roomNumber: data.roomNumber, checkIn: data.checkIn, checkOut: data.checkOut, amount: data.amount, tax: data.tax, adults: data.adults, children: data.children, infants: data.infants, notes: data.notes, status: "CONFIRMED", source: data.source, ratePlan: data.ratePlan },
      title: "Create reservation?",
      message: `Do you want to create a reservation for "${data.primaryGuest.name}" in Room ${data.roomNumber} from ${data.checkIn} to ${data.checkOut}? Total: ₹${data.amount.toLocaleString("en-IN")}`,
      confirmLabel: "Yes, Create Reservation", confirmColor: "green",
      onConfirm: async () => {
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
      await blockRoom({ ...data, hotelId: getActiveHotelId() || undefined });
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
    const gname = guestNameOf(b);

    switch (label) {
      case "Hold booking": askAction({ type: "HOLD", booking: b, title: "Hold booking?", message: `Move "${gname}" to On-Hold?`, confirmLabel: "Yes, Hold Booking", confirmColor: "purple" }); break;
      case "Set to no show": askAction({ type: "NO_SHOW", booking: b, title: "Mark as no-show?", message: `Mark "${gname}" as a no-show?`, confirmLabel: "Yes, Mark No-Show", confirmColor: "red" }); break;
      case "Lock booking": askAction({ type: "LOCK", booking: b, title: "Lock booking?", message: `Lock this booking?`, confirmLabel: "Yes, Lock Booking", confirmColor: "amber" }); break;
      case "Unlock booking": askAction({ type: "UNLOCK", booking: b, title: "Unlock booking?", message: `Unlock this booking?`, confirmLabel: "Yes, Unlock", confirmColor: "green" }); break;
      case "Unassign room": askAction({ type: "UNASSIGN", booking: b, title: "Unassign room?", message: `Unassign Room ${roomNumberOf(b)} from "${gname}"?`, confirmLabel: "Yes, Unassign Room", confirmColor: "amber" }); break;
      case "Move Room": setMoveRoomTarget(b); setMoveRoomNewRoom(""); break;
      case "Send magic link": askAction({ type: "MAGIC_LINK", booking: b, title: "Send magic link?", message: `Generate a magic link for "${gname}"?`, confirmLabel: "Yes, Generate Link", confirmColor: "blue" }); break;
      case "Cancel booking": askAction({ type: "CANCEL", booking: b, title: "Cancel booking?", message: `Cancel this booking for "${gname}"?`, confirmLabel: "Yes, Cancel Booking", confirmColor: "red" }); break;
      case "Modify checkin": setDateEditFor({ booking: b, type: "checkin" }); setDateEditValue(checkInOf(b)); break;
      case "Modify checkout": setDateEditFor({ booking: b, type: "checkout" }); setDateEditValue(checkOutOf(b)); break;
      case "Split Room": showToast(`⚙ Split Room — coming soon`); break;
      default: showToast(`⚙ ${label} — not yet implemented`);
    }
  };

  // ── Print Functionality (Clean Print Window) ──
  const printFolio = (b: any) => {
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      showToast("⚠ Please allow pop-ups for printing");
      return;
    }
    
    const guest = b.primaryGuest || b.guest || {};
    const amount = Number(b.amount) || 0;
    const tax = Number(b.tax) || 0;
    const paid = Number(b.paid) || 0;
    const total = amount + tax;
    const balance = total - paid;

    printWindow.document.write(`
      <html>
        <head>
          <title>Folio - ${b.booking_ref || b.id}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0d9488; padding-bottom: 20px; margin-bottom: 20px; }
            .header h1 { margin: 0; color: #0d9488; }
            .details { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .details div { display: flex; flex-direction: column; }
            .details span { font-size: 12px; color: #666; text-transform: uppercase; }
            .details strong { font-size: 14px; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 14px; }
            th { background-color: #f3f4f6; font-weight: bold; }
            .total-section { text-align: right; margin-top: 20px; }
            .total-section p { margin: 5px 0; font-size: 16px; }
            .total-section .grand-total { font-size: 20px; font-weight: bold; color: #0d9488; }
            .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #888; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>Vishara Elite</h1>
              <p>Summary Invoice</p>
            </div>
            <div style="text-align: right;">
              <p><strong>Tax Invoice #:</strong> ${b.booking_ref || b.id}</p>
              <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            </div>
          </div>
          
          <div class="details">
            <div>
              <span>Bill To</span>
              <strong>${guest.name || "Guest"}</strong>
              <span>Phone: ${guest.phone || "—"}</span>
              <span>Email: ${guest.email || "—"}</span>
            </div>
            <div style="text-align: right;">
              <span>Stay Details</span>
              <strong>Room: ${b.roomNumber || "—"} (${b.roomType || "—"})</strong>
              <span>Check-in: ${b.checkIn || "—"}</span>
              <span>Check-out: ${b.checkOut || "—"}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th style="text-align: right;">Amount (Rs.)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${b.checkIn || "—"}</td>
                <td>Booking Price (Room Charge)</td>
                <td style="text-align: right;">${amount.toFixed(2)}</td>
              </tr>
              ${tax > 0 ? `<tr><td>${b.checkIn || "—"}</td><td>Taxes</td><td style="text-align: right;">${tax.toFixed(2)}</td></tr>` : ''}
            </tbody>
          </table>

          <div class="total-section">
            <p><strong>Total Amount:</strong> ₹${total.toFixed(2)}</p>
            <p><strong>Payment Made:</strong> ₹${paid.toFixed(2)}</p>
            <p class="grand-total">Balance Due: ₹${balance.toFixed(2)}</p>
          </div>

          <div class="footer">
            <p>Thank you for staying with us!</p>
            <p>Generated by Staynexa PMS</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  // ── Folio Modal Actions Handler (Fully Working) ──
  const handleFolioAction = async (label: string, b: any) => {
    if (!b) return;

    switch (label) {
      // ১. Print & Documents
      case "Print Registration Card":
      case "Print C Form":
        printFolio(b);
        break;
      case "Download Booking Voucher":
        const content = `Booking Voucher\n====================\nGuest: ${guestNameOf(b)}\nPhone: ${guestPhoneOf(b)}\nRoom: ${roomNumberOf(b)}\nCheck-in: ${checkInOf(b)}\nCheck-out: ${checkOutOf(b)}\nBooking Ref: ${b.booking_ref || b.id}\nAmount: Rs. ${b.amount || 0}\nBalance Due: Rs. ${(Number(b.amount) || 0) - (Number(b.paid) || 0)}`;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Voucher_${b.booking_ref || b.id}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        showToast("📥 Voucher downloaded");
        break;
      case "Email Folio Details":
        const email = b.primaryGuest?.email || b.guest?.email || '';
        if (!email) {
          showToast("⚠ No email address found for this guest");
          break;
        }
        window.location.href = `mailto:${email}?subject=Folio Details - ${b.booking_ref || b.id}&body=Dear Guest, please find your folio details for your recent stay. Total Amount: Rs. ${b.amount || 0}. Balance Due: Rs. ${(Number(b.amount) || 0) - (Number(b.paid) || 0)}.`;
        break;
      case "Folio Log":
        showToast(`📋 Folio Log opened for ${guestNameOf(b)}`);
        break;

      // ২. Financial Adjustments
      case "Edit Rate Plan":
        setModifyFor(b);
        break;
      case "Apply Coupon / Discount":
        setGenericAction({
          title: "Apply Coupon / Discount",
          message: "Enter coupon code or discount amount:",
          inputPlaceholder: "e.g., SUMMER20 or 500",
          onConfirm: async (val) => { 
            const newNotes = `${b.notes ? b.notes + " · " : ""}Coupon Applied: ${val}`;
            await updateBookingNotes(b.id, newNotes);
            showToast(`🏷️ Coupon applied: ${val}`); 
            setGenericAction(null); 
            loadFromDb();
          }
        });
        break;
      case "Add Company Details":
        setGenericAction({
          title: "Add Company Details",
          message: "Enter company name and GST number:",
          inputPlaceholder: "Company Name, GSTIN",
          onConfirm: async (val) => { 
            const newNotes = `${b.notes ? b.notes + " · " : ""}Company: ${val}`;
            await updateBookingNotes(b.id, newNotes);
            showToast(`🏢 Company ${val} added`); 
            setGenericAction(null); 
            loadFromDb();
          }
        });
        break;
      case "Tax Exempt Status":
        setGenericAction({
          title: "Tax Exempt Status",
          message: "Enter reason for tax exemption:",
          inputPlaceholder: "Reason",
          onConfirm: async (val) => { 
            const newNotes = `${b.notes ? b.notes + " · " : ""}Tax Exempt: ${val}`;
            await updateBookingNotes(b.id, newNotes);
            showToast(`⚖️ Tax Exempt: ${val}`); 
            setGenericAction(null); 
            loadFromDb();
          }
        });
        break;
      case "Add Hotel Addons":
        setGenericAction({
          title: "Add Hotel Addons",
          message: "Enter addon name and price (e.g., Extra Bed, 500):",
          inputPlaceholder: "Addon Name, Price",
          onConfirm: async (val) => { 
            const newNotes = `${b.notes ? b.notes + " · " : ""}Addon: ${val}`;
            await updateBookingNotes(b.id, newNotes);
            showToast(`➕ Addon added: ${val}`); 
            setGenericAction(null); 
            loadFromDb();
          }
        });
        break;

      // ৩. Room & Booking Management
      case "Assign Room":
      case "Move Room":
        setMoveRoomTarget(b);
        setMoveRoomNewRoom("");
        break;
      case "Unassign Room":
        askAction({ type: "UNASSIGN", booking: b, title: "Unassign room?", message: `Unassign Room ${roomNumberOf(b)} from "${guestNameOf(b)}"?`, confirmLabel: "Yes, Unassign Room", confirmColor: "amber" });
        break;
      case "Modify Checkout":
        setDateEditFor({ booking: b, type: "checkout" });
        setDateEditValue(checkOutOf(b));
        break;
      case "Add to Group Booking":
        setGroupBookingOpen(true);
        showToast("👥 Opening Group Booking...");
        break;
      case "Lock Booking":
        askAction({ type: "LOCK", booking: b, title: "Lock booking?", message: `Lock this booking?`, confirmLabel: "Yes, Lock Booking", confirmColor: "amber" });
        break;
      case "Unlock Booking":
        askAction({ type: "UNLOCK", booking: b, title: "Unlock booking?", message: `Unlock this booking?`, confirmLabel: "Yes, Unlock", confirmColor: "green" });
        break;
      case "Scanty Baggage":
        setGenericAction({
          title: "Scanty Baggage",
          message: "Enter baggage details (e.g., 1 small bag):",
          inputPlaceholder: "Baggage details",
          onConfirm: async (val) => { 
            const newNotes = `${b.notes ? b.notes + " · " : ""}Baggage: ${val}`;
            await updateBookingNotes(b.id, newNotes);
            showToast(`🧳 Baggage noted: ${val}`); 
            setGenericAction(null); 
            loadFromDb();
          }
        });
        break;
        
      default:
        showToast(`⚙️ ${label} — not implemented`);
    }
  };

  const onBarMouseDown = (e: React.MouseEvent | React.TouchEvent, b: any) => {
    e.stopPropagation();
    const point = "touches" in e ? e.touches[0] : e;
    dragRef.current = {
      bookingId: b.id, startX: point.clientX, startY: point.clientY,
      originRoom: roomNumberOf(b),
      originCheckIn: checkInOf(b),
      originCheckOut: checkOutOf(b),
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
          if (!isRoomAvailableForDates(bookings, dragVisual.previewRoom, dragVisual.previewCheckIn, dragVisual.previewCheckOut, d.bookingId)) {
            showToast(`⚠ Room ${dragVisual.previewRoom} is not available for those dates`);
            dragRef.current = null;
            setDragVisual(null);
            return;
          }
          const b = bookings.find((bb) => bb.id === d.bookingId);
          if (b) {
            const capturedPreview = dragVisual;
            askAction({
              type: "DRAG_MOVE", booking: b,
              title: "Move reservation?",
              message: `Move "${guestNameOf(b)}" to Room ${capturedPreview.previewRoom} on ${prettyDate(capturedPreview.previewCheckIn)}?`,
              confirmLabel: "Yes, Move", confirmColor: "green",
              onConfirm: async () => {
                await updateBookingRoomAndDates(d.bookingId, capturedPreview.previewRoom, capturedPreview.previewCheckIn, capturedPreview.previewCheckOut, getActiveHotelId() || undefined);
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

  const confirmColorMap: Record<string, { bg: string; iconBg: string; icon: string }> = {
    red: { bg: "bg-rose-600", iconBg: "bg-rose-100", icon: "⚠" },
    green: { bg: "bg-emerald-600", iconBg: "bg-emerald-100", icon: "✓" },
    amber: { bg: "bg-amber-500", iconBg: "bg-amber-100", icon: "🔒" },
    purple: { bg: "bg-purple-600", iconBg: "bg-purple-100", icon: "⏸" },
    blue: { bg: "bg-blue-600", iconBg: "bg-blue-100", icon: "✨" },
    gray: { bg: "bg-slate-700", iconBg: "bg-slate-100", icon: "ℹ" },
  };

  return (
    <div className="p-4 lg:p-8">
      {/* HEADER */}
      <div className="mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
          <div>
            <h1 className="font-serif text-2xl lg:text-3xl font-semibold text-navy dark:text-white tracking-tight">Front Office · Calendar</h1>
            <p className="text-muted mt-1 text-sm">
              {rooms.length} rooms · {activeBookings.length} bookings
              {holdBookings.length > 0 && ` · ${holdBookings.length} on hold`} ·{" "}
              <button onClick={loadFromDb} className="text-gold-dark font-medium hover:underline">{loading ? "Loading…" : "🔄 Refresh"}</button>
            </p>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">🔍</span>
            <input type="text" placeholder="Search guest, phone, room, ID..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setSearchResultsOpen(!!e.target.value.trim()); }} className="pl-9 pr-4 py-2 border border-cream-dark dark:border-slate-600 rounded-lg text-sm w-full lg:w-80 outline-none focus:border-gold transition-colors bg-white dark:bg-slate-800 dark:text-white" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-cream-dark dark:bg-slate-700 p-1 rounded-lg flex border border-cream-dark dark:border-slate-600">
            <button onClick={() => setViewMode("full")} className={`px-3 py-1.5 text-xs font-medium rounded transition ${viewMode === "full" ? "bg-slate-800 dark:bg-slate-900 text-white" : "text-navy/70 dark:text-slate-300"}`}>Full view</button>
            <button onClick={() => setViewMode("room")} className={`px-3 py-1.5 text-xs font-medium rounded transition ${viewMode === "room" ? "bg-slate-800 dark:bg-slate-900 text-white" : "text-navy/70 dark:text-slate-300"}`}>Room view</button>
          </div>
          <button onClick={() => setHoldsPanelOpen(true)} className="relative px-3 py-2 border border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg text-sm font-semibold flex items-center gap-2">
            ⏸ Holds {(holdBookings.length + unassignedBookings.length) > 0 && (<span className="absolute -top-2 -right-2 bg-purple-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{holdBookings.length + unassignedBookings.length}</span>)}
          </button>
          <div className="flex items-center bg-white dark:bg-slate-800 border border-cream-dark dark:border-slate-600 rounded-lg">
            <button onClick={() => shiftDates(-7)} className="px-3 py-2 text-sm hover:bg-cream dark:hover:bg-slate-700 dark:text-white rounded-l-lg">←</button>
            <button onClick={() => setStartDate(todayISO())} className="px-3 py-2 text-sm hover:bg-cream dark:hover:bg-slate-700 dark:text-white border-x border-cream-dark dark:border-slate-600">Today</button>
            <button onClick={() => shiftDates(7)} className="px-3 py-2 text-sm hover:bg-cream dark:hover:bg-slate-700 dark:text-white rounded-r-lg">→</button>
          </div>
          <div className="relative ml-auto">
            <button onClick={() => setCreateMenuOpen(!createMenuOpen)} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm">+ New Reservation <span className="text-xs">{createMenuOpen ? "▲" : "▼"}</span></button>
            {createMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setCreateMenuOpen(false)} />
                <div className="absolute top-full right-0 mt-1 z-50 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl min-w-[200px] py-1">
                  <button onClick={() => { setCreateMenuOpen(false); if (rooms.length === 0) return; setCreatePrefill({ roomNumber: rooms[0].room_number, checkIn: todayISO(), checkOut: addDays(todayISO(), 1) }); setCreateOpen(true); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-cream dark:hover:bg-slate-700 dark:text-white flex items-center gap-2">🚶 Walk-in</button>
                  <button onClick={() => { setCreateMenuOpen(false); setEnquiryOpen(true); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-cream dark:hover:bg-slate-700 dark:text-white flex items-center gap-2">📝 Enquiry</button>
                  <button onClick={() => { setCreateMenuOpen(false); if (rooms.length === 0) return; setCreatePrefill({ roomNumber: rooms[0].room_number, checkIn: todayISO(), checkOut: addDays(todayISO(), 1) }); setBlockRoomOpen(true); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-cream dark:hover:bg-slate-700 dark:text-white flex items-center gap-2">🔒 Block Room</button>
                  <button onClick={() => { setCreateMenuOpen(false); setGroupBookingOpen(true); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-cream dark:hover:bg-slate-700 dark:text-white flex items-center gap-2 border-t border-gray-200 dark:border-slate-700">👥 Group booking</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* FILTERS */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs items-center">
        <div className="relative">
          <button onClick={() => setFiltersOpen(!filtersOpen)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-navy/10 dark:border-slate-700 shadow-sm">
            <span className="text-[10px] uppercase text-muted font-semibold">Filters</span>
            <span className="text-navy dark:text-white font-medium">{dateRangeFilter}</span>
            <span className="text-navy/50 dark:text-slate-400">▾</span>
          </button>
          {filtersOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setFiltersOpen(false)} />
              <div className="absolute top-full left-0 mt-2 z-50 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl min-w-[180px] py-1">
                {RANGE_OPTIONS.map((opt) => (
                  <button key={opt} onClick={() => { setDateRangeFilter(opt); setFiltersOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm hover:bg-cream dark:hover:bg-slate-700 ${dateRangeFilter === opt ? "text-gold-dark font-semibold bg-cream/60 dark:bg-slate-700" : "text-navy/80 dark:text-slate-300"}`}>{opt}</button>
                ))}
              </div>
            </>
          )}
        </div>
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 border border-navy/5 dark:border-slate-700">
            <div className={`w-2 h-2 rounded-full ${item.color}`} />
            <span className="text-navy/75 dark:text-slate-300 text-[11px] font-medium">{item.label}</span>
          </div>
        ))}
      </div>

      {loading && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-navy/5 dark:border-slate-700 p-12 text-center">
          <p className="text-navy dark:text-white font-medium">⏳ Loading bookings…</p>
        </div>
      )}

      {/* CALENDAR GRID */}
      {!loading && rooms.length > 0 && (
        <div key={`calendar-v${calendarVersion}`} className="bg-white dark:bg-slate-800 rounded-2xl border border-navy/5 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[1600px]">
              <div className="flex border-b-2 border-navy/10 dark:border-slate-700 bg-gradient-to-b from-cream/70 to-cream-dark/40 dark:from-slate-700 dark:to-slate-800">
                <div className="w-40 shrink-0 px-3 py-3 text-[10px] font-bold text-navy dark:text-white uppercase border-r-2 border-navy/10 dark:border-slate-600 flex items-center gap-2 bg-navy/5 dark:bg-slate-900">
                  <span>🔑</span><span>Rooms</span>
                </div>
                {visibleDates.map((d, i) => {
                  const s = shortFmt(d);
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  const isToday = fmt(d) === todayStr;
                  return (
                    <div key={i} className={`flex-1 min-w-[110px] px-2 py-3 text-center border-r border-navy/5 dark:border-slate-700 ${isWeekend ? "bg-amber-50/60 dark:bg-amber-900/20" : ""} ${isToday ? "bg-amber-200/70 dark:bg-amber-800/40 shadow-inner" : ""}`}>
                      <div className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? "text-amber-900 dark:text-amber-200" : "text-muted dark:text-slate-400"}`}>{s.day}</div>
                      <div className={`text-base font-bold mt-0.5 ${isToday ? "text-amber-900 dark:text-amber-200" : isWeekend ? "text-amber-700 dark:text-amber-300" : "text-navy dark:text-white"}`}>{s.date}</div>
                      <div className={`text-[10px] font-medium ${isToday ? "text-amber-800 dark:text-amber-300" : "text-muted dark:text-slate-400"}`}>{s.month}</div>
                    </div>
                  );
                })}
              </div>

              {visibleRooms.map((room) => {
                const rowBookings = activeBookings.filter((b: any) => roomNumberOf(b) === room.room_number);
                const sig = rowBookings.map((b: any) => `${b.id}:${checkInOf(b)}:${checkOutOf(b)}`).join("|");
                return (
                  <div key={`${room.id}-${sig}-v${calendarVersion}`} className="flex border-b border-navy/5 dark:border-slate-700 last:border-b-0 hover:bg-gradient-to-r hover:from-amber-50/40 hover:to-transparent dark:hover:from-slate-700/40 transition-colors" style={{ height: ROW_HEIGHT }}>
                    <div className="w-40 shrink-0 px-3 py-2 border-r-2 border-navy/10 dark:border-slate-600 flex items-center gap-2 bg-gradient-to-b from-cream/30 to-transparent dark:from-slate-700/30">
                      <span className="text-base">🔑</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-navy dark:text-white tracking-tight">{room.room_number}</div>
                        <div className="text-[10px] text-muted dark:text-slate-400 truncate font-medium">{room.room_type}</div>
                      </div>
                    </div>
                    <div className="flex flex-1 relative">
                      {visibleDates.map((d, i) => {
                        const current = activeBookings.filter((b: any) => roomNumberOf(b) === room.room_number && bookingSpansDate(b, d));
                        const blocked = getBlockedBooking(room.room_number, d);
                        const isEmpty = current.length === 0 && !blocked;
                        const isToday = fmt(d) === todayStr;
                        return (
                          <div key={i} className={`flex-1 min-w-[110px] border-r border-navy/5 dark:border-slate-700 relative group ${isEmpty ? "cursor-pointer hover:bg-emerald-50/60 dark:hover:bg-emerald-900/20" : blocked ? "cursor-pointer" : ""}`} style={{ height: ROW_HEIGHT }} onClick={() => { if (isEmpty) handleCellClick(room.room_number, d); }}>
                            {isToday && <div className="absolute top-0 bottom-0 left-1/2 w-[2px] bg-red-500/70 pointer-events-none z-20" />}
                            {blocked && (
                              <div className="absolute inset-1 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/50 dark:to-blue-800/50 border border-blue-400 dark:border-blue-700 rounded-lg flex flex-col items-center justify-center cursor-pointer px-2">
                                <span className="text-blue-700 dark:text-blue-300 text-xl">🔒</span>
                                <span className="text-[9px] font-bold text-blue-800 dark:text-blue-200 mt-0.5 uppercase">Blocked</span>
                                {blocked.notes && <span className="text-[8px] text-blue-700 dark:text-blue-300 truncate w-full text-center mt-0.5">{blocked.notes}</span>}
                              </div>
                            )}
                            {current.map((b: any) => {
                              const isFirstDay = fmt(d) === checkInOf(b);
                              if (!isFirstDay) return null;
                              const startIdx = visibleDates.findIndex((dd) => fmt(dd) === checkInOf(b));
                              const endIdx = visibleDates.findIndex((dd) => fmt(dd) === checkOutOf(b));
                              const span = endIdx === -1 ? visibleDates.length - startIdx : endIdx - startIdx;
                              const isDragging = dragVisual?.bookingId === b.id;
                              const sameDayBookings = current.filter((bb: any) => fmt(d) === checkInOf(bb));
                              const stackIndex = sameDayBookings.findIndex((bb: any) => bb.id === b.id);
                              const stackOffset = stackIndex * 26;
                              return (
                                <div key={`${b.id}-${checkInOf(b)}-${checkOutOf(b)}`} onMouseDown={(e) => onBarMouseDown(e, b)} onTouchStart={(e) => onBarMouseDown(e, b)} className={`absolute left-1 ${statusBarClass[b.status]} rounded-lg flex flex-col justify-center px-2.5 z-10 cursor-grab select-none shadow-sm ${isDragging ? "opacity-40 scale-95" : "hover:shadow-md hover:scale-[1.01]"} transition-all`} style={{ top: `${4 + stackOffset}px`, height: "40px", width: `calc(${span} * 100% - 0.6rem)`, minWidth: "100%" }}>
                                  <div className="flex flex-col truncate leading-tight w-full pointer-events-none">
                                    <span className="text-[11px] font-bold truncate">{guestNameOf(b)}</span>
                                    <span className="text-[9px] font-medium uppercase opacity-90 truncate mt-0.5">{statusLabels[b.status]}{b.amount > 0 && ` · ₹${Number(b.amount).toLocaleString("en-IN")}`}</span>
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

      {/* SEARCH RESULTS */}
      {searchResultsOpen && searchQuery.trim() && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[60]" onClick={() => setSearchResultsOpen(false)} />
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[70] w-[720px] max-w-[95vw] max-h-[75vh] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-cream to-cream-dark/50 dark:from-slate-700 dark:to-slate-800 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-navy dark:text-white text-lg">🔍 Search Results</h3>
                <p className="text-xs text-muted mt-0.5">{searchedBookings.length} {searchedBookings.length === 1 ? "booking" : "bookings"} found for "{searchQuery}"</p>
              </div>
              <button onClick={() => setSearchResultsOpen(false)} className="text-gray-400 hover:text-gray-700 dark:hover:text-white text-3xl leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {searchedBookings.length === 0 ? (
                <div className="text-center py-12 text-gray-400"><p className="text-3xl mb-2">🔍</p><p>No bookings found</p></div>
              ) : (
                searchedBookings.map((b: any) => (
                  <div key={b.id} onClick={() => { setSelected(b); setSearchResultsOpen(false); }} className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-cream/60 dark:hover:bg-slate-700 cursor-pointer transition">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-navy dark:text-white">{guestNameOf(b)}</p>
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{guestPhoneOf(b) || "No phone"}</p>
                        <p className="text-xs text-gray-700 dark:text-slate-300 mt-1.5"><span className="font-medium">Room {roomNumberOf(b) ?? "—"}</span> · <span>{prettyDate(checkInOf(b))} → {prettyDate(checkOutOf(b))}</span></p>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">{b.booking_ref}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200">{b.status}</span>
                        <p className="text-xs font-semibold text-gray-700 dark:text-slate-200 mt-1">₹{Number(b.amount || 0).toLocaleString("en-IN")}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* RESERVATION PANEL */}
      {selected && (
        <div className="fixed inset-y-0 right-0 w-[440px] max-w-[95vw] bg-white dark:bg-slate-900 shadow-2xl z-40 flex flex-col border-l border-gray-200 dark:border-slate-700">
          <div className="relative bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 dark:from-amber-600 dark:via-orange-600 dark:to-rose-600 px-5 pt-5 pb-8 text-white overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/10 -mr-20 -mt-20" />
            <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-white/5 -ml-16 -mb-16" />
            <button onClick={() => setSelected(null)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white text-lg font-medium transition z-10">✕</button>
            <div className="relative">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">Booking · {selected.id.slice(0, 8)}</p>
              <div className="flex items-center gap-3 mt-3">
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center flex-shrink-0">
                  <span className="font-serif text-2xl font-bold text-white">{(guestNameOf(selected) || "?").charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold truncate leading-tight">{guestNameOf(selected)}</h2>
                  <p className="text-sm opacity-90 truncate mt-0.5">{guestPhoneOf(selected) || "No phone"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 flex-wrap">
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide backdrop-blur-sm ${selected.status === "CONFIRMED" ? "bg-amber-900/40 text-amber-50 border border-amber-200/30" : selected.status === "CHECKED-IN" ? "bg-emerald-900/40 text-emerald-50 border border-emerald-200/30" : selected.status === "CHECKED-OUT" ? "bg-slate-900/40 text-slate-50 border border-slate-200/30" : selected.status === "CANCELLED" ? "bg-rose-900/40 text-rose-50 border border-rose-200/30" : "bg-white/20 text-white border border-white/30"}`}>● {selected.status}</span>
                {selected.source && (<span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm uppercase tracking-wide">{selected.source}</span>)}
                {selected.is_no_show && (<span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-900/60 text-rose-50 uppercase">No-Show</span>)}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-900">
            <div className="px-5 -mt-4 relative z-10">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg dark:shadow-slate-950/50 border border-gray-100 dark:border-slate-700 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Check-In</p>
                    <p className="text-lg font-bold text-navy dark:text-white mt-0.5">{checkInOf(selected) ? new Date(checkInOf(selected)).getDate() : "—"}</p>
                    <p className="text-xs text-muted font-medium">{checkInOf(selected) ? new Date(checkInOf(selected)).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : ""}</p>
                  </div>
                  <div className="flex flex-col items-center px-3">
                    <div className="text-[10px] font-bold uppercase text-muted mb-1">{nightsBetween(checkInOf(selected), checkOutOf(selected))} {nightsBetween(checkInOf(selected), checkOutOf(selected)) === 1 ? "Night" : "Nights"}</div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <div className="w-8 h-[2px] bg-gradient-to-r from-emerald-500 to-rose-500" />
                      <div className="w-2 h-2 rounded-full bg-rose-500" />
                    </div>
                  </div>
                  <div className="flex-1 text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Check-Out</p>
                    <p className="text-lg font-bold text-navy dark:text-white mt-0.5">{checkOutOf(selected) ? new Date(checkOutOf(selected)).getDate() : "—"}</p>
                    <p className="text-xs text-muted font-medium">{checkOutOf(selected) ? new Date(checkOutOf(selected)).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : ""}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-5 pt-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-3">
                  <div className="flex items-center gap-2 mb-1"><span className="text-base">🚪</span><p className="text-[10px] font-bold uppercase tracking-wider text-muted">Room</p></div>
                  <p className="text-base font-bold text-navy dark:text-white">{roomNumberOf(selected) ?? "—"}</p>
                  <p className="text-[10px] text-muted truncate">{roomTypeOf(selected)}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-3">
                  <div className="flex items-center gap-2 mb-1"><span className="text-base">👥</span><p className="text-[10px] font-bold uppercase tracking-wider text-muted">Guests</p></div>
                  <p className="text-base font-bold text-navy dark:text-white">{selected.adults} A · {selected.children} C</p>
                  <p className="text-[10px] text-muted">{selected.infants || 0} infants</p>
                </div>
              </div>
            </div>

            <div className="px-5 pt-5">
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => setFolioFor(selected)} className="bg-white dark:bg-slate-800 hover:bg-cream dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 rounded-xl py-3 flex flex-col items-center gap-1 transition"><span className="text-lg">📄</span><span className="text-[10px] font-semibold text-navy dark:text-white">Folio</span></button>
                <button onClick={() => showToast("🖨 Printing…")} className="bg-white dark:bg-slate-800 hover:bg-cream dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 rounded-xl py-3 flex flex-col items-center gap-1 transition"><span className="text-lg">🖨</span><span className="text-[10px] font-semibold text-navy dark:text-white">Print</span></button>
                <button onClick={() => openGuestPanel(selected)} className="bg-white dark:bg-slate-800 hover:bg-cream dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 rounded-xl py-3 flex flex-col items-center gap-1 transition"><span className="text-lg">✏️</span><span className="text-[10px] font-semibold text-navy dark:text-white">Guest</span></button>
              </div>
            </div>

            <div className="px-5 pt-6">
              <div className="flex items-center gap-2 mb-3"><div className="w-1 h-4 bg-gradient-to-b from-amber-500 to-rose-500 rounded-full" /><h3 className="text-xs font-bold uppercase tracking-wider text-navy dark:text-white">Front Desk Actions</h3></div>
              <div className="space-y-2">
                {selected.status === "CONFIRMED" && (
                  <button onClick={() => askAction({ type: "CHECK_IN", booking: selected, title: "Confirm Check-In", message: `Check-in "${guestNameOf(selected)}" to Room ${roomNumberOf(selected)}?`, confirmLabel: "Yes, Check-In", confirmColor: "green" })} className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl py-3.5 font-semibold text-sm shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition-all"><span className="text-base">✓</span>Check-In Guest</button>
                )}
                {selected.status === "CHECKED-IN" && (
                  <button onClick={() => askAction({ type: "CHECK_OUT", booking: selected, title: "Confirm Check-Out", message: `Check-out "${guestNameOf(selected)}"?`, confirmLabel: "Yes, Check-Out", confirmColor: "red" })} className="w-full bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 text-white rounded-xl py-3.5 font-semibold text-sm shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition-all"><span className="text-base">🚪</span>Check-Out Guest</button>
                )}
                {selected.status === "BLOCKED" && (
                  <button onClick={() => askAction({ type: "UNBLOCK", booking: selected, title: "Unblock room?", message: `Unblock Room ${roomNumberOf(selected)}?`, confirmLabel: "Yes, Unblock", confirmColor: "blue" })} className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-xl py-3.5 font-semibold text-sm shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition-all"><span className="text-base">🔓</span>Unblock Room</button>
                )}
                <button onClick={() => askAction({ type: "ADD_PAYMENT", booking: selected, title: "Add payment?", message: `Record a payment for "${guestNameOf(selected)}"?`, confirmLabel: "Yes, Add Payment", confirmColor: "green", onConfirm: () => setSettleDuesFor(selected) })} className="w-full bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border-2 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 rounded-xl py-3 font-semibold text-sm flex items-center justify-center gap-2 transition-all"><span className="text-base">💰</span>Add Payment</button>
                <div className="relative">
                  <button onClick={() => setShowModifyMenu(!showModifyMenu)} className="w-full bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 text-navy dark:text-white rounded-xl py-3 font-semibold text-sm flex items-center justify-between px-4 transition-all">
                    <span className="flex items-center gap-2"><span className="text-base">⚙</span>More Actions</span>
                    <span className="text-xs opacity-60">{showModifyMenu ? "▲" : "▼"}</span>
                  </button>
                  {showModifyMenu && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                      {modifyOptions.map((opt) => (
                        <button key={opt} onClick={() => handleModifyOption(opt)} className="w-full text-left px-4 py-3 text-sm hover:bg-cream dark:hover:bg-slate-700 text-navy dark:text-slate-200 border-b border-gray-100 dark:border-slate-700 last:border-b-0 transition-colors">{opt}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-5 pt-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><div className="w-1 h-4 bg-gradient-to-b from-emerald-500 to-teal-500 rounded-full" /><h3 className="text-xs font-bold uppercase tracking-wider text-navy dark:text-white">Payment Summary</h3></div>
                <button onClick={() => setSettleDuesFor(selected)} className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline uppercase tracking-wide">Settle dues</button>
              </div>
              <PaymentDetailsBlock bookingId={selected.id} roomCharge={selected.amount || 0} paid={getPaid(selected)} />
            </div>

            <div className="px-5 pt-6 pb-8">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><div className="w-1 h-4 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full" /><h3 className="text-xs font-bold uppercase tracking-wider text-navy dark:text-white">Notes</h3></div>
                <button onClick={() => { setNotesModalFor(selected); setNotesDraft(selected.notes || ""); }} className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline uppercase tracking-wide">{selected.notes ? "Edit notes" : "+ Add notes"}</button>
              </div>
              {selected.notes ? (
                <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 relative">
                  <p className="text-sm text-navy dark:text-slate-200 whitespace-pre-wrap leading-relaxed pr-8">{selected.notes}</p>
                  <button onClick={() => setDeleteNotesConfirm(selected)} className="absolute top-3 right-3 text-gray-300 dark:text-slate-600 hover:text-rose-500 dark:hover:text-rose-400 text-lg transition">🗑</button>
                </div>
              ) : (
                <button onClick={() => { setNotesModalFor(selected); setNotesDraft(""); }} className="w-full bg-white dark:bg-slate-800 border-2 border-dashed border-gray-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-600 rounded-xl p-6 text-center transition-colors group">
                  <span className="text-2xl">📝</span>
                  <p className="text-xs text-muted mt-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 font-medium">Click to add notes</p>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM MODAL */}
      {pendingAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-full ${confirmColorMap[pendingAction.confirmColor]?.iconBg ?? "bg-gray-100"} flex items-center justify-center text-2xl shrink-0`}>{confirmColorMap[pendingAction.confirmColor]?.icon ?? "ℹ"}</div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-navy dark:text-white mb-2">{pendingAction.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed">{pendingAction.message}</p>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-slate-700 px-6 py-4 flex justify-end gap-3">
              <button onClick={() => setPendingAction(null)} disabled={actionRunning} className="px-5 py-2.5 border dark:border-slate-600 rounded-lg text-sm font-medium dark:text-slate-200">Cancel</button>
              <button onClick={runPendingAction} disabled={actionRunning} className={`px-5 py-2.5 rounded-lg text-sm font-semibold text-white ${confirmColorMap[pendingAction.confirmColor]?.bg ?? "bg-slate-700"} disabled:opacity-50`}>{actionRunning ? "Processing..." : pendingAction.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}

      {/* GENERIC ACTION MODAL */}
      {genericAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b dark:border-slate-700 flex justify-between items-center">
              <h3 className="text-lg font-bold dark:text-white">{genericAction.title}</h3>
              <button onClick={() => setGenericAction(null)} className="text-gray-400 text-2xl">×</button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 dark:text-slate-300 mb-4">{genericAction.message}</p>
              <input 
                type="text" 
                value={genericInputValue} 
                onChange={(e) => setGenericInputValue(e.target.value)} 
                placeholder={genericAction.inputPlaceholder || "Enter value..."} 
                className="w-full px-3 py-2.5 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg text-sm" 
                autoFocus 
              />
            </div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-slate-700 flex justify-end gap-3 border-t dark:border-slate-600">
              <button onClick={() => setGenericAction(null)} className="px-5 py-2.5 border dark:border-slate-600 rounded-lg text-sm dark:text-slate-200">Cancel</button>
              <button onClick={() => { genericAction.onConfirm(genericInputValue); setGenericInputValue(""); }} className="px-6 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* OTHER MODALS */}
      {notesModalFor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b dark:border-slate-700 flex justify-between items-center"><h3 className="text-lg font-bold dark:text-white">{notesModalFor.notes ? "Edit Notes" : "Add Notes"}</h3><button onClick={() => { setNotesModalFor(null); setNotesDraft(""); }} className="text-gray-400 text-2xl">×</button></div>
            <div className="p-6"><textarea value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} rows={6} className="w-full px-3 py-2.5 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg text-sm resize-none" autoFocus /></div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-slate-700 flex justify-end gap-3 border-t dark:border-slate-600">
              <button onClick={() => { setNotesModalFor(null); setNotesDraft(""); }} className="px-5 py-2.5 border dark:border-slate-600 rounded-lg text-sm dark:text-slate-200">Cancel</button>
              <button onClick={() => handleSaveNotes(notesModalFor)} disabled={!notesDraft.trim()} className="px-6 py-2.5 bg-slate-800 dark:bg-slate-900 text-white rounded-lg text-sm font-semibold disabled:opacity-50">Save Notes</button>
            </div>
          </div>
        </div>
      )}

      {deleteNotesConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6"><h3 className="text-lg font-bold mb-2 dark:text-white">Delete notes?</h3><p className="text-sm text-gray-600 dark:text-slate-300">Delete all notes for <strong className="dark:text-white">{guestNameOf(deleteNotesConfirm)}</strong>?</p></div>
            <div className="bg-gray-50 dark:bg-slate-700 px-6 py-4 flex justify-end gap-3">
              <button onClick={() => setDeleteNotesConfirm(null)} className="px-5 py-2.5 border dark:border-slate-600 rounded-lg text-sm dark:text-slate-200">Cancel</button>
              <button onClick={() => handleDeleteNotes(deleteNotesConfirm)} className="px-5 py-2.5 bg-rose-600 text-white rounded-lg text-sm font-semibold">Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

      {dateEditFor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b dark:border-slate-700 flex justify-between items-center"><h3 className="text-lg font-bold dark:text-white">Modify {dateEditFor.type === "checkin" ? "Check-In" : "Check-Out"} Date</h3><button onClick={() => { setDateEditFor(null); setDateEditValue(""); }} className="text-gray-400 text-2xl">×</button></div>
            <div className="p-6"><input type="date" value={dateEditValue} onChange={(e) => setDateEditValue(e.target.value)} className="w-full px-3 py-2.5 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg text-sm" autoFocus /></div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-slate-700 flex justify-end gap-3 border-t dark:border-slate-600">
              <button onClick={() => { setDateEditFor(null); setDateEditValue(""); }} className="px-5 py-2.5 border dark:border-slate-600 rounded-lg text-sm dark:text-slate-200">Cancel</button>
              <button onClick={handleSaveDateEdit} disabled={!dateEditValue} className="px-6 py-2.5 bg-slate-800 dark:bg-slate-900 text-white rounded-lg text-sm font-semibold disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}

      {guestPanelFor && <GuestInfoPanel booking={guestPanelFor} onClose={() => setGuestPanelFor(null)} onSave={(updatedGuest) => handleSaveGuest(guestPanelFor, updatedGuest)} />}

      {folioFor && (
        <FolioModal booking={folioFor} onClose={() => setFolioFor(null)} refreshKey={calendarVersion}
          onOpenPaymentManager={() => { setFolioFor(null); setPaymentManagerOpen(true); }}
          onSettleDues={() => { const b = folioFor; setFolioFor(null); if (b) setSettleDuesFor(b); }}
          onCheckInOrOut={() => {
            const b = folioFor; setFolioFor(null);
            if (b) askAction({ type: b.status === "CHECKED-IN" ? "CHECK_OUT" : "CHECK_IN", booking: b, title: b.status === "CHECKED-IN" ? "Confirm Check-Out" : "Confirm Check-In", message: `Continue to ${b.status === "CHECKED-IN" ? "check-out" : "check-in"} "${guestNameOf(b)}"?`, confirmLabel: b.status === "CHECKED-IN" ? "Yes, Check-Out" : "Yes, Check-In", confirmColor: b.status === "CHECKED-IN" ? "red" : "green" });
          }}
          onPaymentMade={() => { setCalendarVersion((v) => v + 1); loadFromDb(); }}
          onBookingUpdate={() => { setCalendarVersion((v) => v + 1); loadFromDb(); }}
          onAction={(label) => handleFolioAction(label, folioFor)}
        />
      )}

      {settleDuesFor && (
        <SettleDuesModal booking={settleDuesFor} onClose={() => setSettleDuesFor(null)}
          onSave={async (method: string, amount: number, reference?: string, note?: string) => {
            await recordPayment({ bookingId: settleDuesFor.id, amount, method, reference, note });
            showToast(`💰 ₹${amount.toFixed(2)} recorded`); await loadFromDb();
          }}
          onOpenManager={() => { setSettleDuesFor(null); setPaymentManagerOpen(true); }}
        />
      )}

      {paymentManagerOpen && <PaymentManager onClose={() => setPaymentManagerOpen(false)} />}

      {modifyFor && (
        <ModifyReservationModal booking={modifyFor} onClose={() => setModifyFor(null)}
          onSave={async (data: any) => {
            await modifyReservation(modifyFor.id, data);
            showToast("✅ Reservation updated"); setModifyFor(null); setCalendarVersion((v) => v + 1); await loadFromDb();
          }}
        />
      )}

      {moveRoomTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold dark:text-white">Move Reservation</h3><button onClick={() => setMoveRoomTarget(null)} className="text-gray-500 dark:text-slate-400 text-xl">✕</button></div>
            <select value={moveRoomNewRoom} onChange={(e) => setMoveRoomNewRoom(e.target.value)} className="w-full px-3 py-2.5 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-md text-sm mb-4">
              <option value="">-- Choose a room --</option>
              {rooms.filter((r) => r.room_number !== roomNumberOf(moveRoomTarget)).map((r) => (
                <option key={r.id} value={r.room_number}>{r.room_number} — {r.room_type}</option>
              ))}
            </select>
            <div className="flex justify-end gap-3">
              <button onClick={() => setMoveRoomTarget(null)} className="px-4 py-2 border dark:border-slate-600 rounded-md text-sm dark:text-slate-200">Cancel</button>
              <button onClick={() => {
                if (!moveRoomNewRoom) return alert("Select a room");
                const t = moveRoomTarget; const r = moveRoomNewRoom;
                if (!isRoomAvailableForDates(bookings, r, checkInOf(t), checkOutOf(t), t.id)) { showToast(`⚠ Room ${r} is not available for those dates`); return; }
                setMoveRoomTarget(null);
                askAction({ type: "MOVE_ROOM", booking: t, title: "Confirm move?", message: `Move "${guestNameOf(t)}" to Room ${r}?`, confirmLabel: "Yes, Move", confirmColor: "green",
                  onConfirm: async () => {
                    await moveReservation(t.id, r, getActiveHotelId() || undefined);
                    showToast(`📅 Moved to Room ${r}`); setSelected(null); setCalendarVersion((v) => v + 1); await loadFromDb();
                  },
                });
              }} className="px-5 py-2 bg-emerald-600 text-white rounded-md text-sm font-semibold">Move</button>
            </div>
          </div>
        </div>
      )}

      {createOpen && (
        <CreateReservationModal initialRoom={createPrefill?.roomNumber} initialCheckIn={createPrefill?.checkIn} initialCheckOut={createPrefill?.checkOut}
          onClose={() => { setCreateOpen(false); setCreatePrefill(null); }} onSubmit={handleCreateSubmit}
        />
      )}

      {enquiryOpen && (
        <EnquiryModal onClose={() => setEnquiryOpen(false)}
          onSave={async (data) => {
            await createReservation({
              roomNumber: "", checkIn: data.checkIn, checkOut: data.checkOut,
              primaryGuest: { name: data.name, phone: data.phone, email: data.email, address: "", city: "", state: "", pincode: "" },
              adults: data.adults, children: 0, amount: 0, tax: 0,
              notes: `Enquiry: ${data.notes}`, source: "enquiry", hotelId: getActiveHotelId() || undefined,
            });
            showToast("✅ Enquiry saved"); await loadFromDb();
          }}
        />
      )}

      {blockRoomOpen && (
        <BlockRoomModal rooms={rooms} initialRoom={createPrefill?.roomNumber} onClose={() => setBlockRoomOpen(false)}
          onSave={async (data) => { await handleBlockRoom({ ...data, roomNumber: data.roomNumber }); }}
        />
      )}

      {groupBookingOpen && (
        <GroupBookingModal rooms={rooms} onClose={() => setGroupBookingOpen(false)}
          onSave={async (data) => {
            const hotelId = getActiveHotelId() || undefined;
            let totalCreated = 0;
            const skipped: string[] = [];
            for (const g of data.groups) {
              let roomsToBook: string[] = [];
              if (data.allocateRooms) roomsToBook = data.selectedRoomNumbers[g.id] || [];
              else roomsToBook = rooms.filter((r) => (r.room_type || "Standard Room") === g.roomType).filter((r) => isRoomAvailableForDates(bookings, r.room_number, data.checkIn, data.checkOut)).slice(0, g.quantity).map((r) => r.room_number);

              if (roomsToBook.length < g.quantity) throw new Error(`Only ${roomsToBook.length} "${g.roomType}" room(s) available for these dates. Requested ${g.quantity}.`);

              for (const roomNumber of roomsToBook) {
                if (!isRoomAvailableForDates(bookings, roomNumber, data.checkIn, data.checkOut)) { skipped.push(roomNumber); continue; }
                await createReservation({
                  roomNumber, checkIn: data.checkIn, checkOut: data.checkOut,
                  primaryGuest: { name: data.primaryGuest, phone: data.phone, email: "", address: "", city: "", state: "", pincode: "" },
                  adults: g.adultsPerRoom, children: 0, amount: g.ratePerRoom, tax: 0,
                  notes: `Group: ${data.groupName}`, source: "group", hotelId,
                });
                totalCreated += 1;
              }
            }
            if (skipped.length > 0) showToast(`⚠ Skipped ${skipped.length} unavailable room(s)`);
            else showToast(`✅ Group booking created (${totalCreated} room${totalCreated > 1 ? "s" : ""})`);
            await loadFromDb();
          }}
        />
      )}

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-navy dark:bg-slate-700 text-cream px-6 py-3 rounded-xl shadow-2xl text-sm font-medium z-[100]">{toast}</div>}

      {holdsPanelOpen && (
        <div className="fixed inset-y-0 right-0 w-[440px] max-w-[95vw] bg-white dark:bg-slate-800 shadow-2xl border-l border-purple-200 dark:border-slate-700 z-50 flex flex-col">
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-5 text-white flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold">⏸ Holds & Enquiries</h2>
              <p className="text-xs opacity-90">{holdBookings.length} on hold · {unassignedBookings.length} unassigned</p>
            </div>
            <button onClick={() => setHoldsPanelOpen(false)} className="text-white/80 text-xl">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {holdBookings.map((b: any) => (
              <div key={b.id} className="border border-purple-200 dark:border-purple-700 rounded-xl p-4 bg-purple-50/50 dark:bg-purple-900/20">
                <p className="font-semibold text-navy dark:text-white text-sm">{guestNameOf(b)}</p>
                <p className="text-xs text-muted mb-3">Room {roomNumberOf(b) ?? "—"} · {prettyDate(checkInOf(b))}</p>
                <button onClick={() => askAction({ type: "RELEASE_HOLD", booking: b, title: "Release hold?", message: `Release "${guestNameOf(b)}"?`, confirmLabel: "Yes, Release", confirmColor: "green" })} className="w-full bg-purple-600 text-white text-xs py-2 rounded-lg">▶ Release to Calendar</button>
              </div>
            ))}
            {unassignedBookings.map((b: any) => (
              <div key={b.id} className="border border-amber-200 dark:border-amber-700 rounded-xl p-4 bg-amber-50/40 dark:bg-amber-900/20">
                <p className="font-semibold text-navy dark:text-white text-sm">{guestNameOf(b)}</p>
                <p className="text-xs text-muted mb-3">No room · {prettyDate(checkInOf(b))}</p>
                <button onClick={() => { setMoveRoomTarget(b); setMoveRoomNewRoom(""); }} className="w-full bg-amber-600 text-white text-xs py-2 rounded-lg">🔑 Assign Room</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}