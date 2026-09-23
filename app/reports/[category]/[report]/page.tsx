"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getActiveHotelId } from "../../../active-hotel";
import { fetchReportBookings, fetchReportPayments, fetchHousekeepingRooms } from "../../../db";
import { REPORT_CONFIGS, downloadCSV, downloadExcel, downloadPDF } from "../../../lib/report-utils";
import DataTable from "../../../components/DataTable";
import SummaryReportView from "../../../components/SummaryReportView";
import NightAuditPage from "../../property/night-audit/page";

export default function ReportViewPage() {
  const params = useParams();
  const category = String(params?.category || "property");
  const reportSlug = String(params?.report || "");

  // ═══════════════════════════════════════════════
  // NIGHT AUDIT SPECIAL CASE — Hook এর আগে থাকতে হবে
  // ═══════════════════════════════════════════════
  if (reportSlug === "night-audit") {
    return <NightAuditPage />;
  }

  const config = REPORT_CONFIGS[reportSlug];

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [preset, setPreset] = useState("month");
  const [loading, setLoading] = useState(true);
  const [rawBookings, setRawBookings] = useState<any[]>([]);
  const [rawPayments, setRawPayments] = useState<any[]>([]);
  const [rawRooms, setRawRooms] = useState<any[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [downloadMenu, setDownloadMenu] = useState(false);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

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
      showToast("⚠ Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  const data = useMemo(() => {
    if (!config || config.layout === "summary") return [];
    let result: any[] = [];

    if (config.dataSource === "rooms") result = rawRooms;
    else if (config.dataSource === "payments") result = rawPayments;
    else if (config.dataSource === "bookings" || config.dataSource === "bookings-with-notes") result = rawBookings;
    else if (config.dataSource === "bookings-with-addons") {
      result = rawBookings
        .filter((b: any) => (b.notes || "").includes("ADDONS_JSON"))
        .map((b: any) => {
          const match = (b.notes || "").match(/ADDONS_JSON:(\[[^\]]*\])/);
          let addons: any[] = [];
          if (match) { try { addons = JSON.parse(match[1]); } catch {} }
          const total = addons.reduce((s, a) => s + (Number(a.price) || 0) * (1 + (Number(a.tax) || 0) / 100), 0);
          return { ...b, addonList: addons.map(a => a.name).join(", ") || "—", addonTotal: total };
        });
    }

    const slug = reportSlug;
    if (slug === "arrivals" || slug === "new-bookings" || slug === "room-bookings") {
      result = result.filter((b: any) => b.check_in >= startDate && b.check_in <= endDate);
    } else if (slug === "departures") {
      result = result.filter((b: any) => b.check_out >= startDate && b.check_out <= endDate);
    } else if (slug === "day-use") {
      result = result.filter((b: any) => b.check_in === b.check_out);
    }

    // Master Report-এর জন্য ডেমো ফিল্ড ম্যাপিং
    if (slug === "master") {
      result = result.map((b: any) => ({
        ...b,
        roomsCount: 1,
        preBookingWindow: 0,
        scantyBaggage: "NO",
      }));
    }

    if (slug === "guest-list") {
      const seen = new Map<string, any>();
      result.forEach((b: any) => {
        const key = (b.guestPhone || "") + "|" + (b.guestName || "");
        if (!seen.has(key)) seen.set(key, { ...b, bookingsCount: 1 });
        else seen.get(key).bookingsCount += 1;
      });
      result = Array.from(seen.values());
    } else if (slug === "top-spenders") {
      const byGuest: Record<string, any> = {};
      result.forEach((b: any) => {
        const key = (b.guestPhone || "") + "|" + (b.guestName || "");
        if (!byGuest[key]) byGuest[key] = { guestName: b.guestName, guestPhone: b.guestPhone, guestCountry: b.guestCountry, bookings: 0, totalAmount: 0 };
        byGuest[key].bookings += 1;
        byGuest[key].totalAmount += b.totalAmount;
      });
      result = Object.values(byGuest).sort((a: any, b: any) => b.totalAmount - a.totalAmount);
    } else if (slug === "guest-origins") {
      const byCountry: Record<string, any> = {};
      result.forEach((b: any) => {
        const c = b.guestCountry || "India";
        if (!byCountry[c]) byCountry[c] = { guestCountry: c, bookings: 0, totalAmount: 0 };
        byCountry[c].bookings += 1;
        byCountry[c].totalAmount += b.totalAmount;
      });
      result = Object.values(byCountry).sort((a: any, b: any) => b.bookings - a.bookings);
    } else if (slug === "repeat-guests") {
      const byGuest: Record<string, any> = {};
      result.forEach((b: any) => {
        const key = (b.guestPhone || "") + "|" + (b.guestName || "");
        if (!byGuest[key]) byGuest[key] = { guestName: b.guestName, guestPhone: b.guestPhone, roomNumber: b.roomNumber, checkIn: b.checkIn, bookings: 0 };
        byGuest[key].bookings += 1;
      });
      result = Object.values(byGuest).filter((g: any) => g.bookings > 1).sort((a: any, b: any) => b.bookings - a.bookings);
    } else if (slug === "rate-plan-count") {
      const byPlan: Record<string, any> = {};
      result.forEach((b: any) => {
        const p = b.ratePlan || "EP";
        if (!byPlan[p]) byPlan[p] = { ratePlan: p, bookings: 0, totalAmount: 0 };
        byPlan[p].bookings += 1;
        byPlan[p].totalAmount += b.totalAmount;
      });
      result = Object.values(byPlan);
    }

    if (config.filter) result = result.filter(config.filter);
    return result;
  }, [config, rawBookings, rawPayments, rawRooms, startDate, endDate, reportSlug]);

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

  const summary = useMemo(() => {
    if (config?.summaryKeys) {
      return config.summaryKeys.map(k => {
        let val = 0;
        if (k.key === "count") val = filteredData.length;
        else if (k.key === "totalAmount") val = filteredData.reduce((s, r) => s + (Number(r.totalAmount) || 0), 0);
        else if (k.key === "paidAmount") val = filteredData.reduce((s, r) => s + (Number(r.paidAmount) || 0), 0);
        else if (k.key === "balanceDue") val = filteredData.reduce((s, r) => s + (Number(r.balanceDue) || 0), 0);
        return { ...k, value: val };
      });
    }
    return [];
  }, [filteredData, config]);

  const fmtC = (n: number) => `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  const handleDownload = (format: string) => {
    if (!config) return;
    setDownloadMenu(false);
    const baseName = `${config.title.replace(/\s+/g, "_")}_${startDate}_to_${endDate}`;
    if (format === "csv") { downloadCSV(sortedData, config.columns, baseName); showToast("📥 CSV downloaded"); }
    else if (format === "excel") { downloadExcel(sortedData, config.columns, baseName, config.title); showToast("📥 Excel downloaded"); }
    else if (format === "pdf" || format === "print") { downloadPDF(sortedData, config.columns, baseName, config.title, config.desc); showToast("🖨️ Print window opened"); }
  };

  if (!config) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-12">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">🔍</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Report not found</h2>
          <p className="text-sm text-slate-500 mb-6">Slug: <code className="bg-slate-100 px-2 py-1 rounded text-xs">{reportSlug}</code></p>
          <Link href={`/reports/${category}`} className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition">
            ← Back to {category.replace(/-/g, " ")}
          </Link>
        </div>
      </div>
    );
  }

  // ═══ SUMMARY LAYOUT রেন্ডার ═══
  if (config.layout === "summary") {
    return (
      <SummaryReportView 
        title={config.title} 
        date={startDate} 
        onDateChange={(d) => { setStartDate(d); setEndDate(d); }} 
        onPrint={() => handleDownload("print")} 
      />
    );
  }

  // ═══ TABLE LAYOUT রেন্ডার ═══
  return (
    <div className="min-h-screen bg-slate-50/50 pb-12">
      {/* ═══ HEADER ═══ */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-8 lg:px-10 py-6">
          <nav className="flex items-center gap-2 text-xs mb-4">
            <Link href="/reports" className="text-slate-400 hover:text-slate-700 transition">Reports</Link>
            <span className="text-slate-300">/</span>
            <Link href={`/reports/${category}`} className="text-slate-400 hover:text-slate-700 transition capitalize">{category.replace(/-/g, " ")}</Link>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-slate-800">{config.title}</span>
          </nav>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center shadow-lg shadow-slate-900/20 shrink-0">
                <span className="text-2xl">{config.icon || "📊"}</span>
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">{config.title}</h1>
                <p className="text-sm text-slate-500 mt-1 max-w-2xl">{config.desc}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button onClick={load} className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-xl transition" title="Refresh">
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </button>
              <div className="relative">
                <button onClick={() => setDownloadMenu(!downloadMenu)} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition shadow-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Export
                </button>
                {downloadMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setDownloadMenu(false)} />
                    <div className="absolute top-full right-0 mt-2 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl w-[260px] overflow-hidden">
                      <div className="bg-gradient-to-r from-slate-900 to-slate-700 px-4 py-3">
                        <p className="text-white text-xs font-bold uppercase tracking-wider">Export Options</p>
                      </div>
                      {[{ id: "excel", label: "Excel (.xls)", icon: "📊" }, { id: "csv", label: "CSV (.csv)", icon: "📄" }, { id: "pdf", label: "PDF Document", icon: "📕" }, { id: "print", label: "Print Now", icon: "🖨" }].map(opt => (
                        <button key={opt.id} onClick={() => handleDownload(opt.id)} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100 last:border-0 transition group">
                          <div className="w-9 h-9 rounded-lg bg-slate-50 group-hover:bg-slate-100 flex items-center justify-center text-base transition">{opt.icon}</div>
                          <div className="flex-1"><p className="text-sm font-semibold text-slate-800">{opt.label}</p></div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ FILTERS ═══ */}
      <div className="bg-white border-b border-slate-200 px-8 lg:px-10 py-3 sticky top-0 z-30 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
            {[{ k: "today", l: "Today" }, { k: "yesterday", l: "Yesterday" }, { k: "week", l: "7 Days" }, { k: "month", l: "This Month" }].map((opt) => (
              <button key={opt.k} onClick={() => applyPreset(opt.k)} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${preset === opt.k ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>{opt.l}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
            <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPreset("custom"); }} className="bg-transparent text-xs font-medium text-slate-700 outline-none w-[110px]" />
            <span className="text-slate-400 text-xs">→</span>
            <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPreset("custom"); }} className="bg-transparent text-xs font-medium text-slate-700 outline-none w-[110px]" />
          </div>
          <div className="relative ml-auto">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></span>
            <input type="text" placeholder="Search records..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10 rounded-lg text-xs w-64 outline-none transition" />
          </div>
        </div>
      </div>

      {/* ═══ CONTENT ═══ */}
      <div className="px-8 lg:px-10 py-6 space-y-6">
        {!loading && sortedData.length > 0 && summary.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {summary.map((s, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-lg transition-all">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{s.label}</p>
                <p className={`text-2xl font-bold text-slate-900 tracking-tight mt-2`}>
                  {s.format === "currency" ? fmtC(s.value) : s.value.toLocaleString("en-IN")}
                </p>
              </div>
            ))}
          </div>
        )}

        {loading || sortedData.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-24 text-center">
            {loading ? (
              <>
                <div className="w-12 h-12 mx-auto mb-4 rounded-full border-[3px] border-slate-200 border-t-slate-900 animate-spin" />
                <p className="text-sm text-slate-500 font-semibold">Loading report data...</p>
              </>
            ) : (
              <>
                <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-5"><span className="text-4xl opacity-40">📭</span></div>
                <p className="text-base font-bold text-slate-700">No records found</p>
                <p className="text-sm text-slate-400 mt-2">Try changing the date range or clearing filters</p>
              </>
            )}
          </div>
        ) : (
          <DataTable data={sortedData} columns={config.columns} loading={loading} />
        )}
      </div>

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl text-sm font-semibold shadow-2xl z-50 transition-all duration-300">
          {toast}
        </div>
      )}
    </div>
  );
}