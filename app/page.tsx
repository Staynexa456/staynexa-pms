"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { getActiveHotelId } from "./active-hotel";
import {
  fetchDashboardStatsForDate,
  fetchRevenueStats,
  fetchTodayOperations,
  fetchHousekeepingRooms,
  fetchBookings,
} from "./db";
import FolioModal from "./components/FolioModal";

// ═══════════════════════════════════════════════
// SVG CHART COMPONENTS
// ═══════════════════════════════════════════════

function OccupancyDonut({ inHouse, total }: { inHouse: number; total: number }) {
  const pct = total > 0 ? Math.round((inHouse / total) * 100) : 0;
  const r = 54;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative w-44 h-44">
      <svg className="transform -rotate-90 w-full h-full" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#f1f5f9" strokeWidth="12" />
        <circle cx="70" cy="70" r={r} fill="none" stroke="url(#donutGrad)" strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }} />
        <defs>
          <linearGradient id="donutGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold text-slate-900 tracking-tight">{pct}<span className="text-xl text-slate-400">%</span></span>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Occupied</span>
      </div>
    </div>
  );
}

function RevenueBarChart({ data }: { data: { day: string; value: number }[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end justify-between gap-2 h-32">
      {data.map((d, i) => {
        const h = (d.value / max) * 100;
        const isToday = i === data.length - 1;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-2">
            <div className="w-full relative group">
              <div className={`w-full rounded-t-md transition-all duration-700 ${isToday ? "bg-gradient-to-t from-teal-600 to-teal-400" : "bg-slate-200 group-hover:bg-teal-400"}`}
                style={{ height: `${Math.max(h, 8)}%`, minHeight: "8px" }} />
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-10 shadow-lg">
                ₹{d.value.toLocaleString("en-IN")}
              </div>
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? "text-teal-600" : "text-slate-400"}`}>{d.day}</span>
          </div>
        );
      })}
    </div>
  );
}

function Sparkline({ data, color = "#0ea5e9" }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 100, h = 28;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  const id = color.replace("#", "");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-7" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sp-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#sp-${id})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ═══════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [revenue, setRevenue] = useState<any>(null);
  const [ops, setOps] = useState<any>(null);
  const [hkStats, setHkStats] = useState({ clean: 0, dirty: 0, maintenance: 0, inspected: 0, total: 0 });
  const [bookings, setBookings] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"arrivals" | "departures" | "inHouse">("arrivals");
  const [arrivalsFilter, setArrivalsFilter] = useState<"all" | "pending" | "completed">("all");
  const [departuresFilter, setDeparturesFilter] = useState<"all" | "pending" | "completed">("all");
  const [showDetailsFor, setShowDetailsFor] = useState<any | null>(null);
  const [folioFor, setFolioFor] = useState<any | null>(null);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const todayPretty = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const hotelId = getActiveHotelId() || undefined;
      const [s, r, o, rm, bk] = await Promise.all([
        fetchDashboardStatsForDate(hotelId, today),
        fetchRevenueStats(hotelId),
        fetchTodayOperations(hotelId),
        fetchHousekeepingRooms(hotelId),
        fetchBookings(hotelId),
      ]);
      setStats(s); setRevenue(r); setOps(o); setRooms(rm); setBookings(bk);
      const hk = { clean: 0, dirty: 0, maintenance: 0, inspected: 0, total: rm.length };
      rm.forEach((x: any) => {
        const st = x.housekeeping_status || "CLEAN";
        if (st === "CLEAN") hk.clean++;
        else if (st === "DIRTY") hk.dirty++;
        else if (st === "MAINTENANCE") hk.maintenance++;
        else if (st === "INSPECTED") hk.inspected++;
      });
      setHkStats(hk);
    } catch (err) { console.error("[Dashboard]", err); }
    finally { setLoading(false); }
  }, [today]);

  useEffect(() => {
    loadAll();
    const h = () => loadAll();
    window.addEventListener("hotel-changed", h);
    return () => window.removeEventListener("hotel-changed", h);
  }, [loadAll]);

  const weeklyRevenue = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const base = revenue?.monthRevenue ? revenue.monthRevenue / 30 : 0;
    const td = new Date();
    const sw = new Date(td); sw.setDate(td.getDate() - td.getDay());
    return days.map((dayName, i) => {
      const d = new Date(sw); d.setDate(sw.getDate() + i);
      return { day: dayName, value: Math.round(base * (0.6 + (i * 0.15))) };
    });
  }, [revenue]);

  const occupancyPct = hkStats.total > 0 ? Math.round(((stats?.inHouse || 0) / hkStats.total) * 100) : 0;
  const fmtC = (n: number) => `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  const fmtCShort = (n: number) => {
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
    return `₹${n}`;
  };

  // Filter operations
  const filteredArrivals = useMemo(() => {
    const list = ops?.arrivals || [];
    if (arrivalsFilter === "pending") return list.filter((b: any) => b.status === "CONFIRMED" || b.status === "PENDING DEPARTURE");
    if (arrivalsFilter === "completed") return list.filter((b: any) => b.status === "CHECKED-IN");
    return list;
  }, [ops, arrivalsFilter]);

  const filteredDepartures = useMemo(() => {
    const list = ops?.departures || [];
    if (departuresFilter === "pending") return list.filter((b: any) => b.status === "CHECKED-IN" || b.status === "PENDING DEPARTURE");
    if (departuresFilter === "completed") return list.filter((b: any) => b.status === "CHECKED-OUT");
    return list;
  }, [ops, departuresFilter]);

  const arrivalsPendingCount = (ops?.arrivals || []).filter((b: any) => b.status === "CONFIRMED" || b.status === "PENDING DEPARTURE").length;
  const arrivalsCheckedInCount = (ops?.arrivals || []).filter((b: any) => b.status === "CHECKED-IN").length;
  const departuresPendingCount = (ops?.departures || []).filter((b: any) => b.status === "CHECKED-IN" || b.status === "PENDING DEPARTURE").length;
  const departuresCompletedCount = (ops?.departures || []).filter((b: any) => b.status === "CHECKED-OUT").length;

  const currentList = activeTab === "arrivals" ? filteredArrivals : activeTab === "departures" ? filteredDepartures : (ops?.inHouse || []);

  // Download reports
  const downloadCSV = (filename: string, rows: any[][], headers: string[]) => {
    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${String(c || "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("📥 " + filename + " downloaded");
  };

  const handleDownload = (type: string) => {
    setDownloadMenuOpen(false);
    if (type === "arrivals") {
      downloadCSV(`Arrivals_${today}.csv`,
        (ops?.arrivals || []).map((b: any) => [b.guestName, b.guestPhone, b.roomNumber, b.check_in, b.check_out, b.status, b.amount || 0]),
        ["Guest Name", "Phone", "Room", "Check-In", "Check-Out", "Status", "Amount"]);
    } else if (type === "departures") {
      downloadCSV(`Departures_${today}.csv`,
        (ops?.departures || []).map((b: any) => [b.guestName, b.guestPhone, b.roomNumber, b.check_in, b.check_out, b.status, b.amount || 0]),
        ["Guest Name", "Phone", "Room", "Check-In", "Check-Out", "Status", "Amount"]);
    } else if (type === "inHouse") {
      downloadCSV(`InHouse_${today}.csv`,
        (ops?.inHouse || []).map((b: any) => [b.guestName, b.guestPhone, b.roomNumber, b.check_in, b.check_out, b.status, b.amount || 0]),
        ["Guest Name", "Phone", "Room", "Check-In", "Check-Out", "Status", "Amount"]);
    } else if (type === "revenue") {
      downloadCSV(`Revenue_${today}.csv`,
        (bookings || []).map((b: any) => [b.booking_ref || b.id, b.guestName || b.primaryGuest?.name || "Guest", b.roomNumber || "", b.checkIn || "", b.checkOut || "", b.amount || 0, b.tax || 0, b.paid || 0, (Number(b.amount) || 0) + (Number(b.tax) || 0) - (Number(b.paid) || 0)]),
        ["Booking Ref", "Guest", "Room", "Check-In", "Check-Out", "Room Charge", "Tax", "Paid", "Balance"]);
    } else if (type === "all") {
      downloadCSV(`AllBookings_${today}.csv`,
        (bookings || []).map((b: any) => [b.booking_ref || b.id, b.guestName || b.primaryGuest?.name || "Guest", b.guestPhone || "", b.roomNumber || "", b.checkIn || "", b.checkOut || "", b.status || "", b.amount || 0, b.paid || 0]),
        ["Ref", "Guest", "Phone", "Room", "Check-In", "Check-Out", "Status", "Amount", "Paid"]);
    } else if (type === "housekeeping") {
      downloadCSV(`Housekeeping_${today}.csv`,
        (rooms || []).map((r: any) => [r.room_number, r.room_type, r.housekeeping_status || "CLEAN", r.last_cleaned_by || "", r.last_cleaned_at || ""]),
        ["Room", "Type", "Status", "Cleaned By", "Last Cleaned"]);
    }
  };

  const handleCheckIn = async (booking: any) => {
    try {
      showToast(`✅ Opening check-in for ${booking.guestName}...`);
      // Open folio for now, or trigger actual check-in
      setFolioFor(booking);
    } catch (err: any) { showToast(`⚠ ${err.message}`); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] bg-[#fafafa]">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full border-[3px] border-slate-200 border-t-slate-900 animate-spin" />
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-[0.2em]">Loading</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* ═══════ HEADER ═══════ */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-8 py-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-[28px] font-bold text-slate-900 tracking-tight leading-none">Dashboard</h1>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Live</span>
                </div>
              </div>
              <p className="text-sm text-slate-500">{todayPretty}</p>
            </div>

            <div className="flex items-center gap-2">
              {/* DOWNLOAD BUTTON */}
              <div className="relative">
                <button
                  onClick={() => setDownloadMenuOpen(!downloadMenuOpen)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Download
                  <svg className={`w-3 h-3 transition-transform ${downloadMenuOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
                </button>

                {downloadMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setDownloadMenuOpen(false)} />
                    <div className="absolute top-full right-0 mt-2 z-50 bg-white border border-slate-200 rounded-xl shadow-2xl w-[280px] overflow-hidden">
                      <div className="bg-gradient-to-r from-slate-900 to-slate-700 px-4 py-3">
                        <p className="text-white text-xs font-bold uppercase tracking-wider">Download Reports</p>
                        <p className="text-white/70 text-[10px] mt-0.5">Choose a report to export</p>
                      </div>
                      <div className="py-1.5">
                        <DownloadItem icon="🛬" label="Today's Arrivals" desc={`${ops?.arrivals?.length || 0} records`} onClick={() => handleDownload("arrivals")} />
                        <DownloadItem icon="🛫" label="Today's Departures" desc={`${ops?.departures?.length || 0} records`} onClick={() => handleDownload("departures")} />
                        <DownloadItem icon="🏨" label="In-House Guests" desc={`${ops?.inHouse?.length || 0} records`} onClick={() => handleDownload("inHouse")} />
                        <div className="border-t border-slate-100 my-1" />
                        <DownloadItem icon="💰" label="Revenue Report" desc="All bookings with payment" onClick={() => handleDownload("revenue")} />
                        <DownloadItem icon="📋" label="All Bookings" desc="Full booking list" onClick={() => handleDownload("all")} />
                        <DownloadItem icon="🧹" label="Housekeeping Status" desc="Room cleaning report" onClick={() => handleDownload("housekeeping")} />
                      </div>
                    </div>
                  </>
                )}
              </div>

              <button onClick={loadAll} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </button>

              <Link href="/calendar" className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-all shadow-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Calendar
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto p-8 space-y-6">

        {/* ═══ TOP KPIs ═══ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Arrivals Today"
            value={ops?.arrivals?.length || 0}
            subValue={`${arrivalsPendingCount} pending · ${arrivalsCheckedInCount} checked-in`}
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>}
            trend={12.5}
            accent="emerald"
            onClick={() => { setActiveTab("arrivals"); setArrivalsFilter("all"); }}
          />
          <KpiCard
            label="Departures"
            value={ops?.departures?.length || 0}
            subValue={`${departuresPendingCount} pending · ${departuresCompletedCount} checked-out`}
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>}
            trend={-3.2}
            accent="rose"
            onClick={() => { setActiveTab("departures"); setDeparturesFilter("all"); }}
          />
          <KpiCard
            label="In-House"
            value={stats?.inHouse || 0}
            subValue="Currently staying"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
            trend={8.1}
            accent="sky"
            onClick={() => setActiveTab("inHouse")}
          />
          <KpiCard
            label="Occupancy"
            value={`${occupancyPct}%`}
            subValue={`${stats?.inHouse || 0} of ${hkStats.total} rooms`}
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
            trend={4.7}
            accent="violet"
            onClick={() => showToast("📊 Occupancy details → Reports")}
          />
        </div>

        {/* ═══ DONUT + REVENUE ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="mb-5">
              <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em]">Live Occupancy</h2>
              <p className="text-xs text-slate-500 mt-0.5">Real-time room status</p>
            </div>
            <div className="flex items-center justify-center mb-5">
              <OccupancyDonut inHouse={stats?.inHouse || 0} total={hkStats.total} />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-5 border-t border-slate-100">
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Available</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5">{Math.max(0, hkStats.total - (stats?.inHouse || 0))}</p>
              </div>
              <div className="text-center border-l border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Rooms</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5">{hkStats.total}</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em]">Revenue Overview</h2>
                <p className="text-xs text-slate-500 mt-0.5">Weekly performance</p>
              </div>
              <Link href="/reports" className="text-[10px] font-bold text-teal-600 hover:text-teal-800 uppercase tracking-wider flex items-center gap-1">
                Reports <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="border-r border-slate-100 pr-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Today</p>
                <p className="text-2xl font-bold text-slate-900 tracking-tight">{fmtC(revenue?.todayRevenue || 0)}</p>
                <div className="flex items-center gap-1 mt-2">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">↑ 8.2%</span>
                  <span className="text-[10px] text-slate-400">{revenue?.todayBookings || 0} bookings</span>
                </div>
                <div className="mt-2"><Sparkline data={[10, 15, 12, 20, 18, 25, 30]} color="#10b981" /></div>
              </div>
              <div className="border-r border-slate-100 pr-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">This Week</p>
                <p className="text-2xl font-bold text-slate-900 tracking-tight">{fmtCShort(revenue?.weekRevenue || 0)}</p>
                <div className="flex items-center gap-1 mt-2">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">↑ 12.5%</span>
                </div>
                <div className="mt-2"><Sparkline data={[20, 25, 22, 30, 28, 35, 40]} color="#0ea5e9" /></div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">This Month</p>
                <p className="text-2xl font-bold text-slate-900 tracking-tight">{fmtCShort(revenue?.monthRevenue || 0)}</p>
                <div className="flex items-center gap-1 mt-2">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">↑ 5.1%</span>
                  <span className="text-[10px] text-slate-400">{revenue?.monthBookings || 0} bookings</span>
                </div>
                <div className="mt-2"><Sparkline data={[15, 18, 22, 20, 28, 32, 35]} color="#a855f7" /></div>
              </div>
            </div>

            <div className="pt-5 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">Daily Revenue — This Week</p>
              <RevenueBarChart data={weeklyRevenue} />
            </div>
          </div>
        </div>

        {/* ═══ HOUSEKEEPING + PENDING ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em]">Housekeeping Status</h2>
                <p className="text-xs text-slate-500 mt-0.5">Room cleaning overview</p>
              </div>
              <Link href="/housekeeping" className="text-[10px] font-bold text-teal-600 hover:text-teal-800 uppercase tracking-wider flex items-center gap-1">
                Manage <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
              </Link>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-4 gap-3 mb-6">
                <HkStat label="Clean" count={hkStats.clean} color="emerald" />
                <HkStat label="Dirty" count={hkStats.dirty} color="rose" />
                <HkStat label="Inspected" count={hkStats.inspected} color="sky" />
                <HkStat label="Maintenance" count={hkStats.maintenance} color="amber" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                  <span className="text-slate-400">Overall Cleanliness</span>
                  <span className="text-slate-900">{hkStats.total > 0 ? Math.round(((hkStats.clean + hkStats.inspected) / hkStats.total) * 100) : 0}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden flex">
                  <div className="bg-emerald-500 h-full transition-all" style={{ width: `${hkStats.total > 0 ? (hkStats.clean / hkStats.total) * 100 : 0}%` }} />
                  <div className="bg-sky-500 h-full transition-all" style={{ width: `${hkStats.total > 0 ? (hkStats.inspected / hkStats.total) * 100 : 0}%` }} />
                  <div className="bg-rose-500 h-full transition-all" style={{ width: `${hkStats.total > 0 ? (hkStats.dirty / hkStats.total) * 100 : 0}%` }} />
                  <div className="bg-amber-500 h-full transition-all" style={{ width: `${hkStats.total > 0 ? (hkStats.maintenance / hkStats.total) * 100 : 0}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em]">Pending Payments</h2>
                <p className="text-xs text-slate-500 mt-0.5">Awaiting collection</p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">{ops?.pendingPayment?.length || 0}</span>
            </div>
            <div className="p-6">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Outstanding</p>
              <p className="text-3xl font-bold text-rose-600 tracking-tight mb-4">{fmtC(ops?.pendingAmount || 0)}</p>
              <div className="space-y-1 max-h-44 overflow-y-auto">
                {(ops?.pendingPayment || []).slice(0, 6).map((b: any) => (
                  <div key={b.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">{b.guestName}</p>
                      <p className="text-[10px] text-slate-400">Room {b.roomNumber}</p>
                    </div>
                    <span className="text-sm font-bold text-rose-600 ml-3">{fmtC(b.balanceDue)}</span>
                  </div>
                ))}
                {(ops?.pendingPayment || []).length === 0 && (
                  <p className="text-center text-slate-400 text-sm py-6">No pending payments 🎉</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ═══ MAIN OPERATIONS TABLE ═══ */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-slate-100">
            <div className="flex items-center justify-between px-6 pt-5">
              <div className="flex items-center gap-1">
                <TabButton
                  active={activeTab === "arrivals"}
                  onClick={() => setActiveTab("arrivals")}
                  label="Arrivals"
                  count={ops?.arrivals?.length || 0}
                  color="emerald"
                />
                <TabButton
                  active={activeTab === "departures"}
                  onClick={() => setActiveTab("departures")}
                  label="Departures"
                  count={ops?.departures?.length || 0}
                  color="rose"
                />
                <TabButton
                  active={activeTab === "inHouse"}
                  onClick={() => setActiveTab("inHouse")}
                  label="In-House"
                  count={ops?.inHouse?.length || 0}
                  color="sky"
                />
              </div>
              <p className="text-xs text-slate-500 font-medium">{currentList.length} record{currentList.length !== 1 ? "s" : ""}</p>
            </div>

            {/* Sub-filters */}
            {activeTab === "arrivals" && (
              <div className="flex items-center gap-1 px-6 py-3 bg-slate-50/50">
                <FilterPill active={arrivalsFilter === "all"} onClick={() => setArrivalsFilter("all")} label="All" count={ops?.arrivals?.length || 0} color="slate" />
                <FilterPill active={arrivalsFilter === "pending"} onClick={() => setArrivalsFilter("pending")} label="Pending Check-In" count={arrivalsPendingCount} color="amber" />
                <FilterPill active={arrivalsFilter === "completed"} onClick={() => setArrivalsFilter("completed")} label="Checked-In" count={arrivalsCheckedInCount} color="emerald" />
              </div>
            )}
            {activeTab === "departures" && (
              <div className="flex items-center gap-1 px-6 py-3 bg-slate-50/50">
                <FilterPill active={departuresFilter === "all"} onClick={() => setDeparturesFilter("all")} label="All" count={ops?.departures?.length || 0} color="slate" />
                <FilterPill active={departuresFilter === "pending"} onClick={() => setDeparturesFilter("pending")} label="Pending Check-Out" count={departuresPendingCount} color="amber" />
                <FilterPill active={departuresFilter === "completed"} onClick={() => setDeparturesFilter("completed")} label="Checked-Out" count={departuresCompletedCount} color="slate" />
              </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Guest</th>
                  <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Room</th>
                  <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Dates</th>
                  <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Status</th>
                  <th className="text-right px-6 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Amount</th>
                  <th className="text-right px-6 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Balance</th>
                  <th className="text-right px-6 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentList.slice(0, 10).map((b: any) => (
                  <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-800 to-slate-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                          {(b.guestName || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 text-sm truncate">{b.guestName}</p>
                          <p className="text-[11px] text-slate-400">{b.guestPhone || "No phone"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-700">
                          {b.roomNumber}
                        </div>
                        <span className="text-[11px] text-slate-500">{b.roomType}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600 leading-relaxed">
                      <div>In: <span className="font-semibold">{b.check_in}</span></div>
                      <div className="text-slate-400">Out: {b.check_out}</div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-800 text-sm">
                      {fmtC((Number(b.amount) || 0) + (Number(b.tax) || 0))}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {b.balanceDue > 0 ? (
                        <span className="font-bold text-rose-600 text-sm">{fmtC(b.balanceDue)}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-xs">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                          Paid
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <ActionButton
                          icon="👁"
                          label="Details"
                          onClick={() => setShowDetailsFor(b)}
                        />
                        <ActionButton
                          icon="📄"
                          label="Folio"
                          onClick={() => setFolioFor(b)}
                          highlight
                        />
                        {activeTab === "arrivals" && b.status === "CONFIRMED" && (
                          <ActionButton icon="✓" label="Check-In" onClick={() => handleCheckIn(b)} success />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {currentList.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <div className="text-5xl mb-4 opacity-30">📭</div>
                      <p className="text-slate-500 text-sm font-medium">No records found</p>
                      <p className="text-slate-400 text-xs mt-1">Try changing the filter or check back later</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ═══ DETAILS SIDE PANEL ═══ */}
      {showDetailsFor && (
        <BookingDetailsPanel
          booking={showDetailsFor}
          onClose={() => setShowDetailsFor(null)}
          onOpenFolio={() => { setFolioFor(showDetailsFor); setShowDetailsFor(null); }}
        />
      )}

      {/* ═══ FOLIO MODAL ═══ */}
      {folioFor && (
        <FolioModal
          booking={folioFor}
          onClose={() => setFolioFor(null)}
          onSettleDues={() => { showToast("💰 Settle dues opened"); setFolioFor(null); }}
          onCheckInOrOut={() => { showToast("✓ Action triggered"); setFolioFor(null); }}
          onPaymentMade={() => { loadAll(); }}
          onBookingUpdate={() => { loadAll(); }}
          onAction={(l: string) => showToast("⚙ " + l)}
          onDeleteAddon={() => {}}
        />
      )}

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-xl text-sm font-medium z-[100] shadow-2xl">{toast}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════
// SUB COMPONENTS
// ═══════════════════════════════════════════════

function KpiCard({ label, value, subValue, icon, trend, accent, onClick }: any) {
  const map: any = {
    emerald: { bg: "bg-emerald-50", text: "text-emerald-600", bar: "bg-emerald-500", hover: "group-hover:border-emerald-300" },
    rose:    { bg: "bg-rose-50",    text: "text-rose-600",    bar: "bg-rose-500",    hover: "group-hover:border-rose-300" },
    sky:     { bg: "bg-sky-50",     text: "text-sky-600",     bar: "bg-sky-500",     hover: "group-hover:border-sky-300" },
    violet:  { bg: "bg-violet-50",  text: "text-violet-600",  bar: "bg-violet-500",  hover: "group-hover:border-violet-300" },
  };
  const a = map[accent];
  const isPos = trend >= 0;
  return (
    <button onClick={onClick} className={`group text-left bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md ${a.hover} transition-all overflow-hidden`}>
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-xl ${a.bg} ${a.text} flex items-center justify-center`}>{icon}</div>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 ${isPos ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
            {isPos ? "↑" : "↓"} {Math.abs(trend)}%
          </span>
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-1">{label}</p>
        <p className="text-3xl font-bold text-slate-900 tracking-tight">{value}</p>
        <p className="text-xs text-slate-500 mt-1.5">{subValue}</p>
      </div>
      <div className={`h-1 ${a.bar} opacity-0 group-hover:opacity-100 transition-opacity`} />
    </button>
  );
}

function HkStat({ label, count, color }: { label: string; count: number; color: string }) {
  const map: any = {
    emerald: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500" },
    rose:    { bg: "bg-rose-50",    border: "border-rose-200",    text: "text-rose-700",    dot: "bg-rose-500" },
    sky:     { bg: "bg-sky-50",     border: "border-sky-200",     text: "text-sky-700",     dot: "bg-sky-500" },
    amber:   { bg: "bg-amber-50",   border: "border-amber-200",   text: "text-amber-700",   dot: "bg-amber-500" },
  };
  const c = map[color];
  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-3.5 text-center relative overflow-hidden`}>
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${c.dot}`} />
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${c.text} tracking-tight`}>{count}</p>
    </div>
  );
}

function TabButton({ active, onClick, label, count, color }: any) {
  const colorMap: any = {
    emerald: active ? "text-emerald-700 border-emerald-600" : "text-slate-500 border-transparent hover:text-slate-800",
    rose:    active ? "text-rose-700 border-rose-600" : "text-slate-500 border-transparent hover:text-slate-800",
    sky:     active ? "text-sky-700 border-sky-600" : "text-slate-500 border-transparent hover:text-slate-800",
  };
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-3 border-b-2 font-semibold text-sm transition-all ${colorMap[color]}`}>
      {label}
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-600"}`}>{count}</span>
    </button>
  );
}

function FilterPill({ active, onClick, label, count, color }: any) {
  const colorMap: any = {
    slate:   active ? "bg-slate-900 text-white" : "bg-white text-slate-600 border-slate-200",
    emerald: active ? "bg-emerald-600 text-white" : "bg-white text-emerald-700 border-emerald-200",
    amber:   active ? "bg-amber-500 text-white" : "bg-white text-amber-700 border-amber-200",
  };
  return (
    <button onClick={onClick} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${colorMap[color]}`}>
      {label} <span className="opacity-70">({count})</span>
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: any = {
    CONFIRMED:       { bg: "bg-amber-50",    text: "text-amber-700",    dot: "bg-amber-500",    label: "Confirmed" },
    "CHECKED-IN":    { bg: "bg-emerald-50",  text: "text-emerald-700",  dot: "bg-emerald-500",  label: "Checked-In" },
    "CHECKED-OUT":   { bg: "bg-slate-100",   text: "text-slate-600",    dot: "bg-slate-400",    label: "Checked-Out" },
    "ON-HOLD":       { bg: "bg-purple-50",   text: "text-purple-700",   dot: "bg-purple-500",   label: "On-Hold" },
    "PENDING DEPARTURE": { bg: "bg-sky-50",  text: "text-sky-700",      dot: "bg-sky-500",      label: "Pending" },
  };
  const s = map[status] || { bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400", label: status };
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function ActionButton({ icon, label, onClick, highlight, success }: any) {
  const cls = highlight
    ? "bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100"
    : success
    ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50";
  return (
    <button onClick={onClick} title={label} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all ${cls}`}>
      <span>{icon}</span>
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}

function DownloadItem({ icon, label, desc, onClick }: any) {
  return (
    <button onClick={onClick} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-3 transition border-b border-slate-50 last:border-0">
      <span className="text-lg">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="text-[10px] text-slate-400">{desc}</p>
      </div>
      <svg className="w-3.5 h-3.5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    </button>
  );
}

// ═══════════════════════════════════════════════
// BOOKING DETAILS SIDE PANEL
// ═══════════════════════════════════════════════

function BookingDetailsPanel({ booking, onClose, onOpenFolio }: any) {
  const b = booking;
  const balanceDue = Math.max(0, (Number(b.amount) || 0) + (Number(b.tax) || 0) - (Number(b.paid) || 0));

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[520px] bg-white shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-8 bg-gradient-to-br from-slate-800 via-slate-900 to-black text-white overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 -mr-24 -mt-24" />
          <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-white/5 -ml-16 -mb-16" />

          <button onClick={onClose} className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-lg transition z-10">✕</button>

          <div className="relative">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/50 mb-3">Booking Details</p>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/10 border-2 border-white/20 flex items-center justify-center text-2xl font-bold backdrop-blur-sm">
                {(b.guestName || "?").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold tracking-tight truncate">{b.guestName}</h2>
                <p className="text-sm text-white/70 mt-1">{b.guestPhone || "No phone"}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-5">
              <span className="text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider bg-white/15 border border-white/20 backdrop-blur-sm">🚪 {b.roomNumber}</span>
              <span className="text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider bg-white/15 border border-white/20 backdrop-blur-sm">{b.status}</span>
              <span className="text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider bg-white/15 border border-white/20 backdrop-blur-sm">#{b.booking_ref || b.id?.slice(0, 8)}</span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Stay Timeline */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-4">Stay Timeline</h3>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Check-In</p>
                <p className="text-lg font-bold text-slate-900 mt-0.5">{b.check_in || "—"}</p>
              </div>
              <div className="flex flex-col items-center px-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-100" />
                  <div className="w-12 h-[2px] bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-100" />
                </div>
              </div>
              <div className="flex-1 text-right">
                <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Check-Out</p>
                <p className="text-lg font-bold text-slate-900 mt-0.5">{b.check_out || "—"}</p>
              </div>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-4">Payment Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 font-medium">Room Charges</span>
                <span className="text-sm font-semibold text-slate-800">₹{(Number(b.amount) || 0).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 font-medium">Taxes</span>
                <span className="text-sm font-semibold text-slate-800">₹{(Number(b.tax) || 0).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Total</span>
                <span className="text-lg font-bold text-slate-900">₹{((Number(b.amount) || 0) + (Number(b.tax) || 0)).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-emerald-600 font-bold">Paid</span>
                <span className="text-sm font-bold text-emerald-600">₹{(Number(b.paid) || 0).toLocaleString("en-IN")}</span>
              </div>
              <div className={`flex justify-between items-center p-3 rounded-xl ${balanceDue > 0 ? "bg-rose-50 border border-rose-200" : "bg-emerald-50 border border-emerald-200"}`}>
                <span className={`text-xs font-bold uppercase tracking-wider ${balanceDue > 0 ? "text-rose-700" : "text-emerald-700"}`}>Balance Due</span>
                <span className={`text-base font-bold ${balanceDue > 0 ? "text-rose-700" : "text-emerald-700"}`}>₹{balanceDue.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>

          {/* Booking Metadata */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-4">Booking Info</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Booking Ref</span>
                <span className="font-mono font-semibold text-slate-800 text-xs">{b.booking_ref || b.id?.slice(0, 12)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Room Type</span>
                <span className="font-semibold text-slate-800">{b.roomType || "—"}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Source</span>
                <span className="font-semibold text-slate-800">{b.source || "walk-in"}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Rate Plan</span>
                <span className="font-semibold text-slate-800">{b.ratePlan || "EP"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 border border-slate-300 rounded-xl text-sm font-bold text-slate-700 hover:bg-white transition">
            Close
          </button>
          <button onClick={onOpenFolio} className="flex-[2] py-3 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 transition flex items-center justify-center gap-2 shadow-lg shadow-teal-600/20">
            <span>📄</span> View Full Folio
          </button>
        </div>
      </div>
    </div>
  );
}