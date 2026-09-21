"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getActiveHotelId } from "../../../active-hotel";
import { fetchReportBookings, fetchReportPayments, fetchHousekeepingRooms } from "../../../db";

type ReportColumn = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  format?: "currency" | "number" | "date" | "status";
};

type ReportConfig = {
  title: string;
  desc: string;
  dataSource: "bookings" | "payments" | "rooms" | "bookings-with-addons" | "bookings-with-notes";
  filter?: (b: any) => boolean;
  columns: ReportColumn[];
};

// ═══════════════════════════════════════════════
// ALL REPORT CONFIGS
// ═══════════════════════════════════════════════
const REPORT_CONFIGS: Record<string, ReportConfig> = {
  // ─── PROPERTY ───
  master: {
    title: "Master Report",
    desc: "All bookings, customer info, payments, taxes",
    dataSource: "bookings",
    columns: [
      { key: "check_in", label: "Date" },
      { key: "booking_ref", label: "Ref" },
      { key: "guestName", label: "Guest" },
      { key: "guestPhone", label: "Phone" },
      { key: "roomNumber", label: "Room" },
      { key: "status", label: "Status", align: "center", format: "status" },
      { key: "roomCharge", label: "Room", format: "currency", align: "right" },
      { key: "taxAmount", label: "Tax", format: "currency", align: "right" },
      { key: "totalAmount", label: "Total", format: "currency", align: "right" },
      { key: "paidAmount", label: "Paid", format: "currency", align: "right" },
      { key: "balanceDue", label: "Balance", format: "currency", align: "right" },
    ],
  },
  "flash-manager": {
    title: "Flash Manager Report",
    desc: "Occupancy, ADR, RevPAR, taxes",
    dataSource: "bookings",
    columns: [
      { key: "check_in", label: "Date" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "nights", label: "Nights", align: "center" },
      { key: "adr", label: "ADR", format: "currency", align: "right" },
      { key: "roomCharge", label: "Revenue", format: "currency", align: "right" },
      { key: "taxAmount", label: "Tax", format: "currency", align: "right" },
      { key: "totalAmount", label: "Total", format: "currency", align: "right" },
    ],
  },
  "guest-ledger": {
    title: "Guest Ledger Report",
    desc: "Outstanding balance owed by in-house guests",
    dataSource: "bookings",
    filter: (b) => b.status === "CHECKED-IN" || b.balanceDue > 0,
    columns: [
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "checkIn", label: "Check-In" },
      { key: "checkOut", label: "Check-Out" },
      { key: "totalAmount", label: "Total", format: "currency", align: "right" },
      { key: "paidAmount", label: "Paid", format: "currency", align: "right" },
      { key: "balanceDue", label: "Outstanding", format: "currency", align: "right" },
    ],
  },
  "room-revenue": {
    title: "Room Revenue Report",
    desc: "Room revenue, taxes, payments",
    dataSource: "bookings",
    filter: (b) => b.status !== "CANCELLED" && b.status !== "BLOCKED",
    columns: [
      { key: "check_in", label: "Date" },
      { key: "booking_ref", label: "Ref" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "roomCharge", label: "Room Revenue", format: "currency", align: "right" },
      { key: "taxAmount", label: "Tax", format: "currency", align: "right" },
      { key: "totalAmount", label: "Total", format: "currency", align: "right" },
      { key: "balanceDue", label: "Balance", format: "currency", align: "right" },
    ],
  },
  sales: {
    title: "Sales Report",
    desc: "Date-wise performance metrics",
    dataSource: "bookings",
    filter: (b) => b.status !== "CANCELLED" && b.status !== "BLOCKED",
    columns: [
      { key: "check_in", label: "Date" },
      { key: "booking_ref", label: "Ref" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "roomCharge", label: "Revenue", format: "currency", align: "right" },
      { key: "taxAmount", label: "Tax", format: "currency", align: "right" },
      { key: "totalAmount", label: "Total", format: "currency", align: "right" },
      { key: "paidAmount", label: "Paid", format: "currency", align: "right" },
    ],
  },
  "room-inventory": {
    title: "Room Inventory Report",
    desc: "Room inventory metrics",
    dataSource: "rooms",
    columns: [
      { key: "room_number", label: "Room" },
      { key: "room_type", label: "Type" },
      { key: "housekeeping_status", label: "Status", align: "center", format: "status" },
      { key: "last_cleaned_by", label: "Cleaned By" },
    ],
  },
  shift: {
    title: "Shift Report",
    desc: "Payment transactions by staff",
    dataSource: "payments",
    columns: [
      { key: "created_at", label: "Date & Time" },
      { key: "method", label: "Method" },
      { key: "amount", label: "Amount", format: "currency", align: "right" },
      { key: "reference", label: "Reference" },
      { key: "note", label: "Note" },
    ],
  },
  "bar-pricing": {
    title: "BAR Pricing Report",
    desc: "Best Available Rate per room type",
    dataSource: "rooms",
    columns: [
      { key: "room_number", label: "Room" },
      { key: "room_type", label: "Type" },
      { key: "base_price", label: "Base Rate", format: "currency", align: "right" },
    ],
  },
  folio: {
    title: "Folio Report",
    desc: "Guest folio balances",
    dataSource: "bookings",
    columns: [
      { key: "booking_ref", label: "Folio #" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "checkIn", label: "Check-In" },
      { key: "checkOut", label: "Check-Out" },
      { key: "status", label: "Status", align: "center", format: "status" },
      { key: "totalAmount", label: "Charges", format: "currency", align: "right" },
      { key: "paidAmount", label: "Payments", format: "currency", align: "right" },
      { key: "balanceDue", label: "Balance", format: "currency", align: "right" },
    ],
  },
  "archived-folio": {
    title: "Archived Folio Report",
    desc: "Historical folios",
    dataSource: "bookings",
    filter: (b) => b.status === "CHECKED-OUT",
    columns: [
      { key: "booking_ref", label: "Folio #" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "checkIn", label: "Check-In" },
      { key: "checkOut", label: "Check-Out" },
      { key: "totalAmount", label: "Total", format: "currency", align: "right" },
      { key: "paidAmount", label: "Paid", format: "currency", align: "right" },
    ],
  },

  // ─── FRONT DESK ───
  "room-bookings": {
    title: "Room Bookings Report",
    desc: "Breakdown of room categories",
    dataSource: "bookings",
    columns: [
      { key: "check_in", label: "Booked On" },
      { key: "booking_ref", label: "Ref" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "roomType", label: "Category" },
      { key: "source", label: "Source" },
      { key: "status", label: "Status", align: "center", format: "status" },
    ],
  },
  "day-use": {
    title: "Day Use Report",
    desc: "Same-day check-ins/check-outs",
    dataSource: "bookings",
    filter: (b) => b.checkIn === b.checkOut || b.nights === 1,
    columns: [
      { key: "check_in", label: "Date" },
      { key: "booking_ref", label: "Ref" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "status", label: "Status", align: "center", format: "status" },
      { key: "totalAmount", label: "Amount", format: "currency", align: "right" },
    ],
  },
  "new-bookings": {
    title: "New Bookings Report",
    desc: "All new reservations",
    dataSource: "bookings",
    columns: [
      { key: "check_in", label: "Booked On" },
      { key: "booking_ref", label: "Ref" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "source", label: "Source" },
      { key: "status", label: "Status", align: "center", format: "status" },
    ],
  },
  arrivals: {
    title: "Arrivals Report",
    desc: "Guest arrivals",
    dataSource: "bookings",
    filter: (b) => b.status !== "CANCELLED" && b.status !== "NO-SHOW",
    columns: [
      { key: "check_in", label: "Date" },
      { key: "guestName", label: "Guest" },
      { key: "guestPhone", label: "Phone" },
      { key: "roomNumber", label: "Room" },
      { key: "status", label: "Status", align: "center", format: "status" },
      { key: "totalAmount", label: "Amount", format: "currency", align: "right" },
    ],
  },
  departures: {
    title: "Departures Report",
    desc: "Guest departures",
    dataSource: "bookings",
    filter: (b) => b.status !== "CANCELLED",
    columns: [
      { key: "checkOut", label: "Date" },
      { key: "guestName", label: "Guest" },
      { key: "guestPhone", label: "Phone" },
      { key: "roomNumber", label: "Room" },
      { key: "status", label: "Status", align: "center", format: "status" },
      { key: "balanceDue", label: "Balance", format: "currency", align: "right" },
    ],
  },
  "on-hold": {
    title: "On-Hold Report",
    desc: "Bookings on hold",
    dataSource: "bookings",
    filter: (b) => b.status === "ON-HOLD",
    columns: [
      { key: "checkIn", label: "Stay From" },
      { key: "guestName", label: "Guest" },
      { key: "guestPhone", label: "Phone" },
      { key: "roomNumber", label: "Room" },
      { key: "totalAmount", label: "Amount", format: "currency", align: "right" },
    ],
  },
  "no-show": {
    title: "No Show Report",
    desc: "No-show bookings",
    dataSource: "bookings",
    filter: (b) => b.is_no_show === true || b.status === "NO-SHOW",
    columns: [
      { key: "checkIn", label: "Expected" },
      { key: "guestName", label: "Guest" },
      { key: "guestPhone", label: "Phone" },
      { key: "roomNumber", label: "Room" },
      { key: "totalAmount", label: "Amount", format: "currency", align: "right" },
    ],
  },
  "room-upgrade": {
    title: "Room Upgrade Report",
    desc: "Upgrades via Magic Link",
    dataSource: "bookings-with-notes",
    filter: (b) => (b.notes || "").toLowerCase().includes("upgrade"),
    columns: [
      { key: "checkIn", label: "Date" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "notes", label: "Notes" },
    ],
  },
  "early-checkin": {
    title: "Early Check-In Report",
    desc: "Early check-ins",
    dataSource: "bookings-with-notes",
    filter: (b) => (b.notes || "").toLowerCase().includes("early"),
    columns: [
      { key: "checkIn", label: "Date" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "notes", label: "Notes" },
    ],
  },
  "late-checkout": {
    title: "Late Check-Out Report",
    desc: "Late check-outs",
    dataSource: "bookings-with-notes",
    filter: (b) => (b.notes || "").toLowerCase().includes("late"),
    columns: [
      { key: "checkIn", label: "Date" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "notes", label: "Notes" },
    ],
  },
  "booking-notes": {
    title: "Booking Notes Report",
    desc: "All booking notes",
    dataSource: "bookings-with-notes",
    columns: [
      { key: "checkIn", label: "Date" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "notes", label: "Notes" },
    ],
  },
  "customer-notes": {
    title: "Customer Notes Report",
    desc: "All customer notes",
    dataSource: "bookings-with-notes",
    columns: [
      { key: "checkIn", label: "Date" },
      { key: "guestName", label: "Guest" },
      { key: "guestPhone", label: "Phone" },
      { key: "notes", label: "Notes" },
    ],
  },
  "rate-plan-count": {
    title: "Rate Plan Count Report",
    desc: "Rate plan distribution",
    dataSource: "bookings",
    columns: [
      { key: "ratePlan", label: "Rate Plan" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "totalAmount", label: "Amount", format: "currency", align: "right" },
    ],
  },

  // ─── PAYMENT ───
  gateway: {
    title: "Payment Gateway Report",
    desc: "Payments via gateways",
    dataSource: "payments",
    filter: (p) => ["Card", "UPI", "Bank Transfer"].includes(p.method),
    columns: [
      { key: "created_at", label: "Date" },
      { key: "method", label: "Method" },
      { key: "amount", label: "Amount", format: "currency", align: "right" },
      { key: "reference", label: "Reference" },
      { key: "note", label: "Note" },
    ],
  },
  "cash-counter": {
    title: "Cash & Counter Report",
    desc: "Cash & offline payments",
    dataSource: "payments",
    filter: (p) => p.method === "Cash",
    columns: [
      { key: "created_at", label: "Date" },
      { key: "method", label: "Method" },
      { key: "amount", label: "Amount", format: "currency", align: "right" },
      { key: "reference", label: "Reference" },
    ],
  },
  refunds: {
    title: "Refunds Report",
    desc: "Payment refunds",
    dataSource: "payments",
    filter: (p) => (p.note || "").toLowerCase().includes("refund"),
    columns: [
      { key: "created_at", label: "Date" },
      { key: "method", label: "Method" },
      { key: "amount", label: "Amount", format: "currency", align: "right" },
      { key: "note", label: "Note" },
    ],
  },
  transfers: {
    title: "Transfers Report",
    desc: "Payment settlements",
    dataSource: "payments",
    filter: (p) => (p.note || "").toLowerCase().includes("transfer"),
    columns: [
      { key: "created_at", label: "Date" },
      { key: "method", label: "Method" },
      { key: "amount", label: "Amount", format: "currency", align: "right" },
      { key: "reference", label: "Reference" },
    ],
  },
  "by-type": {
    title: "Payments by Type",
    desc: "Visa, Mastercard, UPI",
    dataSource: "payments",
    columns: [
      { key: "created_at", label: "Date" },
      { key: "method", label: "Type" },
      { key: "amount", label: "Amount", format: "currency", align: "right" },
      { key: "reference", label: "Reference" },
    ],
  },
  "counter-type": {
    title: "Counter by Payment Type",
    desc: "Cash, offline card",
    dataSource: "payments",
    columns: [
      { key: "created_at", label: "Date" },
      { key: "method", label: "Type" },
      { key: "amount", label: "Amount", format: "currency", align: "right" },
    ],
  },
  "ota-payment": {
    title: "OTA Payment Report",
    desc: "OTA payments",
    dataSource: "bookings",
    filter: (b) => b.source && ["ota", "booking.com", "agoda", "makemytrip", "goibibo"].some((s) => String(b.source).toLowerCase().includes(s)),
    columns: [
      { key: "check_in", label: "Date" },
      { key: "booking_ref", label: "Ref" },
      { key: "guestName", label: "Guest" },
      { key: "source", label: "OTA" },
      { key: "totalAmount", label: "Amount", format: "currency", align: "right" },
    ],
  },

  // ─── SERVICE ───
  "service-revenue": {
    title: "Service Revenue Report",
    desc: "Addons serviced",
    dataSource: "bookings-with-addons",
    columns: [
      { key: "checkIn", label: "Date" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "addonList", label: "Addons" },
      { key: "addonTotal", label: "Revenue", format: "currency", align: "right" },
    ],
  },
  "service-sales": {
    title: "Service Sales Report",
    desc: "Date-wise service sales",
    dataSource: "bookings-with-addons",
    columns: [
      { key: "checkIn", label: "Date" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "addonList", label: "Addons" },
      { key: "addonTotal", label: "Revenue", format: "currency", align: "right" },
    ],
  },

  // ─── TAX ───
  "room-taxes": {
    title: "Room Taxes Report",
    desc: "Booking-wise taxes",
    dataSource: "bookings",
    filter: (b) => b.status !== "CANCELLED" && b.status !== "BLOCKED",
    columns: [
      { key: "check_in", label: "Date" },
      { key: "booking_ref", label: "Ref" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "roomCharge", label: "Base", format: "currency", align: "right" },
      { key: "taxAmount", label: "Tax", format: "currency", align: "right" },
      { key: "totalAmount", label: "Total", format: "currency", align: "right" },
    ],
  },
  gst: {
    title: "GST Report",
    desc: "Complete GST",
    dataSource: "bookings",
    filter: (b) => b.status !== "CANCELLED" && b.status !== "BLOCKED",
    columns: [
      { key: "check_in", label: "Date" },
      { key: "booking_ref", label: "Invoice" },
      { key: "guestName", label: "Guest" },
      { key: "guestGst", label: "GSTIN" },
      { key: "roomCharge", label: "Taxable", format: "currency", align: "right" },
      { key: "taxAmount", label: "GST", format: "currency", align: "right" },
      { key: "totalAmount", label: "Total", format: "currency", align: "right" },
    ],
  },

  // ─── CUSTOMERS ───
  "guest-list": {
    title: "Guest List Report",
    desc: "Complete guest directory",
    dataSource: "bookings",
    columns: [
      { key: "guestName", label: "Guest Name" },
      { key: "guestPhone", label: "Phone" },
      { key: "guestEmail", label: "Email" },
      { key: "guestCountry", label: "Country" },
      { key: "guestGst", label: "GSTIN" },
    ],
  },
  "top-spenders": {
    title: "Top Spenders Report",
    desc: "Highest revenue guests",
    dataSource: "bookings",
    columns: [
      { key: "guestName", label: "Guest" },
      { key: "guestPhone", label: "Phone" },
      { key: "roomNumber", label: "Room" },
      { key: "totalAmount", label: "Total Spent", format: "currency", align: "right" },
    ],
  },
  "guest-origins": {
    title: "Guest Origins Report",
    desc: "Country-wise breakdown",
    dataSource: "bookings",
    columns: [
      { key: "guestCountry", label: "Country" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "totalAmount", label: "Revenue", format: "currency", align: "right" },
    ],
  },
  "repeat-guests": {
    title: "Repeat Guests Report",
    desc: "Guests with multiple stays",
    dataSource: "bookings",
    columns: [
      { key: "guestName", label: "Guest" },
      { key: "guestPhone", label: "Phone" },
      { key: "roomNumber", label: "Room" },
      { key: "checkIn", label: "Stay Date" },
    ],
  },

  // ─── POS ───
  "shopwise-revenue": {
    title: "Shopwise Revenue Report",
    desc: "Revenue by outlet",
    dataSource: "payments",
    columns: [
      { key: "created_at", label: "Date" },
      { key: "method", label: "Payment Method" },
      { key: "amount", label: "Revenue", format: "currency", align: "right" },
      { key: "note", label: "Outlet" },
    ],
  },
  "alloutlets-daysales": {
    title: "All Outlets Day-wise Sales Summary",
    desc: "Consolidated daily sales",
    dataSource: "payments",
    columns: [
      { key: "created_at", label: "Date" },
      { key: "method", label: "Method" },
      { key: "amount", label: "Amount", format: "currency", align: "right" },
    ],
  },
  "alloutlets-hourly": {
    title: "All Outlets Hourly Items Sales",
    desc: "Hourly sales",
    dataSource: "payments",
    columns: [
      { key: "created_at", label: "Date & Time" },
      { key: "method", label: "Method" },
      { key: "amount", label: "Amount", format: "currency", align: "right" },
    ],
  },
  "alloutlets-category": {
    title: "All Outlets Itemwise Category Summary",
    desc: "Category summary",
    dataSource: "payments",
    columns: [
      { key: "created_at", label: "Date" },
      { key: "method", label: "Method" },
      { key: "amount", label: "Amount", format: "currency", align: "right" },
    ],
  },
  "alloutlets-orders": {
    title: "All Outlets Order-wise Sales Summary",
    desc: "Order-wise sales",
    dataSource: "payments",
    columns: [
      { key: "created_at", label: "Date" },
      { key: "method", label: "Method" },
      { key: "amount", label: "Amount", format: "currency", align: "right" },
      { key: "reference", label: "Order Ref" },
    ],
  },

  // ─── LOG ───
  "user-log": {
    title: "User Log Report",
    desc: "User activity logs",
    dataSource: "payments",
    columns: [
      { key: "created_at", label: "Date & Time" },
      { key: "method", label: "Operation" },
      { key: "reference", label: "Reference" },
      { key: "note", label: "Detail" },
    ],
  },
};

// ═══════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════
export default function ReportViewPage() {
  const params = useParams();
  const category = String(params?.category || "property");
  const reportSlug = String(params?.report || "");

  const config = REPORT_CONFIGS[reportSlug];

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [preset, setPreset] = useState("month");
  const [groupBy, setGroupBy] = useState<"none" | "day" | "month">("none");
  const [loading, setLoading] = useState(true);
  const [rawBookings, setRawBookings] = useState<any[]>([]);
  const [rawPayments, setRawPayments] = useState<any[]>([]);
  const [rawRooms, setRawRooms] = useState<any[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [downloadMenu, setDownloadMenu] = useState(false);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  const applyPreset = (p: string) => {
    setPreset(p);
    const now = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    if (p === "today") { setStartDate(iso(now)); setEndDate(iso(now)); }
    else if (p === "yesterday") { const y = new Date(now); y.setDate(y.getDate() - 1); setStartDate(iso(y)); setEndDate(iso(y)); }
    else if (p === "week") { const w = new Date(now); w.setDate(w.getDate() - 6); setStartDate(iso(w)); setEndDate(iso(now)); }
    else if (p === "month") {
      setStartDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
      setEndDate(iso(now));
    }
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const hotelId = getActiveHotelId() || undefined;
      const [bookings, payments, rooms] = await Promise.all([
        fetchReportBookings(hotelId, startDate, endDate),
        fetchReportPayments(hotelId, startDate, endDate),
        fetchHousekeepingRooms(hotelId),
      ]);
      setRawBookings(bookings);
      setRawPayments(payments.map((p: any) => ({ ...p, created_at: new Date(p.created_at).toLocaleString("en-IN") })));
      setRawRooms(rooms);
    } catch (err) {
      console.error("[ReportView]", err);
      showToast("⚠ Failed to load");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  // ═══ Transform data based on config ═══
  const data = useMemo(() => {
    if (!config) return [];
    let result: any[] = [];
    
    if (config.dataSource === "rooms") {
      result = rawRooms;
    } else if (config.dataSource === "payments") {
      result = rawPayments;
    } else if (config.dataSource === "bookings" || config.dataSource === "bookings-with-notes") {
      result = rawBookings;
    } else if (config.dataSource === "bookings-with-addons") {
      result = rawBookings
        .filter((b: any) => (b.notes || "").includes("ADDONS_JSON"))
        .map((b: any) => {
          const match = (b.notes || "").match(/ADDONS_JSON:(\[[^\]]*\])/);
          let addons: any[] = [];
          if (match) { try { addons = JSON.parse(match[1]); } catch {} }
          const total = addons.reduce((s, a) => s + (Number(a.price) || 0) * (1 + (Number(a.tax) || 0) / 100), 0);
          return {
            ...b,
            addonList: addons.map(a => a.name).join(", ") || "—",
            addonTotal: total,
          };
        });
    }

    // Apply specific filter from config
    if (config.filter) {
      result = result.filter(config.filter);
    }

    return result;
  }, [config, rawBookings, rawPayments, rawRooms]);

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase();
    return data.filter((r) => Object.values(r).some((v) => String(v || "").toLowerCase().includes(q)));
  }, [data, searchQuery]);

  const groupedData = useMemo(() => {
    if (groupBy === "none") return [{ key: "all", label: "", rows: filteredData }];
    const groups: Record<string, any[]> = {};
    filteredData.forEach((r: any) => {
      const date = r.check_in || r.checkIn || r.created_at || "";
      let key = "Unknown";
      if (date) {
        const d = new Date(date);
        if (!isNaN(d.getTime())) {
          if (groupBy === "day") key = d.toISOString().slice(0, 10);
          else if (groupBy === "month") key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        }
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a)).map(([key, rows]) => ({ key, label: key, rows }));
  }, [filteredData, groupBy]);

  const summary = useMemo(() => {
    const totalRev = filteredData.reduce((s, r: any) => s + (Number(r.roomCharge) || 0), 0);
    const totalTax = filteredData.reduce((s, r: any) => s + (Number(r.taxAmount) || 0), 0);
    const totalPaid = filteredData.reduce((s, r: any) => s + (Number(r.paidAmount) || 0), 0);
    const totalDue = filteredData.reduce((s, r: any) => s + (Number(r.balanceDue) || 0), 0);
    
    if (config?.dataSource === "payments") {
      const totalPmts = filteredData.reduce((s, p: any) => s + (Number(p.amount) || 0), 0);
      return [
        { label: "Records", value: String(filteredData.length) },
        { label: "Total Collected", value: `₹${totalPmts.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, color: "text-emerald-600" },
      ];
    }
    if (config?.dataSource === "rooms") {
      const clean = filteredData.filter((r: any) => (r.housekeeping_status || "CLEAN") === "CLEAN").length;
      const dirty = filteredData.filter((r: any) => r.housekeeping_status === "DIRTY").length;
      return [
        { label: "Total Rooms", value: String(filteredData.length) },
        { label: "Clean", value: String(clean), color: "text-emerald-600" },
        { label: "Dirty", value: String(dirty), color: "text-rose-600" },
      ];
    }
    return [
      { label: "Records", value: String(filteredData.length) },
      { label: "Revenue", value: `₹${totalRev.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` },
      { label: "Tax", value: `₹${totalTax.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` },
      { label: "Collected", value: `₹${totalPaid.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, color: "text-emerald-600" },
      { label: "Pending", value: `₹${totalDue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, color: "text-rose-600" },
    ];
  }, [filteredData, config]);

  const fmtC = (n: number) => `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

  // ═══ Download handlers ═══
  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleDownload = (format: string) => {
    if (!config) return;
    setDownloadMenu(false);
    const baseName = `${config.title.replace(/\s+/g, "_")}_${startDate}_to_${endDate}`;
    const cols = config.columns;

    if (format === "csv") {
      const headers = cols.map((c) => c.label);
      const csvRows = filteredData.map((r) => cols.map((c) => r[c.key]));
      const csv = [headers.join(","), ...csvRows.map((r) => r.map((v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      triggerDownload(blob, `${baseName}.csv`);
      showToast("📥 CSV downloaded");
    } else if (format === "excel") {
      let html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"><style>table{border-collapse:collapse;font-family:Calibri;font-size:11pt;}th{background:#1e293b;color:#fff;padding:8px 12px;border:1px solid #cbd5e1;text-align:left;}td{border:1px solid #e2e8f0;padding:6px 12px;}tr:nth-child(even) td{background:#f8fafc;}h2{margin:0 0 8px;}</style></head><body>`;
      html += `<h2>${config.title}</h2><table><thead><tr>`;
      cols.forEach((c) => { html += `<th>${c.label}</th>`; });
      html += `</tr></thead><tbody>`;
      filteredData.forEach((r) => {
        html += `<tr>`;
        cols.forEach((c) => {
          let v: any = r[c.key];
          if (v === null || v === undefined) v = "";
          html += `<td>${String(v).replace(/</g, "&lt;")}</td>`;
        });
        html += `</tr>`;
      });
      html += `</tbody></table></body></html>`;
      const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
      triggerDownload(blob, `${baseName}.xls`);
      showToast("📥 Excel downloaded");
    } else if (format === "pdf" || format === "print") {
      const w = window.open("", "_blank", "width=1200,height=900");
      if (!w) { showToast("⚠ Please allow pop-ups"); return; }
      let html = `<!DOCTYPE html><html><head><title>${config.title}</title><style>
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:Arial,sans-serif;padding:24px;color:#0f172a;}
        h1{font-size:22px;margin-bottom:4px;}
        .meta{font-size:11px;color:#64748b;margin-bottom:24px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th{background:#0f172a;color:#fff;padding:10px;text-align:left;font-size:10px;text-transform:uppercase;}
        td{padding:9px 10px;border-bottom:1px solid #e2e8f0;}
        tr:nth-child(even) td{background:#f8fafc;}
        .right{text-align:right;}
        .center{text-align:center;}
        .watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:80px;color:rgba(15,23,42,0.04);font-weight:900;pointer-events:none;}
        @media print{body{padding:12px;}}
      </style></head><body>
        <div class="watermark">STAYNEXA</div>
        <h1>${config.title}</h1>
        <div class="meta">${startDate} to ${endDate} · ${filteredData.length} records · Generated ${new Date().toLocaleString("en-IN")}</div>
        <table><thead><tr>`;
      cols.forEach((c) => { html += `<th class="${c.align === "right" ? "right" : c.align === "center" ? "center" : ""}">${c.label}</th>`; });
      html += `</tr></thead><tbody>`;
      filteredData.forEach((r) => {
        html += `<tr>`;
        cols.forEach((c) => {
          let v: any = r[c.key];
          if (v === null || v === undefined || v === "") v = "—";
          else if (c.format === "currency" && typeof v === "number") v = "₹" + v.toLocaleString("en-IN");
          html += `<td class="${c.align === "right" ? "right" : c.align === "center" ? "center" : ""}">${String(v).replace(/</g, "&lt;")}</td>`;
        });
        html += `</tr>`;
      });
      html += `</tbody></table></body></html>`;
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 500);
      showToast("🖨️ Print window opened");
    }
  };

  // ═══ Not found ═══
  if (!config) {
    return (
      <div className="p-12 text-center">
        <p className="text-6xl mb-4">🔍</p>
        <h2 className="text-xl font-bold text-slate-800">Report not found</h2>
        <p className="text-sm text-slate-500 mt-2">Slug: <code className="bg-slate-100 px-2 py-1 rounded">{reportSlug}</code></p>
        <Link href={`/reports/${category}`} className="mt-4 inline-block px-5 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-semibold">← Back to {category}</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* HEADER */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="px-8 py-5">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs mb-1.5">
                <Link href={`/reports/${category}`} className="text-slate-400 hover:text-slate-700 flex items-center gap-1">
                  ← {category.replace(/-/g, " ")}
                </Link>
                <span className="text-slate-300">/</span>
                <span className="font-semibold text-slate-700">{config.title}</span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">{config.title}</h1>
              <p className="text-sm text-slate-500 mt-1">{config.desc}</p>
            </div>
            <div className="relative">
              <button
                onClick={() => setDownloadMenu(!downloadMenu)}
                className="flex items-center gap-2 px-4 py-2.5 bg-black text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition"
              >
                📥 Download
                <svg className={`w-3 h-3 transition-transform ${downloadMenu ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {downloadMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setDownloadMenu(false)} />
                  <div className="absolute top-full right-0 mt-2 z-50 bg-white border border-slate-200 rounded-xl shadow-2xl w-[260px] overflow-hidden">
                    <button onClick={() => handleDownload("csv")} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100">
                      <span className="text-lg">📄</span>
                      <div><p className="text-sm font-semibold">CSV File</p><p className="text-[10px] text-slate-400">Universal spreadsheet</p></div>
                    </button>
                    <button onClick={() => handleDownload("excel")} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100">
                      <span className="text-lg">📊</span>
                      <div><p className="text-sm font-semibold">Excel File</p><p className="text-[10px] text-slate-400">Formatted spreadsheet</p></div>
                    </button>
                    <button onClick={() => handleDownload("pdf")} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100">
                      <span className="text-lg">📕</span>
                      <div><p className="text-sm font-semibold">PDF Document</p><p className="text-[10px] text-slate-400">Print-ready PDF</p></div>
                    </button>
                    <button onClick={() => handleDownload("print")} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3">
                      <span className="text-lg">🖨</span>
                      <div><p className="text-sm font-semibold">Print Now</p><p className="text-[10px] text-slate-400">Send to printer</p></div>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* FILTERS */}
        <div className="px-8 pb-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          {[
            { k: "today", l: "Today" },
            { k: "yesterday", l: "Yesterday" },
            { k: "week", l: "Last 7 Days" },
            { k: "month", l: "This Month" },
          ].map((opt) => (
            <button
              key={opt.k}
              onClick={() => applyPreset(opt.k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                preset === opt.k ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              }`}
            >
              {opt.l}
            </button>
          ))}
          <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPreset("custom"); }} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs" />
          <span className="text-slate-400 text-xs">→</span>
          <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPreset("custom"); }} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs" />
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 ml-2">
            <span className="text-[10px] font-bold text-slate-400 px-2 uppercase">Group:</span>
            {(["none", "day", "month"] as const).map((g) => (
              <button key={g} onClick={() => setGroupBy(g)} className={`px-2.5 py-1 rounded text-xs font-semibold transition ${groupBy === g ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                {g === "none" ? "None" : g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
          <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="ml-auto px-3 py-1.5 border border-slate-200 rounded-lg text-xs w-48" />
        </div>
      </div>

      {/* CONTENT */}
      <div className="p-8 space-y-6">
        {/* SUMMARY CARDS */}
        {!loading && filteredData.length > 0 && (
          <div className={`grid grid-cols-2 md:grid-cols-${Math.min(summary.length, 5)} gap-3`}>
            {summary.map((s, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{s.label}</p>
                <p className={`text-xl font-bold mt-1 ${s.color || "text-slate-900"}`}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* TABLE */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-20 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full border-4 border-slate-200 border-t-slate-900 animate-spin" />
            <p className="text-sm text-slate-500">Loading report...</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-20 text-center">
            <p className="text-6xl mb-4 opacity-30">📭</p>
            <p className="text-slate-500 font-semibold">No records found</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting the date range or filters</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {config.columns.map((c) => (
                      <th key={c.key} className={`px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"}`}>
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {groupedData.map((group) => (
                    <React.Fragment key={group.key}>
                      {group.label && (
                        <tr className="bg-slate-100/70">
                          <td colSpan={config.columns.length} className="px-4 py-2 text-xs font-bold text-slate-700 uppercase">
                            📅 {group.label} <span className="text-slate-400 font-medium ml-2">({group.rows.length} records)</span>
                          </td>
                        </tr>
                      )}
                      {group.rows.map((r: any, i: number) => (
                        <tr key={`${group.key}-${i}`} className="hover:bg-slate-50/70 transition">
                          {config.columns.map((c) => {
                            const v = r[c.key];
                            let display: any = v;

                            if (v === null || v === undefined || v === "") {
                              display = <span className="text-slate-300">—</span>;
                            } else if (c.format === "currency" && typeof v === "number") {
                              display = <span className="font-medium">{fmtC(v)}</span>;
                            } else if (c.format === "status") {
                              const color: Record<string, string> = {
                                "CHECKED-IN": "bg-emerald-50 text-emerald-700",
                                CONFIRMED: "bg-amber-50 text-amber-700",
                                "CHECKED-OUT": "bg-slate-100 text-slate-600",
                                "ON-HOLD": "bg-purple-50 text-purple-700",
                                CANCELLED: "bg-rose-50 text-rose-700",
                                "NO-SHOW": "bg-rose-50 text-rose-700",
                                CLEAN: "bg-emerald-50 text-emerald-700",
                                DIRTY: "bg-rose-50 text-rose-700",
                                INSPECTED: "bg-sky-50 text-sky-700",
                                MAINTENANCE: "bg-amber-50 text-amber-700",
                              };
                              display = (
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${color[v] || "bg-slate-100 text-slate-600"}`}>
                                  {v}
                                </span>
                              );
                            } else if (c.key === "notes" && typeof v === "string" && v.length > 80) {
                              display = v.slice(0, 80) + "…";
                            }

                            return (
                              <td key={c.key} className={`px-4 py-3 text-slate-700 whitespace-nowrap ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"}`}>
                                {display}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between text-xs">
              <p className="text-slate-500">Showing {filteredData.length} records · {startDate} to {endDate}</p>
              <p className="text-slate-400">Staynexa Reports</p>
            </div>
          </div>
        )}
      </div>

      {/* TOAST */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-xl text-sm font-medium z-50 shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}