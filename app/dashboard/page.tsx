// app/dashboard/page.tsx
"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useHotelStats } from "../lib/use-hotel-stats";
import { useActiveHotel } from "../lib/use-active-hotel";
import {
  fetchActionsRequired,
  type ActionsRequiredSummary,
} from "../lib/actions-required";
import ActionsRequiredWidget from "../components/ActionsRequiredWidget";

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

// ═══════════════════════════════════════════════
// SPARKLINE
// ═══════════════════════════════════════════════
function Sparkline({
  data,
  color = "#0d9488",
  height = 40,
  width = 120,
}: {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data
    .map((v, i) => `${i * step},${height - ((v - min) / range) * height}`)
    .join(" ");

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#grad-${color.replace("#", "")})`} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ═══════════════════════════════════════════════
// OCCUPANCY RING
// ═══════════════════════════════════════════════
function OccupancyRing({
  percent,
  occupied,
  total,
}: {
  percent: number;
  occupied: number;
  total: number;
}) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative w-48 h-48 mx-auto">
      <svg className="w-full h-full transform -rotate-90">
        <circle cx="96" cy="96" r={radius} stroke="#f1f5f9" strokeWidth="16" fill="none" />
        <circle
          cx="96"
          cy="96"
          r={radius}
          stroke="url(#occGrad)"
          strokeWidth="16"
          fill="none"
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

// ═══════════════════════════════════════════════
// MAIN DASHBOARD PAGE
// ═══════════════════════════════════════════════
export default function DashboardPage() {
  const { stats, loading, error, refresh } = useHotelStats();
  const { hotelId, loading: hotelLoading } = useActiveHotel();
  const [actions, setActions] = useState<ActionsRequiredSummary | null>(null);
  const [actionsLoading, setActionsLoading] = useState(true);
  const [arrivalSort, setArrivalSort] = useState<"room" | "guest" | "status">("room");
  const [departureSort, setDepartureSort] = useState<"room" | "guest" | "status">("room");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!hotelId || hotelLoading) return;

    const loadActions = async () => {
      try {
        setActionsLoading(true);
        const data = await fetchActionsRequired(hotelId);
        setActions(data);
      } catch (err) {
        console.error("[Dashboard] Actions error:", err);
      } finally {
        setActionsLoading(false);
      }
    };

    loadActions();

    const handler = () => loadActions();
    window.addEventListener("booking-updated", handler);
    window.addEventListener("hotel-changed", handler);

    return () => {
      window.removeEventListener("booking-updated", handler);
      window.removeEventListener("hotel-changed", handler);
    };
  }, [hotelId, hotelLoading]);

  const trendData = useMemo(() => {
    const now = stats?.monthCollection || 1000;
    return [0.3, 0.5, 0.4, 0.7, 0.6, 0.85, 1].map((m) => now * m);
  }, [stats?.monthCollection]);

  // ─── SORT ARRIVALS ───
  const sortedArrivals = useMemo(() => {
    if (!stats?.arrivalsToday) return [];
    return [...stats.arrivalsToday].sort((a: any, b: any) => {
      if (arrivalSort === "room") return (a.roomNumber || "").localeCompare(b.roomNumber || "");
      if (arrivalSort === "guest") return a.guestName.localeCompare(b.guestName);
      return a.status.localeCompare(b.status);
    });
  }, [stats?.arrivalsToday, arrivalSort]);

  // ─── SORT DEPARTURES ───
  const sortedDepartures = useMemo(() => {
    if (!stats?.departuresToday) return [];
    return [...stats.departuresToday].sort((a: any, b: any) => {
      if (departureSort === "room") return (a.roomNumber || "").localeCompare(b.roomNumber || "");
      if (departureSort === "guest") return a.guestName.localeCompare(b.guestName);
      return a.status.localeCompare(b.status);
    });
  }, [stats?.departuresToday, departureSort]);

  // ─── DOWNLOAD PDF REPORT ───
  const downloadPDF = async () => {
    if (!stats) return;
    setDownloading(true);
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;

      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Header
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 90, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("Staynexa PMS", 40, 45);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(20, 184, 166);
      doc.text("DAILY DASHBOARD REPORT", 40, 65);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.text(new Date().toLocaleString("en-IN"), pageWidth - 40, 50, { align: "right" });

      // KPI Summary
      let y = 120;
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Key Performance Indicators", 40, y);
      y += 20;

      autoTable(doc, {
        startY: y,
        head: [["Metric", "Value"]],
        body: [
          ["Today's Collection", fmtFull(stats.todayCollection)],
          ["Month Revenue", fmtFull(stats.monthCollection)],
          ["Week Revenue", fmtFull(stats.weekCollection)],
          ["ADR (Avg Daily Rate)", fmtFull(stats.adr)],
          ["RevPAR", fmtFull(stats.revpar)],
          ["Total Pending", fmtFull(stats.totalPending)],
          ["Total Rooms", String(stats.totalRooms)],
          ["Occupied Rooms", String(stats.occupiedRooms)],
          ["Available Rooms", String(stats.availableRooms)],
          ["Occupancy Rate", `${stats.occupancyRate.toFixed(1)}%`],
          ["In-House Guests", String(stats.inHouseCount)],
          ["Today's Arrivals", String(stats.arrivalCount)],
          ["Today's Departures", String(stats.departureCount)],
        ],
        theme: "striped",
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
        bodyStyles: { fontSize: 10 },
        columnStyles: { 0: { cellWidth: 250 }, 1: { halign: "right" } },
        margin: { left: 40, right: 40 },
      });

      // Housekeeping
      y = (doc as any).lastAutoTable.finalY + 25;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("Housekeeping Status", 40, y);
      y += 15;

      autoTable(doc, {
        startY: y,
        head: [["Status", "Count"]],
        body: [
          ["Clean Rooms", String(stats.cleanRooms)],
          ["Dirty Rooms", String(stats.dirtyRooms)],
          ["Inspected Rooms", String(stats.inspectedRooms)],
          ["Maintenance Rooms", String(stats.maintenanceRooms)],
          ["Cleanliness Score", `${stats.cleanlinessPercent.toFixed(0)}%`],
        ],
        theme: "striped",
        headStyles: { fillColor: [20, 184, 166], textColor: [255, 255, 255] },
        bodyStyles: { fontSize: 10 },
        columnStyles: { 0: { cellWidth: 250 }, 1: { halign: "right" } },
        margin: { left: 40, right: 40 },
      });

      // Today's Arrivals
      if (sortedArrivals.length > 0) {
        doc.addPage();
        y = 60;
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text("Today's Arrivals", 40, y);
        y += 15;

        autoTable(doc, {
          startY: y,
          head: [["Guest Name", "Room", "Adults", "Children", "Status"]],
          body: sortedArrivals.map((b: any) => [
            b.guestName,
            b.roomNumber || "—",
            String(b.adults || 0),
            String(b.children || 0),
            b.status,
          ]),
          theme: "striped",
          headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] },
          bodyStyles: { fontSize: 9 },
          margin: { left: 40, right: 40 },
        });
      }

      // Today's Departures
      if (sortedDepartures.length > 0) {
        y = (doc as any).lastAutoTable.finalY + 25;
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text("Today's Departures", 40, y);
        y += 15;

        autoTable(doc, {
          startY: y,
          head: [["Guest Name", "Room", "Status", "Balance Due"]],
          body: sortedDepartures.map((b: any) => [
            b.guestName,
            b.roomNumber || "—",
            b.status,
            b.balance > 0 ? fmtFull(b.balance) : "Paid",
          ]),
          theme: "striped",
          headStyles: { fillColor: [244, 63, 94], textColor: [255, 255, 255] },
          bodyStyles: { fontSize: 9 },
          margin: { left: 40, right: 40 },
        });
      }

      // Pending Payments
      const pendingGuests = stats.inHouseGuests.filter((g) => g.balance > 0);
      if (pendingGuests.length > 0) {
        y = (doc as any).lastAutoTable.finalY + 25;
        if (y > pageHeight - 100) {
          doc.addPage();
          y = 60;
        }
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text("Pending Payments", 40, y);
        y += 15;

        autoTable(doc, {
          startY: y,
          head: [["Guest", "Room", "Balance"]],
          body: pendingGuests.map((g: any) => [
            g.guestName,
            g.roomNumber || "—",
            fmtFull(g.balance),
          ]),
          theme: "striped",
          headStyles: { fillColor: [239, 68, 68], textColor: [255, 255, 255] },
          bodyStyles: { fontSize: 9 },
          margin: { left: 40, right: 40 },
        });
      }

      // Footer
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Staynexa PMS · Page ${i} of ${totalPages} · Generated ${new Date().toLocaleDateString("en-IN")}`,
          pageWidth / 2,
          pageHeight - 25,
          { align: "center" }
        );
      }

      doc.save(`Staynexa-Dashboard-${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (err) {
      console.error("PDF download error:", err);
      alert("Failed to download PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  // ═══════════════════════════════════════════════
  // LOADING & ERROR STATES
  // ═══════════════════════════════════════════════
  if (loading || hotelLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full border-4 border-slate-200 border-t-teal-600 animate-spin" />
          <p className="text-slate-500 font-semibold text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-md p-8">
          <p className="text-5xl mb-4">⚠️</p>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Failed to load</h2>
          <p className="text-sm text-slate-500 mb-6">{error || "Unknown error"}</p>
          <button
            onClick={refresh}
            className="px-6 py-3 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const todayStr = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // ═══════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">

        {/* ═══════════ HEADER ═══════════ */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 mb-8 shadow-2xl shadow-slate-900/20">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-teal-500/20 to-cyan-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-br from-violet-500/10 to-transparent rounded-full blur-3xl -ml-20 -mb-20" />

          <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-widest rounded-full border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Dashboard
                </span>
                <span className="text-slate-400 text-xs font-medium">{todayStr}</span>
              </div>
              <h1 className="text-3xl lg:text-4xl font-bold text-white tracking-tight">
                Welcome back, Admin 👋
              </h1>
              <p className="text-slate-300 text-sm mt-2 max-w-xl">
                Here's what's happening at your property today.{" "}
                <span className="text-emerald-400 font-semibold">{stats.occupiedRooms} rooms occupied</span> ·{" "}
                {stats.arrivalCount} arrivals · {stats.departureCount} departures
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              <button
                onClick={downloadPDF}
                disabled={downloading}
                className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-teal-500 to-emerald-600 hover:opacity-90 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition shadow-lg shadow-teal-500/20"
              >
                {downloading ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download PDF
                  </>
                )}
              </button>
              <button
                onClick={refresh}
                className="flex items-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white rounded-xl text-sm font-semibold transition border border-white/10"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
              <Link
                href="/calendar"
                className="flex items-center gap-2 px-5 py-3 bg-white text-slate-900 rounded-xl text-sm font-bold hover:bg-slate-100 transition shadow-lg shadow-white/10"
              >
                📅 Open Calendar
              </Link>
            </div>
          </div>

          {/* TOP STATS */}
          <div className="relative mt-8 pt-6 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Today's Collection</p>
              <p className="text-2xl font-bold text-white mt-1">{fmtFull(stats.todayCollection)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Month Revenue</p>
              <p className="text-2xl font-bold text-white mt-1">{fmtShort(stats.monthCollection)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ADR</p>
              <p className="text-2xl font-bold text-white mt-1">{fmtFull(stats.adr)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">RevPAR</p>
              <p className="text-2xl font-bold text-white mt-1">{fmtFull(stats.revpar)}</p>
            </div>
          </div>
        </div>

        {/* ═══════════ KPI CARDS ═══════════ */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {/* Arrivals */}
          <div className="group relative bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-xl hover:shadow-emerald-100/50 hover:border-emerald-300 transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-xl shadow-lg shadow-emerald-500/30">🛬</div>
              <span className="text-[10px] font-bold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full">Today</span>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Arrivals</p>
            <p className="text-4xl font-bold text-slate-900 mt-2 tracking-tight">{stats.arrivalCount}</p>
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-slate-500">{stats.pendingCheckins.length} pending</p>
              <div className="flex items-center gap-1 text-emerald-600 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {stats.arrivalCount - stats.pendingCheckins.length} done
              </div>
            </div>
          </div>

          {/* Departures */}
          <div className="group relative bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-xl hover:shadow-rose-100/50 hover:border-rose-300 transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-400 to-rose-600" />
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center text-white text-xl shadow-lg shadow-rose-500/30">🛫</div>
              <span className="text-[10px] font-bold px-2.5 py-1 bg-rose-50 text-rose-700 rounded-full">Today</span>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Departures</p>
            <p className="text-4xl font-bold text-slate-900 mt-2 tracking-tight">{stats.departureCount}</p>
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-slate-500">{stats.pendingCheckouts.length} pending</p>
              <div className="flex items-center gap-1 text-rose-600 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                {stats.departureCount - stats.pendingCheckouts.length} done
              </div>
            </div>
          </div>

          {/* In-House */}
          <div className="group relative bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-xl hover:shadow-sky-100/50 hover:border-sky-300 transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-400 to-sky-600" />
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white text-xl shadow-lg shadow-sky-500/30">👥</div>
              <span className="text-[10px] font-bold px-2.5 py-1 bg-sky-50 text-sky-700 rounded-full">Active</span>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">In-House Guests</p>
            <p className="text-4xl font-bold text-slate-900 mt-2 tracking-tight">{stats.inHouseCount}</p>
            <div className="mt-3">
              <div className="h-1.5 bg-sky-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-sky-400 to-sky-600 rounded-full transition-all duration-1000" style={{ width: `${stats.occupancyRate}%` }} />
              </div>
              <p className="text-xs text-slate-500 mt-2">{stats.occupancyRate.toFixed(0)}% occupancy</p>
            </div>
          </div>

          {/* Outstanding */}
          <div className="group relative bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-xl hover:shadow-amber-100/50 hover:border-amber-300 transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-amber-600" />
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-xl shadow-lg shadow-amber-500/30">💰</div>
              <span className="text-[10px] font-bold px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full">Pending</span>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Outstanding</p>
            <p className="text-4xl font-bold text-slate-900 mt-2 tracking-tight">{fmtShort(stats.totalPending)}</p>
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-slate-500">{stats.inHouseGuests.filter((g) => g.balance > 0).length} guests</p>
              <Link href="/calendar" className="text-xs font-bold text-amber-600 hover:text-amber-800">Collect →</Link>
            </div>
          </div>
        </div>

        {/* ═══════════ ACTIONS REQUIRED ═══════════ */}
        {!actionsLoading && actions && actions.total > 0 && (
          <div className="mb-8">
            <ActionsRequiredWidget
              actions={actions.actions}
              total={actions.total}
              highPriority={actions.highPriority}
              mediumPriority={actions.mediumPriority}
              onRefresh={refresh}
            />
          </div>
        )}

        {/* ═══════════ OCCUPANCY + REVENUE ═══════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Occupancy Ring */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-bold text-slate-700">Live Occupancy</h3>
                <p className="text-xs text-slate-400 mt-0.5">Real-time room status</p>
              </div>
              <Link href="/housekeeping" className="text-[10px] font-bold text-teal-600 hover:text-teal-800 uppercase tracking-wider">Manage →</Link>
            </div>
            <OccupancyRing percent={stats.occupancyRate} occupied={stats.occupiedRooms} total={stats.totalRooms} />
            <div className="grid grid-cols-3 gap-2 mt-6 pt-6 border-t border-slate-100">
              <div className="text-center">
                <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Available</p>
                <p className="text-lg font-bold text-emerald-600 mt-1">{stats.availableRooms}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] font-bold text-rose-600 uppercase tracking-wider">Occupied</p>
                <p className="text-lg font-bold text-rose-600 mt-1">{stats.occupiedRooms}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Total</p>
                <p className="text-lg font-bold text-slate-700 mt-1">{stats.totalRooms}</p>
              </div>
            </div>
          </div>

          {/* Revenue Overview */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-bold text-slate-700">Revenue Overview</h3>
                <p className="text-xs text-slate-400 mt-0.5">Collections trend</p>
              </div>
              <Link href="/reports/property" className="text-[10px] font-bold text-teal-600 hover:text-teal-800 uppercase tracking-wider">Full Report →</Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-50/30 rounded-xl border border-emerald-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Today</p>
                  <Sparkline data={[2, 3, 2.5, 4, 3.5, 5, stats.todayCollection / 1000 || 4]} color="#10b981" width={60} height={24} />
                </div>
                <p className="text-2xl font-bold text-emerald-700">{fmtShort(stats.todayCollection)}</p>
                <p className="text-[10px] text-emerald-600 mt-1">Collected today</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-sky-50 to-sky-50/30 rounded-xl border border-sky-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-sky-700 uppercase tracking-wider">This Week</p>
                  <Sparkline data={[3, 4, 3.5, 5, 4.5, 6, stats.weekCollection / 1000 || 5]} color="#0ea5e9" width={60} height={24} />
                </div>
                <p className="text-2xl font-bold text-sky-700">{fmtShort(stats.weekCollection)}</p>
                <p className="text-[10px] text-sky-600 mt-1">7-day total</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-violet-50 to-violet-50/30 rounded-xl border border-violet-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-violet-700 uppercase tracking-wider">This Month</p>
                  <Sparkline data={trendData} color="#8b5cf6" width={60} height={24} />
                </div>
                <p className="text-2xl font-bold text-violet-700">{fmtShort(stats.monthCollection)}</p>
                <p className="text-[10px] text-violet-600 mt-1">{stats.monthBookings} bookings</p>
              </div>
            </div>
            <div className="pt-6 border-t border-slate-100">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Billed</p>
                  <p className="text-lg font-bold text-slate-800 mt-1">{fmtShort(stats.monthRevenue)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Collected</p>
                  <p className="text-lg font-bold text-emerald-600 mt-1">{fmtShort(stats.monthCollection)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Outstanding</p>
                  <p className="text-lg font-bold text-rose-600 mt-1">{fmtShort(stats.totalPending)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════ HOUSEKEEPING + PENDING PAYMENTS ═══════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Housekeeping */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-bold text-slate-700">Housekeeping</h3>
                <p className="text-xs text-slate-400 mt-0.5">Room cleaning status</p>
              </div>
              <Link href="/housekeeping" className="text-[10px] font-bold text-teal-600 hover:text-teal-800 uppercase tracking-wider">Manage →</Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-gradient-to-br from-emerald-50 to-white rounded-xl border border-emerald-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Clean</p>
                </div>
                <p className="text-3xl font-bold text-emerald-700">{stats.cleanRooms}</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-rose-50 to-white rounded-xl border border-rose-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Dirty</p>
                </div>
                <p className="text-3xl font-bold text-rose-700">{stats.dirtyRooms}</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-sky-50 to-white rounded-xl border border-sky-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-sky-500" />
                  <p className="text-[10px] font-bold text-sky-700 uppercase tracking-wider">Inspected</p>
                </div>
                <p className="text-3xl font-bold text-sky-700">{stats.inspectedRooms}</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-amber-50 to-white rounded-xl border border-amber-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Maintenance</p>
                </div>
                <p className="text-3xl font-bold text-amber-700">{stats.maintenanceRooms}</p>
              </div>
            </div>
            <div className="mt-5 pt-5 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-slate-500">Cleanliness Score</p>
                <p className="text-sm font-bold text-emerald-600">{stats.cleanlinessPercent.toFixed(0)}%</p>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-1000" style={{ width: `${stats.cleanlinessPercent}%` }} />
              </div>
            </div>
          </div>

          {/* Pending Payments */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-bold text-slate-700">Pending Payments</h3>
                <p className="text-xs text-slate-400 mt-0.5">Awaiting collection from guests</p>
              </div>
              <span className="inline-flex items-center px-3 py-1 bg-rose-100 text-rose-700 text-[10px] font-bold rounded-full">
                {stats.inHouseGuests.filter((g) => g.balance > 0).length} GUESTS
              </span>
            </div>
            <div className="p-4 bg-gradient-to-r from-rose-50 to-white rounded-xl border border-rose-100 mb-5">
              <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Total Outstanding</p>
              <p className="text-4xl font-bold text-rose-700 mt-2 tracking-tight">{fmtFull(stats.totalPending)}</p>
            </div>
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {stats.inHouseGuests.filter((g) => g.balance > 0).slice(0, 6).map((g) => (
                <div key={g.id} className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition group">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {g.guestName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">{g.guestName}</p>
                      <p className="text-[10px] text-slate-400">Room {g.roomNumber || "—"} · {g.checkIn} → {g.checkOut}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-rose-600">{fmtFull(g.balance)}</p>
                    <Link href="/calendar" className="text-[10px] font-bold text-slate-400 group-hover:text-teal-600 uppercase tracking-wide transition">Collect →</Link>
                  </div>
                </div>
              ))}
              {stats.inHouseGuests.filter((g) => g.balance > 0).length === 0 && (
                <div className="text-center py-8">
                  <p className="text-4xl mb-2">✅</p>
                  <p className="text-sm font-semibold text-emerald-600">All caught up!</p>
                  <p className="text-xs text-slate-400 mt-1">No pending payments</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══════════ ARRIVALS + DEPARTURES WITH SORT ═══════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* ARRIVALS */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-emerald-50 to-emerald-50/30 border-b border-emerald-100 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-lg shadow-md shadow-emerald-500/30">🛬</div>
                <div>
                  <h3 className="text-sm font-bold text-emerald-900">Today's Arrivals</h3>
                  <p className="text-[10px] text-emerald-600 font-medium">{stats.arrivalCount} scheduled · {stats.pendingCheckins.length} pending</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={arrivalSort}
                  onChange={(e) => setArrivalSort(e.target.value as any)}
                  className="text-[10px] font-bold px-2.5 py-1.5 border border-emerald-200 rounded-lg bg-white text-emerald-700 outline-none cursor-pointer"
                >
                  <option value="room">Sort: Room</option>
                  <option value="guest">Sort: Guest</option>
                  <option value="status">Sort: Status</option>
                </select>
                <Link href="/reports/front-desk" className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800 uppercase tracking-wider">View →</Link>
              </div>
            </div>
            <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
              {sortedArrivals.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-3xl mb-2 opacity-30">🛬</p>
                  <p className="text-sm text-slate-400">No arrivals today</p>
                </div>
              ) : (
                sortedArrivals.map((b: any) => (
                  <div key={b.id} className="flex items-center justify-between p-3 bg-emerald-50/50 hover:bg-emerald-100 rounded-xl border border-emerald-100 transition">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {b.guestName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-800 truncate">{b.guestName}</p>
                        <p className="text-[10px] text-slate-500">Room {b.roomNumber || "—"} · {b.adults}A{b.children > 0 ? ` ${b.children}C` : ""}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${b.status === "CHECKED-IN" ? "bg-emerald-500 text-white" : "bg-white text-emerald-700 border border-emerald-200"}`}>
                      {b.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* DEPARTURES */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-rose-50 to-rose-50/30 border-b border-rose-100 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center text-white text-lg shadow-md shadow-rose-500/30">🛫</div>
                <div>
                  <h3 className="text-sm font-bold text-rose-900">Today's Departures</h3>
                  <p className="text-[10px] text-rose-600 font-medium">{stats.departureCount} scheduled · {stats.pendingCheckouts.length} pending</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={departureSort}
                  onChange={(e) => setDepartureSort(e.target.value as any)}
                  className="text-[10px] font-bold px-2.5 py-1.5 border border-rose-200 rounded-lg bg-white text-rose-700 outline-none cursor-pointer"
                >
                  <option value="room">Sort: Room</option>
                  <option value="guest">Sort: Guest</option>
                  <option value="status">Sort: Status</option>
                </select>
                <Link href="/reports/front-desk" className="text-[10px] font-bold text-rose-600 hover:text-rose-800 uppercase tracking-wider">View →</Link>
              </div>
            </div>
            <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
              {sortedDepartures.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-3xl mb-2 opacity-30">🛫</p>
                  <p className="text-sm text-slate-400">No departures today</p>
                </div>
              ) : (
                sortedDepartures.map((b: any) => (
                  <div key={b.id} className="flex items-center justify-between p-3 bg-rose-50/50 hover:bg-rose-100 rounded-xl border border-rose-100 transition">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-full bg-rose-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {b.guestName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-800 truncate">{b.guestName}</p>
                        <p className="text-[10px] text-slate-500">Room {b.roomNumber || "—"}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${b.status === "CHECKED-OUT" ? "bg-rose-500 text-white" : "bg-white text-rose-700 border border-rose-200"}`}>
                        {b.status}
                      </span>
                      {b.balance > 0 && (
                        <p className="text-[10px] font-bold text-rose-600 mt-1">₹{Math.round(b.balance)}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ═══════════ FOOTER CTA ═══════════ */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 text-white shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-2xl">🚀</div>
            <div>
              <p className="text-sm font-bold">Staynexa PMS</p>
              <p className="text-xs text-slate-400 mt-0.5">Powered by AI · Real-time updates</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={downloadPDF}
              disabled={downloading}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition border border-white/10 disabled:opacity-50"
            >
              {downloading ? "Generating..." : "📄 Download Report"}
            </button>
            <Link href="/reports/property" className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition border border-white/10">📊 All Reports</Link>
            <Link href="/calendar" className="px-5 py-2.5 bg-white text-slate-900 rounded-xl text-xs font-bold hover:bg-slate-100 transition">📅 Open Calendar</Link>
          </div>
        </div>

      </div>
    </div>
  );
}