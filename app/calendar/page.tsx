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
      <div className={`px-4 py-4 ${isPaid ? "bg-gradient-to-r from-emerald-50 to-teal-50" : "bg-gradient-to-r from-amber-50 to-orange-50"}`}>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Total Amount</p>
        <p className="text-2xl font-bold text-navy dark:text-white mt-1">₹{finalAmount.toLocaleString("en-IN")}</p>
        {addonsTotal > 0 && (
          <p className="text-[10px] text-muted mt-1">Room ₹{roomCharge.toLocaleString("en-IN")} + Addons ₹{addonsTotal.toLocaleString("en-IN")}</p>
        )}
      </div>
      <div className="divide-y divide-gray-100">
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-xs font-medium text-muted">Paid</span>
          <span className="text-sm font-bold text-emerald-600">₹{paid.toLocaleString("en-IN")}</span>
        </div>
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-xs font-medium text-muted">Balance Due</span>
          <span className={`text-sm font-bold ${balance > 0 ? "text-rose-600" : "text-emerald-600"}`}>₹{balance.toLocaleString("en-IN")}</span>
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

  // New States for Folio Log & Addon Modal
  const [folioLogFor, setFolioLogFor] = useState<any | null>(null);
  const [addonModal, setAddonModal] = useState<{
    booking: any;
    addonName: string;
    addonPrice: string;
    serviceDate: string;
    taxPercent: string;
    amountType: string;
  } | null>(null);

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
      if (!guestId) { showToast("⚠ Guest ID not found"); return; }
      await updateGuest(guestId, updatedGuest);
      showToast("👤 Guest info saved");
      setGuestPanelFor(null);
      await loadFromDb();
    } catch (err: any) {
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
      message: `Create reservation for "${data.primaryGuest.name}" in Room ${data.roomNumber}?`,
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

  // ── Print Folio ──
  const printFolio = (b: any) => {
    const printWindow = window.open('', '_blank', 'width=900,height=900');
    if (!printWindow) { showToast("⚠ Please allow pop-ups"); return; }
    const guest = b.primaryGuest || b.guest || {};
    const amount = Number(b.amount) || 0;
    const tax = Number(b.tax) || 0;
    const paid = Number(b.paid) || 0;
    const total = amount + tax;
    const balance = total - paid;
    printWindow.document.write(`<html><head><title>Folio - ${b.booking_ref || b.id}</title><style>body{font-family:sans-serif;padding:40px;}.header{display:flex;justify-content:space-between;border-bottom:2px solid #0d9488;padding-bottom:20px;margin-bottom:20px;}.header h1{margin:0;color:#0d9488;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #ddd;padding:10px;font-size:14px;}th{background:#f3f4f6;}.total-section{text-align:right;margin-top:20px;}.total-section p{margin:5px 0;font-size:16px;}.grand-total{font-size:20px;font-weight:bold;color:#0d9488;}</style></head><body><div class="header"><div><h1>Vishara Elite</h1><p>Summary Invoice</p></div><div style="text-align:right;"><p><strong>Invoice #:</strong> ${b.booking_ref || b.id}</p><p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p></div></div><table><thead><tr><th>Date</th><th>Description</th><th style="text-align:right;">Amount</th></tr></thead><tbody><tr><td>${b.checkIn || "—"}</td><td>Room Charge</td><td style="text-align:right;">${amount.toFixed(2)}</td></tr>${tax > 0 ? `<tr><td>${b.checkIn}</td><td>Taxes</td><td style="text-align:right;">${tax.toFixed(2)}</td></tr>` : ''}</tbody></table><div class="total-section"><p><strong>Total:</strong> ₹${total.toFixed(2)}</p><p><strong>Paid:</strong> ₹${paid.toFixed(2)}</p><p class="grand-total">Balance Due: ₹${balance.toFixed(2)}</p></div></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  // ── Print Normal Bill ──
  const printNormalBill = (b: any) => {
    const printWindow = window.open('', '_blank', 'width=900,height=900');
    if (!printWindow) { showToast("⚠ Please allow pop-ups"); return; }
    const guest = b.primaryGuest || b.guest || {};
    const amount = Number(b.amount) || 0;
    const tax = Number(b.tax) || 0;
    const paid = Number(b.paid) || 0;
    const total = amount + tax;
    const balance = total - paid;
    const cgst = tax / 2;
    const sgst = tax / 2;
    const invoiceNo = `INV-${(b.booking_ref || b.id || "").slice(-8).toUpperCase()}`;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Tax Invoice - ${invoiceNo}</title><style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Helvetica Neue',Arial,sans-serif;padding:25px;color:#1e293b;line-height:1.45;}.invoice{max-width:800px;margin:0 auto;border:1px solid #cbd5e1;border-radius:10px;padding:30px;}.header{display:flex;justify-content:space-between;border-bottom:2px solid #0d9488;padding-bottom:18px;margin-bottom:22px;}.brand h1{color:#0d9488;font-size:28px;}.brand p{color:#64748b;font-size:12px;margin-top:3px;}.inv-meta{text-align:right;}.inv-meta .title{font-size:20px;font-weight:700;text-transform:uppercase;}.inv-meta .num{font-size:14px;font-weight:700;color:#0d9488;margin-top:6px;}.inv-meta .date{font-size:12px;color:#64748b;margin-top:4px;}.billto-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:22px;}.info-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;}.info-box h3{font-size:11px;text-transform:uppercase;color:#0d9488;margin-bottom:8px;}.info-box .name{font-size:16px;font-weight:700;margin-bottom:4px;}.info-box .line{font-size:12px;color:#475569;margin-bottom:2px;}table.items{width:100%;border-collapse:collapse;}table.items th,table.items td{padding:11px 14px;text-align:left;font-size:13px;border-bottom:1px solid #e2e8f0;}table.items th{background:#0d9488;color:#fff;font-size:11px;text-transform:uppercase;}table.items td:last-child,table.items th:last-child{text-align:right;}.totals{width:100%;border-collapse:collapse;}.totals td{padding:9px 14px;font-size:13px;border-bottom:1px solid #f1f5f9;}.totals td:first-child{text-align:right;color:#64748b;}.totals td:last-child{text-align:right;font-weight:600;width:140px;}.totals tr.grand td{padding:14px;font-size:16px;font-weight:700;background:#f0fdfa;color:#0d9488;border:none;}.totals tr.balance td{padding:14px;font-size:16px;font-weight:700;background:#fef2f2;color:#b91c1c;border:none;}.footer{margin-top:30px;padding-top:18px;border-top:1px dashed #cbd5e1;display:flex;justify-content:space-between;}.footer .terms{font-size:10px;color:#64748b;max-width:55%;}.footer .sign{text-align:center;font-size:11px;color:#64748b;}.footer .sign .line{border-top:1px solid #94a3b8;width:180px;margin-bottom:5px;}</style></head><body><div class="invoice"><div class="header"><div class="brand"><h1>Vishara Elite</h1><p>Hotel & Resorts</p></div><div class="inv-meta"><div class="title">Tax Invoice</div><div class="num">${invoiceNo}</div><div class="date">Date: ${new Date().toLocaleDateString('en-IN')}</div></div></div><div class="billto-grid"><div class="info-box"><h3>Bill To</h3><div class="name">${guest.name || "Guest"}</div><div class="line">Phone: ${guest.phone || "—"}</div>${guest.gst ? `<div class="line">GSTIN: ${guest.gst}</div>` : ""}</div><div class="info-box"><h3>Stay Details</h3><div class="line">Room: ${b.roomNumber || "—"}</div><div class="line">Check-in: ${b.checkIn || "—"}</div><div class="line">Check-out: ${b.checkOut || "—"}</div></div></div><table class="items"><thead><tr><th>Description</th><th>Qty</th><th>Amount</th></tr></thead><tbody><tr><td>Room Charges — ${b.roomType || "Room"}</td><td>1</td><td>${amount.toFixed(2)}</td></tr></tbody></table><table class="totals"><tr><td>Sub Total</td><td>${amount.toFixed(2)}</td></tr>${tax > 0 ? `<tr><td>CGST @ 2.5%</td><td>${cgst.toFixed(2)}</td></tr><tr><td>SGST @ 2.5%</td><td>${sgst.toFixed(2)}</td></tr>` : ""}<tr class="grand"><td>Grand Total</td><td>Rs. ${total.toFixed(2)}</td></tr><tr><td>Payment Made</td><td>Rs. ${paid.toFixed(2)}</td></tr><tr class="balance"><td>Balance Due</td><td>Rs. ${balance.toFixed(2)}</td></tr></table><div class="footer"><div class="terms">1. Check-out time 11:00 AM.<br/>2. Computer-generated invoice.</div><div class="sign"><div class="line"></div>Authorized Signatory</div></div></div></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  // ── Print Company Bill ──
  const printCompanyBill = (b: any, companyData: string) => {
    const printWindow = window.open('', '_blank', 'width=900,height=900');
    if (!printWindow) { showToast("⚠ Please allow pop-ups"); return; }
    const guest = b.primaryGuest || b.guest || {};
    const amount = Number(b.amount) || 0;
    const tax = Number(b.tax) || 0;
    const paid = Number(b.paid) || 0;
    const total = amount + tax;
    const balance = total - paid;
    const cgst = tax / 2;
    const sgst = tax / 2;
    const invoiceNo = `CINV-${(b.booking_ref || b.id || "").slice(-8).toUpperCase()}`;
    const parts = companyData.split(",").map(s => s.trim());
    const companyName = parts[0] || "Company Name";
    const companyGst = parts[1] || "—";
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Company Invoice - ${invoiceNo}</title><style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Helvetica Neue',Arial,sans-serif;padding:25px;color:#1e293b;line-height:1.45;}.invoice{max-width:820px;margin:0 auto;border:1px solid #cbd5e1;border-radius:10px;padding:30px;}.header{display:flex;justify-content:space-between;border-bottom:3px double #1e40af;padding-bottom:18px;margin-bottom:22px;}.brand h1{color:#1e40af;font-size:28px;}.brand p{color:#64748b;font-size:12px;margin-top:3px;}.inv-meta{text-align:right;}.inv-meta .title{font-size:20px;font-weight:700;color:#1e40af;text-transform:uppercase;}.inv-meta .subtitle{font-size:11px;color:#64748b;text-transform:uppercase;margin-top:3px;}.inv-meta .num{font-size:14px;font-weight:700;color:#1e40af;margin-top:8px;}.billto-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:22px;}.info-box{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 16px;}.info-box h3{font-size:11px;text-transform:uppercase;color:#1e40af;margin-bottom:8px;}.info-box .name{font-size:16px;font-weight:700;margin-bottom:4px;}.info-box .line{font-size:12px;color:#475569;}.info-box .gst{font-size:13px;font-weight:700;color:#1e40af;margin-top:6px;}.guest-ref{background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;padding:14px 16px;margin-bottom:20px;}.guest-ref h3{font-size:11px;text-transform:uppercase;color:#0d9488;margin-bottom:6px;}.guest-ref .line{font-size:13px;color:#334155;}table.items{width:100%;border-collapse:collapse;}table.items th,table.items td{padding:11px 14px;text-align:left;font-size:13px;border-bottom:1px solid #e2e8f0;}table.items th{background:#1e40af;color:#fff;font-size:11px;text-transform:uppercase;}table.items td:last-child,table.items th:last-child{text-align:right;}.totals{width:100%;border-collapse:collapse;}.totals td{padding:9px 14px;font-size:13px;border-bottom:1px solid #f1f5f9;}.totals td:first-child{text-align:right;color:#64748b;}.totals td:last-child{text-align:right;font-weight:600;width:140px;}.totals tr.grand td{padding:14px;font-size:16px;font-weight:700;background:#eff6ff;color:#1e40af;border:none;}.totals tr.balance td{padding:14px;font-size:16px;font-weight:700;background:#fef2f2;color:#b91c1c;border:none;}.footer{margin-top:30px;padding-top:18px;border-top:1px dashed #cbd5e1;display:flex;justify-content:space-between;}.footer .terms{font-size:10px;color:#64748b;max-width:55%;}.footer .sign{text-align:center;font-size:11px;color:#64748b;}.footer .sign .line{border-top:1px solid #94a3b8;width:180px;margin-bottom:5px;}</style></head><body><div class="invoice"><div class="header"><div class="brand"><h1>Vishara Elite</h1><p>Hotel & Resorts</p></div><div class="inv-meta"><div class="title">Tax Invoice</div><div class="subtitle">Corporate Billing</div><div class="num">${invoiceNo}</div></div></div><div class="billto-grid"><div class="info-box"><h3>Bill To (Company)</h3><div class="name">${companyName}</div><div class="gst">GSTIN: ${companyGst}</div></div><div class="info-box" style="background:#f8fafc;border-color:#e2e8f0;"><h3 style="color:#64748b;">Stay Details</h3><div class="line">Room: ${b.roomNumber || "—"}</div><div class="line">Check-in: ${b.checkIn || "—"}</div><div class="line">Check-out: ${b.checkOut || "—"}</div></div></div><div class="guest-ref"><h3>Guest Reference</h3><div class="line"><strong>Name:</strong> ${guest.name || "—"}</div><div class="line"><strong>Phone:</strong> ${guest.phone || "—"}</div></div><table class="items"><thead><tr><th>Description</th><th>Qty</th><th>Amount</th></tr></thead><tbody><tr><td>Room Charges — ${b.roomType || "Room"}</td><td>1</td><td>${amount.toFixed(2)}</td></tr></tbody></table><table class="totals"><tr><td>Sub Total</td><td>${amount.toFixed(2)}</td></tr>${tax > 0 ? `<tr><td>CGST @ 2.5%</td><td>${cgst.toFixed(2)}</td></tr><tr><td>SGST @ 2.5%</td><td>${sgst.toFixed(2)}</td></tr>` : ""}<tr class="grand"><td>Grand Total</td><td>Rs. ${total.toFixed(2)}</td></tr><tr><td>Payment Made</td><td>Rs. ${paid.toFixed(2)}</td></tr><tr class="balance"><td>Balance Due</td><td>Rs. ${balance.toFixed(2)}</td></tr></table><div class="footer"><div class="terms">1. Corporate invoice as per agreement.<br/>2. Payment within 15 days.</div><div class="sign"><div class="line"></div>Authorized Signatory</div></div></div></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  // ── Print Registration Card ──
  const printRegistrationCard = (b: any) => {
    const printWindow = window.open('', '_blank', 'width=900,height=900');
    if (!printWindow) { showToast("⚠ Please allow pop-ups"); return; }
    const guest = b.primaryGuest || b.guest || {};
    const amount = Number(b.amount) || 0;
    const tax = Number(b.tax) || 0;
    const paid = Number(b.paid) || 0;
    const total = amount + tax;
    const balance = total - paid;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Registration Card - ${b.booking_ref || b.id}</title><style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Helvetica Neue',Arial,sans-serif;padding:20px;color:#333;line-height:1.4;}.container{max-width:800px;margin:0 auto;border:2px solid #0d9488;border-radius:10px;padding:25px;}.header{display:flex;justify-content:space-between;border-bottom:2px solid #0d9488;padding-bottom:15px;margin-bottom:20px;}.header h1{color:#0d9488;font-size:26px;}.header p{color:#64748b;font-size:12px;text-transform:uppercase;}.title{font-size:20px;font-weight:700;text-transform:uppercase;letter-spacing:2px;text-align:center;background:#f0fdfa;padding:12px;border-radius:8px;border:1px solid #ccfbf1;margin-bottom:20px;}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:20px;}.section{border:1px solid #e2e8f0;border-radius:8px;padding:18px;}.section h3{font-size:12px;text-transform:uppercase;color:#0d9488;border-bottom:1px solid #e2e8f0;padding-bottom:8px;margin-bottom:12px;}.row{display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;border-bottom:1px dashed #f1f5f9;padding-bottom:6px;}.row:last-child{border-bottom:none;}.row span:first-child{color:#64748b;}.row span:last-child{font-weight:600;text-align:right;}.payment-table{width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;}.payment-table th,.payment-table td{padding:10px 14px;font-size:13px;border-bottom:1px solid #f1f5f9;}.payment-table th{background:#f8fafc;font-size:11px;text-transform:uppercase;color:#475569;}.payment-table td:last-child,.payment-table th:last-child{text-align:right;}.total-row{background:#f0fdfa;font-weight:700;}.balance-row{background:#fef2f2;color:#b91c1c;font-weight:700;}.footer{margin-top:30px;display:flex;justify-content:space-between;}.signature{border-top:1.5px solid #94a3b8;width:200px;padding-top:8px;text-align:center;font-size:12px;color:#64748b;}.notes{margin-top:20px;font-size:11px;color:#64748b;background:#f8fafc;padding:15px;border-radius:8px;border-left:4px solid #0d9488;}</style></head><body><div class="container"><div class="header"><div><h1>Vishara Elite</h1><p>Hotel & Resorts</p></div><div style="text-align:right;"><p><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN')}</p><p><strong>Ref:</strong> ${b.booking_ref || b.id}</p></div></div><div class="title">Guest Registration Card</div><div class="grid"><div class="section"><h3>Guest Information</h3><div class="row"><span>Full Name</span><span>${guest.name || "—"}</span></div><div class="row"><span>Phone</span><span>${guest.phone || "—"}</span></div><div class="row"><span>Email</span><span>${guest.email || "—"}</span></div><div class="row"><span>Address</span><span>${guest.address || "—"}</span></div></div><div class="section"><h3>Stay Information</h3><div class="row"><span>Room</span><span>${b.roomNumber || "—"} (${b.roomType || "—"})</span></div><div class="row"><span>Check-In</span><span>${b.checkIn || "—"}</span></div><div class="row"><span>Check-Out</span><span>${b.checkOut || "—"}</span></div><div class="row"><span>Guests</span><span>${b.adults || 1} Adults, ${b.children || 0} Children</span></div></div></div><div class="section" style="margin-bottom:20px;"><h3>Payment Summary</h3><table class="payment-table"><thead><tr><th>Description</th><th>Amount</th></tr></thead><tbody><tr><td>Room Charge</td><td>${amount.toFixed(2)}</td></tr><tr><td>Taxes</td><td>${tax.toFixed(2)}</td></tr><tr class="total-row"><td>Total</td><td>${total.toFixed(2)}</td></tr><tr><td>Paid</td><td>${paid.toFixed(2)}</td></tr><tr class="balance-row"><td>Balance</td><td>Rs. ${balance.toFixed(2)}</td></tr></tbody></table></div><div class="notes"><strong>Terms:</strong> Check-out 11:00 AM. Valid ID proof mandatory.</div><div class="footer"><div class="signature">Guest Signature</div><div class="signature">Receptionist Signature</div></div></div></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  // ── Print C Form ──
  const printCForm = (b: any, passportData: string) => {
    const printWindow = window.open('', '_blank', 'width=900,height=900');
    if (!printWindow) { showToast("⚠ Please allow pop-ups"); return; }
    const guest = b.primaryGuest || b.guest || {};
    const dataParts = passportData.split(",").map(s => s.trim());
    const passportNo = dataParts[0] || "—";
    const visaNo = dataParts[1] || "—";
    const nationality = dataParts[2] || "—";
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Form C - ${b.booking_ref || b.id}</title><style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Times New Roman',serif;padding:20px;color:#000;line-height:1.4;}.container{max-width:850px;margin:0 auto;border:2px solid #000;padding:30px;}.header{text-align:center;border-bottom:2px solid #000;padding-bottom:15px;margin-bottom:25px;}.header h1{font-size:26px;text-transform:uppercase;letter-spacing:2px;}.header h2{font-size:16px;font-weight:normal;text-transform:uppercase;margin-top:5px;}.header p{font-size:12px;margin-top:5px;}.form-title{text-align:center;font-size:20px;font-weight:bold;text-transform:uppercase;margin-bottom:25px;text-decoration:underline;}.section{margin-bottom:25px;}.section-title{font-weight:bold;font-size:14px;background:#e5e7eb;padding:8px 12px;border:1px solid #000;margin-bottom:15px;}.row{display:flex;margin-bottom:12px;font-size:14px;}.col{flex:1;padding-right:20px;}.field{display:flex;border-bottom:1px dotted #000;padding-bottom:4px;}.field label{width:180px;font-weight:bold;}.field span{flex:1;}.declaration{font-size:13px;margin:25px 0;padding:15px;background:#f9fafb;border:1px solid #e5e7eb;}.footer{display:flex;justify-content:space-between;margin-top:50px;}.signature{border-top:1.5px solid #000;width:220px;padding-top:8px;text-align:center;font-size:13px;font-weight:bold;}</style></head><body><div class="container"><div class="header"><h1>FORM C</h1><h2>Format for Foreign Tourists</h2><p>As required under Rule 14 of the Registration of Foreigners Rules, 1992</p></div><div class="form-title">Arrival Report</div><div class="section"><div class="section-title">PART A: Details of the Hotel</div><div class="field"><label>Hotel:</label><span>Vishara Elite</span></div><div class="field"><label>Address:</label><span>Hotel Address, City, State, Pincode</span></div></div><div class="section"><div class="section-title">PART B: Details of the Foreign Guest</div><div class="row"><div class="col field"><label>Full Name:</label><span>${guest.name || "—"}</span></div><div class="col field"><label>Nationality:</label><span>${nationality}</span></div></div><div class="row"><div class="col field"><label>Passport No:</label><span>${passportNo}</span></div><div class="col field"><label>Visa No:</label><span>${visaNo}</span></div></div><div class="row"><div class="col field"><label>Arrival:</label><span>${b.checkIn || "—"}</span></div><div class="col field"><label>Departure:</label><span>${b.checkOut || "—"}</span></div></div><div class="row"><div class="col field"><label>Room No:</label><span>${b.roomNumber || "—"}</span></div><div class="col field"><label>Guests:</label><span>${b.adults || 1} A, ${b.children || 0} C</span></div></div></div><div class="section"><div class="section-title">PART C: Declaration</div><div class="declaration">I hereby declare that the information given above is true and correct to the best of my knowledge and belief. I am aware that any false information may lead to legal action under the Foreigners Act, 1946.</div></div><div class="footer"><div class="signature">Signature of Guest</div><div class="signature">Hotel Manager / Authorized Signatory</div></div></div></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  // ── Download Voucher ──
  const downloadVoucher = (b: any) => {
    const guest = b.primaryGuest || b.guest || {};
    const amount = Number(b.amount) || 0;
    const tax = Number(b.tax) || 0;
    const paid = Number(b.paid) || 0;
    const total = amount + tax;
    const balance = total - paid;
    const voucherHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Booking Voucher - ${b.booking_ref || b.id}</title><style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Helvetica Neue',Arial,sans-serif;background:#f8fafc;padding:40px 20px;color:#333;}.voucher{max-width:700px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.08);overflow:hidden;}.header{background:linear-gradient(135deg,#0d9488 0%,#14b8a6 100%);padding:30px 40px;color:#fff;}.header h1{font-size:28px;margin-bottom:5px;}.header p{opacity:0.9;font-size:14px;}.header .ref{display:flex;justify-content:space-between;margin-top:20px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.3);}.header .ref .label{font-size:11px;text-transform:uppercase;opacity:0.8;}.header .ref .value{font-size:16px;font-weight:700;}.body{padding:30px 40px;}.section{margin-bottom:25px;}.section-title{font-size:12px;font-weight:700;text-transform:uppercase;color:#0d9488;border-bottom:2px solid #ccfbf1;padding-bottom:8px;margin-bottom:15px;}.grid{display:grid;grid-template-columns:1fr 1fr;gap:15px;}.field{padding:10px 0;border-bottom:1px solid #f1f5f9;}.field .label{font-size:11px;color:#94a3b8;text-transform:uppercase;margin-bottom:4px;}.field .value{font-size:15px;font-weight:600;}.payment-table{width:100%;border-collapse:collapse;margin-top:10px;}.payment-table th,.payment-table td{padding:12px 15px;font-size:14px;border-bottom:1px solid #f1f5f9;}.payment-table th{background:#f8fafc;font-weight:700;font-size:11px;text-transform:uppercase;color:#475569;}.payment-table td:last-child,.payment-table th:last-child{text-align:right;}.total-row{background:#f0fdfa;font-weight:700;}.balance-row{background:#fef2f2;color:#b91c1c;font-weight:700;font-size:16px;}.footer{background:#f8fafc;padding:25px 40px;text-align:center;font-size:12px;color:#64748b;border-top:1px solid #e2e8f0;}.thankyou{font-size:16px;font-weight:600;color:#0d9488;margin-bottom:5px;}</style></head><body><div class="voucher"><div class="header"><h1>Vishara Elite</h1><p>Booking Confirmation Voucher</p><div class="ref"><div><div class="label">Booking Ref</div><div class="value">${b.booking_ref || b.id}</div></div><div style="text-align:right;"><div class="label">Generated</div><div class="value">${new Date().toLocaleDateString('en-IN')}</div></div></div></div><div class="body"><div class="section"><div class="section-title">Guest Details</div><div class="grid"><div class="field"><div class="label">Name</div><div class="value">${guest.name || "—"}</div></div><div class="field"><div class="label">Phone</div><div class="value">${guest.phone || "—"}</div></div><div class="field"><div class="label">Email</div><div class="value">${guest.email || "—"}</div></div><div class="field"><div class="label">Address</div><div class="value">${guest.address || "—"}</div></div></div></div><div class="section"><div class="section-title">Stay Details</div><div class="grid"><div class="field"><div class="label">Room</div><div class="value">${b.roomNumber || "—"} — ${b.roomType || "—"}</div></div><div class="field"><div class="label">Rate Plan</div><div class="value">${b.ratePlan || "EP"}</div></div><div class="field"><div class="label">Check-In</div><div class="value">${b.checkIn || "—"}</div></div><div class="field"><div class="label">Check-Out</div><div class="value">${b.checkOut || "—"}</div></div></div></div><div class="section"><div class="section-title">Payment Summary</div><table class="payment-table"><thead><tr><th>Description</th><th>Amount</th></tr></thead><tbody><tr><td>Room Charge</td><td>${amount.toFixed(2)}</td></tr><tr><td>Taxes</td><td>${tax.toFixed(2)}</td></tr><tr class="total-row"><td>Total</td><td>Rs. ${total.toFixed(2)}</td></tr><tr><td>Paid</td><td>Rs. ${paid.toFixed(2)}</td></tr><tr class="balance-row"><td>Balance</td><td>Rs. ${balance.toFixed(2)}</td></tr></tbody></table></div></div><div class="footer"><p class="thankyou">Thank you for choosing Vishara Elite!</p><p style="margin-top:10px;font-size:11px;color:#94a3b8;">Generated by Staynexa PMS</p></div></div></body></html>`;
    const blob = new Blob([voucherHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Voucher_${b.booking_ref || b.id}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // ── Add Addon Handler ──
  const handleAddAddonSubmit = async () => {
    if (!addonModal) return;
    const { booking: b, addonName, addonPrice, serviceDate, taxPercent } = addonModal;
    if (!addonName.trim() || !addonPrice.trim()) {
      showToast("⚠ Please enter addon name and price");
      return;
    }

    const priceNum = parseFloat(addonPrice) || 0;
    const taxNum = parseFloat(taxPercent) || 0;

    // Parse existing addons from notes
    const existingMatch = (b.notes || "").match(/ADDONS_JSON:(\[[^\]]*\])/);
    let existingAddons: any[] = [];
    if (existingMatch) {
      try { existingAddons = JSON.parse(existingMatch[1]); } catch { existingAddons = []; }
    }

    // Add new addon
    const newAddon = {
      id: `addon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: addonName.trim(),
      price: priceNum,
      tax: taxNum,
      date: serviceDate,
    };
    existingAddons.push(newAddon);

    // Build new notes string (remove old ADDONS_JSON and append new one)
    const cleanNotes = (b.notes || "").replace(/·?\s*ADDONS_JSON:\[[^\]]*\]\s*·?/g, "").replace(/^·\s*|\s*·$/g, "").trim();
    const addonsJson = `ADDONS_JSON:${JSON.stringify(existingAddons)}`;
    const newNotes = cleanNotes ? `${cleanNotes} · ${addonsJson}` : addonsJson;

    await updateBookingNotes(b.id, newNotes);
    showToast(`➕ ${addonName} added — ₹${(priceNum * (1 + taxNum / 100)).toFixed(2)}`);
    setAddonModal(null);
    setCalendarVersion((v) => v + 1);
    await loadFromDb();
  };

  // ── Delete Addon Handler ──
  const handleDeleteAddon = async (addonId: string) => {
    if (!folioFor) return;
    const b = folioFor;

    const existingMatch = (b.notes || "").match(/ADDONS_JSON:(\[[^\]]*\])/);
    if (!existingMatch) return;

    let existingAddons: any[] = [];
    try { existingAddons = JSON.parse(existingMatch[1]); } catch { return; }

    const filtered = existingAddons.filter((a) => a.id !== addonId);

    const cleanNotes = (b.notes || "").replace(/·?\s*ADDONS_JSON:\[[^\]]*\]\s*·?/g, "").replace(/^·\s*|\s*·$/g, "").trim();
    let newNotes = cleanNotes;
    if (filtered.length > 0) {
      const addonsJson = `ADDONS_JSON:${JSON.stringify(filtered)}`;
      newNotes = cleanNotes ? `${cleanNotes} · ${addonsJson}` : addonsJson;
    }

    await updateBookingNotes(b.id, newNotes);
    showToast("🗑 Addon deleted");
    setCalendarVersion((v) => v + 1);
    await loadFromDb();
  };

  // ── Parse Folio Log ──
  const parseFolioLog = (b: any) => {
    const notes = b.notes || "";
    const entries: { time: string; description: string; type: string }[] = [];
    if (b.checkIn) entries.push({ time: b.checkIn, description: "Booking Created", type: "BOOKING" });
    if (b.status === "CHECKED-IN") entries.push({ time: new Date().toISOString().split("T")[0], description: "Guest Checked-In", type: "CHECKIN" });
    if (b.status === "CHECKED-OUT") entries.push({ time: new Date().toISOString().split("T")[0], description: "Guest Checked-Out", type: "CHECKOUT" });
    notes.split(" · ").forEach((n: string) => {
      if (!n.trim()) return;
      let type = "NOTE";
      if (n.includes("Addon:")) type = "ADDON";
      else if (n.includes("Coupon Applied:")) type = "COUPON";
      else if (n.includes("Company:")) type = "COMPANY";
      else if (n.includes("Baggage:")) type = "BAGGAGE";
      else if (n.includes("Passport:")) type = "PASSPORT";
      else if (n.includes("Tax Exempt:")) type = "TAX_EXEMPT";
      else if (n.includes("Checked in at")) type = "CHECKIN";
      entries.push({ time: "—", description: n.trim(), type });
    });
    return entries;
  };

  const logTypeColors: Record<string, string> = {
    BOOKING: "bg-blue-100 text-blue-700 border-blue-200",
    CHECKIN: "bg-emerald-100 text-emerald-700 border-emerald-200",
    CHECKOUT: "bg-rose-100 text-rose-700 border-rose-200",
    ADDON: "bg-amber-100 text-amber-700 border-amber-200",
    COUPON: "bg-purple-100 text-purple-700 border-purple-200",
    COMPANY: "bg-teal-100 text-teal-700 border-teal-200",
    BAGGAGE: "bg-slate-100 text-slate-700 border-slate-200",
    PASSPORT: "bg-indigo-100 text-indigo-700 border-indigo-200",
    TAX_EXEMPT: "bg-orange-100 text-orange-700 border-orange-200",
    NOTE: "bg-gray-100 text-gray-700 border-gray-200",
  };

  // ── Folio Actions Handler ──
  const handleFolioAction = async (label: string, b: any) => {
    if (!b) return;
    switch (label) {
      case "Print Registration Card": printRegistrationCard(b); break;
      case "Print C Form": {
        const notesStr = b.notes || "";
        const passportMatch = notesStr.match(/Passport:\s*([^·]+)/);
        if (passportMatch) {
          printCForm(b, passportMatch[1].trim());
        } else {
          setFolioFor(null);
          setGenericAction({
            title: "Enter Passport & Visa Details",
            message: "Please enter Passport No, Visa No, and Nationality separated by commas.",
            inputPlaceholder: "e.g., US1234567, V123456, USA",
            onConfirm: async (val) => {
              if (!val.trim()) { showToast("⚠ Please enter the details"); return; }
              const newNotes = `${b.notes ? b.notes + " · " : ""}Passport: ${val}`;
              await updateBookingNotes(b.id, newNotes);
              showToast("🛂 Passport details saved");
              setGenericAction(null); setGenericInputValue("");
              setCalendarVersion((v) => v + 1);
              await loadFromDb();
              printCForm(b, val);
            }
          });
        }
        break;
      }
      case "Print Normal Bill": printNormalBill(b); break;
      case "Print Company Bill": {
        const notesStr2 = b.notes || "";
        const companyMatch = notesStr2.match(/Company:\s*([^·]+)/);
        if (companyMatch) {
          printCompanyBill(b, companyMatch[1].trim());
        } else {
          setFolioFor(null);
          setGenericAction({
            title: "Enter Company Details",
            message: "Enter Company Name and GSTIN (comma separated):",
            inputPlaceholder: "e.g., ABC Corp Pvt Ltd, 22AAAAA0000A1Z5",
            onConfirm: async (val) => {
              if (!val.trim()) { showToast("⚠ Please enter company details"); return; }
              const newNotes = `${b.notes ? b.notes + " · " : ""}Company: ${val}`;
              await updateBookingNotes(b.id, newNotes);
              showToast("🏢 Company details saved");
              setGenericAction(null); setGenericInputValue("");
              setCalendarVersion((v) => v + 1);
              await loadFromDb();
              printCompanyBill(b, val);
            }
          });
        }
        break;
      }
      case "Download Booking Voucher":
        downloadVoucher(b);
        showToast("📥 Voucher downloaded successfully");
        break;
      case "Email Folio Details": {
        const email = b.primaryGuest?.email || b.guest?.email || '';
        if (!email) { showToast("⚠ No email address found"); break; }
        const sub = encodeURIComponent(`Folio Details - ${b.booking_ref || b.id}`);
        const bodyText = `Dear ${guestNameOf(b)},\n\nRoom: ${roomNumberOf(b)}\nCheck-in: ${checkInOf(b)}\nCheck-out: ${checkOutOf(b)}\nTotal: Rs. ${b.amount || 0}\nBalance: Rs. ${(Number(b.amount) || 0) + (Number(b.tax) || 0) - (Number(b.paid) || 0)}`;
        window.open(`mailto:${email}?subject=${sub}&body=${encodeURIComponent(bodyText)}`, '_blank');
        break;
      }
      case "Folio Log":
        setFolioFor(null);
        setFolioLogFor(b);
        break;
      case "Edit Rate Plan":
        setFolioFor(null);
        setModifyFor(b);
        break;
      case "Apply Coupon / Discount":
        setFolioFor(null);
        setGenericAction({
          title: "Apply Coupon / Discount",
          message: "Enter coupon code or discount amount:",
          inputPlaceholder: "e.g., SUMMER20 or 500",
          onConfirm: async (val) => {
            if (!val.trim()) return;
            await updateBookingNotes(b.id, `${b.notes ? b.notes + " · " : ""}Coupon Applied: ${val}`);
            showToast(`🏷️ Coupon applied: ${val}`);
            setGenericAction(null); setGenericInputValue("");
            setCalendarVersion((v) => v + 1);
            await loadFromDb();
          }
        });
        break;
      case "Add Company Details":
        setFolioFor(null);
        setGenericAction({
          title: "Add Company Details",
          message: "Enter company name and GST number:",
          inputPlaceholder: "Company Name, GSTIN",
          onConfirm: async (val) => {
            if (!val.trim()) return;
            await updateBookingNotes(b.id, `${b.notes ? b.notes + " · " : ""}Company: ${val}`);
            showToast(`🏢 Company details added`);
            setGenericAction(null); setGenericInputValue("");
            setCalendarVersion((v) => v + 1);
            await loadFromDb();
          }
        });
        break;
      case "Tax Exempt Status":
        setFolioFor(null);
        setGenericAction({
          title: "Tax Exempt Status",
          message: "Enter reason for tax exemption:",
          inputPlaceholder: "Reason",
          onConfirm: async (val) => {
            if (!val.trim()) return;
            await updateBookingNotes(b.id, `${b.notes ? b.notes + " · " : ""}Tax Exempt: ${val}`);
            showToast(`⚖️ Tax exemption noted`);
            setGenericAction(null); setGenericInputValue("");
            setCalendarVersion((v) => v + 1);
            await loadFromDb();
          }
        });
        break;
      case "Add Hotel Addons":
        setFolioFor(null);
        setAddonModal({
          booking: b,
          addonName: "",
          addonPrice: "",
          serviceDate: new Date().toISOString().split("T")[0],
          taxPercent: "0",
          amountType: "Debit (+ charge)",
        });
        break;
      case "Assign Room":
      case "Move Room":
        setFolioFor(null); setMoveRoomTarget(b); setMoveRoomNewRoom("");
        break;
      case "Unassign Room":
        setFolioFor(null);
        askAction({ type: "UNASSIGN", booking: b, title: "Unassign room?", message: `Unassign Room ${roomNumberOf(b)}?`, confirmLabel: "Yes, Unassign Room", confirmColor: "amber" });
        break;
      case "Modify Checkout":
        setFolioFor(null); setDateEditFor({ booking: b, type: "checkout" }); setDateEditValue(checkOutOf(b));
        break;
      case "Add to Group Booking":
        setFolioFor(null); setGroupBookingOpen(true);
        break;
      case "Lock Booking":
        setFolioFor(null);
        askAction({ type: "LOCK", booking: b, title: "Lock booking?", message: `Lock this booking?`, confirmLabel: "Yes, Lock Booking", confirmColor: "amber" });
        break;
      case "Unlock Booking":
        setFolioFor(null);
        askAction({ type: "UNLOCK", booking: b, title: "Unlock booking?", message: `Unlock this booking?`, confirmLabel: "Yes, Unlock", confirmColor: "green" });
        break;
      case "Scanty Baggage":
        setFolioFor(null);
        setGenericAction({
          title: "Scanty Baggage",
          message: "Enter baggage details:",
          inputPlaceholder: "Baggage details",
          onConfirm: async (val) => {
            if (!val.trim()) return;
            await updateBookingNotes(b.id, `${b.notes ? b.notes + " · " : ""}Baggage: ${val}`);
            showToast(`🧳 Baggage noted`);
            setGenericAction(null); setGenericInputValue("");
            setCalendarVersion((v) => v + 1);
            await loadFromDb();
          }
        });
        break;
      default: showToast(`⚙️ ${label} — not implemented`);
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
            showToast(`⚠ Room ${dragVisual.previewRoom} is not available`);
            dragRef.current = null; setDragVisual(null);
            return;
          }
          const b = bookings.find((bb) => bb.id === d.bookingId);
          if (b) {
            const capturedPreview = dragVisual;
            askAction({
              type: "DRAG_MOVE", booking: b,
              title: "Move reservation?",
              message: `Move "${guestNameOf(b)}" to Room ${capturedPreview.previewRoom}?`,
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
                              <div className="absolute inset-1 bg-gradient-to-br from-blue-100 to-blue-200 border border-blue-400 rounded-lg flex flex-col items-center justify-center cursor-pointer px-2">
                                <span className="text-blue-700 text-xl">🔒</span>
                                <span className="text-[9px] font-bold text-blue-800 mt-0.5 uppercase">Blocked</span>
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
                <p className="text-xs text-muted mt-0.5">{searchedBookings.length} results for "{searchQuery}"</p>
              </div>
              <button onClick={() => setSearchResultsOpen(false)} className="text-gray-400 text-3xl leading-none">×</button>
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
                        <p className="text-xs text-gray-500 mt-0.5">{guestPhoneOf(b) || "No phone"}</p>
                        <p className="text-xs mt-1.5">Room {roomNumberOf(b) ?? "—"} · {prettyDate(checkInOf(b))} → {prettyDate(checkOutOf(b))}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-700">{b.status}</span>
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
          <div className="relative bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 px-5 pt-5 pb-8 text-white overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/10 -mr-20 -mt-20" />
            <button onClick={() => setSelected(null)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white text-lg font-medium transition z-10">✕</button>
            <div className="relative">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">Booking · {selected.id.slice(0, 8)}</p>
              <div className="flex items-center gap-3 mt-3">
                <div className="w-14 h-14 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center flex-shrink-0">
                  <span className="font-serif text-2xl font-bold text-white">{(guestNameOf(selected) || "?").charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold truncate leading-tight">{guestNameOf(selected)}</h2>
                  <p className="text-sm opacity-90 truncate mt-0.5">{guestPhoneOf(selected) || "No phone"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 flex-wrap">
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${selected.status === "CONFIRMED" ? "bg-amber-900/40 text-amber-50 border border-amber-200/30" : selected.status === "CHECKED-IN" ? "bg-emerald-900/40 text-emerald-50 border border-emerald-200/30" : "bg-white/20 text-white border border-white/30"}`}>● {selected.status}</span>
                {selected.source && (<span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-white/20 uppercase">{selected.source}</span>)}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-900">
            <div className="px-5 -mt-4 relative z-10">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-gray-100 dark:border-slate-700 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Check-In</p>
                    <p className="text-lg font-bold text-navy dark:text-white mt-0.5">{checkInOf(selected) ? new Date(checkInOf(selected)).getDate() : "—"}</p>
                    <p className="text-xs text-muted font-medium">{checkInOf(selected) ? new Date(checkInOf(selected)).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : ""}</p>
                  </div>
                  <div className="flex flex-col items-center px-3">
                    <div className="text-[10px] font-bold uppercase text-muted mb-1">{nightsBetween(checkInOf(selected), checkOutOf(selected))} Night</div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <div className="w-8 h-[2px] bg-gradient-to-r from-emerald-500 to-rose-500" />
                      <div className="w-2 h-2 rounded-full bg-rose-500" />
                    </div>
                  </div>
                  <div className="flex-1 text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Check-Out</p>
                    <p className="text-lg font-bold text-navy dark:text-white mt-0.5">{checkOutOf(selected) ? new Date(checkOutOf(selected)).getDate() : "—"}</p>
                    <p className="text-xs text-muted font-medium">{checkOutOf(selected) ? new Date(checkOutOf(selected)).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : ""}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-5 pt-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-3">
                  <div className="flex items-center gap-2 mb-1"><span>🚪</span><p className="text-[10px] font-bold uppercase text-muted">Room</p></div>
                  <p className="text-base font-bold text-navy dark:text-white">{roomNumberOf(selected) ?? "—"}</p>
                  <p className="text-[10px] text-muted truncate">{roomTypeOf(selected)}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-3">
                  <div className="flex items-center gap-2 mb-1"><span>👥</span><p className="text-[10px] font-bold uppercase text-muted">Guests</p></div>
                  <p className="text-base font-bold text-navy dark:text-white">{selected.adults} A · {selected.children} C</p>
                </div>
              </div>
            </div>

            <div className="px-5 pt-5">
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => setFolioFor(selected)} className="bg-white dark:bg-slate-800 hover:bg-cream border border-gray-200 dark:border-slate-700 rounded-xl py-3 flex flex-col items-center gap-1 transition"><span className="text-lg">📄</span><span className="text-[10px] font-semibold text-navy dark:text-white">Folio</span></button>
                <button onClick={() => showToast("🖨 Printing…")} className="bg-white dark:bg-slate-800 hover:bg-cream border border-gray-200 dark:border-slate-700 rounded-xl py-3 flex flex-col items-center gap-1 transition"><span className="text-lg">🖨</span><span className="text-[10px] font-semibold text-navy dark:text-white">Print</span></button>
                <button onClick={() => openGuestPanel(selected)} className="bg-white dark:bg-slate-800 hover:bg-cream border border-gray-200 dark:border-slate-700 rounded-xl py-3 flex flex-col items-center gap-1 transition"><span className="text-lg">✏️</span><span className="text-[10px] font-semibold text-navy dark:text-white">Guest</span></button>
              </div>
            </div>

            <div className="px-5 pt-6">
              <div className="flex items-center gap-2 mb-3"><div className="w-1 h-4 bg-gradient-to-b from-amber-500 to-rose-500 rounded-full" /><h3 className="text-xs font-bold uppercase tracking-wider text-navy dark:text-white">Front Desk Actions</h3></div>
              <div className="space-y-2">
                {selected.status === "CONFIRMED" && (
                  <button onClick={() => askAction({ type: "CHECK_IN", booking: selected, title: "Confirm Check-In", message: `Check-in "${guestNameOf(selected)}"?`, confirmLabel: "Yes, Check-In", confirmColor: "green" })} className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl py-3.5 font-semibold text-sm shadow-md flex items-center justify-center gap-2 transition-all"><span>✓</span>Check-In Guest</button>
                )}
                {selected.status === "CHECKED-IN" && (
                  <button onClick={() => askAction({ type: "CHECK_OUT", booking: selected, title: "Confirm Check-Out", message: `Check-out "${guestNameOf(selected)}"?`, confirmLabel: "Yes, Check-Out", confirmColor: "red" })} className="w-full bg-gradient-to-r from-rose-500 to-red-500 text-white rounded-xl py-3.5 font-semibold text-sm shadow-md flex items-center justify-center gap-2 transition-all"><span>🚪</span>Check-Out Guest</button>
                )}
                <button onClick={() => askAction({ type: "ADD_PAYMENT", booking: selected, title: "Add payment?", message: `Record a payment?`, confirmLabel: "Yes, Add Payment", confirmColor: "green", onConfirm: () => setSettleDuesFor(selected) })} className="w-full bg-white dark:bg-slate-800 hover:bg-emerald-50 border-2 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 rounded-xl py-3 font-semibold text-sm flex items-center justify-center gap-2 transition-all"><span>💰</span>Add Payment</button>
                <div className="relative">
                  <button onClick={() => setShowModifyMenu(!showModifyMenu)} className="w-full bg-white dark:bg-slate-800 hover:bg-gray-50 border border-gray-200 dark:border-slate-700 text-navy dark:text-white rounded-xl py-3 font-semibold text-sm flex items-center justify-between px-4 transition-all">
                    <span className="flex items-center gap-2"><span>⚙</span>More Actions</span>
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
                <button onClick={() => setSettleDuesFor(selected)} className="text-[10px] font-bold text-emerald-600 hover:underline uppercase">Settle dues</button>
              </div>
              <PaymentDetailsBlock bookingId={selected.id} roomCharge={selected.amount || 0} paid={getPaid(selected)} />
            </div>

            <div className="px-5 pt-6 pb-8">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><div className="w-1 h-4 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full" /><h3 className="text-xs font-bold uppercase tracking-wider text-navy dark:text-white">Notes</h3></div>
                <button onClick={() => { setNotesModalFor(selected); setNotesDraft(selected.notes || ""); }} className="text-[10px] font-bold text-purple-600 hover:underline uppercase">{selected.notes ? "Edit notes" : "+ Add notes"}</button>
              </div>
              {selected.notes ? (
                <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 relative">
                  <p className="text-sm text-navy dark:text-slate-200 whitespace-pre-wrap leading-relaxed pr-8">{selected.notes}</p>
                  <button onClick={() => setDeleteNotesConfirm(selected)} className="absolute top-3 right-3 text-gray-300 hover:text-rose-500 text-lg transition">🗑</button>
                </div>
              ) : (
                <button onClick={() => { setNotesModalFor(selected); setNotesDraft(""); }} className="w-full bg-white dark:bg-slate-800 border-2 border-dashed border-gray-200 dark:border-slate-700 hover:border-purple-300 rounded-xl p-6 text-center transition-colors group">
                  <span className="text-2xl">📝</span>
                  <p className="text-xs text-muted mt-2 group-hover:text-purple-600 font-medium">Click to add notes</p>
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
                  <p className="text-sm text-gray-600 dark:text-slate-300">{pendingAction.message}</p>
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
              <input type="text" value={genericInputValue} onChange={(e) => setGenericInputValue(e.target.value)} placeholder={genericAction.inputPlaceholder || "Enter value..."} className="w-full px-3 py-2.5 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg text-sm" autoFocus />
            </div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-slate-700 flex justify-end gap-3 border-t dark:border-slate-600">
              <button onClick={() => setGenericAction(null)} className="px-5 py-2.5 border dark:border-slate-600 rounded-lg text-sm dark:text-slate-200">Cancel</button>
              <button onClick={() => { genericAction.onConfirm(genericInputValue); setGenericInputValue(""); }} className="px-6 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ADDON MODAL */}
      {addonModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[90] p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center">
                  <span className="text-teal-600 dark:text-teal-400 text-lg font-bold">+</span>
                </div>
                <h3 className="text-xl font-bold text-navy dark:text-white">Add add-ons / services</h3>
              </div>
              <button onClick={() => setAddonModal(null)} className="text-gray-400 hover:text-gray-700 text-3xl leading-none">×</button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Charge to room</label>
                <select className="w-full px-4 py-3 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg text-sm font-medium focus:border-teal-500 outline-none transition">
                  <option>{roomNumberOf(addonModal.booking) || "—"} ({roomTypeOf(addonModal.booking) || "Room"})</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Mode</label>
                <div className="grid grid-cols-2 gap-3">
                  <button className="px-4 py-3 rounded-lg border-2 border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 font-semibold text-sm transition">Custom</button>
                  <button className="px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 font-semibold text-sm transition">Predefined</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Service date</label>
                  <input type="date" value={addonModal.serviceDate} onChange={(e) => setAddonModal({ ...addonModal, serviceDate: e.target.value })} className="w-full px-4 py-3 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg text-sm focus:border-teal-500 outline-none transition" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Amount type</label>
                  <select value={addonModal.amountType} onChange={(e) => setAddonModal({ ...addonModal, amountType: e.target.value })} className="w-full px-4 py-3 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg text-sm font-medium focus:border-teal-500 outline-none transition">
                    <option>Debit (+ charge)</option>
                    <option>Credit (− discount)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Folio item name</label>
                <input type="text" value={addonModal.addonName} onChange={(e) => setAddonModal({ ...addonModal, addonName: e.target.value })} placeholder="e.g., Extra Bed, Mini Bar, Laundry, Room Service" className="w-full px-4 py-3 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg text-sm focus:border-teal-500 outline-none transition" autoFocus />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Amount (excl. tax)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">₹</span>
                    <input type="number" value={addonModal.addonPrice} onChange={(e) => setAddonModal({ ...addonModal, addonPrice: e.target.value })} placeholder="0.00" className="w-full pl-8 pr-4 py-3 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg text-sm focus:border-teal-500 outline-none transition" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Tax %</label>
                  <select value={addonModal.taxPercent} onChange={(e) => setAddonModal({ ...addonModal, taxPercent: e.target.value })} className="w-full px-4 py-3 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg text-sm focus:border-teal-500 outline-none transition">
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Amount (incl. tax)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">₹</span>
                    <input type="text" value={addonModal.addonPrice ? (parseFloat(addonModal.addonPrice) * (1 + parseFloat(addonModal.taxPercent) / 100)).toFixed(2) : ""} readOnly placeholder="0.00" className="w-full pl-8 pr-4 py-3 border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800 dark:text-white rounded-lg text-sm font-semibold text-teal-600 outline-none" />
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-white dark:bg-slate-800 border-t border-gray-100 dark:border-slate-700 flex gap-3">
              <button onClick={() => setAddonModal(null)} className="flex-1 py-3 rounded-lg border-2 border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-200 font-semibold text-sm hover:bg-gray-50 transition">CANCEL</button>
              <button onClick={handleAddAddonSubmit} disabled={!addonModal.addonName.trim() || !addonModal.addonPrice.trim()} className="flex-1 py-3 rounded-lg bg-navy dark:bg-slate-900 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-navy/90 transition disabled:opacity-50 disabled:cursor-not-allowed">
                <span className="text-base">+</span>ADD TO FOLIO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOLIO LOG MODAL */}
      {folioLogFor && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[90] p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-5 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-xl">📋</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Folio Log</h3>
                  <p className="text-xs text-white/80">{guestNameOf(folioLogFor)} · {folioLogFor.booking_ref || folioLogFor.id}</p>
                </div>
              </div>
              <button onClick={() => setFolioLogFor(null)} className="text-white/80 hover:text-white text-3xl leading-none">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900">
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
                    <tr>
                      <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-300">Date / Time</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-300">Type</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-300">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {parseFolioLog(folioLogFor).length === 0 ? (
                      <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">No log entries yet</td></tr>
                    ) : (
                      parseFolioLog(folioLogFor).map((entry, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                          <td className="px-4 py-3 text-gray-600 dark:text-slate-300 whitespace-nowrap">{entry.time}</td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full border uppercase ${logTypeColors[entry.type] || logTypeColors.NOTE}`}>
                              {entry.type.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-800 dark:text-slate-200">{entry.description}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-6 py-4 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 flex justify-end shrink-0">
              <button onClick={() => setFolioLogFor(null)} className="px-6 py-2.5 bg-navy dark:bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-navy/90 transition">Close</button>
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
            <div className="px-6 py-4 border-b dark:border-slate-700 flex justify-between items-center"><h3 className="text-lg font-bold dark:text-white">Modify {dateEditFor.type === "checkin" ? "Check-In" : "Check-Out"}</h3><button onClick={() => { setDateEditFor(null); setDateEditValue(""); }} className="text-gray-400 text-2xl">×</button></div>
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
        <FolioModal 
          booking={folioFor} 
          onClose={() => setFolioFor(null)} 
          refreshKey={calendarVersion}
          onOpenPaymentManager={() => { setFolioFor(null); setPaymentManagerOpen(true); }}
          onSettleDues={() => { const b = folioFor; setFolioFor(null); if (b) setSettleDuesFor(b); }}
          onCheckInOrOut={() => {
            const b = folioFor; setFolioFor(null);
            if (b) askAction({ type: b.status === "CHECKED-IN" ? "CHECK_OUT" : "CHECK_IN", booking: b, title: b.status === "CHECKED-IN" ? "Confirm Check-Out" : "Confirm Check-In", message: `Continue?`, confirmLabel: b.status === "CHECKED-IN" ? "Yes, Check-Out" : "Yes, Check-In", confirmColor: b.status === "CHECKED-IN" ? "red" : "green" });
          }}
          onPaymentMade={() => { setCalendarVersion((v) => v + 1); loadFromDb(); }}
          onBookingUpdate={() => { setCalendarVersion((v) => v + 1); loadFromDb(); }}
          onAction={(label) => handleFolioAction(label, folioFor)}
          onDeleteAddon={handleDeleteAddon}
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
            <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold dark:text-white">Move Reservation</h3><button onClick={() => setMoveRoomTarget(null)} className="text-gray-500 text-xl">✕</button></div>
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
                if (!isRoomAvailableForDates(bookings, r, checkInOf(t), checkOutOf(t), t.id)) { showToast(`⚠ Room ${r} not available`); return; }
                setMoveRoomTarget(null);
                askAction({ type: "MOVE_ROOM", booking: t, title: "Confirm move?", message: `Move to Room ${r}?`, confirmLabel: "Yes, Move", confirmColor: "green",
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
              if (roomsToBook.length < g.quantity) throw new Error(`Only ${roomsToBook.length} room(s) available. Requested ${g.quantity}.`);
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
            if (skipped.length > 0) showToast(`⚠ Skipped ${skipped.length} room(s)`);
            else showToast(`✅ Group booking created (${totalCreated} rooms)`);
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
              <div key={b.id} className="border border-purple-200 rounded-xl p-4 bg-purple-50/50">
                <p className="font-semibold text-navy dark:text-white text-sm">{guestNameOf(b)}</p>
                <p className="text-xs text-muted mb-3">Room {roomNumberOf(b) ?? "—"} · {prettyDate(checkInOf(b))}</p>
                <button onClick={() => askAction({ type: "RELEASE_HOLD", booking: b, title: "Release hold?", message: `Release "${guestNameOf(b)}"?`, confirmLabel: "Yes, Release", confirmColor: "green" })} className="w-full bg-purple-600 text-white text-xs py-2 rounded-lg">▶ Release to Calendar</button>
              </div>
            ))}
            {unassignedBookings.map((b: any) => (
              <div key={b.id} className="border border-amber-200 rounded-xl p-4 bg-amber-50/40">
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