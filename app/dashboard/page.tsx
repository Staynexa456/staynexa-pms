// app/dashboard/page.tsx
"use client";

import React, { useEffect, useState, useMemo } from "react";
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

type SortMode = "room" | "guest" | "status" | "amount" | "date";

// ═══════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════
export default function DashboardPage() {
  const { stats, loading, error, refresh } = useHotelStats();
  const { hotelId, loading: hotelLoading } = useActiveHotel();
  const [actions, setActions] = useState<ActionsRequiredSummary | null>(null);
  const [actionsLoading, setActionsLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  // Sort states
  const [arrivalsSort, setArrivalsSort] = useState<SortMode>("room");
  const [departuresSort, setDeparturesSort] = useState<SortMode>("room");
  const [newBookingsSort, setNewBookingsSort] = useState<SortMode>("date");
  const [pendingSort, setPendingSort] = useState<SortMode>("amount");

  // New bookings
  const [newBookings, setNewBookings] = useState<any[]>([]);
  const [loadingNewBookings, setLoadingNewBookings] = useState(true);

  // View details modal
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
        setNewBookings(sorted.slice(0, 10));
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

  // Sort function
  const sortBookings = (bookings: any[], mode: SortMode) => {
    return [...bookings].sort((a, b) => {
      switch (mode) {
        case "room":
          return (a.roomNumber || "").localeCompare(b.roomNumber || "");
        case "guest":
          return (a.guestName || "").localeCompare(b.guestName || "");
        case "status":
          return (a.status || "").localeCompare(b.status || "");
        case "amount":
          return (b.balance || 0) - (a.balance || 0);
        case "date":
        default:
          return (
            new Date(b.created_at || b.checkIn || 0).getTime() -
            new Date(a.created_at || a.checkIn || 0).getTime()
          );
      }
    });
  };

  const sortedArrivals = useMemo(
    () => sortBookings(stats?.arrivalsToday || [], arrivalsSort),
    [stats?.arrivalsToday, arrivalsSort]
  );
  const sortedDepartures = useMemo(
    () => sortBookings(stats?.departuresToday || [], departuresSort),
    [stats?.departuresToday, departuresSort]
  );
  const sortedPending = useMemo(
    () => sortBookings(
      (stats?.inHouseGuests || []).filter((g: any) => g.balance > 0),
      pendingSort
    ),
    [stats?.inHouseGuests, pendingSort]
  );
  const sortedNewBookings = useMemo(
    () => sortBookings(newBookings, newBookingsSort),
    [newBookings, newBookingsSort]
  );

  // PDF Download
  const downloadReport = async (type: "summary" | "arrivals" | "departures" | "pending" | "newBookings") => {
    if (!stats) return;
    setDownloading(type);
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Header
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 80, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("Staynexa PMS", 40, 40);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(20, 184, 166);
      const titles: Record<string, string> = {
        summary: "DAILY DASHBOARD REPORT",
        arrivals: "TODAY'S ARRIVALS",
        departures: "TODAY'S DEPARTURES",
        pending: "PENDING PAYMENTS",
        newBookings: "RECENT NEW BOOKINGS",
      };
      doc.text(titles[type], 40, 60);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.text(new Date().toLocaleString("en-IN"), pageWidth - 40, 45, { align: "right" });

      let y = 110;

      if (type === "summary") {
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Key Performance Indicators", 40, y);
        y += 15;
        autoTable(doc, {
          startY: y,
          head: [["Metric", "Value"]],
          body: [
            ["Today's Collection", fmtFull(stats.todayCollection)],
            ["Month Revenue", fmtFull(stats.monthCollection)],
            ["Week Revenue", fmtFull(stats.weekCollection)],
            ["ADR", fmtFull(stats.adr)],
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
          headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
          bodyStyles: { fontSize: 10 },
          margin: { left: 40, right: 40 },
        });
        y = (doc as any).lastAutoTable.finalY + 25;
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Housekeeping", 40, y);
        y += 15;
        autoTable(doc, {
          startY: y,
          head: [["Status", "Count"]],
          body: [
            ["Clean", String(stats.cleanRooms)],
            ["Dirty", String(stats.dirtyRooms)],
            ["Inspected", String(stats.inspectedRooms)],
            ["Maintenance", String(stats.maintenanceRooms)],
            ["Cleanliness Score", `${stats.cleanlinessPercent.toFixed(0)}%`],
          ],
          theme: "striped",
          headStyles: { fillColor: [20, 184, 166], textColor: [255, 255, 255] },
          margin: { left: 40, right: 40 },
        });
      } else if (type === "arrivals") {
        autoTable(doc, {
          startY: y,
          head: [["#", "Guest", "Room", "Adults", "Children", "Status"]],
          body: sortedArrivals.map((b: any, i: number) => [
            String(i + 1),
            b.guestName,
            b.roomNumber || "—",
            String(b.adults || 0),
            String(b.children || 0),
            b.status,
          ]),
          theme: "striped",
          headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] },
          margin: { left: 40, right: 40 },
        });
      } else if (type === "departures") {
        autoTable(doc, {
          startY: y,
          head: [["#", "Guest", "Room", "Status", "Balance"]],
          body: sortedDepartures.map((b: any, i: number) => [
            String(i + 1),
            b.guestName,
            b.roomNumber || "—",
            b.status,
            b.balance > 0 ? fmtFull(b.balance) : "Paid",
          ]),
          theme: "striped",
          headStyles: { fillColor: [244, 63, 94], textColor: [255, 255, 255] },
          margin: { left: 40, right: 40 },
        });
      } else if (type === "pending") {
        autoTable(doc, {
          startY: y,
          head: [["#", "Guest", "Room", "Check-in", "Check-out", "Balance"]],
          body: sortedPending.map((g: any, i: number) => [
            String(i + 1),
            g.guestName,
            g.roomNumber || "—",
            g.checkIn || "—",
            g.checkOut || "—",
            fmtFull(g.balance),
          ]),
          theme: "striped",
          headStyles: { fillColor: [239, 68, 68], textColor: [255, 255, 255] },
          margin: { left: 40, right: 40 },
        });
      } else if (type === "newBookings") {
        autoTable(doc, {
          startY: y,
          head: [["#", "Guest", "Room", "Check-in", "Check-out", "Amount", "Status"]],
          body: sortedNewBookings.map((b: any, i: number) => [
            String(i + 1),
            b.primaryGuest?.name || b.guestName || "Guest",
            b.roomNumber || "—",
            b.checkIn || "—",
            b.checkOut || "—",
            fmtFull((b.amount || 0) + (b.tax || 0)),
            b.status,
          ]),
          theme: "striped",
          headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255] },
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
          `Staynexa PMS · Page ${i} of ${totalPages} · ${new Date().toLocaleDateString("en-IN")}`,
          pageWidth / 2,
          pageHeight - 25,
          { align: "center" }
        );
      }

      doc.save(`Staynexa-${type}-${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (err) {
      console.error("PDF error:", err);
      alert("PDF download failed. Please try again.");
    } finally {
      setDownloading(null);
    }
  };

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
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto p-4 lg:p-6 space-y-6">

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
                Welcome back 👋
              </h1>
              <p className="text-slate-300 text-sm mt-1">
                {stats.occupiedRooms} occupied · {stats.arrivalCount} arrivals · {stats.departureCount} departures
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => downloadReport("summary")}
                disabled={downloading === "summary"}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:opacity-90 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-lg"
              >
                {downloading === "summary" ? "…" : "📄 Download Report"}
              </button>
              <button
                onClick={refresh}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition border border-white/10"
              >
                🔄 Refresh
              </button>
              <Link
                href="/calendar"
                className="px-4 py-2.5 bg-white text-slate-900 rounded-xl text-xs font-bold hover:bg-slate-100"
              >
                📅 Calendar
              </Link>
            </div>
          </div>

          {/* Top Stats */}
          <div className="relative mt-6 pt-5 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatBox label="Today's Collection" value={fmtFull(stats.todayCollection)} />
            <StatBox label="Month Revenue" value={fmtShort(stats.monthCollection)} />
            <StatBox label="ADR" value={fmtFull(stats.adr)} />
            <StatBox label="RevPAR" value={fmtFull(stats.revpar)} />
          </div>
        </div>

        {/* ═══ KPI CARDS ═══ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            icon="🛬"
            label="Arrivals"
            value={stats.arrivalCount}
            sub={`${stats.pendingCheckins.length} pending`}
            accent="emerald"
          />
          <KPICard
            icon="🛫"
            label="Departures"
            value={stats.departureCount}
            sub={`${stats.pendingCheckouts.length} pending`}
            accent="rose"
          />
          <KPICard
            icon="👥"
            label="In-House"
            value={stats.inHouseCount}
            sub={`${stats.occupancyRate.toFixed(0)}% occupancy`}
            accent="sky"
          />
          <KPICard
            icon="💰"
            label="Outstanding"
            value={fmtShort(stats.totalPending)}
            sub={`${stats.inHouseGuests.filter((g: any) => g.balance > 0).length} guests`}
            accent="amber"
          />
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

        {/* ═══ ARRIVALS with SORT + PDF ═══ */}
        <BookingSection
          title="Today's Arrivals"
          icon="🛬"
          accent="emerald"
          count={stats.arrivalCount}
          pendingCount={stats.pendingCheckins.length}
          sortMode={arrivalsSort}
          onSortChange={setArrivalsSort}
          onDownload={() => downloadReport("arrivals")}
          downloading={downloading === "arrivals"}
        >
          {sortedArrivals.length === 0 ? (
            <EmptyState icon="🛬" text="No arrivals today" />
          ) : (
            sortedArrivals.map((b: any) => (
              <BookingRow
                key={b.id}
                booking={b}
                accent="emerald"
                onView={() => setDetailsBooking(b)}
              />
            ))
          )}
        </BookingSection>

        {/* ═══ DEPARTURES with SORT + PDF ═══ */}
        <BookingSection
          title="Today's Departures"
          icon="🛫"
          accent="rose"
          count={stats.departureCount}
          pendingCount={stats.pendingCheckouts.length}
          sortMode={departuresSort}
          onSortChange={setDeparturesSort}
          onDownload={() => downloadReport("departures")}
          downloading={downloading === "departures"}
        >
          {sortedDepartures.length === 0 ? (
            <EmptyState icon="🛫" text="No departures today" />
          ) : (
            sortedDepartures.map((b: any) => (
              <BookingRow
                key={b.id}
                booking={b}
                accent="rose"
                showBalance
                onView={() => setDetailsBooking(b)}
              />
            ))
          )}
        </BookingSection>

        {/* ═══ NEW BOOKINGS with SORT + PDF ═══ */}
        <BookingSection
          title="Recent New Bookings"
          icon="✨"
          accent="indigo"
          count={newBookings.length}
          sortMode={newBookingsSort}
          onSortChange={setNewBookingsSort}
          onDownload={() => downloadReport("newBookings")}
          downloading={downloading === "newBookings"}
        >
          {loadingNewBookings ? (
            <div className="text-center py-8 text-sm text-slate-400">Loading…</div>
          ) : sortedNewBookings.length === 0 ? (
            <EmptyState icon="✨" text="No recent bookings" />
          ) : (
            sortedNewBookings.map((b: any) => (
              <BookingRow
                key={b.id}
                booking={{
                  id: b.id,
                  guestName: b.primaryGuest?.name || b.guestName || "Guest",
                  roomNumber: b.roomNumber || b.room?.room_number,
                  status: b.status,
                  checkIn: b.checkIn,
                  checkOut: b.checkOut,
                  balance: (b.amount + b.tax) - (b.paid || 0),
                  amount: (b.amount || 0) + (b.tax || 0),
                  adults: b.adults,
                  children: b.children,
                }}
                accent="indigo"
                onView={() => setDetailsBooking(b)}
                showAmount
              />
            ))
          )}
        </BookingSection>

        {/* ═══ PENDING PAYMENTS with SORT + PDF ═══ */}
        <BookingSection
          title="Pending Payments"
          icon="💰"
          accent="amber"
          count={sortedPending.length}
          totalAmount={stats.totalPending}
          sortMode={pendingSort}
          onSortChange={setPendingSort}
          onDownload={() => downloadReport("pending")}
          downloading={downloading === "pending"}
        >
          {sortedPending.length === 0 ? (
            <EmptyState icon="✅" text="All caught up! No pending payments." />
          ) : (
            sortedPending.map((g: any) => (
              <BookingRow
                key={g.id}
                booking={{
                  id: g.id,
                  guestName: g.guestName,
                  roomNumber: g.roomNumber,
                  status: "IN-HOUSE",
                  checkIn: g.checkIn,
                  checkOut: g.checkOut,
                  balance: g.balance,
                }}
                accent="amber"
                showBalance
                onView={() => setDetailsBooking(g)}
              />
            ))
          )}
        </BookingSection>

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
function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-xl lg:text-2xl font-bold text-white mt-1">{value}</p>
    </div>
  );
}

function KPICard({ icon, label, value, sub, accent }: any) {
  const colors: any = {
    emerald: "from-emerald-400 to-emerald-600 shadow-emerald-500/30 border-emerald-200",
    rose: "from-rose-400 to-rose-600 shadow-rose-500/30 border-rose-200",
    sky: "from-sky-400 to-sky-600 shadow-sky-500/30 border-sky-200",
    amber: "from-amber-400 to-amber-600 shadow-amber-500/30 border-amber-200",
  };
  return (
    <div className={`relative bg-white rounded-2xl border ${colors[accent].split(" ").pop()} p-5 overflow-hidden`}>
      <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${colors[accent].split(" ").slice(0, 2).join(" ")}`} />
      <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${colors[accent].split(" ").slice(0, 2).join(" ")} flex items-center justify-center text-white text-xl shadow-lg mb-3`}>
        {icon}
      </div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{sub}</p>
    </div>
  );
}

function MiniStat({ label, value, color }: any) {
  const c: any = {
    emerald: "text-emerald-600",
    rose: "text-rose-600",
    sky: "text-sky-600",
    slate: "text-slate-700",
  };
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

function BookingSection({
  title, icon, accent, count, pendingCount, totalAmount, sortMode, onSortChange, onDownload, downloading, children,
}: any) {
  const accents: any = {
    emerald: "from-emerald-50 to-emerald-50/30 border-emerald-100 text-emerald-900",
    rose: "from-rose-50 to-rose-50/30 border-rose-100 text-rose-900",
    amber: "from-amber-50 to-amber-50/30 border-amber-100 text-amber-900",
    indigo: "from-indigo-50 to-indigo-50/30 border-indigo-100 text-indigo-900",
  };
  const [from, to, , text] = accents[accent].split(" ");

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className={`px-5 py-3 bg-gradient-to-r ${from} ${to} border-b ${accents[accent].split(" ")[2]} flex flex-wrap items-center justify-between gap-3`}>
        <div className="flex items-center gap-3">
          <div className="text-2xl">{icon}</div>
          <div>
            <h3 className={`text-sm font-bold ${text}`}>{title}</h3>
            <p className="text-[10px] text-slate-500 font-medium">
              {count} {pendingCount !== undefined ? `· ${pendingCount} pending` : ""}
              {totalAmount !== undefined ? ` · ₹${Math.round(totalAmount).toLocaleString("en-IN")}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sortMode}
            onChange={(e) => onSortChange(e.target.value)}
            className="text-[10px] font-bold px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 outline-none cursor-pointer"
          >
            <option value="room">Sort: Room</option>
            <option value="guest">Sort: Guest</option>
            <option value="status">Sort: Status</option>
            <option value="amount">Sort: Amount</option>
            <option value="date">Sort: Date</option>
          </select>
          <button
            onClick={onDownload}
            disabled={downloading}
            className="text-[10px] font-bold px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {downloading ? "…" : "📄 PDF"}
          </button>
        </div>
      </div>
      <div className="p-3 space-y-2 max-h-96 overflow-y-auto">{children}</div>
    </div>
  );
}

function BookingRow({ booking, accent, showBalance, showAmount, onView }: any) {
  const colors: any = {
    emerald: { bg: "bg-emerald-50/50 hover:bg-emerald-100 border-emerald-100", avatar: "bg-emerald-500", status: "text-emerald-700 border-emerald-200" },
    rose: { bg: "bg-rose-50/50 hover:bg-rose-100 border-rose-100", avatar: "bg-rose-500", status: "text-rose-700 border-rose-200" },
    amber: { bg: "bg-amber-50/50 hover:bg-amber-100 border-amber-100", avatar: "bg-amber-500", status: "text-amber-700 border-amber-200" },
    indigo: { bg: "bg-indigo-50/50 hover:bg-indigo-100 border-indigo-100", avatar: "bg-indigo-500", status: "text-indigo-700 border-indigo-200" },
  };
  const c = colors[accent] || colors.emerald;
  const name = booking.guestName || "Guest";

  return (
    <div className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${c.bg} transition`}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className={`w-9 h-9 rounded-full ${c.avatar} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
          {name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
          <p className="text-[10px] text-slate-500 truncate">
            Room {booking.roomNumber || "—"}
            {booking.checkIn && ` · ${booking.checkIn} → ${booking.checkOut || "—"}`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {showBalance && booking.balance > 0 && (
          <span className="text-xs font-bold text-rose-600">{fmtFull(booking.balance)}</span>
        )}
        {showAmount && booking.amount > 0 && (
          <span className="text-xs font-bold text-slate-700">{fmtFull(booking.amount)}</span>
        )}
        {booking.status && (
          <span className={`text-[9px] font-bold px-2 py-1 rounded-full border bg-white ${c.status}`}>
            {booking.status}
          </span>
        )}
        {onView && (
          <button
            onClick={onView}
            className="text-[10px] font-bold px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100"
          >
            View
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ icon, text }: any) {
  return (
    <div className="text-center py-8">
      <p className="text-3xl mb-2 opacity-30">{icon}</p>
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════
// BOOKING DETAILS MODAL
// ═══════════════════════════════════════════════
function BookingDetailsModal({ booking, onClose }: any) {
  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Booking Details</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-lg">
            ×
          </button>
        </div>
        <div className="p-6 space-y-3">
          <Row label="Guest" value={booking.guestName || "—"} />
          <Row label="Room" value={booking.roomNumber || "—"} />
          <Row label="Check-in" value={booking.checkIn || "—"} />
          <Row label="Check-out" value={booking.checkOut || "—"} />
          <Row label="Status" value={booking.status || "—"} />
          {booking.adults !== undefined && <Row label="Adults" value={String(booking.adults)} />}
          {booking.children !== undefined && <Row label="Children" value={String(booking.children)} />}
          {booking.amount !== undefined && <Row label="Amount" value={fmtFull(booking.amount)} />}
          {booking.balance !== undefined && (
            <Row
              label="Balance Due"
              value={fmtFull(booking.balance)}
              highlight={booking.balance > 0 ? "rose" : "emerald"}
            />
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
  const colors: any = {
    rose: "text-rose-600 font-bold",
    emerald: "text-emerald-600 font-bold",
  };
  return (
    <div className="flex justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm ${highlight ? colors[highlight] : "font-semibold text-slate-800"}`}>{value}</span>
    </div>
  );
}