"use client";

import CompanyDetailsModal, { type CompanyDetails } from "../components/CompanyDetailsModal";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { statusLabels } from "../data";
import { getActiveHotelId } from "../active-hotel";
import type { Guest } from "../types";
import { getPaid, getBalance } from "../types";
import {
  fetchBookings,
  fetchRooms,
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

// ── Helper Functions ──
function cleanNotesForDisplay(notes: string): string {
  if (!notes) return "";
  return notes
    .replace(/·?\s*ADDONS_JSON:\[[^\]]*\]\s*·?/g, "")
    .replace(/^·\s*|\s*·$/g, "")
    .replace(/·\s*·/g, "·")
    .trim();
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
  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
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
    if (b.status === "CANCELLED" || b.status === "BLOCKED") return false;
    const bci = checkInOf(b);
    const bco = checkOutOf(b);
    return bci < checkOut && bco > checkIn;
  });
}

type ViewMode = "full" | "room";
type DateRangeFilter = "All" | "Today" | "This Week" | "Next 7 Days" | "Next 14 Days" | "This Month";

const RANGE_OPTIONS: DateRangeFilter[] = ["All", "Today", "This Week", "Next 7 Days", "Next 14 Days", "This Month"];

const legendItems = [
  { label: "Confirmed", color: "bg-[#f5c563]" },
  { label: "Checked-in", color: "bg-[#7eb6a8]" },
  { label: "Blocked", color: "bg-gray-300" },
];

const statusBarClass: Record<string, string> = {
  CONFIRMED: "bg-[#f5c563] text-gray-800 border border-[#e0b050]",
  "CHECKED-IN": "bg-[#7eb6a8] text-white border border-[#6aa393]",
  "CHECKED-OUT": "bg-gray-300 text-gray-600",
  "PENDING DEPARTURE": "bg-[#7eb6a8] text-white border border-[#6aa393]",
  BLOCKED: "bg-gray-200 text-gray-500 border border-gray-300",
  CANCELLED: "bg-gray-100 text-gray-400 line-through",
  "ON-HOLD": "bg-purple-200 text-purple-800",
};

const modifyOptions = [
  "Hold booking", "Set to no show", "Lock booking", "Unlock booking", "Unassign room",
  "Modify checkin", "Modify checkout", "Split Room", "Move Room", "Send magic link", "Cancel booking",
];

const CELL_WIDTH = 150;
const ROW_HEIGHT = 60;
const DRAG_THRESHOLD = 5;

function PaymentDetailsBlock({ booking, roomCharge, paid }: { booking: any; roomCharge: number; paid: number }) {
  const notes = booking?.notes || "";
  const match = notes.match(/ADDONS_JSON:(\[[^\]]*\])/);
  let addons: any[] = [];
  if (match) {
    try { addons = JSON.parse(match[1]); } catch { addons = []; }
  }

  const addonsSubtotal = addons.reduce((sum: number, a: any) => sum + (Number(a.price) || 0), 0);
  const addonsTax = addons.reduce((sum: number, a: any) => sum + ((Number(a.price) || 0) * (Number(a.tax) || 0)) / 100, 0);
  const addonsTotal = addonsSubtotal + addonsTax;
  const tax = Number(booking.tax) || 0;

  const finalAmount = roomCharge + tax + addonsTotal;
  const balance = Math.max(0, finalAmount - paid);
  const isPaid = balance === 0 && finalAmount > 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      <div className={`px-4 py-3 ${isPaid ? "bg-emerald-50" : "bg-amber-50"}`}>
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Total Amount</p>
        <p className="text-xl font-bold text-gray-900 mt-0.5">₹{finalAmount.toLocaleString("en-IN")}</p>
        {addonsTotal > 0 && (
          <p className="text-[10px] text-gray-500 mt-1">Room ₹{roomCharge} + Tax ₹{tax} + Addons ₹{addonsTotal}</p>
        )}
      </div>
      <div className="divide-y divide-gray-100">
        <div className="flex justify-between items-center px-4 py-2.5">
          <span className="text-xs font-medium text-gray-500">Paid</span>
          <span className="text-sm font-bold text-emerald-600">₹{paid.toLocaleString("en-IN")}</span>
        </div>
        <div className="flex justify-between items-center px-4 py-2.5">
          <span className="text-xs font-medium text-gray-500">Balance Due</span>
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
  const [companyModalFor, setCompanyModalFor] = useState<any | null>(null);
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

  const [folioLogFor, setFolioLogFor] = useState<any | null>(null);
  const [addonModal, setAddonModal] = useState<{
    booking: any;
    addonName: string;
    addonPrice: string;
    serviceDate: string;
    taxPercent: string;
    amountType: string;
  } | null>(null);
  const [billPreview, setBillPreview] = useState<{
    booking: any;
    type: "normal" | "company";
    companyName?: string;
    companyGst?: string;
    companyEmail?: string;
    companyPhone?: string;
    companyAddress?: string;
  } | null>(null);
  const [printMenuOpen, setPrintMenuOpen] = useState(false);
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
        pincode: pg.pincode || pg.zipCode || "",
        idType: pg.idType || "",
        idNumber: pg.idNumber || "",
        country: pg.country || "India",
        zipCode: pg.zipCode || pg.pincode || "",
        gst: pg.gst || "",
        company: pg.company || "",
        companyName: pg.companyName || "",
        companyGst: pg.companyGst || "",
        companyEmail: pg.companyEmail || "",
        companyPhone: pg.companyPhone || "",
        companyAddress: pg.companyAddress || "",
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
          setBookings((prev) => prev.map((b) => b.id === booking.id ? { ...b, status: "CHECKED-IN", notes } : b));
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
          setBookings((prev) => prev.map((b) => b.id === booking.id ? { ...b, status: "CHECKED-OUT" } : b));
          showToast(`🚪 ${guestNameOf(booking)} checked out`);
          setSelected(null);
          break;
        }
        case "HOLD": {
          await holdBooking(booking.id, "Moved to holds");
          setBookings((prev) => prev.map((b) => b.id === booking.id ? { ...b, status: "ON-HOLD", notes: "Moved to holds" } : b));
          showToast(`⏸ ${guestNameOf(booking)} moved to On-Hold`);
          setSelected(null);
          break;
        }
        case "NO_SHOW": { 
          await markNoShow(booking.id); 
          setBookings((prev) => prev.map((b) => b.id === booking.id ? { ...b, status: "NO-SHOW", is_no_show: true } : b));
          showToast(`🚫 Marked as no-show`); 
          setSelected(null); 
          break; 
        }
        case "LOCK": { 
          await lockBooking(booking.id); 
          setBookings((prev) => prev.map((b) => b.id === booking.id ? { ...b, is_locked: true } : b));
          showToast(`🔒 Booking locked`); 
          break; 
        }
        case "UNLOCK": { 
          await unlockBooking(booking.id); 
          setBookings((prev) => prev.map((b) => b.id === booking.id ? { ...b, is_locked: false } : b));
          showToast(`🔓 Booking unlocked`); 
          break; 
        }
        case "UNASSIGN": { 
          await unassignRoom(booking.id); 
          setBookings((prev) => prev.map((b) => b.id === booking.id ? { ...b, room_id: null, roomNumber: null } : b));
          showToast(`🚪 Room unassigned`); 
          setSelected(null); 
          break; 
        }
        case "CANCEL": { 
          await updateBookingStatus(booking.id, "CANCELLED", booking.notes); 
          setBookings((prev) => prev.map((b) => b.id === booking.id ? { ...b, status: "CANCELLED" } : b));
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
          setBookings((prev) => prev.map((b) => b.id === booking.id ? { ...b, status: "CONFIRMED" } : b));
          showToast(`✅ ${guestNameOf(booking)} restored`); 
          setHoldsPanelOpen(false); 
          break; 
        }
        case "UNBLOCK": { 
          await updateBookingStatus(booking.id, "CANCELLED", booking.notes); 
          setBookings((prev) => prev.filter((b) => b.id !== booking.id)); 
          setSelected(null);
          setCalendarVersion((v) => v + 1);
          showToast(`🔓 Room ${roomNumberOf(booking)} unblocked`); 
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

  const handleSaveCompany = async (details: CompanyDetails) => {
    if (!companyModalFor) return;
    const b = companyModalFor;

    try {
      const guestId = b?.primaryGuest?.id ?? b?.guest?.id ?? b?.primary_guest_id;
      if (!guestId) {
        showToast("⚠ Guest ID not found");
        return;
      }

      await updateGuest(guestId, {
        companyName: details.companyName,
        companyGst: details.companyGst,
        companyEmail: details.companyEmail,
        companyPhone: details.companyPhone,
        companyAddress: details.companyAddress,
      });

      const notesStr = b.notes || "";
      const cleanNotes = notesStr.replace(/·?\s*Company:\s*[^·]+/g, "").replace(/^·\s*|\s*·$/g, "").trim();
      const companyPart = `Company: ${details.companyName}, ${details.companyGst}`;
      const newNotes = cleanNotes ? `${cleanNotes} · ${companyPart}` : companyPart;
      await updateBookingNotes(b.id, newNotes);

      showToast("🏢 Company details saved successfully");
      setCompanyModalFor(null);
      setCalendarVersion((v) => v + 1);
      await loadFromDb();
    } catch (err: any) {
      console.error("[handleSaveCompany]", err);
      showToast(`⚠ ${err?.message || "Failed to save company details"}`);
    }
  };

  const handleSaveNotes = async (booking: any) => {
    try {
      const originalNotes = booking.notes || "";
      const addonMatch = originalNotes.match(/ADDONS_JSON:(\[[^\]]*\])/);
      const addonPart = addonMatch ? `ADDONS_JSON:${addonMatch[1]}` : "";

      const userNote = notesDraft.trim();
      let newNotes = userNote;
      if (addonPart) {
        newNotes = userNote ? `${userNote} · ${addonPart}` : addonPart;
      }

      await updateBookingNotes(booking.id, newNotes);
      showToast("📝 Notes saved");
      setNotesModalFor(null);
      setNotesDraft("");
      setCalendarVersion((v) => v + 1);
      await loadFromDb();
    } catch (err: any) {
      showToast(`⚠ ${err.message || "Failed to save notes"}`);
    }
  };

  const handleDeleteNotes = async (booking: any) => {
    try {
      const originalNotes = booking.notes || "";
      const addonMatch = originalNotes.match(/ADDONS_JSON:(\[[^\]]*\])/);
      const addonPart = addonMatch ? `ADDONS_JSON:${addonMatch[1]}` : "";

      await updateBookingNotes(booking.id, addonPart);
      showToast("🗑 Notes deleted");
      setDeleteNotesConfirm(null);
      setCalendarVersion((v) => v + 1);
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
    } catch (err: any) {
      console.error("[handleBlockRoom]", err);
      showToast(`⚠ ${err?.message || "Failed to block room"}`);
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

  const handleAddAddonSubmit = async () => {
    if (!addonModal) return;
    const { booking: b, addonName, addonPrice, serviceDate, taxPercent } = addonModal;
    if (!addonName.trim() || !addonPrice.trim()) {
      showToast("⚠ Please enter addon name and price");
      return;
    }

    const priceNum = parseFloat(addonPrice) || 0;
    const taxNum = parseFloat(taxPercent) || 0;

    const existingMatch = (b.notes || "").match(/ADDONS_JSON:(\[[^\]]*\])/);
    let existingAddons: any[] = [];
    if (existingMatch) {
      try { existingAddons = JSON.parse(existingMatch[1]); } catch { existingAddons = []; }
    }

    const newAddon = {
      id: `addon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: addonName.trim(),
      price: priceNum,
      tax: taxNum,
      date: serviceDate,
    };
    existingAddons.push(newAddon);

    const cleanNotes = cleanNotesForDisplay(b.notes || "");
    const addonsJson = `ADDONS_JSON:${JSON.stringify(existingAddons)}`;
    const newNotes = cleanNotes ? `${cleanNotes} · ${addonsJson}` : addonsJson;

    await updateBookingNotes(b.id, newNotes);
    showToast(`➕ ${addonName} added — ₹${(priceNum * (1 + taxNum / 100)).toFixed(2)}`);
    setAddonModal(null);
    setCalendarVersion((v) => v + 1);
    await loadFromDb();
  };

  const handleDeleteAddon = async (addonId: string) => {
    if (!folioFor) return;
    const b = folioFor;

    const existingMatch = (b.notes || "").match(/ADDONS_JSON:(\[[^\]]*\])/);
    if (!existingMatch) return;

    let existingAddons: any[] = [];
    try { existingAddons = JSON.parse(existingMatch[1]); } catch { return; }

    const filtered = existingAddons.filter((a) => a.id !== addonId);

    const cleanNotes = cleanNotesForDisplay(b.notes || "");
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

  const parseFolioLog = (b: any) => {
    const notes = b.notes || "";
    const entries: { time: string; description: string; type: string }[] = [];
    if (b.checkIn) entries.push({ time: b.checkIn, description: "Booking Created", type: "BOOKING" });
    if (b.status === "CHECKED-IN") entries.push({ time: new Date().toISOString().split("T")[0], description: "Guest Checked-In", type: "CHECKIN" });
    if (b.status === "CHECKED-OUT") entries.push({ time: new Date().toISOString().split("T")[0], description: "Guest Checked-Out", type: "CHECKOUT" });
    notes.split(" · ").forEach((n: string) => {
      if (!n.trim()) return;
      if (n.includes("ADDONS_JSON:")) {
        try {
          const addonsJson = n.replace("ADDONS_JSON:", "");
          const addonList = JSON.parse(addonsJson);
          addonList.forEach((a: any) => {
            entries.push({
              time: a.date || "—",
              description: `Addon: ${a.name} — ₹${(Number(a.price) || 0).toFixed(2)}`,
              type: "ADDON",
            });
          });
        } catch { /* ignore */ }
        return;
      }
      let type = "NOTE";
      if (n.includes("Coupon Applied:")) type = "COUPON";
      else if (n.includes("Company:")) type = "COMPANY";
      else if (n.includes("Baggage:")) type = "BAGGAGE";
      else if (n.includes("Passport:")) type = "PASSPORT";
      else if (n.includes("Tax Exempt:")) type = "TAX_EXEMPT";
      else if (n.includes("Checked in at")) type = "CHECKIN";
      entries.push({ time: "—", description: n.trim(), type });
    });
    return entries;
  };

  const generateBillHtml = (b: any, type: "normal" | "company", companyName?: string, companyGst?: string, companyEmail?: string, companyPhone?: string, companyAddress?: string) => {
    const guest = b.primaryGuest || b.guest || {};
    const amount = Number(b.amount) || 0;
    const tax = Number(b.tax) || 0;
    const paid = Number(b.paid) || 0;

    const notesStr = b.notes || "";
    const addonMatch = notesStr.match(/ADDONS_JSON:(\[[^\]]*\])/);
    let addons: any[] = [];
    if (addonMatch) {
      try { addons = JSON.parse(addonMatch[1]); } catch { addons = []; }
    }

    const addonsSubtotal = addons.reduce((s, a) => s + (Number(a.price) || 0), 0);
    const addonsTax = addons.reduce((s, a) => s + ((Number(a.price) || 0) * (Number(a.tax) || 0)) / 100, 0);
    const addonsTotal = addonsSubtotal + addonsTax;

    const totalAmount = amount + tax + addonsTotal;
    const balance = totalAmount - paid;
    const isCompany = type === "company";
    const invoiceNo = isCompany
      ? `CINV-${(b.booking_ref || b.id || "").slice(-8).toUpperCase()}`
      : `INV-${(b.booking_ref || b.id || "").slice(-8).toUpperCase()}`;
    const accentColor = isCompany ? "#1e40af" : "#0d9488";

    let itemRows = `<tr><td>Room Charges — ${b.roomType || "Room"}</td><td>1</td><td style="text-align:right;">${amount.toFixed(2)}</td></tr>`;
    addons.forEach((a: any) => {
      const lineTotal = (Number(a.price) || 0) * (1 + (Number(a.tax) || 0) / 100);
      itemRows += `<tr><td>${a.name}</td><td>1</td><td style="text-align:right;">${lineTotal.toFixed(2)}</td></tr>`;
    });

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${isCompany ? "Company " : ""}Tax Invoice - ${invoiceNo}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:'Helvetica Neue',Arial,sans-serif;padding:25px;color:#1e293b;line-height:1.5;background:#fff;}
        .invoice{max-width:800px;margin:0 auto;border:1px solid #cbd5e1;border-radius:10px;padding:32px;}
        .header{display:flex;justify-content:space-between;border-bottom:2px solid ${accentColor};padding-bottom:18px;margin-bottom:22px;}
        .brand h1{color:${accentColor};font-size:28px;letter-spacing:-0.5px;}
        .brand p{color:#64748b;font-size:12px;margin-top:3px;}
        .brand .addr{font-size:11px;color:#64748b;margin-top:8px;line-height:1.4;}
        .inv-meta{text-align:right;}
        .inv-meta .title{font-size:20px;font-weight:700;color:${accentColor};text-transform:uppercase;letter-spacing:1px;}
        .inv-meta .subtitle{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-top:3px;}
        .inv-meta .num{font-size:14px;font-weight:700;color:${accentColor};margin-top:8px;}
        .inv-meta .date{font-size:12px;color:#64748b;margin-top:4px;}
        .billto-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:22px;}
        .info-box{background:${isCompany ? "#eff6ff" : "#f8fafc"};border:1px solid ${isCompany ? "#bfdbfe" : "#e2e8f0"};border-radius:8px;padding:14px 16px;}
        .info-box h3{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:${accentColor};margin-bottom:8px;font-weight:700;}
        .info-box .name{font-size:16px;font-weight:700;color:#0f172a;margin-bottom:4px;}
        .info-box .line{font-size:12px;color:#475569;margin-bottom:2px;}
        .info-box .gst{font-size:13px;font-weight:700;color:${accentColor};margin-top:6px;}
        .guest-ref{background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;padding:14px 16px;margin-bottom:20px;}
        .guest-ref h3{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#0d9488;margin-bottom:6px;font-weight:700;}
        .guest-ref .line{font-size:13px;color:#334155;margin-bottom:2px;}
        table.items{width:100%;border-collapse:collapse;margin-bottom:0;}
        table.items th,table.items td{padding:11px 14px;text-align:left;font-size:13px;border-bottom:1px solid #e2e8f0;}
        table.items th{background:${accentColor};color:#fff;font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:0.8px;}
        table.items th:nth-child(2),table.items td:nth-child(2){text-align:center;}
        table.items th:last-child,table.items td:last-child{text-align:right;}
        .totals{width:100%;border-collapse:collapse;margin-top:0;}
        .totals td{padding:9px 14px;font-size:13px;border-bottom:1px solid #f1f5f9;}
        .totals td:first-child{text-align:right;color:#64748b;font-weight:500;}
        .totals td:last-child{text-align:right;font-weight:600;color:#0f172a;width:150px;}
        .totals tr.grand td{padding:14px;font-size:16px;font-weight:700;background:${isCompany ? "#eff6ff" : "#f0fdfa"};color:${accentColor};border-bottom:none;}
        .totals tr.grand td:first-child{color:${accentColor};}
        .totals tr.balance td{padding:14px;font-size:16px;font-weight:700;background:#fef2f2;color:#b91c1c;border-bottom:none;}
        .totals tr.balance td:first-child{color:#b91c1c;}
        .footer{margin-top:30px;padding-top:18px;border-top:1px dashed #cbd5e1;display:flex;justify-content:space-between;align-items:flex-end;}
        .footer .terms{font-size:10px;color:#64748b;max-width:60%;line-height:1.5;}
        .footer .sign{text-align:center;font-size:11px;color:#64748b;}
        .footer .sign .line{border-top:1px solid #94a3b8;width:180px;margin-bottom:5px;}
      </style></head><body>
      <div class="invoice">
        <div class="header">
          <div class="brand">
            <h1>Vishara Elite</h1>
            <p>Hotel & Resorts</p>
            <div class="addr">Hotel Address, City, State, Pincode<br/>GSTIN: 22AAAAA0000A1Z5 • Phone: +91-XXXXXXXXXX</div>
          </div>
          <div class="inv-meta">
            <div class="title">Tax Invoice</div>
            ${isCompany ? `<div class="subtitle">Corporate Billing</div>` : ""}
            <div class="num">${invoiceNo}</div>
            <div class="date">Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            <div class="date">Ref: ${b.booking_ref || b.id}</div>
          </div>
        </div>

        <div class="billto-grid">
          ${isCompany ? `
            <div class="info-box">
              <h3>Bill To (Company)</h3>
              <div class="name">${companyName || "—"}</div>
              ${companyAddress ? `<div class="line">${companyAddress}</div>` : ""}
              ${companyEmail ? `<div class="line">Email: ${companyEmail}</div>` : ""}
              ${companyPhone ? `<div class="line">Phone: ${companyPhone}</div>` : ""}
              <div class="gst">GSTIN: ${companyGst || "—"}</div>
            </div>
            <div class="info-box" style="background:#f8fafc;border-color:#e2e8f0;">
              <h3 style="color:#64748b;">Stay Details</h3>
              <div class="line"><strong>Room:</strong> ${b.roomNumber || "—"} — ${b.roomType || "—"}</div>
              <div class="line"><strong>Check-in:</strong> ${b.checkIn || "—"}</div>
              <div class="line"><strong>Check-out:</strong> ${b.checkOut || "—"}</div>
              <div class="line"><strong>Rate Plan:</strong> ${b.ratePlan || "EP"}</div>
            </div>
          ` : `
            <div class="info-box">
              <h3>Bill To</h3>
              <div class="name">${guest.name || "Guest"}</div>
              <div class="line">${guest.address || ""}</div>
              <div class="line">Phone: ${guest.phone || "—"}</div>
              <div class="line">Email: ${guest.email || "—"}</div>
              ${guest.gst ? `<div class="line">GSTIN: ${guest.gst}</div>` : ""}
            </div>
            <div class="info-box" style="background:#f8fafc;border-color:#e2e8f0;">
              <h3 style="color:#64748b;">Stay Details</h3>
              <div class="line"><strong>Room:</strong> ${b.roomNumber || "—"} — ${b.roomType || "—"}</div>
              <div class="line"><strong>Check-in:</strong> ${b.checkIn || "—"}</div>
              <div class="line"><strong>Check-out:</strong> ${b.checkOut || "—"}</div>
              <div class="line"><strong>Pax:</strong> ${b.adults || 1} Adults, ${b.children || 0} Children</div>
            </div>
          `}
        </div>

        ${isCompany ? `
          <div class="guest-ref">
            <h3>Guest Reference (Actual Occupant)</h3>
            <div class="line"><strong>Name:</strong> ${guest.name || "—"}</div>
            <div class="line"><strong>Phone:</strong> ${guest.phone || "—"} &nbsp; • &nbsp; <strong>Email:</strong> ${guest.email || "—"}</div>
          </div>
        ` : ""}

        <table class="items">
          <thead>
            <tr>
              <th style="width:55%;">Description</th>
              <th style="width:10%;">Qty</th>
              <th style="width:35%;">Amount (Rs.)</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>

        <table class="totals">
          <tr><td>Sub Total (Room + Addons)</td><td>${(amount + addonsSubtotal).toFixed(2)}</td></tr>
          ${tax + addonsTax > 0 ? `
            <tr><td>CGST @ 2.5%</td><td>${((tax + addonsTax) / 2).toFixed(2)}</td></tr>
            <tr><td>SGST @ 2.5%</td><td>${((tax + addonsTax) / 2).toFixed(2)}</td></tr>
          ` : ""}
          <tr class="grand"><td>Grand Total</td><td>Rs. ${totalAmount.toFixed(2)}</td></tr>
          <tr><td>Payment Made</td><td>Rs. ${paid.toFixed(2)}</td></tr>
          <tr class="balance"><td>Balance Due</td><td>Rs. ${balance.toFixed(2)}</td></tr>
        </table>

        <div class="footer">
          <div class="terms">
            <strong>Terms & Conditions:</strong><br/>
            ${isCompany
              ? "1. Corporate invoice as per agreement.<br/>2. Payment within 15 days.<br/>3. Computer-generated invoice."
              : "1. Check-out time is 11:00 AM.<br/>2. Payment due at check-out.<br/>3. Computer-generated invoice."}
          </div>
          <div class="sign">
            <div class="line"></div>
            Authorized Signatory
          </div>
        </div>
      </div>
    </body></html>`;
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
      case "Print Bill":
      case "Print Normal Bill": {
        const notesStr = b.notes || "";
        const companyMatch = notesStr.match(/Company:\s*([^·]+)/);
        setFolioFor(null);
        if (companyMatch) {
          const parts = companyMatch[1].split(",").map((s: string) => s.trim());
          setBillPreview({
            booking: b,
            type: "normal",
            companyName: parts[0] || "",
            companyGst: parts[1] || "",
          });
        } else {
          setBillPreview({
            booking: b,
            type: "normal",
          });
        }
        break;
      }
      case "Print Company Bill": {
        const notesStr2 = b.notes || "";
        const companyMatch2 = notesStr2.match(/Company:\s*([^·]+)/);
        
        const guestCompanyName = b.primaryGuest?.companyName || "";
        const guestCompanyGst = b.primaryGuest?.companyGst || "";
        const guestCompanyEmail = b.primaryGuest?.companyEmail || "";
        const guestCompanyPhone = b.primaryGuest?.companyPhone || "";
        const guestCompanyAddress = b.primaryGuest?.companyAddress || "";

        if (guestCompanyName || companyMatch2) {
          let parsedName = guestCompanyName;
          let parsedGst = guestCompanyGst;
          
          if (!parsedName && companyMatch2) {
            const parts = companyMatch2[1].split(",").map((s: string) => s.trim());
            parsedName = parts[0] || "";
            parsedGst = parts[1] || "";
          }

          setFolioFor(null);
          setBillPreview({
            booking: b,
            type: "company",
            companyName: parsedName,
            companyGst: parsedGst,
            companyEmail: guestCompanyEmail,
            companyPhone: guestCompanyPhone,
            companyAddress: guestCompanyAddress,
          });
        } else {
          setFolioFor(null);
          setCompanyModalFor(b);
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
        setCompanyModalFor(b);
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

  // ═══════════════════════════════════════════════
  // UI RENDER (NEW MODERN DESIGN)
  // ═══════════════════════════════════════════════
  return (
    <div className="flex flex-col h-screen bg-[#f8f9fa] font-sans overflow-hidden">
      
      {/* 1. TOP HEADER */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black rounded flex items-center justify-center text-white font-bold text-xl">S</div>
            <span className="font-bold text-lg tracking-tight">Staynexa</span>
          </div>
          <div className="relative w-96 hidden md:block">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input type="text" placeholder="Search for reservation" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setSearchResultsOpen(!!e.target.value.trim()); }} className="w-full pl-10 pr-4 py-2 bg-gray-100 border-none rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 transition-all" />
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm font-medium text-gray-600">
          <button className="flex items-center gap-1 hover:text-black transition">✨ flexi AI</button>
          <button className="flex items-center gap-1 hover:text-black transition">❓ Help?</button>
          <div className="h-5 w-px bg-gray-300"></div>
          <span className="font-bold text-black">Vishara Elite</span>
          <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center text-xs">V</div>
        </div>
      </div>

      {/* 2. SUB-HEADER (View Controls) */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => setStartDate(todayISO())} className="px-4 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50">Today</button>
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5 border border-gray-200">
            <button onClick={() => shiftDates(-7)} className="text-gray-500 hover:text-black">←</button>
            <span className="text-sm font-medium text-gray-800">{prettyDate(startDate)} - {prettyDate(addDays(startDate, 6))}</span>
            <button onClick={() => shiftDates(7)} className="text-gray-500 hover:text-black">→</button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button className="px-3 py-1.5 text-xs font-medium rounded bg-white shadow-sm text-black">Week</button>
          </div>
          <button onClick={() => { setCreateMenuOpen(false); if (rooms.length > 0) { setCreatePrefill({ roomNumber: rooms[0].room_number, checkIn: todayISO(), checkOut: addDays(todayISO(), 1) }); setCreateOpen(true); } }} className="px-4 py-1.5 bg-black text-white text-sm font-medium rounded-lg flex items-center gap-1 hover:bg-gray-800 transition">
            Create <span className="text-xs">▾</span>
          </button>
        </div>
      </div>

      {/* 3. CALENDAR GRID */}
      <div className="flex-1 overflow-auto bg-white relative">
        {loading && <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-50">⏳ Loading calendar...</div>}
        
        <div className="min-w-[1200px]">
          {/* Date Header */}
          <div className="flex border-b border-gray-200 bg-white sticky top-0 z-30">
            <div className="w-[120px] shrink-0 border-r border-gray-200 py-3 px-4 text-xs font-semibold text-gray-500 uppercase flex items-center gap-1 bg-white sticky left-0 z-40">
              Room <span className="text-gray-400">↑</span>
            </div>
            {dates.map((d, i) => {
              const s = shortFmt(d);
              const isToday = fmt(d) === todayStr;
              return (
                <div key={i} className={`w-[150px] shrink-0 border-r border-gray-100 py-2 text-center ${isToday ? 'bg-gray-50' : ''}`}>
                  <div className={`text-[10px] font-bold tracking-wider ${isToday ? 'text-red-500' : 'text-gray-400'}`}>{s.day}</div>
                  <div className={`text-sm font-semibold ${isToday ? 'text-red-500' : 'text-gray-800'}`}>{s.month} {s.date}</div>
                </div>
              );
            })}
          </div>

          {/* Rows (Rooms and Bookings) */}
          {rooms.map((room) => {
            const rowBookings = activeBookings.filter((b: any) => roomNumberOf(b) === room.room_number);
            return (
              <div key={room.id} className="flex border-b border-gray-100 hover:bg-gray-50/50 transition-colors" style={{ height: ROW_HEIGHT }}>
                {/* Room Column */}
                <div className="w-[120px] shrink-0 border-r border-gray-200 py-2 px-4 flex flex-col justify-center bg-white sticky left-0 z-20">
                  <div className="text-sm font-bold text-gray-800">{room.room_number}</div>
                  <div className="text-[10px] text-gray-400 truncate">{room.room_type}</div>
                </div>

                {/* Booking Grid Cells */}
                <div className="flex flex-1 relative">
                  {/* Today red line */}
                  {dates.map((d, i) => fmt(d) === todayStr && (
                    <div key={`line-${i}`} className="absolute top-0 bottom-0 border-l border-red-500 z-10" style={{ left: `${i * CELL_WIDTH}px`, height: '100%' }} />
                  ))}

                  {/* Date Cells (Empty clickable areas) */}
                  {dates.map((d, i) => {
                    const blocked = getBlockedBooking(room.room_number, d);
                    const isEmpty = !blocked && !rowBookings.some(b => bookingSpansDate(b, d));
                    return (
                      <div key={i} className={`w-[150px] shrink-0 border-r border-gray-100 relative group ${isEmpty ? 'cursor-pointer hover:bg-gray-100/50' : ''}`} onClick={() => { if (isEmpty) handleCellClick(room.room_number, d); }}>
                        {blocked && (
                           <div className="absolute inset-y-1.5 left-1 right-1 bg-gray-200 rounded border border-gray-300 text-[10px] flex items-center px-2 text-gray-600 font-medium">
                             🔒 Blocked
                           </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Booking Bars */}
                  {rowBookings.map((b: any) => {
                    const startIdx = dates.findIndex((dd) => fmt(dd) === checkInOf(b));
                    const endIdx = dates.findIndex((dd) => fmt(dd) === checkOutOf(b));
                    if (startIdx === -1) return null; 
                    
                    const span = (endIdx === -1 ? dates.length : endIdx) - startIdx;
                    const isDragging = dragVisual?.bookingId === b.id;
                    
                    return (
                      <div 
                        key={b.id} 
                        onMouseDown={(e) => onBarMouseDown(e, b)} 
                        className={`absolute top-1.5 bottom-1.5 ${statusBarClass[b.status]} rounded shadow-sm flex items-center px-2 cursor-grab z-20 transition-all ${isDragging ? 'opacity-50 scale-95' : 'hover:shadow-md hover:z-30'}`}
                        style={{ left: `${startIdx * CELL_WIDTH + 2}px`, width: `${span * CELL_WIDTH - 4}px` }}
                      >
                        <div className="w-5 h-5 rounded-full bg-white/30 flex items-center justify-center text-[10px] font-bold shrink-0 mr-2 text-current">
                          {(guestNameOf(b) || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="truncate font-semibold text-xs flex-1">
                          {guestNameOf(b)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── RESERVATION SIDE PANEL ── */}
      {selected && (
        <div className="fixed inset-y-0 right-0 w-[420px] bg-white shadow-2xl z-50 flex flex-col border-l border-gray-200">
          <div className="relative bg-gradient-to-br from-amber-400 to-orange-500 px-5 pt-5 pb-8 text-white">
            <button onClick={() => setSelected(null)} className="absolute top-4 right-4 text-white text-xl">✕</button>
            <div className="flex items-center gap-3 mt-2">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold">{(guestNameOf(selected) || "?").charAt(0).toUpperCase()}</div>
              <div>
                <h2 className="text-xl font-bold">{guestNameOf(selected)}</h2>
                <p className="text-xs opacity-90">{guestPhoneOf(selected) || "No phone"}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded uppercase">{selected.status}</span>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded uppercase">{selected.roomNumber || "—"}</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
             <PaymentDetailsBlock booking={selected} roomCharge={selected.amount || 0} paid={Number(selected.paid) || 0} />
             <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setFolioFor(selected)} className="border rounded-lg py-3 flex flex-col items-center hover:bg-gray-50"><span className="text-lg">📄</span><span className="text-xs font-semibold mt-1">Folio</span></button>
                <button onClick={() => openGuestPanel(selected)} className="border rounded-lg py-3 flex flex-col items-center hover:bg-gray-50"><span className="text-lg">👤</span><span className="text-xs font-semibold mt-1">Guest</span></button>
             </div>
             <div className="space-y-2">
               {selected.status === "CONFIRMED" && <button onClick={() => askAction({ type: "CHECK_IN", booking: selected, title: "Confirm Check-In", message: `Check-in "${guestNameOf(selected)}"?`, confirmLabel: "Yes, Check-In", confirmColor: "green" })} className="w-full bg-teal-600 text-white rounded-lg py-2.5 font-semibold text-sm">Check-In Guest</button>}
               {selected.status === "CHECKED-IN" && <button onClick={() => askAction({ type: "CHECK_OUT", booking: selected, title: "Confirm Check-Out", message: `Check-out "${guestNameOf(selected)}"?`, confirmLabel: "Yes, Check-Out", confirmColor: "red" })} className="w-full bg-rose-600 text-white rounded-lg py-2.5 font-semibold text-sm">Check-Out Guest</button>}
               <button onClick={() => setSettleDuesFor(selected)} className="w-full border border-emerald-600 text-emerald-700 rounded-lg py-2.5 font-semibold text-sm">Add Payment</button>
               <div className="relative">
                 <button onClick={() => setShowModifyMenu(!showModifyMenu)} className="w-full border rounded-lg py-2.5 font-semibold text-sm flex justify-between px-4">
                   <span>More Actions</span><span>▼</span>
                 </button>
                 {showModifyMenu && (
                   <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50">
                     {modifyOptions.map(opt => <button key={opt} onClick={() => handleModifyOption(opt)} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 border-b last:border-0">{opt}</button>)}
                   </div>
                 )}
               </div>
             </div>
          </div>
        </div>
      )}

      {/* ── MODALS RENDERING ── */}
      {pendingAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-2">{pendingAction.title}</h3>
            <p className="text-sm text-gray-600 mb-4">{pendingAction.message}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setPendingAction(null)} disabled={actionRunning} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button onClick={runPendingAction} disabled={actionRunning} className={`px-4 py-2 rounded-lg text-sm text-white ${confirmColorMap[pendingAction.confirmColor]?.bg || "bg-gray-800"}`}>{actionRunning ? "Processing..." : pendingAction.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}

      {companyModalFor && <CompanyDetailsModal initial={companyModalFor.primaryGuest || {}} onClose={() => setCompanyModalFor(null)} onSave={handleSaveCompany} />}
      {guestPanelFor && <GuestInfoPanel booking={guestPanelFor} onClose={() => setGuestPanelFor(null)} onSave={(g) => handleSaveGuest(guestPanelFor, g)} />}
      {folioFor && <FolioModal booking={folioFor} onClose={() => setFolioFor(null)} onSettleDues={() => { setSettleDuesFor(folioFor); setFolioFor(null); }} onCheckInOrOut={() => { setFolioFor(null); askAction({ type: folioFor.status === "CHECKED-IN" ? "CHECK_OUT" : "CHECK_IN", booking: folioFor, title: "Confirm", message: "Continue?", confirmLabel: "Yes", confirmColor: "green" }); }} onAction={(l) => handleFolioAction(l, folioFor)} onDeleteAddon={handleDeleteAddon} />}
      {settleDuesFor && <SettleDuesModal booking={settleDuesFor} onClose={() => setSettleDuesFor(null)} onSave={async (m, a, r, n) => { await recordPayment({ bookingId: settleDuesFor.id, amount: a, method: m, reference: r, note: n }); showToast(`💰 ₹${a} recorded`); setSettleDuesFor(null); await loadFromDb(); }} />}
      {createOpen && <CreateReservationModal initialRoom={createPrefill?.roomNumber} initialCheckIn={createPrefill?.checkIn} initialCheckOut={createPrefill?.checkOut} onClose={() => setCreateOpen(false)} onSubmit={handleCreateSubmit} />}
      {blockRoomOpen && <BlockRoomModal rooms={rooms} initialRoom={createPrefill?.roomNumber} onClose={() => setBlockRoomOpen(false)} onSave={handleBlockRoom} />}
      {groupBookingOpen && <GroupBookingModal rooms={rooms} onClose={() => setGroupBookingOpen(false)} onSave={async () => {}} />}
      
      {/* Toast */}
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white px-6 py-2 rounded-lg text-sm z-[100] shadow-lg">{toast}</div>}

    </div>
  );
}