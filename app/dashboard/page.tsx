
// app/dashboard/page.tsx
"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useActiveHotel } from "../lib/use-active-hotel";
import { fetchBookings } from "../db";

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════
function fmtFull(n: number): string {
  return `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
}
function fmtShort(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n || 0)}`;
}
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function formatPrettyDate(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const date = new Date(y, m - 1, d);
  return `${days[date.getDay()]}, ${d} ${months[m - 1]} ${y}`;
}

type KpiType = "arrivals" | "departures" | "newbookings" | "inhouse";

// ═══════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════
export default function DashboardPage() {
  const { hotelId, loading: hotelLoading } = useActiveHotel();

  const [selectedDate, setSelectedDate] = useState<string>(todayISO());
  const [allBookings, setAllBookings] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeKpi, setActiveKpi] = useState<KpiType>("arrivals");
  const [subFilter, setSubFilter] = useState<string>("all");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [detailsBooking, setDetailsBooking] = useState<any | null>(null);
  const [downloading, setDownloading] = useState(false);

  // ═══ Load data ═══
  const loadData = useCallback(async () => {
    if (!hotelId) return;
    try {
      setLoading(true);
      const [bookingsData, roomsResp] = await Promise.all([
        fetchBookings(hotelId),
        (async () => {
          const { supabase } = await import("../supabase");
          const { data } = await supabase
            .from("rooms")
            .select("*")
            .eq("hotel_id", hotelId);
          return data || [];
        })(),
      ]);
      setAllBookings(bookingsData || []);
      setRooms(roomsResp || []);
    } catch (err) {
      console.error("[Dashboard] load error:", err);
    } finally {
      setLoading(false);
    }
  }, [hotelId]);

  useEffect(() => {
    if (!hotelLoading && hotelId) loadData();
  }, [hotelId, hotelLoading, loadData]);

  useEffect(() => {
    const handler = () => loadData();
    window.addEventListener("booking-updated", handler);
    window.addEventListener("hotel-changed", handler);
    return () => {
      window.removeEventListener("booking-updated", handler);
      window.removeEventListener("hotel-changed", handler);
    };
  }, [loadData]);

  // ═══ Filter by date ═══
  const arrivals = useMemo(() => {
    return allBookings.filter((b: any) => {
      const ci = (b.check_in || b.checkIn || "").split("T")[0];
      return ci === selectedDate;
    });
  }, [allBookings, selectedDate]);

  const departures = useMemo(() => {
    return allBookings.filter((b: any) => {
      const co = (b.check_out || b.checkOut || "").split("T")[0];
      return co === selectedDate;
    });
  }, [allBookings, selectedDate]);

  const newBookings = useMemo(() => {
    return allBookings.filter((b: any) => {
      const created = (b.created_at || b.createdAt || "").split("T")[0];
      return created === selectedDate;
    });
  }, [allBookings, selectedDate]);

  const inHouse = useMemo(() => {
    return allBookings.filter((b: any) => {
      const status = (b.status || "").toUpperCase();
      return status === "CHECKED-IN" || status === "PENDING DEPARTURE";
    });
  }, [allBookings]);

  // ═══ Occupancy ═══
  const occupancy = useMemo(() => {
    const totalRooms = rooms.length;
    const occupied = inHouse.length;
    const available = Math.max(0, totalRooms - occupied);
    const rate = totalRooms > 0 ? (occupied / totalRooms) * 100 : 0;
    return { totalRooms, occupied, available, rate };
  }, [rooms, inHouse]);

  // ═══ Housekeeping ═══
  const housekeeping = useMemo(() => {
    const clean = rooms.filter((r: any) => r.housekeeping_status === "CLEAN").length;
    const dirty = rooms.filter((r: any) => r.housekeeping_status === "DIRTY").length;
    const inspected = rooms.filter((r: any) => r.housekeeping_status === "INSPECTED").length;
    const maintenance = rooms.filter((r: any) => r.housekeeping_status === "MAINTENANCE").length;
    const total = rooms.length;
    const score = total > 0 ? ((clean + inspected) / total) * 100 : 0;
    return { clean, dirty, inspected, maintenance, total, score };
  }, [rooms]);

  // ═══ Revenue ═══
  const revenue = useMemo(() => {
    const today = todayISO();
    const monthPrefix = today.substring(0, 7);

    let todayCollection = 0;
    let monthCollection = 0;
    let totalPending = 0;

    allBookings.forEach((b: any) => {
      const status = (b.status || "").toUpperCase();
      if (status === "CANCELLED" || status === "BLOCKED") return;

      const paid = Number(b.paid) || 0;
      const amount = Number(b.amount) || 0;
      const tax = Number(b.tax) || 0;
      const total = amount + tax;
      const balance = Math.max(0, total - paid);

      const checkIn = (b.check_in || "").split("T")[0];
      if (checkIn === today) todayCollection += paid;
      if (checkIn.startsWith(monthPrefix)) monthCollection += paid;
      if (balance > 0) totalPending += balance;
    });

    return { todayCollection, monthCollection, totalPending };
  }, [allBookings]);

  // ═══ Pending Payments (from ALL bookings, not just in-house) ═══
  const pendingPayments = useMemo(() => {
    return allBookings
      .filter((b: any) => {
        const status = (b.status || "").toUpperCase();
        if (status === "CANCELLED" || status === "BLOCKED") return false;
        const paid = Number(b.paid) || 0;
        const total = (Number(b.amount) || 0) + (Number(b.tax) || 0);
        return total - paid > 0;
      })
      .map((b: any) => ({
        ...b,
        balance: (Number(b.amount) || 0) + (Number(b.tax) || 0) - (Number(b.paid) || 0),
      }))
      .sort((a: any, b: any) => b.balance - a.balance);
  }, [allBookings]);

  const totalPendingAmount = useMemo(
    () => pendingPayments.reduce((sum: number, p: any) => sum + p.balance, 0),
    [pendingPayments]
  );

  // ═══ KPI counts ═══
  const kpiCounts = {
    arrivals: arrivals.length,
    departures: departures.length,
    newbookings: newBookings.length,
    inhouse: inHouse.length,
  };

  // ═══ Sub-filter ═══
  const filteredList = useMemo(() => {
    let base: any[] = [];
    if (activeKpi === "arrivals") base = arrivals;
    else if (activeKpi === "departures") base = departures;
    else if (activeKpi === "newbookings") base = newBookings;
    else if (activeKpi === "inhouse") base = inHouse;

    if (subFilter === "all") return base;

    if (activeKpi === "arrivals") {
      if (subFilter === "checkedin") base = base.filter((b) => (b.status || "").toUpperCase() === "CHECKED-IN");
      else if (subFilter === "pending") base = base.filter((b) => (b.status || "").toUpperCase() === "CONFIRMED");
    } else if (activeKpi === "departures") {
      if (subFilter === "checkedout") base = base.filter((b) => (b.status || "").toUpperCase() === "CHECKED-OUT");
      else if (subFilter === "pending") base = base.filter((b) => {
        const s = (b.status || "").toUpperCase();
        return s === "CHECKED-IN" || s === "PENDING DEPARTURE";
      });
    } else if (activeKpi === "newbookings") {
      if (subFilter === "confirmed") base = base.filter((b) => (b.status || "").toUpperCase() === "CONFIRMED");
      else if (subFilter === "checkedin") base = base.filter((b) => (b.status || "").toUpperCase() === "CHECKED-IN");
    } else if (activeKpi === "inhouse") {
      if (subFilter === "checkedin") base = base.filter((b) => (b.status || "").toUpperCase() === "CHECKED-IN");
      else if (subFilter === "pendingout") base = base.filter((b) => (b.status || "").toUpperCase() === "PENDING DEPARTURE");
    }
    return base;
  }, [activeKpi, subFilter, arrivals, departures, newBookings, inHouse]);

  // ═══ Sub-filter data ═══
  const subFilterData = useMemo(() => {
    if (activeKpi === "arrivals") {
      return [
        { key: "all", label: "All Arrivals", count: arrivals.length },
        { key: "checkedin", label: "Checked In", count: arrivals.filter((b) => (b.status || "").toUpperCase() === "CHECKED-IN").length },
        { key: "pending", label: "Pending Arrival", count: arrivals.filter((b) => (b.status || "").toUpperCase() === "CONFIRMED").length },
      ];
    }
    if (activeKpi === "departures") {
      return [
        { key: "all", label: "All Departures", count: departures.length },
        { key: "checkedout", label: "Checked Out", count: departures.filter((b) => (b.status || "").toUpperCase() === "CHECKED-OUT").length },
        { key: "pending", label: "Pending Check-out", count: departures.filter((b) => {
          const s = (b.status || "").toUpperCase();
          return s === "CHECKED-IN" || s === "PENDING DEPARTURE";
        }).length },
      ];
    }
    if (activeKpi === "newbookings") {
      return [
        { key: "all", label: "All Bookings", count: newBookings.length },
        { key: "confirmed", label: "Confirmed", count: newBookings.filter((b) => (b.status || "").toUpperCase() === "CONFIRMED").length },
        { key: "checkedin", label: "Checked In", count: newBookings.filter((b) => (b.status || "").toUpperCase() === "CHECKED-IN").length },
      ];
    }
    if (activeKpi === "inhouse") {
      return [
        { key: "all", label: "All In-House", count: inHouse.length },
        { key: "checkedin", label: "Checked In", count: inHouse.filter((b) => (b.status || "").toUpperCase() === "CHECKED-IN").length },
        { key: "pendingout", label: "Pending Departure", count: inHouse.filter((b) => (b.status || "").toUpperCase() === "PENDING DEPARTURE").length },
      ];
    }
    return [];
  }, [activeKpi, arrivals, departures, newBookings, inHouse]);

  useEffect(() => {
    setSubFilter("all");
  }, [activeKpi]);

  // ═══ PDF Download (Fixed with Blob URL) ═══
  const downloadPDF = async () => {
    setDownloading(true);
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 80, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("Staynexa PMS", 40, 40);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(20, 184, 166);
      doc.text(activeKpi.toUpperCase() + " REPORT", 40, 60);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.text(`Date: ${formatPrettyDate(selectedDate)}`, pageWidth - 40, 45, { align: "right" });

      autoTable(doc, {
        startY: 110,
        head: [["#", "Guest", "Room", "Status", "Check-in", "Check-out", "Balance"]],
        body: filteredList.map((b: any, i: number) => [
          String(i + 1),
          b.guestName || b.primaryGuest?.name || "Guest",
          b.roomNumber || b.room?.room_number || "—",
          b.status || "—",
          (b.check_in || b.checkIn || "—").split("T")[0],
          (b.check_out || b.checkOut || "—").split("T")[0],
          b.balance > 0 ? fmtFull(b.balance) : "Paid",
        ]),
        theme: "striped",
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
        margin: { left: 40, right: 40 },
      });

      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(148, 163, 184);
        doc.text(`Staynexa PMS · Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 25, { align: "center" });
      }

      // ✅ FIX: Blob URL দিয়ে download — সব ব্রাউজারে (mobile included) কাজ করবে
      const filename = `Staynexa-${activeKpi}-${selectedDate}.pdf`;
      const blob = doc.output("blob");
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (err) {
      console.error("PDF error:", err);
      alert("PDF failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setDownloading(false);
    }
  };

  const changeDate = (days: number) => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + days);
    const next = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    setSelectedDate(next);
  };

  if (loading || hotelLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full border-4 border-slate-200 border-t-teal-600 animate-spin" />
          <p className="text-slate-500 font-semibold text-sm">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  const isEmpty = allBookings.length === 0 && rooms.length === 0;

  const kpiConfig: { key: KpiType; label: string; icon: string; color: string }[] = [
    { key: "arrivals", label: "Arrivals", icon: "🛬", color: "emerald" },
    { key: "departures", label: "Departures", icon: "🛫", color: "rose" },
    { key: "newbookings", label: "New Bookings", icon: "✨", color: "indigo" },
    { key: "inhouse", label: "In-House", icon: "👥", color: "sky" },
  ];

  const colorMap: any = {
    emerald: { bg: "bg-emerald-500", light: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-700", ring: "ring-emerald-500/20", grad: "from-emerald-400 to-emerald-600" },
    rose: { bg: "bg-rose-500", light: "bg-rose-50", border: "border-rose-300", text: "text-rose-700", ring: "ring-rose-500/20", grad: "from-rose-400 to-rose-600" },
    indigo: { bg: "bg-indigo-500", light: "bg-indigo-50", border: "border-indigo-300", text: "text-indigo-700", ring: "ring-indigo-500/20", grad: "from-indigo-400 to-indigo-600" },
    sky: { bg: "bg-sky-500", light: "bg-sky-50", border: "border-sky-300", text: "text-sky-700", ring: "ring-sky-500/20", grad: "from-sky-400 to-sky-600" },
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-4 lg:p-6 space-y-5">

        {/* HERO HEADER */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 lg:p-8 shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-teal-500/20 to-cyan-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-br from-violet-500/10 to-transparent rounded-full blur-3xl -ml-20 -mb-20" />

          <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-widest rounded-full border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
                <span className="text-slate-400 text-xs">{formatPrettyDate(selectedDate)}</span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">Dashboard</h1>
              <p className="text-slate-300 text-sm mt-1">
                {occupancy.occupied} occupied · {kpiCounts.arrivals} arrivals · {kpiCounts.departures} departures
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-white/10 rounded-xl p-1 border border-white/10">
                <button
                  onClick={() => changeDate(-1)}
                  className="w-8 h-8 rounded-lg hover:bg-white/20 text-white flex items-center justify-center text-sm font-bold transition"
                >
                  ←
                </button>
                <button
                  onClick={() => setCalendarOpen(!calendarOpen)}
                  className="px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20 rounded-lg transition"
                >
                  📅 {formatPrettyDate(selectedDate)}
                </button>
                <button
                  onClick={() => changeDate(1)}
                  className="w-8 h-8 rounded-lg hover:bg-white/20 text-white flex items-center justify-center text-sm font-bold transition"
                >
                  →
                </button>
              </div>

              <button
                onClick={downloadPDF}
                disabled={downloading}
                className="px-4 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:opacity-90 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-lg"
              >
                {downloading ? "…" : "📄 Report"}
              </button>

              <Link href="/calendar" className="px-4 py-2.5 bg-white text-slate-900 rounded-xl text-xs font-bold hover:bg-slate-100 transition">
                📅 Calendar
              </Link>
            </div>
          </div>

          <div className="relative mt-6 pt-5 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-4">
            <QuickStat label="Today's Collection" value={fmtFull(revenue.todayCollection)} />
            <QuickStat label="Month Revenue" value={fmtShort(revenue.monthCollection)} />
            <QuickStat label="Occupancy" value={`${occupancy.rate.toFixed(0)}%`} />
            <QuickStat label="Outstanding" value={fmtShort(revenue.totalPending)} />
          </div>

          {calendarOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setCalendarOpen(false)} />
              <div className="absolute top-24 right-4 lg:right-8 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 w-72">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Select Date</p>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => { setSelectedDate(e.target.value); setCalendarOpen(false); }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-teal-500"
                />
                <div className="mt-3 space-y-1">
                  <button
                    onClick={() => { setSelectedDate(todayISO()); setCalendarOpen(false); }}
                    className="w-full text-left text-xs font-bold px-3 py-2 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100"
                  >
                    📍 Today
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* KPI CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpiConfig.map((k) => {
            const c = colorMap[k.color];
            const isActive = activeKpi === k.key;
            const count = kpiCounts[k.key];
            return (
              <button
                key={k.key}
                onClick={() => setActiveKpi(k.key)}
                className={`relative text-left p-5 rounded-2xl border-2 transition-all ${
                  isActive
                    ? `${c.light} ${c.border} ring-4 ${c.ring} shadow-lg scale-[1.02]`
                    : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-md"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${c.grad} flex items-center justify-center text-white text-lg shadow-md`}>
                    {k.icon}
                  </div>
                  {isActive && <span className={`w-2 h-2 rounded-full ${c.bg} animate-pulse`} />}
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{k.label}</p>
                <p className={`text-3xl font-bold mt-1 ${isActive ? c.text : "text-slate-900"}`}>{count}</p>
                {isActive && <p className="text-[10px] text-slate-500 mt-1">Click to view list below ↓</p>}
              </button>
            );
          })}
        </div>

        {/* BOOKING LIST */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${colorMap[kpiConfig.find(k => k.key === activeKpi)!.color].grad} flex items-center justify-center text-white text-lg shadow-md`}>
                {kpiConfig.find(k => k.key === activeKpi)!.icon}
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {kpiConfig.find(k => k.key === activeKpi)!.label}
                </h2>
                <p className="text-[11px] text-slate-500">
                  {formatPrettyDate(selectedDate)} · {filteredList.length} item{filteredList.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <button
              onClick={downloadPDF}
              disabled={downloading}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 disabled:opacity-50"
            >
              {downloading ? "…" : "📄 PDF"}
            </button>
          </div>

          <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap gap-2">
            {subFilterData.map((sf) => (
              <button
                key={sf.key}
                onClick={() => setSubFilter(sf.key)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                  subFilter === sf.key
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {sf.label} <span className="opacity-70">({sf.count})</span>
              </button>
            ))}
          </div>

          <div className="p-3 space-y-2 max-h-[500px] overflow-y-auto">
            {filteredList.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-5xl mb-3 opacity-20">📭</p>
                <p className="text-sm font-semibold text-slate-500">No bookings found</p>
                <p className="text-xs text-slate-400 mt-1">Nothing on {formatPrettyDate(selectedDate)}</p>
              </div>
            ) : (
              filteredList.map((b: any) => (
                <BookingRow key={b.id} booking={b} onView={() => setDetailsBooking(b)} />
              ))
            )}
          </div>
        </div>

        {/* LIVE OCCUPANCY + HOUSEKEEPING */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Live Occupancy</h3>
                <p className="text-xs text-slate-400 mt-0.5">Real-time room status</p>
              </div>
              <Link href="/housekeeping" className="text-[10px] font-bold text-teal-600 hover:text-teal-800 uppercase tracking-wider">
                Manage →
              </Link>
            </div>
            <OccupancyRing percent={occupancy.rate} occupied={occupancy.occupied} total={occupancy.totalRooms} />
            <div className="grid grid-cols-3 gap-2 mt-6 pt-6 border-t border-slate-100">
              <MiniStat label="Available" value={occupancy.available} color="emerald" />
              <MiniStat label="Occupied" value={occupancy.occupied} color="rose" />
              <MiniStat label="Total" value={occupancy.totalRooms} color="slate" />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Housekeeping Status</h3>
                <p className="text-xs text-slate-400 mt-0.5">Room cleaning overview</p>
              </div>
              <Link href="/housekeeping" className="text-[10px] font-bold text-teal-600 hover:text-teal-800 uppercase tracking-wider">
                Manage →
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <HKBox label="Clean" value={housekeeping.clean} color="emerald" icon="✓" />
              <HKBox label="Dirty" value={housekeeping.dirty} color="rose" icon="⚠" />
              <HKBox label="Inspected" value={housekeeping.inspected} color="sky" icon="🔍" />
              <HKBox label="Maintenance" value={housekeeping.maintenance} color="amber" icon="🔧" />
            </div>

            <div className="pt-5 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-slate-500">Cleanliness Score</p>
                <p className="text-sm font-bold text-emerald-600">{housekeeping.score.toFixed(0)}%</p>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-1000"
                  style={{ width: `${housekeeping.score}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* PENDING PAYMENTS */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-gradient-to-r from-amber-50 to-white border-b border-amber-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-lg shadow-md">
                💰
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Pending Payments</h3>
                <p className="text-[10px] text-slate-500">
                  {pendingPayments.length} booking{pendingPayments.length !== 1 ? "s" : ""} · {fmtFull(totalPendingAmount)} outstanding
                </p>
              </div>
            </div>
            <Link href="/calendar" className="text-[10px] font-bold text-amber-700 hover:text-amber-800 uppercase tracking-wider">
              Collect →
            </Link>
          </div>

          <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
            {pendingPayments.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-4xl mb-2">✅</p>
                <p className="text-sm font-semibold text-emerald-600">All caught up!</p>
                <p className="text-xs text-slate-400 mt-1">No pending payments</p>
              </div>
            ) : (
              pendingPayments.slice(0, 8).map((g: any) => (
                <div
                  key={g.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-amber-100 bg-amber-50/30 hover:bg-amber-50 transition"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {(g.guestName || g.primaryGuest?.name || "G").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">
                      {g.guestName || g.primaryGuest?.name || "Guest"}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      Room {g.roomNumber || g.room?.room_number || "—"} · {g.status || "—"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-rose-600">{fmtFull(g.balance)}</p>
                    <button
                      onClick={() => setDetailsBooking(g)}
                      className="text-[10px] font-bold text-slate-400 hover:text-teal-600 uppercase tracking-wide transition"
                    >
                      View →
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* EMPTY STATE */}
        {isEmpty && (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center">
            <p className="text-6xl mb-4">🏨</p>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Welcome to Your New Property!</h2>
            <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
              Your dashboard is empty. Start by setting up rooms, rates, and your booking engine.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/settings/property" className="px-5 py-3 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800">
                ⚙️ Setup Property
              </Link>
              <Link href="/settings/room-types" className="px-5 py-3 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-700">
                🛏️ Add Rooms
              </Link>
              <Link href="/settings/rate-plans" className="px-5 py-3 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50">
                🏷️ Set Rates
              </Link>
            </div>
          </div>
        )}

      </div>

      {detailsBooking && (
        <BookingDetailsModal booking={detailsBooking} onClose={() => setDetailsBooking(null)} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// SUB COMPONENTS
// ═══════════════════════════════════════════════
function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-xl lg:text-2xl font-bold text-white mt-1">{value}</p>
    </div>
  );
}

function OccupancyRing({ percent, occupied, total }: { percent: number; occupied: number; total: number }) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  return (
    <div className="relative w-48 h-48 mx-auto">
      <svg className="w-full h-full transform -rotate-90">
        <circle cx="96" cy="96" r={radius} stroke="#f1f5f9" strokeWidth="16" fill="none" />
        <circle
          cx="96" cy="96" r={radius}
          stroke="url(#occGrad)"
          strokeWidth="16" fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
        <defs>
          <linearGradient id="occGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#0891b2" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-4xl font-bold text-slate-900 tracking-tight">{percent.toFixed(0)}%</p>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Occupied</p>
        <p className="text-xs font-semibold text-teal-600 mt-1">{occupied} / {total}</p>
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: any) {
  const c: any = { emerald: "text-emerald-600", rose: "text-rose-600", slate: "text-slate-700" };
  return (
    <div className="text-center p-3 bg-slate-50 rounded-xl">
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold ${c[color]} mt-1`}>{value}</p>
    </div>
  );
}

function HKBox({ label, value, color, icon }: any) {
  const colors: any = {
    emerald: "from-emerald-50 to-white border-emerald-100 text-emerald-700",
    rose: "from-rose-50 to-white border-rose-100 text-rose-700",
    sky: "from-sky-50 to-white border-sky-100 text-sky-700",
    amber: "from-amber-50 to-white border-amber-100 text-amber-700",
  };
  return (
    <div className={`p-4 bg-gradient-to-br ${colors[color]} rounded-xl border`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-wider">{label}</p>
        <span className="text-sm">{icon}</span>
      </div>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}

function BookingRow({ booking, onView }: { booking: any; onView: () => void }) {
  const name = booking.guestName || booking.primaryGuest?.name || "Guest";
  const room = booking.roomNumber || booking.room?.room_number || "—";
  const status = booking.status || "—";
  const paid = Number(booking.paid) || 0;
  const total = (Number(booking.amount) || 0) + (Number(booking.tax) || 0);
  const balance = Math.max(0, total - paid);

  const statusColors: any = {
    "CONFIRMED": "bg-amber-100 text-amber-700",
    "CHECKED-IN": "bg-emerald-100 text-emerald-700",
    "CHECKED-OUT": "bg-blue-100 text-blue-700",
    "PENDING DEPARTURE": "bg-orange-100 text-orange-700",
    "CANCELLED": "bg-rose-100 text-rose-700",
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-teal-300 hover:bg-teal-50/30 transition">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
        {name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-800 truncate">{name}</p>
        <p className="text-[11px] text-slate-500 truncate">
          Room {room} · {(booking.check_in || booking.checkIn || "—").split("T")[0]} → {(booking.check_out || booking.checkOut || "—").split("T")[0]}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {balance > 0 && (
          <span className="text-xs font-bold text-rose-600 hidden sm:block">{fmtFull(balance)}</span>
        )}
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${statusColors[status] || "bg-slate-100 text-slate-600"}`}>
          {status}
        </span>
        <button
          onClick={onView}
          className="text-[10px] font-bold px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 transition"
        >
          View
        </button>
      </div>
    </div>
  );
}

function BookingDetailsModal({ booking, onClose }: any) {
  const name = booking.guestName || booking.primaryGuest?.name || "Guest";
  const total = (Number(booking.amount) || 0) + (Number(booking.tax) || 0);
  const paid = Number(booking.paid) || 0;
  const balance = total - paid;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white font-bold">
              {name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{name}</h3>
              <p className="text-[10px] text-slate-500">
                {booking.booking_ref || booking.bookingRef || "—"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-lg">
            ×
          </button>
        </div>
        <div className="p-6 space-y-2">
          <Row label="Room" value={booking.roomNumber || booking.room?.room_number || "—"} />
          <Row label="Status" value={booking.status || "—"} />
          <Row label="Check-in" value={(booking.check_in || booking.checkIn || "—").split("T")[0]} />
          <Row label="Check-out" value={(booking.check_out || booking.checkOut || "—").split("T")[0]} />
          {booking.adults !== undefined && <Row label="Adults" value={String(booking.adults)} />}
          {booking.children !== undefined && <Row label="Children" value={String(booking.children)} />}
          <div className="pt-3 mt-3 border-t border-slate-100 space-y-2">
            <Row label="Total Amount" value={fmtFull(total)} />
            <Row label="Paid" value={fmtFull(paid)} highlight="emerald" />
            {balance > 0 && <Row label="Balance Due" value={fmtFull(balance)} highlight="rose" />}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button onClick={onClose} className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: any) {
  const colors: any = { rose: "text-rose-600 font-bold", emerald: "text-emerald-600 font-bold" };
  return (
    <div className="flex justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-sm ${highlight ? colors[highlight] : "font-semibold text-slate-800"}`}>{value}</span>
    </div>
  );
}