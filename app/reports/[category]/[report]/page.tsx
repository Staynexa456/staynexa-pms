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
  width?: string;
};

type ReportConfig = {
  title: string;
  desc: string;
  icon: string;
  dataSource: "bookings" | "payments" | "rooms" | "bookings-with-addons" | "bookings-with-notes";
  filter?: (b: any) => boolean;
  columns: ReportColumn[];
};

// ═══════════════════════════════════════════════
// ALL REPORT CONFIGS
// ═══════════════════════════════════════════════
const REPORT_CONFIGS: Record<string, ReportConfig> = {
  master: {
    title: "Master Report", desc: "Complete bookings, customers, payments & taxes", icon: "📊",
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
    title: "Flash Manager Report", desc: "Occupancy, ADR, RevPAR & revenue metrics", icon: "⚡",
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
    title: "Guest Ledger Report", desc: "Outstanding balance from in-house guests", icon: "📒",
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
    title: "Room Revenue Report", desc: "Detailed room revenue & taxes", icon: "💰",
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
    title: "Sales Report", desc: "Date-wise performance report", icon: "📈",
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
    title: "Room Inventory Report", desc: "Live room inventory & status", icon: "🏨",
    dataSource: "rooms",
    columns: [
      { key: "room_number", label: "Room" },
      { key: "room_type", label: "Type" },
      { key: "housekeeping_status", label: "Status", align: "center", format: "status" },
      { key: "last_cleaned_by", label: "Cleaned By" },
    ],
  },
  shift: {
    title: "Shift Report", desc: "Payment transactions by staff", icon: "⏰",
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
    title: "BAR Pricing Report", desc: "Best Available Rate per room type", icon: "🏷️",
    dataSource: "rooms",
    columns: [
      { key: "room_number", label: "Room" },
      { key: "room_type", label: "Type" },
      { key: "base_price", label: "Base Rate", format: "currency", align: "right" },
    ],
  },
  folio: {
    title: "Folio Report", desc: "Guest folio balances & payments", icon: "📄",
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
    title: "Archived Folio Report", desc: "Historical completed folios", icon: "🗄️",
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
  "room-bookings": {
    title: "Room Bookings Report", desc: "Breakdown by room categories", icon: "🛏️",
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
    title: "Day Use Report", desc: "Same-day check-ins & check-outs", icon: "☀️",
    dataSource: "bookings",
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
    title: "New Bookings Report", desc: "All new reservations", icon: "🆕",
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
    title: "Arrivals Report", desc: "Guest arrivals overview", icon: "🛬",
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
    title: "Departures Report", desc: "Guest departures overview", icon: "🛫",
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
    title: "On-Hold Report", desc: "Bookings currently on hold", icon: "⏸️",
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
    title: "No-Show Report", desc: "Guests who didn't arrive", icon: "🚫",
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
    title: "Room Upgrade Report", desc: "Room upgrades via magic link", icon: "⬆️",
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
    title: "Early Check-In Report", desc: "Early check-ins via magic link", icon: "⏱️",
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
    title: "Late Check-Out Report", desc: "Late check-outs via magic link", icon: "⏰",
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
    title: "Booking Notes Report", desc: "Notes across all bookings", icon: "📝",
    dataSource: "bookings-with-notes",
    columns: [
      { key: "checkIn", label: "Date" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "notes", label: "Notes" },
    ],
  },
  "customer-notes": {
    title: "Customer Notes Report", desc: "Customer notes across bookings", icon: "💬",
    dataSource: "bookings-with-notes",
    columns: [
      { key: "checkIn", label: "Date" },
      { key: "guestName", label: "Guest" },
      { key: "guestPhone", label: "Phone" },
      { key: "notes", label: "Notes" },
    ],
  },
  "rate-plan-count": {
    title: "Rate Plan Count Report", desc: "Distribution of rate plans", icon: "📊",
    dataSource: "bookings",
    columns: [
      { key: "ratePlan", label: "Rate Plan" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "totalAmount", label: "Amount", format: "currency", align: "right" },
    ],
  },
  gateway: {
    title: "Payment Gateway Report", desc: "Card, UPI & Bank Transfer payments", icon: "💳",
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
    title: "Cash & Counter Report", desc: "Cash & offline payments", icon: "💵",
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
    title: "Refunds Report", desc: "Payment refunds", icon: "↩️",
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
    title: "Transfers Report", desc: "Payment settlements", icon: "🔄",
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
    title: "Payments by Type", desc: "Visa, Mastercard, UPI", icon: "🏦",
    dataSource: "payments",
    columns: [
      { key: "created_at", label: "Date" },
      { key: "method", label: "Type" },
      { key: "amount", label: "Amount", format: "currency", align: "right" },
      { key: "reference", label: "Reference" },
    ],
  },
  "counter-type": {
    title: "Counter by Payment Type", desc: "Cash, offline card payments", icon: "🏪",
    dataSource: "payments",
    columns: [
      { key: "created_at", label: "Date" },
      { key: "method", label: "Type" },
      { key: "amount", label: "Amount", format: "currency", align: "right" },
    ],
  },
  "ota-payment": {
    title: "OTA Payment Report", desc: "Pre-paid OTA bookings", icon: "🌐",
    dataSource: "bookings",
    filter: (b) => b.source && ["ota", "booking", "agoda", "makemytrip", "goibibo"].some((s) => String(b.source).toLowerCase().includes(s)),
    columns: [
      { key: "check_in", label: "Date" },
      { key: "booking_ref", label: "Ref" },
      { key: "guestName", label: "Guest" },
      { key: "source", label: "OTA" },
      { key: "totalAmount", label: "Amount", format: "currency", align: "right" },
    ],
  },
  "service-revenue": {
    title: "Service Revenue Report", desc: "Addon & service revenue", icon: "🛎️",
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
    title: "Service Sales Report", desc: "Date-wise service sales", icon: "🧾",
    dataSource: "bookings-with-addons",
    columns: [
      { key: "checkIn", label: "Date" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "addonList", label: "Addons" },
      { key: "addonTotal", label: "Revenue", format: "currency", align: "right" },
    ],
  },
  "room-taxes": {
    title: "Room Taxes Report", desc: "Booking-wise tax breakdown", icon: "🏛️",
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
    title: "GST Report", desc: "Complete GST breakdown for filing", icon: "🧾",
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
  "guest-list": {
    title: "Guest List Report", desc: "Complete guest directory", icon: "👥",
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
    title: "Top Spenders Report", desc: "Highest revenue guests", icon: "🏆",
    dataSource: "bookings",
    columns: [
      { key: "guestName", label: "Guest" },
      { key: "guestPhone", label: "Phone" },
      { key: "roomNumber", label: "Room" },
      { key: "totalAmount", label: "Total Spent", format: "currency", align: "right" },
    ],
  },
  "guest-origins": {
    title: "Guest Origins Report", desc: "Country-wise breakdown", icon: "🌍",
    dataSource: "bookings",
    columns: [
      { key: "guestCountry", label: "Country" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "totalAmount", label: "Revenue", format: "currency", align: "right" },
    ],
  },
  "repeat-guests": {
    title: "Repeat Guests Report", desc: "Guests with multiple stays", icon: "🔁",
    dataSource: "bookings",
    columns: [
      { key: "guestName", label: "Guest" },
      { key: "guestPhone", label: "Phone" },
      { key: "roomNumber", label: "Room" },
      { key: "checkIn", label: "Stay Date" },
    ],
  },
  "shopwise-revenue": {
    title: "Shopwise Revenue Report", desc: "Revenue by outlet", icon: "🏬",
    dataSource: "payments",
    columns: [
      { key: "created_at", label: "Date" },
      { key: "method", label: "Method" },
      { key: "amount", label: "Revenue", format: "currency", align: "right" },
      { key: "note", label: "Outlet" },
    ],
  },
  "alloutlets-daysales": {
    title: "All Outlets Day-wise Sales", desc: "Consolidated daily sales", icon: "📅",
    dataSource: "payments",
    columns: [
      { key: "created_at", label: "Date" },
      { key: "method", label: "Method" },
      { key: "amount", label: "Amount", format: "currency", align: "right" },
    ],
  },
  "alloutlets-hourly": {
    title: "All Outlets Hourly Sales", desc: "Hourly sales variation", icon: "⏰",
    dataSource: "payments",
    columns: [
      { key: "created_at", label: "Date & Time" },
      { key: "method", label: "Method" },
      { key: "amount", label: "Amount", format: "currency", align: "right" },
    ],
  },
  "alloutlets-category": {
    title: "All Outlets Category Summary", desc: "Category-wise sales", icon: "📁",
    dataSource: "payments",
    columns: [
      { key: "created_at", label: "Date" },
      { key: "method", label: "Method" },
      { key: "amount", label: "Amount", format: "currency", align: "right" },
    ],
  },
  "alloutlets-orders": {
    title: "All Outlets Order-wise Sales", desc: "Order-wise sales summary", icon: "📋",
    dataSource: "payments",
    columns: [
      { key: "created_at", label: "Date" },
      { key: "method", label: "Method" },
      { key: "amount", label: "Amount", format: "currency", align: "right" },
      { key: "reference", label: "Order Ref" },
    ],
  },
  "user-log": {
    title: "User Log Report", desc: "User activity logs", icon: "📜",
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
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

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

    if (config.filter) result = result.filter(config.filter);
    return result;
  }, [config, rawBookings, rawPayments, rawRooms]);

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase();
    return data.filter((r) => Object.values(r).some((v) => String(v || "").toLowerCase().includes(q)));
  }, [data, searchQuery]);

  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      const na = Number(va);
      const nb = Number(vb);
      if (!isNaN(na) && !isNaN(nb)) return sortDir === "asc" ? na - nb : nb - na;
      const sa = String(va || "").toLowerCase();
      const sb = String(vb || "").toLowerCase();
      return sortDir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
  }, [filteredData, sortKey, sortDir]);

  const groupedData = useMemo(() => {
    if (groupBy === "none") return [{ key: "all", label: "", rows: sortedData }];
    const groups: Record<string, any[]> = {};
    sortedData.forEach((r: any) => {
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
  }, [sortedData, groupBy]);

  const paginatedGroups = useMemo(() => {
    if (groupBy === "none") {
      const start = (currentPage - 1) * ITEMS_PER_PAGE;
      return [{ key: "all", label: "", rows: sortedData.slice(start, start + ITEMS_PER_PAGE) }];
    }
    const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);
    if (currentPage > totalPages) setCurrentPage(1);
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const slice = sortedData.slice(start, start + ITEMS_PER_PAGE);
    return [{ key: "page", label: "", rows: slice }];
  }, [sortedData, groupBy, currentPage]);

  const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);

  const summary = useMemo(() => {
    const totalRev = filteredData.reduce((s, r: any) => s + (Number(r.roomCharge) || 0), 0);
    const totalTax = filteredData.reduce((s, r: any) => s + (Number(r.taxAmount) || 0), 0);
    const totalPaid = filteredData.reduce((s, r: any) => s + (Number(r.paidAmount) || 0), 0);
    const totalDue = filteredData.reduce((s, r: any) => s + (Number(r.balanceDue) || 0), 0);
    
    if (config?.dataSource === "payments") {
      const totalPmts = filteredData.reduce((s, p: any) => s + (Number(p.amount) || 0), 0);
      return [
        { label: "Records", value: String(filteredData.length), icon: "📊", color: "slate" },
        { label: "Total Collected", value: `₹${totalPmts.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, icon: "💰", color: "emerald" },
      ];
    }
    if (config?.dataSource === "rooms") {
      const clean = filteredData.filter((r: any) => (r.housekeeping_status || "CLEAN") === "CLEAN").length;
      const dirty = filteredData.filter((r: any) => r.housekeeping_status === "DIRTY").length;
      const maintenance = filteredData.filter((r: any) => r.housekeeping_status === "MAINTENANCE").length;
      return [
        { label: "Total Rooms", value: String(filteredData.length), icon: "🏨", color: "slate" },
        { label: "Clean", value: String(clean), icon: "✅", color: "emerald" },
        { label: "Dirty", value: String(dirty), icon: "🧹", color: "rose" },
        { label: "Maintenance", value: String(maintenance), icon: "🔧", color: "amber" },
      ];
    }
    return [
      { label: "Records", value: String(filteredData.length), icon: "📊", color: "slate" },
      { label: "Revenue", value: `₹${totalRev.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, icon: "💰", color: "sky" },
      { label: "Tax", value: `₹${totalTax.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, icon: "🧾", color: "violet" },
      { label: "Collected", value: `₹${totalPaid.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, icon: "✅", color: "emerald" },
      { label: "Pending", value: `₹${totalDue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, icon: "⚠️", color: "rose" },
    ];
  }, [filteredData, config]);

  const fmtC = (n: number) => `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

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
      const csvRows = sortedData.map((r) => cols.map((c) => r[c.key]));
      const csv = [headers.join(","), ...csvRows.map((r) => r.map((v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      triggerDownload(blob, `${baseName}.csv`);
      showToast("📥 CSV downloaded");
    } else if (format === "excel") {
      let html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"><style>table{border-collapse:collapse;font-family:Calibri;}th{background:#0f172a;color:#fff;padding:10px 14px;border:1px solid #cbd5e1;text-align:left;font-weight:bold;}td{border:1px solid #e2e8f0;padding:8px 14px;}tr:nth-child(even) td{background:#f8fafc;}h2{margin:0 0 8px;font-family:Calibri;}</style></head><body>`;
      html += `<h2>${config.title}</h2><p>${startDate} to ${endDate} · ${sortedData.length} records</p><table><thead><tr>`;
      cols.forEach((c) => { html += `<th>${c.label}</th>`; });
      html += `</tr></thead><tbody>`;
      sortedData.forEach((r) => {
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

      let totalsRow = "";
      if (config.dataSource === "bookings" || config.dataSource === "bookings-with-notes") {
        const totalRev = sortedData.reduce((s, r: any) => s + (Number(r.roomCharge) || 0), 0);
        const totalTax = sortedData.reduce((s, r: any) => s + (Number(r.taxAmount) || 0), 0);
        const totalPaid = sortedData.reduce((s, r: any) => s + (Number(r.paidAmount) || 0), 0);
        const totalDue = sortedData.reduce((s, r: any) => s + (Number(r.balanceDue) || 0), 0);
        if (totalRev > 0) {
          totalsRow = `<tr class="totals"><td colspan="5" class="right">TOTALS</td><td class="right">₹${totalRev.toLocaleString("en-IN")}</td><td class="right">₹${totalTax.toLocaleString("en-IN")}</td><td class="right">—</td><td class="right">₹${totalPaid.toLocaleString("en-IN")}</td><td class="right">₹${totalDue.toLocaleString("en-IN")}</td></tr>`;
        }
      }

      let html = `<!DOCTYPE html><html><head><title>${config.title}</title><style>
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:'Helvetica Neue',Arial,sans-serif;padding:32px;color:#0f172a;}
        .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0f172a;padding-bottom:20px;margin-bottom:24px;}
        .header h1{font-size:24px;font-weight:700;letter-spacing:-0.5px;margin-bottom:4px;}
        .header p{font-size:12px;color:#64748b;}
        .header .meta{text-align:right;font-size:11px;color:#64748b;}
        .header .meta strong{color:#0f172a;}
        table{width:100%;border-collapse:collapse;font-size:10.5px;}
        th{background:#0f172a;color:#fff;padding:10px 8px;text-align:left;font-size:9.5px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;}
        td{padding:8px;border-bottom:1px solid #e2e8f0;}
        tr:nth-child(even) td{background:#f8fafc;}
        .right{text-align:right;}
        .center{text-align:center;}
        .totals td{background:#0f172a !important;color:#fff !important;font-weight:700;border-top:2px solid #0f172a;}
        .footer{margin-top:32px;padding-top:16px;border-top:1px solid #cbd5e1;font-size:10px;color:#94a3b8;display:flex;justify-content:space-between;}
        .watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:100px;color:rgba(15,23,42,0.03);font-weight:900;pointer-events:none;z-index:-1;letter-spacing:8px;}
        @media print{body{padding:16px;} .header h1{font-size:20px;} table{font-size:9px;} th,td{padding:6px;}}
      </style></head><body>
        <div class="watermark">STAYNEXA</div>
        <div class="header">
          <div>
            <h1>${config.title}</h1>
            <p>${config.desc}</p>
          </div>
          <div class="meta">
            <div>Period: <strong>${startDate} to ${endDate}</strong></div>
            <div>Records: <strong>${sortedData.length}</strong></div>
            <div>Generated: ${new Date().toLocaleString("en-IN")}</div>
          </div>
        </div>
        <table><thead><tr>`;
      cols.forEach((c) => { html += `<th class="${c.align === "right" ? "right" : c.align === "center" ? "center" : ""}">${c.label}</th>`; });
      html += `</tr></thead><tbody>`;
      sortedData.forEach((r) => {
        html += `<tr>`;
        cols.forEach((c) => {
          let v: any = r[c.key];
          if (v === null || v === undefined || v === "") v = "—";
          else if (c.format === "currency" && typeof v === "number") v = "₹" + v.toLocaleString("en-IN");
          html += `<td class="${c.align === "right" ? "right" : c.align === "center" ? "center" : ""}">${String(v).replace(/</g, "&lt;")}</td>`;
        });
        html += `</tr>`;
      });
      html += totalsRow;
      html += `</tbody></table>
        <div class="footer">
          <span>Staynexa PMS · Reports Module</span>
          <span>${config.title}</span>
        </div>
      </body></html>`;
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 500);
      showToast("🖨️ Print window opened");
    }
  };

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  if (!config) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-12">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">🔍</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Report not found</h2>
          <p className="text-sm text-slate-500 mb-6">The report <code className="bg-slate-100 px-2 py-1 rounded text-xs">{reportSlug}</code> doesn't exist</p>
          <Link href={`/reports/${category}`} className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-full text-sm font-semibold hover:bg-slate-800 transition">
            ← Back to {category.replace(/-/g, " ")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60">
      {/* ═══ HEADER ═══ */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-8 lg:px-10 py-6">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-xs mb-4">
            <Link href="/reports" className="text-slate-400 hover:text-slate-700 transition">Reports</Link>
            <span className="text-slate-300">/</span>
            <Link href={`/reports/${category}`} className="text-slate-400 hover:text-slate-700 transition capitalize">{category.replace(/-/g, " ")}</Link>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-slate-800">{config.title}</span>
          </nav>

          {/* Title Row */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center shadow-lg shadow-slate-900/20 shrink-0">
                <span className="text-2xl">{config.icon}</span>
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">{config.title}</h1>
                <p className="text-sm text-slate-500 mt-1">{config.desc}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={load}
                className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-xl transition"
                title="Refresh"
              >
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <div className="relative">
                <button
                  onClick={() => setDownloadMenu(!downloadMenu)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                  <svg className={`w-3 h-3 transition-transform ${downloadMenu ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {downloadMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setDownloadMenu(false)} />
                    <div className="absolute top-full right-0 mt-2 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl w-[280px] overflow-hidden">
                      <div className="bg-gradient-to-r from-slate-900 to-slate-700 px-4 py-3">
                        <p className="text-white text-xs font-bold uppercase tracking-wider">Export Report</p>
                        <p className="text-white/70 text-[10px] mt-0.5">{sortedData.length} records</p>
                      </div>
                      <button onClick={() => handleDownload("excel")} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100 transition group">
                        <div className="w-9 h-9 rounded-lg bg-emerald-50 group-hover:bg-emerald-100 flex items-center justify-center text-base transition">📊</div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-800">Excel (.xls)</p>
                          <p className="text-[10px] text-slate-400">Formatted with headers</p>
                        </div>
                      </button>
                      <button onClick={() => handleDownload("csv")} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100 transition group">
                        <div className="w-9 h-9 rounded-lg bg-sky-50 group-hover:bg-sky-100 flex items-center justify-center text-base transition">📄</div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-800">CSV (.csv)</p>
                          <p className="text-[10px] text-slate-400">Universal spreadsheet format</p>
                        </div>
                      </button>
                      <button onClick={() => handleDownload("pdf")} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100 transition group">
                        <div className="w-9 h-9 rounded-lg bg-rose-50 group-hover:bg-rose-100 flex items-center justify-center text-base transition">📕</div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-800">PDF Document</p>
                          <p className="text-[10px] text-slate-400">Print-ready PDF</p>
                        </div>
                      </button>
                      <button onClick={() => handleDownload("print")} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 transition group">
                        <div className="w-9 h-9 rounded-lg bg-violet-50 group-hover:bg-violet-100 flex items-center justify-center text-base transition">🖨</div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-800">Print Now</p>
                          <p className="text-[10px] text-slate-400">Send to printer directly</p>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ FILTERS BAR ═══ */}
      <div className="bg-white border-b border-slate-200 px-8 lg:px-10 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Presets */}
          {[
            { k: "today", l: "Today" },
            { k: "yesterday", l: "Yesterday" },
            { k: "week", l: "7 Days" },
            { k: "month", l: "Month" },
          ].map((opt) => (
            <button
              key={opt.k}
              onClick={() => applyPreset(opt.k)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                preset === opt.k
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {opt.l}
            </button>
          ))}

          <div className="h-5 w-px bg-slate-200 mx-1" />

          {/* Custom Date Range */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPreset("custom"); }}
              className="bg-transparent text-xs font-medium text-slate-700 outline-none w-[110px]"
            />
            <span className="text-slate-400 text-xs">→</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPreset("custom"); }}
              className="bg-transparent text-xs font-medium text-slate-700 outline-none w-[110px]"
            />
          </div>

          <div className="h-5 w-px bg-slate-200 mx-1" />

          {/* Group By */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase px-2.5">Group</span>
            {(["none", "day", "month"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                  groupBy === g ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {g === "none" ? "None" : g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative ml-auto">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search records..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-lg text-xs w-56 outline-none transition"
            />
          </div>
        </div>
      </div>

      {/* ═══ CONTENT ═══ */}
      <div className="px-8 lg:px-10 py-6 space-y-5">
        {/* Summary Cards */}
        {!loading && sortedData.length > 0 && (
          <div className={`grid grid-cols-2 md:grid-cols-${Math.min(summary.length, 5)} gap-3`}>
            {summary.map((s, i) => {
              const colorMap: Record<string, { bg: string; text: string; border: string }> = {
                slate: { bg: "bg-slate-50", text: "text-slate-900", border: "border-slate-200" },
                sky: { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" },
                emerald: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
                rose: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
                violet: { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
                amber: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
              };
              const c = colorMap[s.color] || colorMap.slate;
              return (
                <div key={i} className={`bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-md transition-shadow`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{s.label}</p>
                    <div className={`w-8 h-8 rounded-lg ${c.bg} ${c.border} border flex items-center justify-center text-sm`}>{s.icon}</div>
                  </div>
                  <p className={`text-2xl font-bold ${c.text} tracking-tight`}>{s.value}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-24 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full border-[3px] border-slate-200 border-t-slate-900 animate-spin" />
            <p className="text-sm text-slate-500 font-semibold">Loading report data</p>
            <p className="text-xs text-slate-400 mt-1">Please wait...</p>
          </div>
        ) : sortedData.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-24 text-center">
            <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-5">
              <span className="text-4xl opacity-40">📭</span>
            </div>
            <p className="text-base font-bold text-slate-700">No records found</p>
            <p className="text-sm text-slate-400 mt-2">Try changing the date range or clearing filters</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Table Header */}
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center gap-3">
                <p className="text-sm font-bold text-slate-800">Report Data</p>
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-600">{sortedData.length} records</span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">{startDate} → {endDate}</p>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/80 border-b border-slate-200">
                  <tr>
                    {config.columns.map((c) => (
                      <th
                        key={c.key}
                        onClick={() => handleSort(c.key)}
                        className={`px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition select-none ${
                          c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"
                        }`}
                      >
                        <div className={`flex items-center gap-1 ${c.align === "right" ? "justify-end" : c.align === "center" ? "justify-center" : "justify-start"}`}>
                          {c.label}
                          {sortKey === c.key && (
                            <span className="text-[8px] text-slate-900">{sortDir === "asc" ? "▲" : "▼"}</span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedGroups.map((group) => (
                    <React.Fragment key={group.key}>
                      {group.label && (
                        <tr className="bg-slate-100/60">
                          <td colSpan={config.columns.length} className="px-4 py-2 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            <span className="inline-flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              {group.label}
                              <span className="text-slate-400 font-medium normal-case ml-1">({group.rows.length})</span>
                            </span>
                          </td>
                        </tr>
                      )}
                      {group.rows.map((r: any, i: number) => (
                        <tr key={`${group.key}-${i}`} className="hover:bg-slate-50/80 transition-colors">
                          {config.columns.map((c) => {
                            const v = r[c.key];
                            let display: any = v;

                            if (v === null || v === undefined || v === "") {
                              display = <span className="text-slate-300">—</span>;
                            } else if (c.format === "currency" && typeof v === "number") {
                              display = <span className="font-semibold tabular-nums">{fmtC(v)}</span>;
                            } else if (c.format === "status") {
                              const color: Record<string, string> = {
                                "CHECKED-IN": "bg-emerald-100 text-emerald-700 ring-emerald-200",
                                CONFIRMED: "bg-amber-100 text-amber-700 ring-amber-200",
                                "CHECKED-OUT": "bg-slate-100 text-slate-600 ring-slate-200",
                                "ON-HOLD": "bg-purple-100 text-purple-700 ring-purple-200",
                                CANCELLED: "bg-rose-100 text-rose-700 ring-rose-200",
                                "NO-SHOW": "bg-rose-100 text-rose-700 ring-rose-200",
                                CLEAN: "bg-emerald-100 text-emerald-700 ring-emerald-200",
                                DIRTY: "bg-rose-100 text-rose-700 ring-rose-200",
                                INSPECTED: "bg-sky-100 text-sky-700 ring-sky-200",
                                MAINTENANCE: "bg-amber-100 text-amber-700 ring-amber-200",
                              };
                              display = (
                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full ring-1 uppercase tracking-wide ${color[v] || "bg-slate-100 text-slate-600 ring-slate-200"}`}>
                                  <span className="w-1 h-1 rounded-full bg-current" />
                                  {v}
                                </span>
                              );
                            } else if (c.key === "notes" && typeof v === "string" && v.length > 80) {
                              display = <span title={v}>{v.slice(0, 80)}…</span>;
                            }

                            return (
                              <td
                                key={c.key}
                                className={`px-4 py-3 text-slate-700 whitespace-nowrap ${
                                  c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"
                                }`}
                              >
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

            {/* Footer + Pagination */}
            <div className="border-t border-slate-200 px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/60">
              <p className="text-xs text-slate-500">
                Showing <span className="font-semibold text-slate-700">{Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, sortedData.length)}</span>–<span className="font-semibold text-slate-700">{Math.min(currentPage * ITEMS_PER_PAGE, sortedData.length)}</span> of <span className="font-semibold text-slate-700">{sortedData.length}</span>
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 text-slate-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    «
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 text-slate-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    ←
                  </button>
                  <div className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg">
                    {currentPage} <span className="text-slate-400 font-medium">/ {totalPages}</span>
                  </div>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 text-slate-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    →
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 text-slate-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    »
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* TOAST */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl text-sm font-semibold shadow-2xl z-50 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          {toast}
        </div>
      )}
    </div>
  );
}