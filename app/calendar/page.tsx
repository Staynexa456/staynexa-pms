"use client";

import CompanyDetailsModal, { type CompanyDetails } from "../components/CompanyDetailsModal";
import DateRangePicker from "../components/DateRangePicker";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { statusLabels } from "../data";
import { useActiveHotel } from "../lib/use-active-hotel";
import { supabase } from "../supabase";
import type { Guest } from "../types";
import { getPaid, getBalance } from "../types";
import {
  fetchBookings, fetchRooms, updateBookingStatus, updateBookingNotes,
  updateBookingRoomAndDates, createReservation, blockRoom, updateGuest,
  holdBooking, releaseHold, lockBooking, unlockBooking, markNoShow,
  unassignRoom, moveReservation, sendMagicLink, recordPayment,
  modifyReservation, type Room,
  updateRoomHousekeeping,
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

type ViewMode = "day" | "week" | "15d" | "month";

const VIEW_MODE_DAYS: Record<ViewMode, number> = { day: 1, week: 7, "15d": 15, month: 30 };
const VIEW_MODE_LABEL: Record<ViewMode, string> = { day: "Day", week: "Week", "15d": "15 Day", month: "Month" };

function cleanNotesForDisplay(notes: string): string {
  if (!notes) return "";
  return notes.replace(/·?\s*ADDONS_JSON:\[[^\]]*\]\s*·?/g, "").replace(/^·\s*|\s*·$/g, "").replace(/·\s*·/g, "·").trim();
}
function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseISO(s: string): Date { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function addDays(iso: string, days: number): string { const d = parseISO(iso); d.setDate(d.getDate() + days); return fmt(d); }
function daysBetween(a: string, b: string): number { return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000); }
function getDates(startDate: string, days: number): Date[] {
  const out: Date[] = []; const start = new Date(startDate);
  for (let i = 0; i < days; i++) { const d = new Date(start); d.setDate(start.getDate() + i); out.push(d); }
  return out;
}
function shortFmt(d: Date) {
  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return { day: days[d.getDay()], date: d.getDate(), month: months[d.getMonth()] };
}
function prettyDate(iso: string): string {
  if (!iso) return "—"; const d = parseISO(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
function nightsBetween(a: string, b: string): number { return Math.max(1, daysBetween(a, b)); }
function todayISO(): string { return fmt(new Date()); }
function roomNumberOf(b: any): string | null { if (!b) return null; return b.roomNumber ?? b.room?.room_number ?? null; }
function guestNameOf(b: any): string { if (!b) return "Guest"; return b.primaryGuest?.name ?? b.guest?.name ?? "Guest"; }
function guestPhoneOf(b: any): string { if (!b) return ""; return b.primaryGuest?.phone ?? b.guest?.phone ?? ""; }
function checkInOf(b: any): string { if (!b) return ""; return b.checkIn ?? b.check_in ?? ""; }
function checkOutOf(b: any): string { if (!b) return ""; return b.checkOut ?? b.check_out ?? ""; }
function roomTypeOf(b: any): string { if (!b) return ""; return b.roomType ?? b.room?.room_type ?? ""; }
function bookingSpansDate(b: any, date: Date): boolean {
  const s = fmt(date); const ci = checkInOf(b); const co = checkOutOf(b); return ci <= s && co > s;
}
function isRoomAvailableForDates(allBookings: any[], roomNumber: string, checkIn: string, checkOut: string, ignoreBookingId?: string): boolean {
  return !allBookings.some((b: any) => {
    if (b.id === ignoreBookingId) return false;
    if (roomNumberOf(b) !== roomNumber) return false;
    if (b.status === "CANCELLED" || b.status === "ON-HOLD") return false;
    const bci = checkInOf(b); const bco = checkOutOf(b);
    return bci < checkOut && bco > checkIn;
  });
}

const statusBarClass: Record<string, string> = {
  CONFIRMED: "bg-gradient-to-r from-amber-300 to-amber-400 text-amber-950 border-l-4 border-amber-600",
  "CHECKED-IN": "bg-gradient-to-r from-emerald-400 to-teal-500 text-white border-l-4 border-emerald-700",
  "CHECKED-OUT": "bg-gradient-to-r from-slate-300 to-slate-400 text-slate-700 border-l-4 border-slate-500",
  "PENDING DEPARTURE": "bg-gradient-to-r from-teal-400 to-cyan-500 text-white border-l-4 border-teal-700",
  BLOCKED: "bg-gradient-to-r from-slate-200 to-slate-300 text-slate-500 border-l-4 border-slate-400",
  CANCELLED: "bg-slate-100 text-slate-400 line-through opacity-60",
  "ON-HOLD": "bg-gradient-to-r from-purple-300 to-purple-400 text-purple-900 border-l-4 border-purple-600",
  "NO-SHOW": "bg-gradient-to-r from-rose-300 to-rose-400 text-rose-900 border-l-4 border-rose-600",
};
const statusDotColor: Record<string, string> = {
  CONFIRMED: "bg-amber-500", "CHECKED-IN": "bg-emerald-500", "CHECKED-OUT": "bg-slate-400",
  "PENDING DEPARTURE": "bg-teal-500", BLOCKED: "bg-slate-400", CANCELLED: "bg-slate-300",
  "ON-HOLD": "bg-purple-500", "NO-SHOW": "bg-rose-500",
};
const modifyOptions = [
  "Hold booking", "Set to no show", "Lock booking", "Unlock booking", "Unassign room",
  "Modify checkin", "Modify checkout", "Split Room", "Move Room", "Send magic link", "Cancel booking",
];
const CELL_WIDTH = 130;
const ROW_HEIGHT = 68;
const DRAG_THRESHOLD = 5;

function PaymentDetailsBlock({ booking, roomCharge, paid }: { booking: any; roomCharge: number; paid: number }) {
  const notes = booking?.notes || "";
  const match = notes.match(/ADDONS_JSON:(\[[^\]]*\])/);
  let addons: any[] = [];
  if (match) { try { addons = JSON.parse(match[1]); } catch { addons = []; } }
  const addonsSubtotal = addons.reduce((sum: number, a: any) => sum + (Number(a.price) || 0), 0);
  const addonsTax = addons.reduce((sum: number, a: any) => sum + ((Number(a.price) || 0) * (Number(a.tax) || 0)) / 100, 0);
  const addonsTotal = addonsSubtotal + addonsTax;
  const tax = Number(booking.tax) || 0;
  const finalAmount = roomCharge + tax + addonsTotal;
  const balance = Math.max(0, finalAmount - paid);
  const isPaid = balance === 0 && finalAmount > 0;
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className={`px-4 py-3 ${isPaid ? "bg-gradient-to-r from-emerald-50 to-teal-50" : "bg-gradient-to-r from-amber-50 to-orange-50"}`}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total Amount</p>
        <p className="text-2xl font-bold text-slate-900 mt-0.5">₹{finalAmount.toLocaleString("en-IN")}</p>
        {addonsTotal > 0 && <p className="text-[10px] text-slate-500 mt-1">Room ₹{roomCharge} + Tax ₹{tax} + Addons ₹{addonsTotal}</p>}
      </div>
      <div className="divide-y divide-slate-100">
        <div className="flex justify-between items-center px-4 py-2.5"><span className="text-xs font-medium text-slate-500">Paid</span><span className="text-sm font-bold text-emerald-600">₹{paid.toLocaleString("en-IN")}</span></div>
        <div className="flex justify-between items-center px-4 py-2.5"><span className="text-xs font-medium text-slate-500">Balance Due</span><span className={`text-sm font-bold ${balance > 0 ? "text-rose-600" : "text-emerald-600"}`}>₹{balance.toLocaleString("en-IN")}</span></div>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const { hotelId, loading: hotelLoading } = useActiveHotel();
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
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>("all");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
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
  const [genericAction, setGenericAction] = useState<{ title: string; message: string; inputPlaceholder?: string; onConfirm: (value: string) => void; } | null>(null);
  const [genericInputValue, setGenericInputValue] = useState("");
  const [folioLogFor, setFolioLogFor] = useState<any | null>(null);
  const [addonModal, setAddonModal] = useState<{ booking: any; addonName: string; addonPrice: string; serviceDate: string; taxPercent: string; amountType: string; } | null>(null);
  const [billPreview, setBillPreview] = useState<{ booking: any; type: "normal" | "company"; companyName?: string; companyGst?: string; companyEmail?: string; companyPhone?: string; companyAddress?: string; } | null>(null);
  const [printMenuOpen, setPrintMenuOpen] = useState(false);
  const [cellContextMenu, setCellContextMenu] = useState<{ x: number; y: number; roomNumber: string; date: Date; } | null>(null);
  const dragRef = useRef<any>(null);
  const [dragVisual, setDragVisual] = useState<any>(null);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  // 🆕 হোটেলের Folio সেটিংস
  const [hotelSettings, setHotelSettings] = useState<any>(null);

  useEffect(() => {
    const fetchHotelSettings = async () => {
      if (!hotelId) return;
      const { data } = await supabase
        .from("hotels")
        .select("name, logo_url, gst_number, address, contact_phone, invoice_prefix, terms_conditions")
        .eq("id", hotelId)
        .maybeSingle();
      if (data) setHotelSettings(data);
    };
    fetchHotelSettings();
  }, [hotelId]);

  useEffect(() => {
    const handleGlobalSearch = (e: Event) => {
      const customEvent = e as CustomEvent;
      const val = customEvent.detail || "";
      setSearchQuery(val);
      setSearchResultsOpen(!!val.trim());
    };
    window.addEventListener("global-search", handleGlobalSearch);
    return () => window.removeEventListener("global-search", handleGlobalSearch);
  }, []);

  const numDays = VIEW_MODE_DAYS[viewMode];
  const dates = useMemo(() => getDates(startDate, numDays), [startDate, numDays]);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2800); };

  const roomTypes = useMemo(() => {
    const types = new Set<string>();
    rooms.forEach((r: any) => types.add(r.room_type || "Standard"));
    return Array.from(types).sort();
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    if (roomTypeFilter === "all") return rooms;
    return rooms.filter((r: any) => (r.room_type || "Standard") === roomTypeFilter);
  }, [rooms, roomTypeFilter]);

  const calendarStats = useMemo(() => {
    const today = todayISO();
    const occupiedRoomNumbers = new Set(bookings.filter((b: any) => b.status === "CHECKED-IN" && checkInOf(b) <= today && checkOutOf(b) > today).map((b: any) => roomNumberOf(b)).filter(Boolean));
    const blockedRoomNumbers = new Set(bookings.filter((b: any) => b.status === "BLOCKED" && checkInOf(b) <= today && checkOutOf(b) > today).map((b: any) => roomNumberOf(b)).filter(Boolean));
    const occupied = occupiedRoomNumbers.size;
    const blockedToday = blockedRoomNumbers.size;
    const maintenanceRooms = rooms.filter((r: any) => r.housekeeping_status === "MAINTENANCE").length;
    const arrivals = bookings.filter((b: any) => checkInOf(b) === today && b.status === "CONFIRMED").length;
    const departures = bookings.filter((b: any) => checkOutOf(b) === today && ["CHECKED-IN", "PENDING DEPARTURE"].includes(b.status)).length;
    const availableRooms = rooms.filter((r: any) => {
      const rn = r.room_number;
      if (occupiedRoomNumbers.has(rn)) return false;
      if (blockedRoomNumbers.has(rn)) return false;
      if (r.housekeeping_status === "MAINTENANCE") return false;
      return true;
    }).length;
    const occupancyRate = rooms.length > 0 ? (occupied / rooms.length) * 100 : 0;
    return { occupied, arrivals, departures, available: availableRooms, blockedToday, maintenanceRooms, occupancyRate };
  }, [bookings, rooms]);

  const openGuestPanel = (b: any) => {
    if (!b) return;
    const pg = b.primaryGuest || b.guest || {};
    setGuestPanelFor({
      ...b,
      primaryGuest: {
        id: pg.id || b.primary_guest_id || "", name: pg.name || "", phone: pg.phone || "",
        email: pg.email || "", address: pg.address || "", city: pg.city || "", state: pg.state || "",
        pincode: pg.pincode || pg.zipCode || "", idType: pg.idType || "", idNumber: pg.idNumber || "",
        country: pg.country || "India", zipCode: pg.zipCode || pg.pincode || "", gst: pg.gst || "",
        company: pg.company || "", companyName: pg.companyName || "", companyGst: pg.companyGst || "",
        companyEmail: pg.companyEmail || "", companyPhone: pg.companyPhone || "", companyAddress: pg.companyAddress || ""
      }
    });
  };

  const activeBookings = useMemo(() => {
    const visible = bookings.filter((b) => b.status !== "CANCELLED" && b.status !== "ON-HOLD" && !deletedIds.has(b.id));
    const nonBlocked = visible.filter(b => b.status !== "BLOCKED");
    return visible.filter(b => {
      if (b.status !== "BLOCKED") return true;
      return !nonBlocked.some(nb => roomNumberOf(nb) === roomNumberOf(b) && checkInOf(nb) < checkOutOf(b) && checkOutOf(nb) > checkInOf(b));
    });
  }, [bookings, deletedIds]);

  const holdBookings = useMemo(() => bookings.filter((b) => b.status === "ON-HOLD" && !deletedIds.has(b.id)), [bookings, deletedIds]);
  const unassignedBookings = useMemo(() => bookings.filter((b) => b.status === "CONFIRMED" && !roomNumberOf(b) && !deletedIds.has(b.id)), [bookings, deletedIds]);

  useEffect(() => {
    if (selected && selected.status !== "ON-HOLD" && selected.status !== "BLOCKED") {
      const stillExists = activeBookings.some(b => b.id === selected.id);
      if (!stillExists) setSelected(null);
    }
  }, [activeBookings, selected]);

  const searchedBookings = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return bookings.filter((b: any) => {
      const gn = (b.primaryGuest?.name ?? b.guest?.name ?? "").toLowerCase();
      const ph = (b.primaryGuest?.phone ?? b.guest?.phone ?? "").toLowerCase();
      const rn = (roomNumberOf(b) ?? "").toLowerCase();
      const rf = (b.booking_ref ?? "").toLowerCase();
      return gn.includes(q) || ph.includes(q) || rn.includes(q) || rf.includes(q);
    });
  }, [bookings, searchQuery]);

  const loadFromDb = useCallback(async () => {
    if (!hotelId) { setLoading(false); return; }
    try {
      setLoading(true);
      const [bookingsData, roomsData] = await Promise.all([fetchBookings(hotelId), fetchRooms(hotelId)]);
      setBookings([...bookingsData]);
      setRooms([...roomsData]);
    } catch (err) {
      console.error("Failed to load bookings:", err);
      showToast("⚠ Failed to load bookings");
    } finally { setLoading(false); }
  }, [hotelId]);

  useEffect(() => {
    if (hotelLoading) return;
    if (!hotelId) { setLoading(false); return; }
    loadFromDb();
    const handler = () => loadFromDb();
    window.addEventListener("hotel-changed", handler);
    return () => { window.removeEventListener("hotel-changed", handler); };
  }, [loadFromDb, hotelLoading, hotelId]);

  const shiftDates = (direction: number) => {
    const d = parseISO(startDate);
    d.setDate(d.getDate() + direction * numDays);
    setStartDate(fmt(d));
  };

  const getBlockedBooking = (roomNumber: string, date: Date): any | null => {
    const dateStr = fmt(date);
    return activeBookings.find((b: any) => roomNumberOf(b) === roomNumber && b.status === "BLOCKED" && checkInOf(b) <= dateStr && checkOutOf(b) > dateStr) || null;
  };

  const askAction = (action: any) => { setShowModifyMenu(false); setPendingAction(action); };

  const runPendingAction = async () => {
    if (!pendingAction) return;
    setActionRunning(true);
    const { type, booking, onConfirm } = pendingAction;
    try {
      if (onConfirm) { await onConfirm(); setActionRunning(false); setPendingAction(null); return; }
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
          if (balance > 0) { showToast(`⚠ Cannot check-out · ₹${balance.toFixed(2)} balance due`); setActionRunning(false); setPendingAction(null); return; }
          await updateBookingStatus(booking.id, "CHECKED-OUT");
          setBookings((prev) => prev.map((b) => b.id === booking.id ? { ...b, status: "CHECKED-OUT" } : b));
          showToast(`🚪 ${guestNameOf(booking)} checked out`);
          setSelected(null);
          const roomNum = roomNumberOf(booking);
          if (roomNum) {
            const roomObj = rooms.find(r => r.room_number === roomNum);
            if (roomObj) {
              try { await updateRoomHousekeeping(roomObj.id, "DIRTY", "Receptionist"); setRooms((prev) => prev.map(r => r.id === roomObj.id ? { ...r, housekeeping_status: "DIRTY" } : r)); } catch (e) { console.error("[Auto-Dirty] failed:", e); }
            }
          }
          break;
        }
        case "HOLD": {
          await holdBooking(booking.id, "Moved to holds");
          setBookings((prev) => prev.map((b) => b.id === booking.id ? { ...b, status: "ON-HOLD", notes: "Moved to holds" } : b));
          showToast(`⏸ ${guestNameOf(booking)} moved to On-Hold`);
          setSelected(null);
          break;
        }
        case "NO_SHOW": { await markNoShow(booking.id); setBookings((prev) => prev.map((b) => b.id === booking.id ? { ...b, status: "NO-SHOW", is_no_show: true } : b)); showToast(`🚫 Marked as no-show`); setSelected(null); break; }
        case "LOCK": { await lockBooking(booking.id); setBookings((prev) => prev.map((b) => b.id === booking.id ? { ...b, is_locked: true } : b)); showToast(`🔒 Booking locked`); break; }
        case "UNLOCK": { await unlockBooking(booking.id); setBookings((prev) => prev.map((b) => b.id === booking.id ? { ...b, is_locked: false } : b)); showToast(`🔓 Booking unlocked`); break; }
        case "UNASSIGN": { await unassignRoom(booking.id); setBookings((prev) => prev.map((b) => b.id === booking.id ? { ...b, room_id: null, roomNumber: null } : b)); showToast(`🚪 Room unassigned`); setSelected(null); break; }
        case "CANCEL": { await updateBookingStatus(booking.id, "CANCELLED", booking.notes); setBookings((prev) => prev.map((b) => b.id === booking.id ? { ...b, status: "CANCELLED" } : b)); showToast(`🚫 Booking cancelled`); setSelected(null); break; }
        case "MAGIC_LINK": { const link = await sendMagicLink(booking.id); await navigator.clipboard.writeText(link); showToast(`✨ Magic link copied!`); break; }
        case "RELEASE_HOLD": { await releaseHold(booking.id); setBookings((prev) => prev.map((b) => b.id === booking.id ? { ...b, status: "CONFIRMED" } : b)); showToast(`✅ ${guestNameOf(booking)} restored`); setHoldsPanelOpen(false); break; }
        case "UNBLOCK": {
          const blockId = booking.id;
          setDeletedIds((prev) => { const next = new Set(prev); next.add(blockId); return next; });
          setBookings((prev) => prev.filter((b) => b.id !== blockId));
          setSelected(null); setCalendarVersion((v) => v + 1); setActionRunning(false); setPendingAction(null);
          showToast(`🔓 Room ${roomNumberOf(booking)} unblocked`);
          updateBookingStatus(blockId, "CANCELLED", booking.notes).catch((e) => { console.error("[UNBLOCK] DB update failed:", e); });
          return;
        }
      }
      await loadFromDb();
    } catch (err: any) { console.error("[runPendingAction]", err); showToast(`⚠ ${err?.message || "Action failed"}`); }
    finally { setActionRunning(false); setPendingAction(null); }
  };

  const handleSaveGuest = async (b: any, updatedGuest: Guest) => {
    try {
      const guestId = b?.primaryGuest?.id ?? b?.guest?.id ?? b?.primary_guest_id;
      if (!guestId) { showToast("⚠ Guest ID not found"); return; }
      await updateGuest(guestId, updatedGuest);
      showToast("👤 Guest info saved");
      setGuestPanelFor(null);
      await loadFromDb();
    } catch (err: any) { showToast(`⚠ ${err?.message || "Failed to save guest"}`); }
  };

  const handleSaveCompany = async (details: CompanyDetails) => {
    if (!companyModalFor) return;
    const b = companyModalFor;
    try {
      const guestId = b?.primaryGuest?.id ?? b?.guest?.id ?? b?.primary_guest_id;
      if (!guestId) { showToast("⚠ Guest ID not found"); return; }
      await updateGuest(guestId, {
        companyName: details.companyName, companyGst: details.companyGst,
        companyEmail: details.companyEmail, companyPhone: details.companyPhone,
        companyAddress: details.companyAddress,
      });
      const notesStr = b.notes || "";
      const cleanNotes = notesStr.replace(/·?\s*Company:\s*[^·]+/g, "").replace(/^·\s*|\s*·$/g, "").trim();
      const companyPart = `Company: ${details.companyName}, ${details.companyGst}`;
      const newNotes = cleanNotes ? `${cleanNotes} · ${companyPart}` : companyPart;
      await updateBookingNotes(b.id, newNotes);
      showToast("🏢 Company details saved");
      setCompanyModalFor(null); setCalendarVersion((v) => v + 1);
      await loadFromDb();
    } catch (err: any) { showToast(`⚠ ${err?.message || "Failed to save company"}`); }
  };

  const handleSaveNotes = async (booking: any) => {
    try {
      const originalNotes = booking.notes || "";
      const addonMatch = originalNotes.match(/ADDONS_JSON:(\[[^\]]*\])/);
      const addonPart = addonMatch ? `ADDONS_JSON:${addonMatch[1]}` : "";
      const userNote = notesDraft.trim();
      let newNotes = userNote;
      if (addonPart) newNotes = userNote ? `${userNote} · ${addonPart}` : addonPart;
      await updateBookingNotes(booking.id, newNotes);
      showToast("📝 Notes saved");
      setNotesModalFor(null); setNotesDraft(""); setCalendarVersion((v) => v + 1);
      await loadFromDb();
    } catch (err: any) { showToast(`⚠ ${err.message || "Failed to save notes"}`); }
  };

  const handleDeleteNotes = async (booking: any) => {
    try {
      const originalNotes = booking.notes || "";
      const addonMatch = originalNotes.match(/ADDONS_JSON:(\[[^\]]*\])/);
      const addonPart = addonMatch ? `ADDONS_JSON:${addonMatch[1]}` : "";
      await updateBookingNotes(booking.id, addonPart);
      showToast("🗑 Notes deleted");
      setDeleteNotesConfirm(null); setCalendarVersion((v) => v + 1);
      await loadFromDb();
    } catch (err: any) { showToast(`⚠ ${err.message || "Failed to delete notes"}`); }
  };

  const handleSaveDateEdit = async () => {
    if (!dateEditFor) return;
    if (!dateEditValue) { alert("Please select a date"); return; }
    try {
      const data: any = {};
      if (dateEditFor.type === "checkin") data.checkIn = dateEditValue;
      else data.checkOut = dateEditValue;
      await modifyReservation(dateEditFor.booking.id, data);
      setCalendarVersion((v) => v + 1);
      setDateEditFor(null); setDateEditValue("");
      showToast(`✅ Date updated`);
      loadFromDb();
    } catch (err: any) { showToast(`⚠ ${err.message || "Failed to update date"}`); }
  };

  const handleCellClick = (roomNumber: string, date: Date) => {
    const blocked = getBlockedBooking(roomNumber, date);
    if (blocked) {
      askAction({ type: "UNBLOCK", booking: blocked, title: "Unblock room?", message: `Unblock Room ${roomNumber}? Reason: "${blocked.notes || "no reason"}".`, confirmLabel: "Yes, Unblock", confirmColor: "blue" });
      return;
    }
    setCreatePrefill({ roomNumber, checkIn: fmt(date), checkOut: fmt(new Date(date.getTime() + 86400000)) });
    setCreateOpen(true);
  };

  const handleCellContextMenu = (e: React.MouseEvent, roomNumber: string, date: Date) => {
    e.preventDefault();
    setCellContextMenu({ x: e.clientX, y: e.clientY, roomNumber, date });
  };

  const handleCreateSubmit = async (data: ReservationFormData) => {
    if (!isRoomAvailableForDates(bookings, data.roomNumber, data.checkIn, data.checkOut)) { showToast(`⚠ Room ${data.roomNumber} is already booked for those dates`); return; }
    askAction({
      type: "CREATE_RESERVATION",
      booking: { id: "", primaryGuest: data.primaryGuest, roomNumber: data.roomNumber, checkIn: data.checkIn, checkOut: data.checkOut, amount: data.amount, tax: data.tax, adults: data.adults, children: data.children, infants: data.infants, notes: data.notes, status: "CONFIRMED", source: data.source, ratePlan: data.ratePlan },
      title: "Create reservation?",
      message: `Create reservation for "${data.primaryGuest.name}" in Room ${data.roomNumber}?`,
      confirmLabel: "Yes, Create Reservation", confirmColor: "green",
      onConfirm: async () => {
        try {
          await createReservation({
            roomNumber: data.roomNumber, checkIn: data.checkIn, checkOut: data.checkOut,
            ratePlan: data.ratePlan, source: data.source.toLowerCase().replace(/\s+/g, ""),
            primaryGuest: data.primaryGuest, adults: data.adults, children: data.children,
            infants: data.infants, amount: data.amount, tax: data.tax, notes: data.notes,
            hotelId: hotelId || undefined,
          });
          showToast("✅ Reservation created");
          setCreateOpen(false); setCreatePrefill(null); setCalendarVersion((v) => v + 1);
          await loadFromDb();
        } catch (err: any) { showToast(`⚠ ${err.message || "Failed to create reservation"}`); }
      },
    });
  };

  const handleBlockRoom = async (data: { roomNumber: string; checkIn: string; checkOut: string; reason: string }) => {
    try {
      await blockRoom({ ...data, hotelId: hotelId || undefined });
      showToast(`🔒 Room ${data.roomNumber} blocked`);
      setCreateOpen(false); setCreatePrefill(null); setBlockRoomOpen(false);
      setCalendarVersion((v) => v + 1);
      await loadFromDb();
    } catch (err: any) { showToast(`⚠ ${err?.message || "Failed to block room"}`); }
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
    const amount = Number(b.amount) || 0; const tax = Number(b.tax) || 0; const paid = Number(b.paid) || 0;
    const total = amount + tax; const balance = total - paid;
    const hotelName = hotelSettings?.name || "Your Hotel";
    const hotelLogo = hotelSettings?.logo_url || "";
    const hotelAddress = hotelSettings?.address || "";
    const hotelGst = hotelSettings?.gst_number || "";
    const hotelPhone = hotelSettings?.contact_phone || "";
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Registration Card</title><style>body{font-family:Arial;padding:20px;}.h{display:flex;justify-content:space-between;border-bottom:2px solid #0d9488;padding-bottom:15px;}</style></head><body><div style="max-width:800px;margin:auto;border:2px solid #0d9488;padding:25px;"><div class="h"><div>${hotelLogo ? `<img src="${hotelLogo}" style="height:50px;"/>` : ""}<h1 style="color:#0d9488;">${hotelName}</h1>${hotelAddress ? `<p>${hotelAddress}</p>` : ""}${hotelPhone ? `<p>📞 ${hotelPhone}</p>` : ""}${hotelGst ? `<p>GSTIN: ${hotelGst}</p>` : ""}</div></div><h2>Guest Registration Card</h2><p><strong>Guest:</strong> ${guest.name || "—"}</p><p><strong>Phone:</strong> ${guest.phone || "—"}</p><p><strong>Room:</strong> ${b.roomNumber || "—"} (${b.roomType || "—"})</p><p><strong>Check-In:</strong> ${b.checkIn || "—"}</p><p><strong>Check-Out:</strong> ${b.checkOut || "—"}</p><p><strong>Adults:</strong> ${b.adults || 1}, <strong>Children:</strong> ${b.children || 0}</p><h3>Payment Summary</h3><p>Room: ₹${amount.toFixed(2)} | Tax: ₹${tax.toFixed(2)} | Total: ₹${total.toFixed(2)} | Paid: ₹${paid.toFixed(2)} | Balance: ₹${balance.toFixed(2)}</p></div></body></html>`);
    printWindow.document.close(); printWindow.focus(); setTimeout(() => printWindow.print(), 500);
  };

  const printCForm = (b: any, passportData: string) => {
    const printWindow = window.open('', '_blank', 'width=900,height=900');
    if (!printWindow) { showToast("⚠ Please allow pop-ups"); return; }
    const guest = b.primaryGuest || b.guest || {};
    const dataParts = passportData.split(",").map(s => s.trim());
    const passportNo = dataParts[0] || "—"; const visaNo = dataParts[1] || "—"; const nationality = dataParts[2] || "—";
    const hotelName = hotelSettings?.name || "Your Hotel";
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Form C</title><style>body{font-family:'Times New Roman',serif;padding:20px;}.container{max-width:850px;margin:auto;border:2px solid #000;padding:30px;}</style></head><body><div class="container"><h1 style="text-align:center;">FORM C</h1><h2 style="text-align:center;">Arrival Report</h2><p><strong>Hotel:</strong> ${hotelName}</p><p><strong>Name:</strong> ${guest.name || "—"}</p><p><strong>Nationality:</strong> ${nationality}</p><p><strong>Passport No:</strong> ${passportNo}</p><p><strong>Visa No:</strong> ${visaNo}</p></div></body></html>`);
    printWindow.document.close(); printWindow.focus(); setTimeout(() => printWindow.print(), 500);
  };

  const downloadVoucher = (b: any) => {
    const guest = b.primaryGuest || b.guest || {};
    const amount = Number(b.amount) || 0; const tax = Number(b.tax) || 0; const paid = Number(b.paid) || 0;
    const total = amount + tax; const balance = total - paid;
    const hotelName = hotelSettings?.name || "Your Hotel";
    const voucherHtml = `<!DOCTYPE html><html><head><title>Voucher</title></head><body><div style="font-family:Arial;padding:40px;"><h1>${hotelName}</h1><h3>Booking Confirmation Voucher</h3><p><strong>Ref:</strong> ${b.booking_ref || b.id}</p><p><strong>Guest:</strong> ${guest.name || "—"}</p><p><strong>Room:</strong> ${b.roomNumber || "—"}</p><p><strong>Total:</strong> ₹${total.toFixed(2)}</p><p><strong>Paid:</strong> ₹${paid.toFixed(2)}</p><p><strong>Balance:</strong> ₹${balance.toFixed(2)}</p></div></body></html>`;
    const blob = new Blob([voucherHtml], { type: 'text/html' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `Voucher_${b.booking_ref || b.id}.html`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleAddAddonSubmit = async () => {
    if (!addonModal) return;
    const { booking: b, addonName, addonPrice, serviceDate, taxPercent } = addonModal;
    if (!addonName.trim() || !addonPrice.trim()) { showToast("⚠ Please enter addon name and price"); return; }
    const priceNum = parseFloat(addonPrice) || 0; const taxNum = parseFloat(taxPercent) || 0;
    const existingMatch = (b.notes || "").match(/ADDONS_JSON:(\[[^\]]*\])/);
    let existingAddons: any[] = [];
    if (existingMatch) { try { existingAddons = JSON.parse(existingMatch[1]); } catch { existingAddons = []; } }
    const newAddon = { id: `addon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, name: addonName.trim(), price: priceNum, tax: taxNum, date: serviceDate };
    existingAddons.push(newAddon);
    const cleanNotes = cleanNotesForDisplay(b.notes || "");
    const addonsJson = `ADDONS_JSON:${JSON.stringify(existingAddons)}`;
    const newNotes = cleanNotes ? `${cleanNotes} · ${addonsJson}` : addonsJson;
    await updateBookingNotes(b.id, newNotes);
    showToast(`➕ ${addonName} added — ₹${(priceNum * (1 + taxNum / 100)).toFixed(2)}`);
    setAddonModal(null); setCalendarVersion((v) => v + 1); await loadFromDb();
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
    showToast("🗑 Addon deleted"); setCalendarVersion((v) => v + 1); await loadFromDb();
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
          const addonList = JSON.parse(n.replace("ADDONS_JSON:", ""));
          addonList.forEach((a: any) => { entries.push({ time: a.date || "—", description: `Addon: ${a.name} — ₹${(Number(a.price) || 0).toFixed(2)}`, type: "ADDON" }); });
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

  // ═══════════════════════════════════════════════
  // 🆕 DYNAMIC INVOICE — Pulls from Folio Setup
  // ═══════════════════════════════════════════════
  const generateBillHtml = (b: any, type: "normal" | "company", companyName?: string, companyGst?: string, companyEmail?: string, companyPhone?: string, companyAddress?: string) => {
    const guest = b.primaryGuest || b.guest || {};
    const amount = Number(b.amount) || 0;
    const tax = Number(b.tax) || 0;
    const paid = Number(b.paid) || 0;
    const notesStr = b.notes || "";
    const addonMatch = notesStr.match(/ADDONS_JSON:(\[[^\]]*\])/);
    let addons: any[] = [];
    if (addonMatch) { try { addons = JSON.parse(addonMatch[1]); } catch { addons = []; } }
    const addonsSubtotal = addons.reduce((s, a) => s + (Number(a.price) || 0), 0);
    const addonsTax = addons.reduce((s, a) => s + ((Number(a.price) || 0) * (Number(a.tax) || 0)) / 100, 0);
    const addonsTotal = addonsSubtotal + addonsTax;
    const totalAmount = amount + tax + addonsTotal;
    const balance = totalAmount - paid;
    const isCompany = type === "company";

    // 🆕 ডাইনামিক হোটেল সেটিংস
    const hotelName = hotelSettings?.name || "Hotel Name";
    const hotelLogo = hotelSettings?.logo_url || "";
    const hotelGst = hotelSettings?.gst_number || "";
    const hotelAddress = hotelSettings?.address || "";
    const hotelPhone = hotelSettings?.contact_phone || "";
    const hotelTerms = hotelSettings?.terms_conditions || "";
    const invoicePrefix = hotelSettings?.invoice_prefix || "INV-";

    const invoiceNo = isCompany
      ? `CINV-${(b.booking_ref || b.id || "").slice(-8).toUpperCase()}`
      : `${invoicePrefix}${(b.booking_ref || b.id || "").slice(-8).toUpperCase()}`;
    const accentColor = isCompany ? "#1e40af" : "#0d9488";

    let itemRows = `<tr><td>Room Charges — ${b.roomType || "Room"}</td><td style="text-align:center;">1</td><td style="text-align:right;">${amount.toFixed(2)}</td></tr>`;
    addons.forEach((a: any) => {
      const lineTotal = (Number(a.price) || 0) * (1 + (Number(a.tax) || 0) / 100);
      itemRows += `<tr><td>${a.name}</td><td style="text-align:center;">1</td><td style="text-align:right;">${lineTotal.toFixed(2)}</td></tr>`;
    });

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Tax Invoice</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Helvetica Neue',Arial,sans-serif;padding:25px;color:#1e293b;background:#fff;}
  .invoice{max-width:820px;margin:0 auto;border:1px solid #cbd5e1;border-radius:12px;padding:36px;box-shadow:0 4px 24px rgba(0,0,0,0.04);}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${accentColor};padding-bottom:22px;margin-bottom:26px;}
  .brand{display:flex;gap:16px;align-items:flex-start;}
  .brand img{height:60px;object-fit:contain;}
  .brand h1{color:${accentColor};font-size:26px;font-weight:800;margin-bottom:4px;}
  .brand p{font-size:12px;color:#64748b;line-height:1.5;}
  .brand .gst{font-weight:700;color:#0f172a;font-size:12px;margin-top:4px;}
  .inv-meta{text-align:right;}
  .inv-meta .title{font-size:22px;font-weight:800;color:${accentColor};text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;}
  .inv-meta .meta-row{font-size:12px;color:#475569;margin-bottom:3px;}
  .inv-meta .meta-row strong{color:#0f172a;}
  .billto-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:26px;}
  .info-box{background:${isCompany ? "#eff6ff" : "#f8fafc"};border:1px solid ${isCompany ? "#bfdbfe" : "#e2e8f0"};border-radius:10px;padding:16px;}
  .info-box h3{font-size:10px;text-transform:uppercase;color:${accentColor};margin-bottom:8px;font-weight:800;letter-spacing:1.5px;}
  .info-box .name{font-size:16px;font-weight:800;color:#0f172a;margin-bottom:4px;}
  .info-box .line{font-size:12px;color:#475569;line-height:1.6;}
  .info-box .line strong{color:#0f172a;}
  table.items{width:100%;border-collapse:collapse;margin-bottom:20px;}
  table.items th{padding:12px 16px;text-align:left;font-size:11px;background:${accentColor};color:#fff;font-weight:700;text-transform:uppercase;letter-spacing:1px;}
  table.items td{padding:12px 16px;font-size:13px;border-bottom:1px solid #e2e8f0;color:#334155;}
  table.items th:last-child, table.items td:last-child{text-align:right;}
  .totals-wrap{display:flex;justify-content:flex-end;margin-bottom:26px;}
  .totals{width:340px;border-collapse:collapse;}
  .totals td{padding:10px 16px;font-size:13px;border-bottom:1px solid #f1f5f9;text-align:right;color:#475569;}
  .totals td:first-child{text-align:left;}
  .totals tr.grand td{font-weight:800;background:${isCompany ? "#eff6ff" : "#f0fdfa"};color:${accentColor};font-size:15px;border-bottom:none;}
  .totals tr.paid td{font-weight:600;color:#059669;}
  .totals tr.balance td{font-weight:800;background:#fef2f2;color:#b91c1c;font-size:14px;}
  .terms{margin-top:30px;border-top:1px solid #e2e8f0;padding-top:16px;}
  .terms h4{font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;font-weight:800;margin-bottom:8px;}
  .terms p{font-size:11px;color:#64748b;line-height:1.7;white-space:pre-wrap;}
  .footer{text-align:center;margin-top:30px;padding-top:16px;border-top:1px solid #f1f5f9;}
  .footer p{font-size:11px;color:#94a3b8;}
</style>
</head>
<body>
<div class="invoice">
  <div class="header">
    <div class="brand">
      ${hotelLogo ? `<img src="${hotelLogo}" alt="Logo" />` : ""}
      <div>
        <h1>${hotelName}</h1>
        ${hotelAddress ? `<p>${hotelAddress}</p>` : ""}
        ${hotelPhone ? `<p>📞 ${hotelPhone}</p>` : ""}
        ${hotelGst ? `<p class="gst">GSTIN: ${hotelGst}</p>` : ""}
      </div>
    </div>
    <div class="inv-meta">
      <div class="title">Tax Invoice</div>
      <div class="meta-row"><strong>No:</strong> ${invoiceNo}</div>
      <div class="meta-row"><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
    </div>
  </div>
  <div class="billto-grid">
    ${isCompany ? `
      <div class="info-box">
        <h3>Bill To (Company)</h3>
        <div class="name">${companyName || "—"}</div>
        ${companyAddress ? `<div class="line">${companyAddress}</div>` : ""}
        ${companyEmail ? `<div class="line">✉ ${companyEmail}</div>` : ""}
        ${companyPhone ? `<div class="line">📞 ${companyPhone}</div>` : ""}
        ${companyGst ? `<div class="line"><strong>GSTIN: ${companyGst}</strong></div>` : ""}
      </div>
      <div class="info-box">
        <h3>Guest & Stay</h3>
        <div class="name">${guest.name || "Guest"}</div>
        <div class="line"><strong>Room:</strong> ${b.roomNumber || "—"} (${b.roomType || "—"})</div>
        <div class="line"><strong>Check-in:</strong> ${b.checkIn || "—"}</div>
        <div class="line"><strong>Check-out:</strong> ${b.checkOut || "—"}</div>
      </div>
    ` : `
      <div class="info-box">
        <h3>Bill To</h3>
        <div class="name">${guest.name || "Guest"}</div>
        ${guest.address ? `<div class="line">${guest.address}</div>` : ""}
        ${guest.phone ? `<div class="line">📞 ${guest.phone}</div>` : ""}
        ${guest.email ? `<div class="line">✉ ${guest.email}</div>` : ""}
      </div>
      <div class="info-box">
        <h3>Stay Details</h3>
        <div class="line"><strong>Room:</strong> ${b.roomNumber || "—"} (${b.roomType || "—"})</div>
        <div class="line"><strong>Check-in:</strong> ${b.checkIn || "—"}</div>
        <div class="line"><strong>Check-out:</strong> ${b.checkOut || "—"}</div>
      </div>
    `}
  </div>
  <table class="items">
    <thead>
      <tr>
        <th style="width:60%;">Description</th>
        <th style="width:10%;text-align:center;">Qty</th>
        <th style="width:30%;">Amount (Rs.)</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div class="totals-wrap">
    <table class="totals">
      <tr><td>Sub Total</td><td>₹${(amount + addonsSubtotal).toFixed(2)}</td></tr>
      ${tax + addonsTax > 0 ? `<tr><td>CGST</td><td>₹${((tax + addonsTax) / 2).toFixed(2)}</td></tr><tr><td>SGST</td><td>₹${((tax + addonsTax) / 2).toFixed(2)}</td></tr>` : ""}
      <tr class="grand"><td>Grand Total</td><td>₹${totalAmount.toFixed(2)}</td></tr>
      <tr class="paid"><td>Payment Made</td><td>₹${paid.toFixed(2)}</td></tr>
      <tr class="balance"><td>Balance Due</td><td>₹${balance.toFixed(2)}</td></tr>
    </table>
  </div>
  ${hotelTerms ? `<div class="terms"><h4>Terms & Conditions</h4><p>${hotelTerms}</p></div>` : ""}
  <div class="footer"><p>Thank you for staying with us! · Generated by Staynexa PMS</p></div>
</div>
</body>
</html>`;
  };

  const logTypeColors: Record<string, string> = {
    BOOKING: "bg-blue-100 text-blue-700 border-blue-200", CHECKIN: "bg-emerald-100 text-emerald-700 border-emerald-200",
    CHECKOUT: "bg-rose-100 text-rose-700 border-rose-200", ADDON: "bg-amber-100 text-amber-700 border-amber-200",
    COUPON: "bg-purple-100 text-purple-700 border-purple-200", COMPANY: "bg-teal-100 text-teal-700 border-teal-200",
    BAGGAGE: "bg-slate-100 text-slate-700 border-slate-200", PASSPORT: "bg-indigo-100 text-indigo-700 border-indigo-200",
    TAX_EXEMPT: "bg-orange-100 text-orange-700 border-orange-200", NOTE: "bg-gray-100 text-gray-700 border-gray-200",
  };

  const handleFolioAction = async (label: string, b: any) => {
    if (!b) return;
    switch (label) {
      case "Print Registration Card": printRegistrationCard(b); break;
      case "Print C Form": {
        const notesStr = b.notes || "";
        const passportMatch = notesStr.match(/Passport:\s*([^·]+)/);
        if (passportMatch) { printCForm(b, passportMatch[1].trim()); }
        else {
          setFolioFor(null);
          setGenericAction({
            title: "Enter Passport & Visa Details", message: "Please enter Passport No, Visa No, and Nationality separated by commas.",
            inputPlaceholder: "e.g., US1234567, V123456, USA",
            onConfirm: async (val) => {
              if (!val.trim()) { showToast("⚠ Please enter the details"); return; }
              const newNotes = `${b.notes ? b.notes + " · " : ""}Passport: ${val}`;
              await updateBookingNotes(b.id, newNotes);
              showToast("🛂 Passport details saved");
              setGenericAction(null); setGenericInputValue("");
              setCalendarVersion((v) => v + 1); await loadFromDb(); printCForm(b, val);
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
          setBillPreview({ booking: b, type: "normal", companyName: parts[0] || "", companyGst: parts[1] || "" });
        } else { setBillPreview({ booking: b, type: "normal" }); }
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
          let parsedName = guestCompanyName; let parsedGst = guestCompanyGst;
          if (!parsedName && companyMatch2) {
            const parts = companyMatch2[1].split(",").map((s: string) => s.trim());
            parsedName = parts[0] || ""; parsedGst = parts[1] || "";
          }
          setFolioFor(null);
          setBillPreview({ booking: b, type: "company", companyName: parsedName, companyGst: parsedGst, companyEmail: guestCompanyEmail, companyPhone: guestCompanyPhone, companyAddress: guestCompanyAddress });
        } else { setFolioFor(null); setCompanyModalFor(b); }
        break;
      }
      case "Download Booking Voucher": downloadVoucher(b); showToast("📥 Voucher downloaded"); break;
      case "Email Folio Details": {
        const email = b.primaryGuest?.email || b.guest?.email || '';
        if (!email) { showToast("⚠ No email address found"); break; }
        const sub = encodeURIComponent(`Folio - ${b.booking_ref || b.id}`);
        const bodyText = `Dear ${guestNameOf(b)},\n\nRoom: ${roomNumberOf(b)}`;
        window.open(`mailto:${email}?subject=${sub}&body=${encodeURIComponent(bodyText)}`, '_blank');
        break;
      }
      case "Folio Log": setFolioFor(null); setFolioLogFor(b); break;
      case "Edit Rate Plan": setFolioFor(null); setModifyFor(b); break;
      case "Apply Coupon / Discount":
        setFolioFor(null);
        setGenericAction({
          title: "Apply Coupon / Discount", message: "Enter coupon code or discount:", inputPlaceholder: "e.g., SUMMER20",
          onConfirm: async (val) => {
            if (!val.trim()) return;
            await updateBookingNotes(b.id, `${b.notes ? b.notes + " · " : ""}Coupon Applied: ${val}`);
            showToast(`🏷️ Coupon applied`);
            setGenericAction(null); setGenericInputValue("");
            setCalendarVersion((v) => v + 1); await loadFromDb();
          }
        });
        break;
      case "Add Company Details": setFolioFor(null); setCompanyModalFor(b); break;
      case "Tax Exempt Status":
        setFolioFor(null);
        setGenericAction({
          title: "Tax Exempt Status", message: "Enter reason:", inputPlaceholder: "Reason",
          onConfirm: async (val) => {
            if (!val.trim()) return;
            await updateBookingNotes(b.id, `${b.notes ? b.notes + " · " : ""}Tax Exempt: ${val}`);
            showToast(`⚖️ Tax exemption noted`);
            setGenericAction(null); setGenericInputValue("");
            setCalendarVersion((v) => v + 1); await loadFromDb();
          }
        });
        break;
      case "Add Hotel Addons":
        setFolioFor(null);
        setAddonModal({ booking: b, addonName: "", addonPrice: "", serviceDate: new Date().toISOString().split("T")[0], taxPercent: "0", amountType: "Debit (+ charge)" });
        break;
      case "Assign Room":
      case "Move Room": setFolioFor(null); setMoveRoomTarget(b); setMoveRoomNewRoom(""); break;
      case "Unassign Room":
        setFolioFor(null);
        askAction({ type: "UNASSIGN", booking: b, title: "Unassign room?", message: `Unassign Room ${roomNumberOf(b)}?`, confirmLabel: "Yes, Unassign Room", confirmColor: "amber" });
        break;
      case "Modify Checkout": setFolioFor(null); setDateEditFor({ booking: b, type: "checkout" }); setDateEditValue(checkOutOf(b)); break;
      case "Add to Group Booking": setFolioFor(null); setGroupBookingOpen(true); break;
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
          title: "Scanty Baggage", message: "Enter baggage details:", inputPlaceholder: "Baggage details",
          onConfirm: async (val) => {
            if (!val.trim()) return;
            await updateBookingNotes(b.id, `${b.notes ? b.notes + " · " : ""}Baggage: ${val}`);
            showToast(`🧳 Baggage noted`);
            setGenericAction(null); setGenericInputValue("");
            setCalendarVersion((v) => v + 1); await loadFromDb();
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
      originRoom: roomNumberOf(b), originCheckIn: checkInOf(b), originCheckOut: checkOutOf(b), hasMoved: false,
    };
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const d = dragRef.current; if (!d) return;
      const point = "touches" in e ? e.touches[0] : e;
      const dx = point.clientX - d.startX; const dy = point.clientY - d.startY;
      if (!d.hasMoved && Math.hypot(dx, dy) > DRAG_THRESHOLD) d.hasMoved = true;
      if (d.hasMoved) {
        const daysOffset = Math.round(dx / CELL_WIDTH); const roomsOffset = Math.round(dy / ROW_HEIGHT);
        const roomIdx = filteredRooms.findIndex((r) => r.room_number === d.originRoom);
        const newRoomIdx = Math.max(0, Math.min(filteredRooms.length - 1, roomIdx + roomsOffset));
        const nights = daysBetween(d.originCheckIn, d.originCheckOut);
        const newCheckIn = addDays(d.originCheckIn, daysOffset); const newCheckOut = addDays(newCheckIn, nights);
        setDragVisual({ bookingId: d.bookingId, currentX: point.clientX, currentY: point.clientY, previewRoom: filteredRooms[newRoomIdx]?.room_number || d.originRoom, previewCheckIn: newCheckIn, previewCheckOut: newCheckOut });
      }
    };
    const handleUp = async () => {
      const d = dragRef.current; if (!d) return;
      if (d.hasMoved && dragVisual) {
        const changed = dragVisual.previewRoom !== d.originRoom || dragVisual.previewCheckIn !== d.originCheckIn;
        if (changed) {
          if (!isRoomAvailableForDates(bookings, dragVisual.previewRoom, dragVisual.previewCheckIn, dragVisual.previewCheckOut, d.bookingId)) {
            showToast(`⚠ Room ${dragVisual.previewRoom} is not available`); dragRef.current = null; setDragVisual(null); return;
          }
          const b = bookings.find((bb) => bb.id === d.bookingId);
          if (b) {
            const capturedPreview = dragVisual;
            askAction({
              type: "DRAG_MOVE", booking: b, title: "Move reservation?",
              message: `Move "${guestNameOf(b)}" to Room ${capturedPreview.previewRoom}?`,
              confirmLabel: "Yes, Move", confirmColor: "green",
              onConfirm: async () => {
                await updateBookingRoomAndDates(d.bookingId, capturedPreview.previewRoom, capturedPreview.previewCheckIn, capturedPreview.previewCheckOut, hotelId || undefined);
                showToast(`📅 Moved to Room ${capturedPreview.previewRoom}`);
                setCalendarVersion((v) => v + 1); await loadFromDb();
              },
            });
          }
        }
      }
      if (!d.hasMoved) { const booking = bookings.find((b) => b.id === d.bookingId); if (booking) setSelected(booking); }
      dragRef.current = null; setDragVisual(null);
    };
    window.addEventListener("mousemove", handleMove); window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleMove); window.addEventListener("touchend", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove); window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleMove); window.removeEventListener("touchend", handleUp);
    };
  }, [dragVisual, bookings, loadFromDb, filteredRooms, hotelId]);

  const todayStr = todayISO();
  const confirmColorMap: Record<string, { bg: string; iconBg: string; icon: string }> = {
    red: { bg: "bg-rose-600", iconBg: "bg-rose-100", icon: "⚠" }, green: { bg: "bg-emerald-600", iconBg: "bg-emerald-100", icon: "✓" },
    amber: { bg: "bg-amber-500", iconBg: "bg-amber-100", icon: "🔒" }, purple: { bg: "bg-purple-600", iconBg: "bg-purple-100", icon: "⏸" },
    blue: { bg: "bg-blue-600", iconBg: "bg-blue-100", icon: "✨" }, gray: { bg: "bg-slate-700", iconBg: "bg-slate-100", icon: "ℹ" },
  };

  return (
    <div className="flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-50 min-h-screen">
      {/* HERO HEADER */}
      <div className="px-6 lg:px-8 pt-6 pb-4">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 shadow-xl shadow-slate-900/10">
          <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-2xl shadow-lg shadow-teal-500/30">📅</div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl font-bold text-white tracking-tight">Calendar</h1>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[9px] font-bold uppercase tracking-widest rounded-full border border-emerald-500/30">
                    <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />Live
                  </span>
                </div>
                <p className="text-sm text-slate-400">
                  <span className="text-emerald-400 font-semibold">{calendarStats.occupied} occupied</span>
                  <span className="mx-1.5">·</span>
                  <span className="text-teal-400 font-semibold">{calendarStats.available} available</span>
                  <span className="mx-1.5">·</span>
                  <span>{calendarStats.occupancyRate.toFixed(0)}% occupancy</span>
                  {calendarStats.blockedToday > 0 && (<><span className="mx-1.5">·</span><span className="text-slate-400">{calendarStats.blockedToday} blocked</span></>)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="px-4 py-2 bg-white/5 backdrop-blur-md rounded-xl border border-white/10"><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Arrivals</p><p className="text-lg font-bold text-emerald-400">{calendarStats.arrivals}</p></div>
              <div className="px-4 py-2 bg-white/5 backdrop-blur-md rounded-xl border border-white/10"><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Departures</p><p className="text-lg font-bold text-rose-400">{calendarStats.departures}</p></div>
              <div className="px-4 py-2 bg-white/5 backdrop-blur-md rounded-xl border border-white/10"><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Occupied</p><p className="text-lg font-bold text-teal-400">{calendarStats.occupied}</p></div>
              <div className="px-4 py-2 bg-gradient-to-br from-emerald-500/20 to-teal-500/10 backdrop-blur-md rounded-xl border border-emerald-400/30 shadow-lg shadow-emerald-500/10"><p className="text-[9px] font-bold text-emerald-300 uppercase tracking-widest">Available</p><p className="text-lg font-bold text-emerald-300">{calendarStats.available}</p></div>
            </div>
          </div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="px-6 lg:px-8 pb-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex flex-wrap items-center gap-3">
          <button onClick={() => setStartDate(todayISO())} className="px-4 py-2 text-sm font-semibold bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition shadow-sm">Today</button>
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl px-1 py-1">
            <button onClick={() => shiftDates(-1)} className="w-8 h-8 rounded-lg hover:bg-white text-slate-600 transition flex items-center justify-center"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg></button>
            <button onClick={() => setDatePickerOpen(true)} className="px-3 py-1.5 rounded-lg hover:bg-white transition flex items-center gap-2 group">
              <span className="text-sm font-semibold text-slate-700 whitespace-nowrap group-hover:text-teal-600 transition">{prettyDate(startDate)} {viewMode !== "day" && dates.length > 1 && `- ${prettyDate(addDays(startDate, dates.length - 1))}`}</span>
            </button>
            <button onClick={() => shiftDates(1)} className="w-8 h-8 rounded-lg hover:bg-white text-slate-600 transition flex items-center justify-center"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg></button>
          </div>
          <button onClick={() => setHoldsPanelOpen(true)} className="relative px-3 py-2 border-2 border-purple-300 bg-purple-50 text-purple-700 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-purple-100 transition">
            ⏸ Holds
            {(holdBookings.length + unassignedBookings.length) > 0 && (<span className="bg-purple-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{holdBookings.length + unassignedBookings.length}</span>)}
          </button>
          <div className="flex items-center gap-0.5 bg-slate-100 rounded-xl p-1">
            {(["day", "week", "15d", "month"] as ViewMode[]).map((m) => (
              <button key={m} onClick={() => setViewMode(m)} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${viewMode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}>{VIEW_MODE_LABEL[m]}</button>
            ))}
          </div>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className={`px-3 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${sidebarOpen ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" /></svg>Filters
          </button>
          <button onClick={() => { if (rooms.length > 0) { setCreatePrefill({ roomNumber: rooms[0].room_number, checkIn: todayISO(), checkOut: addDays(todayISO(), 1) }); setBlockRoomOpen(true); } }} className="px-3 py-2 border-2 border-slate-300 bg-white text-slate-700 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-slate-50 transition">🔒 Block</button>
          <div className="relative ml-auto">
            <button onClick={() => setCreateMenuOpen(!createMenuOpen)} className="px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:from-teal-600 hover:to-emerald-600 transition shadow-lg shadow-teal-500/30">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>Create
            </button>
            {createMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setCreateMenuOpen(false)} />
                <div className="absolute top-full right-0 mt-2 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl min-w-[240px] py-2 overflow-hidden">
                  <button onClick={() => { setCreateMenuOpen(false); if (rooms.length > 0) { setCreatePrefill({ roomNumber: rooms[0].room_number, checkIn: todayISO(), checkOut: addDays(todayISO(), 1) }); setCreateOpen(true); } }} className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 flex items-center gap-3 font-semibold text-slate-700"><span className="text-lg">🚶</span> Walk-in Reservation</button>
                  <button onClick={() => { setCreateMenuOpen(false); setEnquiryOpen(true); }} className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 flex items-center gap-3 font-semibold text-slate-700"><span className="text-lg">📝</span> New Enquiry</button>
                  <button onClick={() => { setCreateMenuOpen(false); if (rooms.length > 0) { setCreatePrefill({ roomNumber: rooms[0].room_number, checkIn: todayISO(), checkOut: addDays(todayISO(), 1) }); setBlockRoomOpen(true); } }} className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 flex items-center gap-3 font-semibold text-slate-700 border-t border-slate-100"><span className="text-lg">🔒</span> Block Room</button>
                  <button onClick={() => { setCreateMenuOpen(false); setGroupBookingOpen(true); }} className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 flex items-center gap-3 font-semibold text-slate-700"><span className="text-lg">👥</span> Group Booking</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* MAIN LAYOUT */}
      <div className="flex-1 px-6 lg:px-8 pb-6 flex gap-4 min-h-0">
        {sidebarOpen && (
          <aside className="w-56 shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden max-h-[calc(100vh-220px)] sticky top-4">
            <div className="px-4 py-3 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Room Types</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">{filteredRooms.length} of {rooms.length} rooms</p>
            </div>
            <div className="p-2 space-y-0.5 overflow-y-auto flex-1">
              <button onClick={() => setRoomTypeFilter("all")} className={`w-full text-left px-3 py-2 rounded-lg text-sm transition flex items-center justify-between ${roomTypeFilter === "all" ? "bg-slate-900 text-white font-semibold" : "text-slate-700 hover:bg-slate-50"}`}>
                <span>All Rooms</span><span className={`text-xs font-bold ${roomTypeFilter === "all" ? "text-slate-300" : "text-slate-400"}`}>{rooms.length}</span>
              </button>
              {roomTypes.map((t) => {
                const count = rooms.filter((r: any) => (r.room_type || "Standard") === t).length;
                const isActive = roomTypeFilter === t;
                return (<button key={t} onClick={() => setRoomTypeFilter(t)} className={`w-full text-left px-3 py-2 rounded-lg text-sm transition flex items-center justify-between ${isActive ? "bg-slate-900 text-white font-semibold" : "text-slate-700 hover:bg-slate-50"}`}><span className="truncate">{t}</span><span className={`text-xs font-bold ml-2 ${isActive ? "text-slate-300" : "text-slate-400"}`}>{count}</span></button>);
              })}
            </div>
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Status Legend</p>
              <div className="space-y-1.5">
                {[{ label: "Confirmed", color: "bg-amber-400" }, { label: "Checked-In", color: "bg-emerald-500" }, { label: "Checked-Out", color: "bg-slate-400" }, { label: "On-Hold", color: "bg-purple-500" }, { label: "Blocked", color: "bg-slate-300" }].map((s) => (
                  <div key={s.label} className="flex items-center gap-2"><div className={`w-2.5 h-2.5 rounded ${s.color}`} /><span className="text-[10px] font-medium text-slate-600">{s.label}</span></div>
                ))}
              </div>
            </div>
          </aside>
        )}

        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" key={`cal-${calendarVersion}`}>
            {loading && (<div className="p-16 text-center"><div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-slate-200 border-t-teal-600 animate-spin" /><p className="text-sm text-slate-500 font-semibold">Loading calendar...</p></div>)}
            {!loading && filteredRooms.length === 0 && (<div className="p-16 text-center text-slate-400"><p className="text-5xl mb-3">🔑</p><p className="font-semibold text-slate-600">No rooms found</p><p className="text-xs mt-1">Try changing the room type filter</p></div>)}
            {!loading && filteredRooms.length > 0 && (
              <div className="overflow-x-auto">
                <div style={{ minWidth: `${140 + dates.length * CELL_WIDTH}px` }}>
                  <div className="flex border-b-2 border-slate-200 bg-gradient-to-b from-slate-50 to-white sticky top-0 z-30">
                    <div className="w-[140px] shrink-0 border-r-2 border-slate-200 py-3 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white sticky left-0 z-40">Room</div>
                    {dates.map((d, i) => {
                      const s = shortFmt(d);
                      const isToday = fmt(d) === todayStr;
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      return (<div key={i} style={{ width: `${CELL_WIDTH}px` }} className={`shrink-0 border-r border-slate-100 py-2.5 text-center transition-colors ${isToday ? "bg-gradient-to-b from-rose-50 to-rose-100/50" : isWeekend ? "bg-slate-50/50" : ""}`}><div className={`text-[10px] font-bold tracking-widest ${isToday ? "text-rose-500" : "text-slate-400"}`}>{s.day}</div><div className={`text-base font-bold mt-0.5 ${isToday ? "text-rose-600" : "text-slate-800"}`}>{s.date}</div><div className={`text-[9px] font-semibold uppercase tracking-wider ${isToday ? "text-rose-400" : "text-slate-400"}`}>{s.month}</div></div>);
                    })}
                  </div>

                  {filteredRooms.map((room) => {
                    const rowBookings = activeBookings.filter((b: any) => roomNumberOf(b) === room.room_number);
                    const hkStatus = room.housekeeping_status || "CLEAN";
                    const hkColor = hkStatus === "DIRTY" ? "bg-rose-500" : hkStatus === "MAINTENANCE" ? "bg-amber-500" : hkStatus === "INSPECTED" ? "bg-sky-500" : "bg-emerald-500";
                    return (
                      <div key={room.id} className="flex border-b border-slate-100 hover:bg-slate-50/40 transition-colors" style={{ height: ROW_HEIGHT }}>
                        <div className="w-[140px] shrink-0 border-r-2 border-slate-100 py-2 px-4 flex flex-col justify-center bg-white sticky left-0 z-20">
                          <div className="flex items-center gap-2"><div className={`w-2.5 h-2.5 rounded-full shrink-0 ${hkColor} ring-2 ring-white shadow-sm`} title={`Housekeeping: ${hkStatus}`} /><div className="text-sm font-bold text-slate-800">{room.room_number}</div></div>
                          <div className="text-[10px] text-slate-400 truncate mt-0.5 pl-4">{room.room_type}</div>
                        </div>
                        <div className="flex flex-1 relative">
                          {dates.map((d, i) => {
                            const blocked = getBlockedBooking(room.room_number, d);
                            const isEmpty = !blocked && !rowBookings.some(b => bookingSpansDate(b, d));
                            const isToday = fmt(d) === todayStr;
                            return (<div key={i} style={{ width: `${CELL_WIDTH}px` }} className={`shrink-0 border-r border-slate-100 relative transition-colors ${isEmpty ? "cursor-pointer hover:bg-teal-50/40" : ""}`} onClick={() => { if (isEmpty) handleCellClick(room.room_number, d); }} onContextMenu={(e) => { if (!isEmpty) return; handleCellContextMenu(e, room.room_number, d); }}>
                              {isToday && <div className="absolute top-0 bottom-0 left-0 w-0.5 bg-rose-400 pointer-events-none z-10" />}
                            </div>);
                          })}

                          {(() => {
                            const blockedBars: React.ReactNode[] = [];
                            const seenBlocks = new Set<string>();
                            rowBookings.filter((b: any) => b.status === "BLOCKED").forEach((blocked: any) => {
                              if (seenBlocks.has(blocked.id)) return;
                              seenBlocks.add(blocked.id);
                              const ci = checkInOf(blocked); const co = checkOutOf(blocked);
                              const firstVisible = fmt(dates[0]); const lastVisible = fmt(dates[dates.length - 1]);
                              if (co <= firstVisible || ci > lastVisible) return;
                              let startIdx = dates.findIndex(dd => fmt(dd) === ci);
                              if (startIdx === -1 && ci < firstVisible) startIdx = 0;
                              if (startIdx === -1) return;
                              let endIdx = dates.findIndex(dd => fmt(dd) === co);
                              if (endIdx === -1 && co > lastVisible) endIdx = dates.length;
                              if (endIdx === -1) endIdx = dates.length;
                              const span = endIdx - startIdx;
                              if (span <= 0) return;
                              const nights = nightsBetween(ci, co);
                              const reason = blocked.notes || "No reason";
                              blockedBars.push(
                                <div key={`blocked-${blocked.id}`} className="group/block absolute top-1.5 bottom-1.5 bg-gradient-to-r from-slate-300 via-slate-400 to-slate-500 border-l-4 border-slate-700 rounded-lg flex items-center px-2 cursor-pointer z-10 shadow-md hover:shadow-lg hover:z-30 hover:-translate-y-0.5 transition-all"
                                  style={{ left: `${startIdx * CELL_WIDTH + 3}px`, width: `${span * CELL_WIDTH - 6}px` }}
                                  onClick={() => handleCellClick(room.room_number, dates[startIdx])}
                                  title={`🔒 Blocked: ${reason}\n📅 ${prettyDate(ci)} → ${prettyDate(co)}\n🌙 ${nights}n`}>
                                  <div className="w-5 h-5 rounded-full bg-white/40 flex items-center justify-center text-[10px] shrink-0 mr-1.5">🔒</div>
                                  <div className="flex flex-col items-start min-w-0 flex-1">
                                    <span className="text-[10px] font-bold text-slate-900 uppercase tracking-wider leading-tight truncate">Blocked</span>
                                    {span > 1 && (<span className="text-[9px] font-semibold text-slate-700 leading-tight truncate">{nights}n · {reason.slice(0, 20)}</span>)}
                                  </div>
                                </div>
                              );
                            });
                            return blockedBars;
                          })()}

                          {rowBookings.filter((b: any) => b.status !== "BLOCKED").map((b: any) => {
                            const ci = checkInOf(b); const co = checkOutOf(b);
                            const firstVisible = fmt(dates[0]); const lastVisible = fmt(dates[dates.length - 1]);
                            if (co <= firstVisible || ci > lastVisible) return null;
                            let startIdx = dates.findIndex((dd) => fmt(dd) === ci);
                            if (startIdx === -1 && ci < firstVisible) startIdx = 0;
                            if (startIdx === -1) return null;
                            let endIdx = dates.findIndex((dd) => fmt(dd) === co);
                            if (endIdx === -1 && co > lastVisible) endIdx = dates.length;
                            if (endIdx === -1) endIdx = dates.length;
                            const span = endIdx - startIdx;
                            if (span <= 0) return null;
                            const isDragging = dragVisual?.bookingId === b.id;
                            const barClass = statusBarClass[b.status] || "bg-slate-200 text-slate-700";
                            const gName = guestNameOf(b);
                            const initial = (gName || "?").charAt(0).toUpperCase();
                            const nights = nightsBetween(ci, co);
                            return (
                              <div key={b.id} onMouseDown={(e) => onBarMouseDown(e, b)} onTouchStart={(e) => onBarMouseDown(e, b)}
                                className={`group absolute top-1.5 bottom-1.5 ${barClass} rounded-lg shadow-sm flex items-center px-2 cursor-grab z-20 transition-all ${isDragging ? "opacity-50 scale-95 shadow-xl" : "hover:shadow-lg hover:z-30 hover:-translate-y-0.5"}`}
                                style={{ left: `${startIdx * CELL_WIDTH + 3}px`, width: `${span * CELL_WIDTH - 6}px` }}>
                                <div className="w-6 h-6 rounded-full bg-white/40 backdrop-blur-sm flex items-center justify-center text-[10px] font-bold shrink-0 mr-2 ring-2 ring-white/30">{initial}</div>
                                <div className="truncate font-semibold text-xs flex-1 min-w-0">
                                  <div className="truncate">{gName}</div>
                                  {span > 1 && (<div className="text-[9px] opacity-75 truncate">{nights}n · {roomTypeOf(b)}</div>)}
                                </div>
                                {b.status === "CONFIRMED" && (<button onClick={(e) => { e.stopPropagation(); askAction({ type: "CHECK_IN", booking: b, title: "Confirm Check-In", message: `Check-in "${gName}"?`, confirmLabel: "Yes, Check-In", confirmColor: "green" }); }} className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 w-6 h-6 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-emerald-600 text-[10px] shadow-sm shrink-0" title="Quick Check-In">✓</button>)}
                                {b.status === "CHECKED-IN" && (<button onClick={(e) => { e.stopPropagation(); askAction({ type: "CHECK_OUT", booking: b, title: "Confirm Check-Out", message: `Check-out "${gName}"?`, confirmLabel: "Yes, Check-Out", confirmColor: "red" }); }} className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 w-6 h-6 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-rose-600 text-[10px] shadow-sm shrink-0" title="Quick Check-Out">🚪</button>)}
                                <div className={`w-1.5 h-1.5 rounded-full ${statusDotColor[b.status] || "bg-slate-400"} ml-1 shrink-0 ring-2 ring-white/50`} />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RESERVATION SIDE PANEL — পুরো কোডটি আগের মতোই আছে */}
      {selected && (
        <div className="fixed inset-y-0 right-0 w-[440px] bg-slate-50 shadow-2xl z-50 flex flex-col border-l border-slate-200">
          <div className={`relative px-5 pt-5 pb-6 text-white overflow-hidden ${selected.status === "BLOCKED" ? "bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900" : selected.status === "CHECKED-IN" ? "bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-600" : selected.status === "ON-HOLD" ? "bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-600" : "bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500"}`}>
            <button onClick={() => setSelected(null)} className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white text-lg font-medium transition z-10 backdrop-blur-sm">✕</button>
            <div className="relative">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 mb-3">{selected.status === "BLOCKED" ? "Room Block" : `Booking · ${(selected.id || "").slice(0, 8)}`}</p>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-white/25 border-2 border-white/40 flex items-center justify-center flex-shrink-0 backdrop-blur-sm shadow-lg">
                  <span className="text-2xl font-bold">{selected.status === "BLOCKED" ? "🔒" : (guestNameOf(selected) || "?").charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold truncate leading-tight">{selected.status === "BLOCKED" ? "Room Blocked" : guestNameOf(selected)}</h2>
                  <p className="text-sm opacity-90 truncate mt-0.5">{selected.status === "BLOCKED" ? (selected.notes || "No reason") : (guestPhoneOf(selected) || "No phone")}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 flex-wrap">
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide bg-white/25 border border-white/30 backdrop-blur-sm">● {selected.status}</span>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide bg-white/25 border border-white/30 backdrop-blur-sm">🚪 {roomNumberOf(selected) || "—"}</span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {selected.status === "BLOCKED" ? (
              <div className="p-5 space-y-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100"><span className="text-lg">🔒</span><h3 className="text-sm font-bold text-slate-800">Block Details</h3></div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-start text-sm"><span className="text-slate-500 font-medium">Room</span><span className="font-bold text-slate-800 text-right">{roomNumberOf(selected)} — {roomTypeOf(selected)}</span></div>
                    <div className="flex justify-between items-start text-sm"><span className="text-slate-500 font-medium">From</span><span className="font-bold text-slate-800">{prettyDate(checkInOf(selected))}</span></div>
                    <div className="flex justify-between items-start text-sm"><span className="text-slate-500 font-medium">To</span><span className="font-bold text-slate-800">{prettyDate(checkOutOf(selected))}</span></div>
                    <div className="flex justify-between items-start text-sm pt-3 border-t border-slate-100"><span className="text-slate-500 font-medium">Reason</span><span className="font-bold text-slate-800 text-right max-w-[60%]">{selected.notes || "—"}</span></div>
                  </div>
                </div>
                <button onClick={() => askAction({ type: "UNBLOCK", booking: selected, title: "Unblock room?", message: `Unblock Room ${roomNumberOf(selected)}?`, confirmLabel: "Yes, Unblock", confirmColor: "blue" })} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-2xl py-4 font-bold text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-blue-600/30"><span className="text-lg">🔓</span> Unblock Room</button>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex items-center gap-2"><span className="text-sm">📅</span><h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Stay Details</h3></div>
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex-1"><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Check-In</p><p className="text-lg font-bold text-slate-900 mt-0.5">{checkInOf(selected) ? new Date(checkInOf(selected)).getDate() : "—"}</p></div>
                    <div className="flex flex-col items-center px-4"><div className="text-[10px] font-bold uppercase text-slate-400 mb-2">{nightsBetween(checkInOf(selected), checkOutOf(selected))} Night</div></div>
                    <div className="flex-1 text-right"><p className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Check-Out</p><p className="text-lg font-bold text-slate-900 mt-0.5">{checkOutOf(selected) ? new Date(checkOutOf(selected)).getDate() : "—"}</p></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm"><div className="flex items-center gap-2 mb-1"><span className="text-base">🚪</span><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Room</p></div><p className="text-base font-bold text-slate-900">{roomNumberOf(selected) ?? "—"}</p></div>
                  <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm"><div className="flex items-center gap-2 mb-1"><span className="text-base">👥</span><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Guests</p></div><p className="text-base font-bold text-slate-900">{selected.adults || 1} A · {selected.children || 0} C</p></div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => setFolioFor(selected)} className="bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-xl py-3.5 flex flex-col items-center gap-1.5 transition group shadow-sm"><span className="text-xl">📄</span><span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">Folio</span></button>
                  <div className="relative">
                    <button onClick={() => setPrintMenuOpen(!printMenuOpen)} className={`w-full h-full rounded-xl py-3.5 flex flex-col items-center gap-1.5 transition group shadow-sm border ${printMenuOpen ? "bg-blue-50 border-blue-400 ring-2 ring-blue-100" : "bg-white hover:bg-blue-50 border-slate-200 hover:border-blue-300"}`}><span className="text-xl">🖨</span><span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">Print</span></button>
                    {printMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setPrintMenuOpen(false)} />
                        <div className="absolute top-full right-0 mt-3 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl w-[300px] overflow-hidden">
                          <div className="py-1.5">
                            <button onClick={() => { setPrintMenuOpen(false); handleFolioAction("Print Normal Bill", selected); }} className="w-full text-left px-4 py-3 hover:bg-blue-50 flex items-start gap-3 border-b border-slate-50"><div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center"><span>🧾</span></div><div><p className="text-sm font-bold text-slate-800">Normal Bill</p></div></button>
                            <button onClick={() => { setPrintMenuOpen(false); handleFolioAction("Print Registration Card", selected); }} className="w-full text-left px-4 py-3 hover:bg-amber-50 flex items-start gap-3 border-b border-slate-50"><div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center"><span>📋</span></div><div><p className="text-sm font-bold text-slate-800">Registration Card</p></div></button>
                            <button onClick={() => { setPrintMenuOpen(false); handleFolioAction("Print C Form", selected); }} className="w-full text-left px-4 py-3 hover:bg-purple-50 flex items-start gap-3"><div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center"><span>📄</span></div><div><p className="text-sm font-bold text-slate-800">C Form</p></div></button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  <button onClick={() => openGuestPanel(selected)} className="bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded-xl py-3.5 flex flex-col items-center gap-1.5 transition group shadow-sm"><span className="text-xl">✏️</span><span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">Guest</span></button>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2"><span className="text-sm">💰</span><h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Payment</h3></div>
                    <button onClick={() => setSettleDuesFor(selected)} className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800 uppercase tracking-wider">Settle Due →</button>
                  </div>
                  <div className="p-4"><PaymentDetailsBlock booking={selected} roomCharge={selected.amount || 0} paid={Number(selected.paid) || 0} /></div>
                </div>

                <div className="space-y-2">
                  {selected.status === "CONFIRMED" && (<button onClick={() => askAction({ type: "CHECK_IN", booking: selected, title: "Confirm Check-In", message: `Check-in "${guestNameOf(selected)}"?`, confirmLabel: "Yes, Check-In", confirmColor: "green" })} className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-2xl py-3.5 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 transition"><span>✓</span> Check-In Guest</button>)}
                  {selected.status === "CHECKED-IN" && (<button onClick={() => askAction({ type: "CHECK_OUT", booking: selected, title: "Confirm Check-Out", message: `Check-out "${guestNameOf(selected)}"?`, confirmLabel: "Yes, Check-Out", confirmColor: "red" })} className="w-full bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 text-white rounded-2xl py-3.5 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-500/30 transition"><span>🚪</span> Check-Out Guest</button>)}
                  <button onClick={() => setSettleDuesFor(selected)} className="w-full bg-white hover:bg-emerald-50 border-2 border-emerald-500 text-emerald-700 rounded-2xl py-3 font-bold text-sm flex items-center justify-center gap-2 transition shadow-sm"><span>💰</span> Add Payment</button>
                  <div className="relative">
                    <button onClick={() => setShowModifyMenu(!showModifyMenu)} className="w-full bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded-2xl py-3 font-bold text-sm flex items-center justify-between px-5 transition shadow-sm">
                      <span className="flex items-center gap-2"><span>⚙</span> More Actions</span>
                      <span className={`text-xs transition-transform ${showModifyMenu ? "rotate-180" : ""}`}>▼</span>
                    </button>
                    {showModifyMenu && (<div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 max-h-80 overflow-y-auto py-1.5">{modifyOptions.map(opt => (<button key={opt} onClick={() => handleModifyOption(opt)} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition">{opt}</button>))}</div>)}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2"><span className="text-sm">📝</span><h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Notes</h3></div>
                    <button onClick={() => { setNotesModalFor(selected); setNotesDraft(cleanNotesForDisplay(selected.notes)); }} className="text-[10px] font-bold text-purple-600 hover:text-purple-800 uppercase tracking-wider">{cleanNotesForDisplay(selected.notes) ? "Edit" : "+ Add"}</button>
                  </div>
                  <div className="p-4">
                    {cleanNotesForDisplay(selected.notes) ? (<p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{cleanNotesForDisplay(selected.notes)}</p>) : (<button onClick={() => { setNotesModalFor(selected); setNotesDraft(""); }} className="w-full border-2 border-dashed border-slate-200 rounded-xl py-4 text-center text-xs text-slate-400 hover:border-purple-300 hover:text-purple-500 transition">📝 Click to add notes</button>)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODALS — সব আগের মতোই আছে */}
      {pendingAction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-2">{pendingAction.title}</h3>
            <p className="text-sm text-slate-600 mb-4">{pendingAction.message}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setPendingAction(null)} disabled={actionRunning} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-50">Cancel</button>
              <button onClick={runPendingAction} disabled={actionRunning} className={`px-5 py-2 rounded-lg text-sm font-semibold text-white shadow-sm ${confirmColorMap[pendingAction.confirmColor]?.bg || "bg-slate-800"}`}>{actionRunning ? "Processing..." : pendingAction.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}

      {genericAction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[80] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center"><h3 className="text-lg font-bold">{genericAction.title}</h3><button onClick={() => setGenericAction(null)} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button></div>
            <div className="p-6"><p className="text-sm text-slate-600 mb-4">{genericAction.message}</p><input type="text" value={genericInputValue} onChange={(e) => setGenericInputValue(e.target.value)} placeholder={genericAction.inputPlaceholder || "Enter value..."} className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" autoFocus /></div>
            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100"><button onClick={() => setGenericAction(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold hover:bg-white">Cancel</button><button onClick={() => { genericAction.onConfirm(genericInputValue); setGenericInputValue(""); }} className="px-5 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-lg text-sm font-bold shadow-sm">Save</button></div>
          </div>
        </div>
      )}

      {notesModalFor && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[80] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center"><h3 className="text-lg font-bold">Notes</h3><button onClick={() => { setNotesModalFor(null); setNotesDraft(""); }} className="text-slate-400 hover:text-slate-700 text-2xl">×</button></div>
            <div className="p-6"><textarea value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} rows={6} className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm resize-none outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" autoFocus /></div>
            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100"><button onClick={() => { setNotesModalFor(null); setNotesDraft(""); }} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold hover:bg-white">Cancel</button><button onClick={() => handleSaveNotes(notesModalFor)} disabled={!notesDraft.trim()} className="px-5 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-lg text-sm font-bold disabled:opacity-50 shadow-sm">Save</button></div>
          </div>
        </div>
      )}

      {dateEditFor && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[80] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4">Modify {dateEditFor.type === "checkin" ? "Check-In" : "Check-Out"}</h3>
            <input type="date" value={dateEditValue} onChange={(e) => setDateEditValue(e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500" autoFocus />
            <div className="flex justify-end gap-3 mt-4"><button onClick={() => { setDateEditFor(null); setDateEditValue(""); }} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold">Cancel</button><button onClick={handleSaveDateEdit} disabled={!dateEditValue} className="px-5 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-lg text-sm font-bold disabled:opacity-50 shadow-sm">Save</button></div>
          </div>
        </div>
      )}

      {moveRoomTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4">Move Reservation</h3>
            <select value={moveRoomNewRoom} onChange={(e) => setMoveRoomNewRoom(e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm mb-4 outline-none focus:border-teal-500">
              <option value="">-- Choose a room --</option>
              {rooms.filter((r) => r.room_number !== roomNumberOf(moveRoomTarget)).map((r) => (<option key={r.id} value={r.room_number}>{r.room_number} — {r.room_type}</option>))}
            </select>
            <div className="flex justify-end gap-3">
              <button onClick={() => setMoveRoomTarget(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold">Cancel</button>
              <button onClick={() => {
                if (!moveRoomNewRoom) return alert("Select a room");
                const t = moveRoomTarget; const r = moveRoomNewRoom;
                if (!isRoomAvailableForDates(bookings, r, checkInOf(t), checkOutOf(t), t.id)) { showToast(`⚠ Room ${r} not available`); return; }
                setMoveRoomTarget(null);
                askAction({ type: "MOVE_ROOM", booking: t, title: "Confirm move?", message: `Move to Room ${r}?`, confirmLabel: "Yes, Move", confirmColor: "green",
                  onConfirm: async () => { await moveReservation(t.id, r, hotelId || undefined); showToast(`📅 Moved to Room ${r}`); setSelected(null); setCalendarVersion((v) => v + 1); await loadFromDb(); }});
              }} className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg text-sm font-bold shadow-sm">Move</button>
            </div>
          </div>
        </div>
      )}

      {addonModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[90] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center"><h3 className="text-xl font-bold">Add add-ons / services</h3><button onClick={() => setAddonModal(null)} className="text-slate-400 hover:text-slate-700 text-3xl leading-none">×</button></div>
            <div className="p-6 space-y-5">
              <div><label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wider">Charge to room</label><div className="px-4 py-3 border border-slate-200 rounded-xl text-sm bg-slate-50 font-semibold">{roomNumberOf(addonModal.booking)} ({roomTypeOf(addonModal.booking)})</div></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wider">Service date</label><input type="date" value={addonModal.serviceDate} onChange={(e) => setAddonModal({ ...addonModal, serviceDate: e.target.value })} className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500" /></div>
                <div><label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wider">Amount type</label><select value={addonModal.amountType} onChange={(e) => setAddonModal({ ...addonModal, amountType: e.target.value })} className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500"><option>Debit (+ charge)</option><option>Credit (− discount)</option></select></div>
              </div>
              <div><label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wider">Item name</label><input type="text" value={addonModal.addonName} onChange={(e) => setAddonModal({ ...addonModal, addonName: e.target.value })} placeholder="e.g., Extra Bed, Mini Bar" className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500" autoFocus /></div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wider">Amount</label><input type="number" value={addonModal.addonPrice} onChange={(e) => setAddonModal({ ...addonModal, addonPrice: e.target.value })} placeholder="0.00" className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500" /></div>
                <div><label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wider">Tax %</label><select value={addonModal.taxPercent} onChange={(e) => setAddonModal({ ...addonModal, taxPercent: e.target.value })} className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500"><option value="0">0%</option><option value="5">5%</option><option value="12">12%</option><option value="18">18%</option><option value="28">28%</option></select></div>
                <div><label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wider">Total</label><input type="text" readOnly value={addonModal.addonPrice ? (parseFloat(addonModal.addonPrice) * (1 + parseFloat(addonModal.taxPercent) / 100)).toFixed(2) : "0.00"} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm bg-slate-50 font-bold text-teal-600" /></div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3 bg-slate-50">
              <button onClick={() => setAddonModal(null)} className="flex-1 py-3 border-2 border-slate-300 rounded-xl font-semibold text-sm hover:bg-white">CANCEL</button>
              <button onClick={handleAddAddonSubmit} disabled={!addonModal.addonName.trim() || !addonModal.addonPrice.trim()} className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl font-bold text-sm disabled:opacity-50 shadow-sm">+ ADD TO FOLIO</button>
            </div>
          </div>
        </div>
      )}

      {folioLogFor && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[90] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="bg-gradient-to-r from-teal-500 to-emerald-500 px-6 py-4 flex justify-between items-center text-white"><div><h3 className="text-lg font-bold">📋 Folio Log</h3><p className="text-xs opacity-80">{guestNameOf(folioLogFor)}</p></div><button onClick={() => setFolioLogFor(null)} className="text-3xl">×</button></div>
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
              <table className="w-full text-sm bg-white rounded-xl overflow-hidden shadow-sm">
                <thead className="bg-slate-100"><tr><th className="text-left px-4 py-3 text-xs font-bold uppercase text-slate-500">Date</th><th className="text-left px-4 py-3 text-xs font-bold uppercase text-slate-500">Type</th><th className="text-left px-4 py-3 text-xs font-bold uppercase text-slate-500">Description</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {parseFolioLog(folioLogFor).length === 0 ? (<tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">No log entries</td></tr>) : (parseFolioLog(folioLogFor).map((entry, idx) => (<tr key={idx} className="hover:bg-slate-50"><td className="px-4 py-3 text-slate-600 whitespace-nowrap">{entry.time}</td><td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-1 rounded-full border uppercase ${logTypeColors[entry.type] || logTypeColors.NOTE}`}>{entry.type}</span></td><td className="px-4 py-3 text-slate-800">{entry.description}</td></tr>)))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end bg-slate-50"><button onClick={() => setFolioLogFor(null)} className="px-6 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold">Close</button></div>
          </div>
        </div>
      )}

      {billPreview && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[95] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[92vh] flex flex-col overflow-hidden">
            <div className="bg-gradient-to-r from-teal-500 to-emerald-500 px-6 py-4 flex items-center justify-between text-white"><h3 className="text-lg font-bold">🧾 {billPreview.type === "company" ? "Company Tax Invoice" : "Tax Invoice"} — Preview</h3><button onClick={() => setBillPreview(null)} className="text-3xl">×</button></div>
            <div className="flex-1 bg-slate-100 p-4 overflow-hidden"><iframe key={`${billPreview.type}-${billPreview.booking.id}`} srcDoc={generateBillHtml(billPreview.booking, billPreview.type, billPreview.companyName, billPreview.companyGst, billPreview.companyEmail, billPreview.companyPhone, billPreview.companyAddress)} className="w-full h-full bg-white rounded-xl shadow-inner" title="Bill Preview" /></div>
            <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setBillPreview(null)} className="px-5 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold hover:bg-white transition">Close</button>
              <button onClick={() => { const w = window.open("", "_blank"); if (w) { w.document.write(generateBillHtml(billPreview.booking, billPreview.type, billPreview.companyName, billPreview.companyGst, billPreview.companyEmail, billPreview.companyPhone, billPreview.companyAddress)); w.document.close(); setTimeout(() => w.print(), 500); } }} className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl text-sm font-bold shadow-sm">🖨 Print</button>
            </div>
          </div>
        </div>
      )}

      {companyModalFor && (<CompanyDetailsModal onClose={() => setCompanyModalFor(null)} onSave={handleSaveCompany} initial={companyModalFor ? { companyName: companyModalFor.primaryGuest?.companyName || "", companyGst: companyModalFor.primaryGuest?.companyGst || "", companyEmail: companyModalFor.primaryGuest?.companyEmail || "", companyPhone: companyModalFor.primaryGuest?.companyPhone || "", companyAddress: companyModalFor.primaryGuest?.companyAddress || "" } : undefined} />)}

      {guestPanelFor && (<GuestInfoPanel booking={guestPanelFor} onClose={() => setGuestPanelFor(null)} onSave={(g: Guest) => handleSaveGuest(guestPanelFor, g)} />)}

      {folioFor && (
        <FolioModal booking={folioFor} onClose={() => setFolioFor(null)} refreshKey={calendarVersion} onAction={(action) => handleFolioAction(action, folioFor)}
          onSettleDues={() => { const b = folioFor; setFolioFor(null); setSettleDuesFor(b); }}
          onCheckInOrOut={() => { const b = folioFor; const st = b.status; setFolioFor(null); if (st === "CONFIRMED") { askAction({ type: "CHECK_IN", booking: b, title: "Confirm Check-In", message: `Check-in "${guestNameOf(b)}"?`, confirmLabel: "Yes, Check-In", confirmColor: "green" }); } else if (st === "CHECKED-IN") { askAction({ type: "CHECK_OUT", booking: b, title: "Confirm Check-Out", message: `Check-out "${guestNameOf(b)}"?`, confirmLabel: "Yes, Check-Out", confirmColor: "red" }); } else { showToast("ℹ Booking is not in a check-in/out state"); } }}
          onOpenPaymentManager={() => { setSelected(folioFor); setFolioFor(null); setPaymentManagerOpen(true); }}
          onPaymentMade={() => { setCalendarVersion((v) => v + 1); loadFromDb(); }}
          onBookingUpdate={() => { setCalendarVersion((v) => v + 1); loadFromDb(); }}
          onDeleteAddon={handleDeleteAddon}
        />
      )}

      {settleDuesFor && (<SettleDuesModal booking={settleDuesFor} onClose={() => setSettleDuesFor(null)} onSave={async (method, amount, reference, note) => { try { await recordPayment({ bookingId: settleDuesFor.id, method, amount, reference, note }); showToast(`✅ Payment recorded — ₹${amount}`); setSettleDuesFor(null); setCalendarVersion((v) => v + 1); await loadFromDb(); } catch (err: any) { showToast(`⚠ ${err?.message || "Failed to record payment"}`); } }} onOpenManager={() => { setSelected(settleDuesFor); setSettleDuesFor(null); setPaymentManagerOpen(true); }} />)}

      {paymentManagerOpen && (<PaymentManager onClose={() => setPaymentManagerOpen(false)} />)}

      {modifyFor && (<ModifyReservationModal booking={modifyFor} onClose={() => setModifyFor(null)} onSave={async (data) => { try { await modifyReservation(modifyFor.id, data); showToast("✅ Reservation updated"); setModifyFor(null); setCalendarVersion((v) => v + 1); await loadFromDb(); } catch (err: any) { showToast(`⚠ ${err?.message || "Failed to update reservation"}`); } }} />)}

      {createOpen && (
  <CreateReservationModal
    initialRoom={createPrefill?.roomNumber}
    initialCheckIn={createPrefill?.checkIn}
    initialCheckOut={createPrefill?.checkOut}
    onClose={() => {
      setCreateOpen(false);
      setCreatePrefill(null);
    }}
    onSubmit={handleCreateSubmit}
    onBlockRoom={async (data) => {
      await handleBlockRoom(data);
      setCreateOpen(false);
      setCreatePrefill(null);
    }}
  />
)}

      {enquiryOpen && (<EnquiryModal onClose={() => setEnquiryOpen(false)} hotelId={hotelId || undefined} onDone={() => { setEnquiryOpen(false); showToast("✅ Enquiry saved"); loadFromDb(); }} />)}

      {blockRoomOpen && (<BlockRoomModal onClose={() => { setBlockRoomOpen(false); setCreatePrefill(null); }} onSubmit={handleBlockRoom} rooms={rooms.map((r) => ({ room_number: r.room_number, room_type: r.room_type || "Standard" }))} />)}

      {groupBookingOpen && (<GroupBookingModal onClose={() => setGroupBookingOpen(false)} hotelId={hotelId || undefined} rooms={rooms.map((r) => ({ room_number: r.room_number, room_type: r.room_type || "Standard" }))} onDone={() => { setGroupBookingOpen(false); showToast("✅ Group booking created"); setCalendarVersion((v) => v + 1); loadFromDb(); }} />)}

      <DateRangePicker open={datePickerOpen} onClose={() => setDatePickerOpen(false)} value={startDate} onChange={(d) => { setStartDate(d); setDatePickerOpen(false); }} />

      {deleteNotesConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[85] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-2">Delete notes?</h3>
            <p className="text-sm text-slate-600 mb-4">This will permanently remove notes from this booking. Add-ons will be preserved.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteNotesConfirm(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-50">Cancel</button>
              <button onClick={() => handleDeleteNotes(deleteNotesConfirm)} className="px-5 py-2 bg-rose-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-rose-700">Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

      {holdsPanelOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[85] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-indigo-500 px-6 py-4 flex items-center justify-between text-white">
              <div><h3 className="text-lg font-bold">⏸ Holds & Unassigned</h3><p className="text-xs opacity-80">{holdBookings.length + unassignedBookings.length} bookings</p></div>
              <button onClick={() => setHoldsPanelOpen(false)} className="text-3xl">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 bg-slate-50 space-y-5">
              {holdBookings.length === 0 && unassignedBookings.length === 0 && (<div className="p-12 text-center text-slate-400"><p className="text-5xl mb-3">✓</p><p className="font-semibold text-slate-600">No holds or unassigned bookings</p></div>)}
              {holdBookings.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">On-Hold ({holdBookings.length})</h4>
                  <div className="space-y-2">
                    {holdBookings.map((b) => (
                      <div key={b.id} className="bg-white rounded-xl border border-purple-200 p-4 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold shrink-0">{(guestNameOf(b) || "?").charAt(0).toUpperCase()}</div>
                          <div className="min-w-0"><p className="font-bold text-slate-800 truncate">{guestNameOf(b)}</p><p className="text-xs text-slate-500 truncate">Room {roomNumberOf(b) || "—"}</p></div>
                        </div>
                        <button onClick={() => askAction({ type: "RELEASE_HOLD", booking: b, title: "Restore booking?", message: `Restore "${guestNameOf(b)}"?`, confirmLabel: "Yes, Restore", confirmColor: "green" })} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shrink-0 transition">Restore</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {unassignedBookings.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Unassigned Rooms ({unassignedBookings.length})</h4>
                  <div className="space-y-2">
                    {unassignedBookings.map((b) => (
                      <div key={b.id} className="bg-white rounded-xl border border-amber-200 p-4 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold shrink-0">{(guestNameOf(b) || "?").charAt(0).toUpperCase()}</div>
                          <div className="min-w-0"><p className="font-bold text-slate-800 truncate">{guestNameOf(b)}</p><p className="text-xs text-slate-500 truncate">{prettyDate(checkInOf(b))} → {prettyDate(checkOutOf(b))}</p></div>
                        </div>
                        <button onClick={() => { setHoldsPanelOpen(false); setMoveRoomTarget(b); setMoveRoomNewRoom(""); }} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold shrink-0 transition">Assign Room</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end bg-slate-50"><button onClick={() => setHoldsPanelOpen(false)} className="px-5 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold">Close</button></div>
          </div>
        </div>
      )}

      {searchResultsOpen && searchQuery.trim() && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg max-h-[70vh] overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Search Results ({searchedBookings.length})</p>
            <button onClick={() => { setSearchResultsOpen(false); setSearchQuery(""); }} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {searchedBookings.length === 0 ? (<div className="p-10 text-center text-slate-400"><p className="text-3xl mb-2">🔍</p><p className="text-sm font-semibold">No matches found</p></div>) : (
              searchedBookings.map((b) => (
                <button key={b.id} onClick={() => { setSelected(b); setSearchResultsOpen(false); setSearchQuery(""); }} className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 flex items-center gap-3 transition">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 text-white flex items-center justify-center font-bold text-sm shrink-0">{(guestNameOf(b) || "?").charAt(0).toUpperCase()}</div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-bold text-slate-800 truncate">{guestNameOf(b)}</p><p className="text-xs text-slate-500 truncate">Room {roomNumberOf(b) || "—"}</p></div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {cellContextMenu && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setCellContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setCellContextMenu(null); }} />
          <div className="fixed z-[61] bg-white border border-slate-200 rounded-xl shadow-2xl py-1.5 min-w-[200px] overflow-hidden"
            style={{ left: `${Math.min(cellContextMenu.x, window.innerWidth - 220)}px`, top: `${Math.min(cellContextMenu.y, window.innerHeight - 140)}px` }}>
            <div className="px-3 py-1.5 border-b border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Room {cellContextMenu.roomNumber} · {prettyDate(fmt(cellContextMenu.date))}</p>
            </div>
            <button onClick={() => { const d = cellContextMenu.date; const rn = cellContextMenu.roomNumber; setCellContextMenu(null); setCreatePrefill({ roomNumber: rn, checkIn: fmt(d), checkOut: fmt(new Date(d.getTime() + 86400000)) }); setCreateOpen(true); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-teal-50 flex items-center gap-3 font-semibold text-slate-700 transition"><span className="text-base">🚶</span> New Booking</button>
            <button onClick={() => { const d = cellContextMenu.date; const rn = cellContextMenu.roomNumber; setCellContextMenu(null); setCreatePrefill({ roomNumber: rn, checkIn: fmt(d), checkOut: fmt(new Date(d.getTime() + 86400000)) }); setBlockRoomOpen(true); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-100 flex items-center gap-3 font-semibold text-slate-700 border-t border-slate-100 transition"><span className="text-base">🔒</span> Block Room</button>
          </div>
        </>
      )}

      {toast && (<div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl text-sm font-semibold">{toast}</div>)}
    </div>
  );
}
