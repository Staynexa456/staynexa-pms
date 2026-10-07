// app/dashboard/page.tsx
"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useHotelStats } from "../lib/use-hotel-stats";
import { useActiveHotel } from "../lib/use-active-hotel";
import { fetchActionsRequired, type ActionsRequiredSummary } from "../lib/actions-required";
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

type KpiFilter = "arrivals" | "departures" | "inhouse" | "newbookings" | "pending";
type SubFilter = "all" | "checkedin" | "pendingin" | "checkedout" | "pendingout";

// ═══════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════
export default function DashboardPage() {
  const { stats, loading, error, refresh } = useHotelStats();
  const { hotelId, loading: hotelLoading } = useActiveHotel();
  const [actions, setActions] = useState<ActionsRequiredSummary | null>(null);
  const [actionsLoading, setActionsLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  // ✅ NEW: KPI filter + sub-filter
  const [activeKpi, setActiveKpi] = useState<KpiFilter>("arrivals");
  const [subFilter, setSubFilter] = useState<SubFilter>("all");
  const [sortMode, setSortMode] = useState<"room" | "guest" | "status" | "amount">("room");

  // New bookings
  const [newBookings, setNewBookings] = useState<any[]>([]);
  const [loadingNewBookings, setLoadingNewBookings] = useState(true);

  // Details modal
  const [detailsBooking, setDetailsBooking] = useState<any | null>(null);

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

    const loadNewBookings = async () => {
      try {
        setLoadingNewBookings(true);
        const all = await fetchBookings(hotelId);
        const sorted = [...all].sort((a: any, b: any) => {
          const aTime = new Date(a.created_at || a.check_in).getTime();
          const bTime = new Date(b.created_at || b.check_in).getTime();
          return bTime - aTime;
        });
        setNewBookings(sorted.slice(0, 20));
      } catch (err) {
        console.error("[Dashboard] NewBookings error:", err);
      } finally {
        setLoadingNewBookings(false);
      }
    };

    loadActions();
    loadNewBookings();

    const handler = () => {
      loadActions();
      loadNewBookings();
    };
    window.addEventListener("booking-updated", handler);
    window.addEventListener("hotel-changed", handler);
    return () => {
      window.removeEventListener("booking-updated", handler);
      window.removeEventListener("hotel-changed", handler);
    };
  }, [hotelId, hotelLoading]);

  // ═══════════════════════════════════════════════
  // FILTER + SORT LOGIC
  // ═══════════════════════════════════════════════
  const filteredBookings = useMemo(() => {
    if (!stats) return [];

    let base: any[] = [];

    // 1. KPI selection
    if (activeKpi === "arrivals") {
      base = stats.arrivalsToday || [];
    } else if (activeKpi === "departures") {
      base = stats.departuresToday || [];
    } else if (activeKpi === "inhouse") {
      base = stats.inHouseGuests || [];
    } else if (activeKpi === "newbookings") {
      base = newBookings;
    } else if (activeKpi === "pending") {
      base = (stats.inHouseGuests || []).filter((g: any) => g.balance > 0);
    }

    // 2. Sub-filter
    if (subFilter !== "all") {
      if (subFilter === "checkedin") {
        base = base.filter((b: any) => b.status === "CHECKED-IN");
      } else if (subFilter === "pendingin") {
        base = base.filter((b: any) => b.status === "CONFIRMED");
      } else if (subFilter === "checkedout") {
        base = base.filter((b: any) => b.status === "CHECKED-OUT");
      } else if (subFilter === "pendingout") {
        base = base.filter((b: any) => b.status === "PENDING DEPARTURE" || b.status === "CHECKED-IN");
      }
    }

    // 3. Sort
    return [...base].sort((a: any, b: any) => {
      switch (sortMode) {
        case "room": return (a.roomNumber || "").localeCompare(b.roomNumber || "");
        case "guest": return (a.guestName || "").localeCompare(b.guestName || "");
        case "status": return (a.status || "").localeCompare(b.status || "");
        case "amount": return (b.balance || 0) - (a.balance || 0);
        default: return 0;
      }
    });
  }, [stats, activeKpi, subFilter, sortMode, newBookings]);

  // Sub-filter counts
  const subFilterCounts = useMemo(() => {
    if (!stats) return { checkedin: 0, pendingin: 0, checkedout: 0, pendingout: 0 };
    let base: any[] = [];
    if (activeKpi === "arrivals") base = stats.arrivalsToday || [];
    else if (activeKpi === "departures") base = stats.departuresToday || [];
    else if (activeKpi === "inhouse") base = stats.inHouseGuests || [];
    else if (activeKpi === "newbookings") base = newBookings;
    else if (activeKpi === "pending") base = (stats.inHouseGuests || []).filter((g: any) => g.balance > 0);

    return {
      checkedin: base.filter((b: any) => b.status === "CHECKED-IN").length,
      pendingin: base.filter((b: any) => b.status === "CONFIRMED").length,
      checkedout: base.filter((b: any) => b.status === "CHECKED-OUT").length,
      pendingout: base.filter((b: any) => b.status === "PENDING DEPARTURE" || b.status === "CHECKED-IN").length,
    };
  }, [stats, activeKpi, newBookings]);

  // Reset sub-filter when KPI changes
  useEffect(() => {
    setSubFilter("all");
  }, [activeKpi]);

  // ═══════════════════════════════════════════════
  // PDF DOWNLOAD
  // ═══════════════════════════════════════════════
  const downloadReport = useCallback(async () => {
    if (!stats) return;
    setDownloading(activeKpi);
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
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(20, 184, 166);
      doc.text(`${activeKpi.toUpperCase()} REPORT`, 40, 60);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.text(new Date().toLocaleString("en-IN"), pageWidth - 40, 45, { align: "right" });

      autoTable(doc, {
        startY: 110,
        head: [["#", "Guest", "Room", "Status", "Balance", "Check-in", "Check-out"]],
        body: filteredBookings.map((b: any, i: number) => [
          String(i + 1),
          b.guestName || "Guest",
          b.roomNumber || "—",
          b.status || "—",
          b.balance > 0 ? fmtFull(b.balance) : "Paid",
          b.checkIn || "—",
          b.checkOut || "—",
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
        doc.text(
          `Staynexa PMS · Page ${i} of ${totalPages} · ${new Date().toLocaleDateString("en-IN")}`,
          pageWidth / 2,
          pageHeight - 25,
          { align: "center" }
        );
      }

      doc.save(`Staynexa-${activeKpi}-${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (err) {
      console.error("PDF error:", err);
      alert("PDF download failed.");
    } finally {
      setDownloading(null);
    }
  }, [stats, activeKpi, filteredBookings]);

  // Loading
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

  if (error || !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-md p-8">
          <p className="text-5xl mb-4">⚠️</p>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Failed to load</h2>
          <p className="text-sm text-slate-500 mb-6">{error || "Unknown error"}</p>
          <button onClick={refresh} className="px-6 py-3 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const todayStr = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const kpiConfig = {
    arrivals: { label: "Arrivals", icon: "🛬", accent: "emerald" as const, count: stats.arrivalCount },
    departures: { label: "Departures", icon: "🛫", accent: "rose" as const, count: stats.departureCount },
    inhouse: { label: "In-House", icon: "👥", accent: "sky" as const, count: stats.inHouseCount },
    newbookings: { label: "New Bookings", icon: "✨", accent: "indigo" as const, count: newBookings.length },
    pending: { label: "Pending Pay", icon: "💰", accent: "amber" as const, count: (stats.inHouseGuests || []).filter((g: any) => g.balance > 0).length },
  };

  const subFilters: { key: SubFilter; label: string; color: string }[] = [
    { key: "all", label: "All", color: "bg-slate-100 text-slate-700" },
    { key: "checkedin", label: "Checked In", color: "bg-emerald-100 text-emerald-700" },
    { key: "pendingin", label: "Pending In", color: "bg-amber-100 text-amber-700" },
    { key: "checkedout", label: "Checked Out", color: "bg-blue-100 text-blue-700" },
    { key: "pendingout", label: "Pending Out", color: "bg-rose-100 text-rose-700" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto p-4 lg:p-6 space-y-5">

        {/* ═══ HEADER ═══ */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 lg:p-8 shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-teal-500/20 to-cyan-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
          <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-widest rounded-full border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
                <span className="text-slate-400 text-xs">{todayStr}</span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
                Dashboard
              </h1>
              <p className="text-slate-300 text-sm mt-1">
                {stats.occupiedRooms} occupied · {stats.arrivalCount} arrivals · {stats.departureCount} departures
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={downloadReport}
                disabled={downloading !== null}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:opacity-90 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-lg"
              >
                {downloading ? "…" : "📄 Download Report"}
              </button>
              <button
                onClick={refresh}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition border border-white/10"
              >
                🔄 Refresh
              </button>
              <Link href="/calendar" className="px-4 py-2.5 bg-white text-slate-900 rounded-xl text-xs font-bold hover:bg-slate-100">
                📅 Calendar
              </Link>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="relative mt-6 pt-5 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-4">
            <QuickStat label="Today's Collection" value={fmtFull(stats.todayCollection)} />
            <QuickStat label="Month Revenue" value={fmtShort(stats.monthCollection)} />
            <QuickStat label="ADR" value={fmtFull(stats.adr)} />
            <QuickStat label="RevPAR" value={fmtFull(stats.revpar)} />
          </div>
        </div>

        {/* ═══ KPI CARDS (Clickable) ═══ */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {(Object.keys(kpiConfig) as KpiFilter[]).map((key) => {
            const k = kpiConfig[key];
            const isActive = activeKpi === key;
            const accentColors: any = {
              emerald: { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-700", ring: "ring-emerald-500/30" },
              rose: { bg: "bg-rose-50", border: "border-rose-300", text: "text-rose-700", ring: "ring-rose-500/30" },
              sky: { bg: "bg-sky-50", border: "border-sky-300", text: "text-sky-700", ring: "ring-sky-500/30" },
              indigo: { bg: "bg-indigo-50", border: "border-indigo-300", text: "text-indigo-700", ring: "ring-indigo-500/30" },
              amber: { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-700", ring: "ring-amber-500/30" },
            };
            const c = accentColors[k.accent];
            return (
              <button
                key={key}
                onClick={() => setActiveKpi(key)}
                className={`relative p-4 rounded-2xl border-2 text-left transition-all ${
                  isActive
                    ? `${c.bg} ${c.border} ring-4 ${c.ring} shadow-lg`
                    : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-md"
                }`}
              >
                <div className="text-2xl mb-2">{k.icon}</div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{k.label}</p>
                <p className={`text-2xl font-bold mt-1 ${isActive ? c.text : "text-slate-900"}`}>{k.count}</p>
                {isActive && (
                  <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${c.text.replace("text-", "bg-")}`} />
                )}
              </button>
            );
          })}
        </div>

        {/* ═══ FILTERED BOOKINGS SECTION ═══ */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Section Header */}
          <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="text-2xl">{kpiConfig[activeKpi].icon}</div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">{kpiConfig[activeKpi].label}</h3>
                <p className="text-[10px] text-slate-500">
                  {filteredBookings.length} booking{filteredBookings.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as any)}
                className="text-[10px] font-bold px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 outline-none cursor-pointer"
              >
                <option value="room">Sort: Room</option>
                <option value="guest">Sort: Guest</option>
                <option value="status">Sort: Status</option>
                <option value="amount">Sort: Amount</option>
              </select>
              <button
                onClick={downloadReport}
                disabled={downloading !== null}
                className="text-[10px] font-bold px-3 py-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
              >
                {downloading ? "…" : "📄 PDF"}
              </button>
            </div>
          </div>

          {/* Sub-filters */}
          <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap gap-2">
            {subFilters.map((sf) => {
              const count = sf.key === "all" ? filteredBookings.length :
                sf.key === "checkedin" ? subFilterCounts.checkedin :
                sf.key === "pendingin" ? subFilterCounts.pendingin :
                sf.key === "checkedout" ? subFilterCounts.checkedout :
                subFilterCounts.pendingout;
              return (
                <button
                  key={sf.key}
                  onClick={() => setSubFilter(sf.key)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition ${
                    subFilter === sf.key
                      ? `${sf.color} ring-2 ring-offset-1 ring-slate-300`
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {sf.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Booking List */}
          <div className="p-3 space-y-2 max-h-[500px] overflow-y-auto">
            {filteredBookings.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-4xl mb-3 opacity-30">{kpiConfig[activeKpi].icon}</p>
                <p className="text-sm font-semibold text-slate-500">No bookings found</p>
                <p className="text-xs text-slate-400 mt-1">Try a different filter</p>
              </div>
            ) : (
              filteredBookings.map((b: any) => (
                <BookingListItem
                  key={b.id}
                  booking={b}
                  accent={kpiConfig[activeKpi].accent}
                  onView={() => setDetailsBooking(b)}
                />
              ))
            )}
          </div>
        </div>

        {/* ═══ HOUSEKEEPING + OCCUPANCY ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card title="Live Occupancy" subtitle="Real-time room status" link="/housekeeping" linkText="Manage">
            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="Available" value={stats.availableRooms} color="emerald" />
              <MiniStat label="Occupied" value={stats.occupiedRooms} color="rose" />
              <MiniStat label="Total" value={stats.totalRooms} color="slate" />
              <MiniStat label="Rate" value={`${stats.occupancyRate.toFixed(0)}%`} color="sky" />
            </div>
          </Card>

          <Card title="Housekeeping" subtitle="Room cleaning status" link="/housekeeping" linkText="Manage" className="lg:col-span-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <HKBox label="Clean" value={stats.cleanRooms} color="emerald" />
              <HKBox label="Dirty" value={stats.dirtyRooms} color="rose" />
              <HKBox label="Inspected" value={stats.inspectedRooms} color="sky" />
              <HKBox label="Maintenance" value={stats.maintenanceRooms} color="amber" />
            </div>
          </Card>
        </div>

      </div>

      {/* ═══ DETAILS MODAL ═══ */}
      {detailsBooking && (
        <BookingDetailsModal
          booking={detailsBooking}
          onClose={() => setDetailsBooking(null)}
        />
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

function MiniStat({ label, value, color }: any) {
  const c: any = { emerald: "text-emerald-600", rose: "text-rose-600", sky: "text-sky-600", slate: "text-slate-700" };
  return (
    <div className="text-center p-3 bg-slate-50 rounded-xl">
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold ${c[color]} mt-1`}>{value}</p>
    </div>
  );
}

function HKBox({ label, value, color }: any) {
  const colors: any = {
    emerald: "from-emerald-50 to-white border-emerald-100 text-emerald-700",
    rose: "from-rose-50 to-white border-rose-100 text-rose-700",
    sky: "from-sky-50 to-white border-sky-100 text-sky-700",
    amber: "from-amber-50 to-white border-amber-100 text-amber-700",
  };
  return (
    <div className={`p-4 bg-gradient-to-br ${colors[color]} rounded-xl border`}>
      <p className="text-[10px] font-bold uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}

function Card({ title, subtitle, link, linkText, children, className = "" }: any) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 p-5 shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-700">{title}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>
        {link && (
          <Link href={link} className="text-[10px] font-bold text-teal-600 hover:text-teal-800 uppercase tracking-wider">
            {linkText} →
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function BookingListItem({ booking, accent, onView }: any) {
  const colors: any = {
    emerald: { bg: "bg-emerald-50/60 hover:bg-emerald-100 border-emerald-100", avatar: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700" },
    rose: { bg: "bg-rose-50/60 hover:bg-rose-100 border-rose-100", avatar: "bg-rose-500", badge: "bg-rose-100 text-rose-700" },
    sky: { bg: "bg-sky-50/60 hover:bg-sky-100 border-sky-100", avatar: "bg-sky-500", badge: "bg-sky-100 text-sky-700" },
    indigo: { bg: "bg-indigo-50/60 hover:bg-indigo-100 border-indigo-100", avatar: "bg-indigo-500", badge: "bg-indigo-100 text-indigo-700" },
    amber: { bg: "bg-amber-50/60 hover:bg-amber-100 border-amber-100", avatar: "bg-amber-500", badge: "bg-amber-100 text-amber-700" },
  };
  const c = colors[accent] || colors.emerald;
  const name = booking.guestName || booking.primaryGuest?.name || "Guest";
  const balance = booking.balance || 0;
  const room = booking.roomNumber || booking.room?.room_number || "—";

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${c.bg} transition group`}>
      <div className={`w-10 h-10 rounded-full ${c.avatar} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
        {name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-800 truncate">{name}</p>
        <p className="text-[11px] text-slate-500 truncate">
          Room {room}
          {booking.checkIn && ` · ${booking.checkIn}`}
          {booking.adults !== undefined && ` · ${booking.adults}A${booking.children ? ` ${booking.children}C` : ""}`}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {balance > 0 && (
          <span className="text-xs font-bold text-rose-600">{fmtFull(balance)}</span>
        )}
        {booking.status && (
          <span className={`text-[9px] font-bold px-2 py-1 rounded-full ${c.badge}`}>
            {booking.status}
          </span>
        )}
        <button
          onClick={onView}
          className="text-[10px] font-bold px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 transition shadow-sm"
        >
          View
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// BOOKING DETAILS MODAL
// ═══════════════════════════════════════════════
function BookingDetailsModal({ booking, onClose }: any) {
  const name = booking.guestName || booking.primaryGuest?.name || "Guest";
  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white font-bold">
              {name.charAt(0).toUpperCase()}
            </div>
            <h3 className="text-lg font-bold text-slate-900">Booking Details</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-lg">
            ×
          </button>
        </div>
        <div className="p-6 space-y-3">
          <Row label="Guest" value={name} />
          <Row label="Room" value={booking.roomNumber || "—"} />
          <Row label="Check-in" value={booking.checkIn || "—"} />
          <Row label="Check-out" value={booking.checkOut || "—"} />
          <Row label="Status" value={booking.status || "—"} />
          {booking.adults !== undefined && <Row label="Adults" value={String(booking.adults)} />}
          {booking.children !== undefined && <Row label="Children" value={String(booking.children)} />}
          {booking.amount !== undefined && <Row label="Amount" value={fmtFull(booking.amount)} />}
          {booking.balance !== undefined && (
            <Row label="Balance Due" value={fmtFull(booking.balance)} highlight={booking.balance > 0 ? "rose" : "emerald"} />
          )}
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
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm ${highlight ? colors[highlight] : "font-semibold text-slate-800"}`}>{value}</span>
    </div>
  );
}