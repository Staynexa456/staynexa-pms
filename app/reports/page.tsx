"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { getActiveHotelId } from "../active-hotel";
import { fetchReportData } from "../db";

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════
const todayISO = () => new Date().toISOString().slice(0, 10);
const monthStart = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};
const fmtC = (n: number) => `₹${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtCShort = (n: number) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
};
const prettyDate = (iso: string) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d} ${months[m - 1]} ${y}`;
};

type ReportType = "sales" | "gst" | "occupancy" | "payment" | "guest";
type DatePreset = "today" | "yesterday" | "week" | "month" | "lastMonth" | "custom";

// ═══════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════
export default function ReportsPage() {
  const [startDate, setStartDate] = useState(monthStart());
  const [endDate, setEndDate] = useState(todayISO());
  const [preset, setPreset] = useState<DatePreset>("month");
  const [reportType, setReportType] = useState<ReportType>("sales");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({ bookings: [], payments: [] });
  const [toast, setToast] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  const applyPreset = (p: DatePreset) => {
    setPreset(p);
    const now = new Date();
    if (p === "today") { setStartDate(todayISO()); setEndDate(todayISO()); }
    else if (p === "yesterday") {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      const iso = y.toISOString().slice(0, 10);
      setStartDate(iso); setEndDate(iso);
    } else if (p === "week") {
      const w = new Date(now); w.setDate(w.getDate() - 6);
      setStartDate(w.toISOString().slice(0, 10)); setEndDate(todayISO());
    } else if (p === "month") {
      setStartDate(monthStart()); setEndDate(todayISO());
    } else if (p === "lastMonth") {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lme = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(lm.toISOString().slice(0, 10));
      setEndDate(lme.toISOString().slice(0, 10));
    }
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const hotelId = getActiveHotelId() || undefined;
      const result = await fetchReportData(hotelId, startDate, endDate);
      setData(result);
    } catch (err) {
      console.error("[Reports] load failed:", err);
      showToast("⚠ Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  // ═══ COMPUTED STATS ═══
  const stats = useMemo(() => {
    const bookings = data.bookings || [];
    const payments = data.payments || [];

    const totalRevenue = bookings.reduce((s: number, b: any) => s + b.roomCharge, 0);
    const totalTax = bookings.reduce((s: number, b: any) => s + b.taxAmount, 0);
    const totalPaid = bookings.reduce((s: number, b: any) => s + b.paidAmount, 0);
    const totalDue = bookings.reduce((s: number, b: any) => s + b.balanceDue, 0);
    const totalBookings = bookings.length;

    // ADR = Average Daily Rate
    const totalNights = bookings.reduce((s: number, b: any) => {
      if (!b.check_in || !b.check_out) return s;
      const nights = Math.max(1, Math.round((new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000));
      return s + nights;
    }, 0);
    const adr = totalNights > 0 ? totalRevenue / totalNights : 0;

    // Cancellations
    const cancelled = bookings.filter((b: any) => b.status === "CANCELLED").length;

    // Payment method breakdown
    const byMethod: Record<string, { count: number; amount: number }> = {};
    payments.forEach((p: any) => {
      const m = p.method || "Other";
      if (!byMethod[m]) byMethod[m] = { count: 0, amount: 0 };
      byMethod[m].count += 1;
      byMethod[m].amount += Number(p.amount) || 0;
    });

    // Guest nationality breakdown (top countries)
    const byCountry: Record<string, number> = {};
    bookings.forEach((b: any) => {
      const c = b.guest?.country || "India";
      byCountry[c] = (byCountry[c] || 0) + 1;
    });

    // GST Breakdown (CGST + SGST = 2.5 + 2.5 = 5%)
    const cgst = totalTax / 2;
    const sgst = totalTax / 2;

    // Company bookings
    const companyBookings = bookings.filter((b: any) => b.companyName || b.guestGst);
    const companyRevenue = companyBookings.reduce((s: number, b: any) => s + b.roomCharge, 0);

    return {
      totalRevenue, totalTax, totalPaid, totalDue, totalBookings,
      adr, cancelled, byMethod, byCountry,
      cgst, sgst, companyBookings, companyRevenue,
      totalNights,
    };
  }, [data]);

  // ═══ CSV EXPORT ═══
  const downloadCSV = (filename: string, rows: any[][], headers: string[]) => {
    const csv = [
      headers.join(","),
      ...rows.map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("📥 " + filename + " downloaded");
  };

  const handleExport = () => {
    const bookings = data.bookings || [];
    if (reportType === "sales" || reportType === "gst") {
      const headers = reportType === "gst"
        ? ["Date", "Booking Ref", "Guest", "GSTIN", "Company", "Room", "Room Charge", "CGST (2.5%)", "SGST (2.5%)", "Total Tax", "Total", "Paid", "Balance"]
        : ["Date", "Booking Ref", "Guest", "Phone", "Room", "Room Type", "Check-In", "Check-Out", "Status", "Room Charge", "Tax", "Total", "Paid", "Balance"];
      const rows = bookings.map((b: any) => reportType === "gst"
        ? [b.check_in, b.booking_ref || b.id, b.guestName, b.guestGst || "—", b.companyName || "—", b.roomNumber, b.roomCharge.toFixed(2), (b.taxAmount / 2).toFixed(2), (b.taxAmount / 2).toFixed(2), b.taxAmount.toFixed(2), b.totalAmount.toFixed(2), b.paidAmount.toFixed(2), b.balanceDue.toFixed(2)]
        : [b.check_in, b.booking_ref || b.id, b.guestName, b.guestPhone, b.roomNumber, b.roomType, b.check_in, b.check_out, b.status, b.roomCharge.toFixed(2), b.taxAmount.toFixed(2), b.totalAmount.toFixed(2), b.paidAmount.toFixed(2), b.balanceDue.toFixed(2)]
      );
      downloadCSV(`${reportType === "gst" ? "GST_Report" : "Sales_Report"}_${startDate}_to_${endDate}.csv`, rows, headers);
    } else if (reportType === "payment") {
      const headers = ["Date", "Method", "Amount", "Reference", "Note"];
      const rows = (data.payments || []).map((p: any) => [
        new Date(p.created_at).toLocaleString("en-IN"), p.method || "—", Number(p.amount || 0).toFixed(2), p.reference || "—", p.note || "—"
      ]);
      downloadCSV(`Payment_Report_${startDate}_to_${endDate}.csv`, rows, headers);
    } else if (reportType === "guest") {
      const headers = ["Guest Name", "Phone", "Email", "Country", "Bookings", "Total Spent"];
      const byGuest: Record<string, any> = {};
      bookings.forEach((b: any) => {
        const key = b.guestName;
        if (!byGuest[key]) byGuest[key] = { name: b.guestName, phone: b.guestPhone, email: b.guestEmail, country: b.guest?.country || "—", count: 0, spent: 0 };
        byGuest[key].count += 1;
        byGuest[key].spent += b.totalAmount;
      });
      const rows = Object.values(byGuest).map((g: any) => [g.name, g.phone, g.email, g.country, g.count, g.spent.toFixed(2)]);
      downloadCSV(`Guest_Report_${startDate}_to_${endDate}.csv`, rows, headers);
    } else {
      showToast("⚠ Select a valid report type");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] bg-[#fafafa]">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full border-[3px] border-slate-200 border-t-slate-900 animate-spin" />
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-[0.2em]">Generating Report</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* ═══ HEADER ═══ */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-8 py-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-[28px] font-bold text-slate-900 tracking-tight leading-none">Reports & Analytics</h1>
              <p className="text-sm text-slate-500 mt-1.5">
                {prettyDate(startDate)} — {prettyDate(endDate)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Export CSV
              </button>
              <button onClick={load} className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto p-8 space-y-6">

        {/* ═══ FILTERS ROW ═══ */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Date Presets */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] block mb-2">Quick Range</label>
              <div className="flex flex-wrap gap-1.5">
                {(["today", "yesterday", "week", "month", "lastMonth"] as DatePreset[]).map(p => (
                  <button key={p} onClick={() => applyPreset(p)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${preset === p ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}>
                    {p === "lastMonth" ? "Last Month" : p === "week" ? "Last 7 Days" : p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Range */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] block mb-2">Custom Range</label>
              <div className="flex items-center gap-2">
                <input
                  type="date" value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setPreset("custom"); }}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:border-slate-900 transition"
                />
                <span className="text-slate-400 text-xs">to</span>
                <input
                  type="date" value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setPreset("custom"); }}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:border-slate-900 transition"
                />
              </div>
            </div>

            {/* Info */}
            <div className="flex items-end">
              <div className="w-full p-3 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Records</p>
                <p className="text-2xl font-bold text-slate-900 mt-0.5">{stats.totalBookings} <span className="text-sm text-slate-400 font-medium">bookings</span></p>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ REPORT TYPE TABS ═══ */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-1 px-4 pt-4 border-b border-slate-100 overflow-x-auto">
            <ReportTab active={reportType === "sales"} onClick={() => setReportType("sales")} icon="💹" label="Sales Report" />
            <ReportTab active={reportType === "gst"} onClick={() => setReportType("gst")} icon="🧾" label="GST Report" />
            <ReportTab active={reportType === "payment"} onClick={() => setReportType("payment")} icon="💰" label="Payment Methods" />
            <ReportTab active={reportType === "guest"} onClick={() => setReportType("guest")} icon="👥" label="Guest Analytics" />
            <ReportTab active={reportType === "occupancy"} onClick={() => setReportType("occupancy")} icon="📊" label="Occupancy" />
          </div>
        </div>

        {/* ═══ SUMMARY KPIs ═══ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard label="Total Revenue" value={fmtCShort(stats.totalRevenue)} sub={`${stats.totalBookings} bookings`} color="emerald" />
          <SummaryCard label="Tax Collected" value={fmtCShort(stats.totalTax)} sub={`CGST + SGST`} color="violet" />
          <SummaryCard label="Amount Paid" value={fmtCShort(stats.totalPaid)} sub={`${stats.totalRevenue > 0 ? Math.round((stats.totalPaid / (stats.totalRevenue + stats.totalTax)) * 100) : 0}% collected`} color="sky" />
          <SummaryCard label="Pending Due" value={fmtCShort(stats.totalDue)} sub={`Avg ADR ${fmtCShort(stats.adr)}`} color={stats.totalDue > 0 ? "rose" : "emerald"} />
        </div>

        {/* ═══ REPORT CONTENT ═══ */}
        {reportType === "sales" && <SalesReport data={data} stats={stats} expandedRow={expandedRow} setExpandedRow={setExpandedRow} />}
        {reportType === "gst" && <GstReport data={data} stats={stats} />}
        {reportType === "payment" && <PaymentReport stats={stats} />}
        {reportType === "guest" && <GuestReport data={data} />}
        {reportType === "occupancy" && <OccupancyReport data={data} stats={stats} />}
      </div>

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-xl text-sm font-medium z-[100] shadow-2xl">{toast}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════
// SUB COMPONENTS
// ═══════════════════════════════════════════════

function ReportTab({ active, onClick, icon, label }: any) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-3 border-b-2 font-semibold text-sm transition whitespace-nowrap ${active ? "text-slate-900 border-slate-900" : "text-slate-500 border-transparent hover:text-slate-800"}`}>
      <span className="text-base">{icon}</span>
      {label}
    </button>
  );
}

function SummaryCard({ label, value, sub, color }: any) {
  const colors: any = {
    emerald: "from-emerald-500 to-teal-600",
    violet: "from-violet-500 to-purple-600",
    sky: "from-sky-500 to-cyan-600",
    rose: "from-rose-500 to-red-600",
    slate: "from-slate-700 to-slate-900",
  };
  return (
    <div className={`bg-gradient-to-br ${colors[color]} rounded-2xl p-5 text-white shadow-lg relative overflow-hidden`}>
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-white/10 -mr-12 -mt-12" />
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-80 relative">{label}</p>
      <p className="text-3xl font-bold tracking-tight mt-2 relative">{value}</p>
      <p className="text-xs opacity-80 mt-1 relative">{sub}</p>
    </div>
  );
}

// ─── SALES REPORT ───
function SalesReport({ data, stats, expandedRow, setExpandedRow }: any) {
  const bookings = data.bookings || [];
  if (bookings.length === 0) return <EmptyState />;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Sales Detail</h2>
          <p className="text-xs text-slate-500 mt-0.5">{bookings.length} transactions in range</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="font-semibold text-slate-700">Revenue: {fmtC(stats.totalRevenue)}</span>
          <span className="text-slate-400">•</span>
          <span className="font-semibold text-emerald-600">Paid: {fmtC(stats.totalPaid)}</span>
          {stats.totalDue > 0 && (
            <>
              <span className="text-slate-400">•</span>
              <span className="font-semibold text-rose-600">Due: {fmtC(stats.totalDue)}</span>
            </>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Date</th>
              <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Guest</th>
              <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Room</th>
              <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</th>
              <th className="text-right px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Room Charge</th>
              <th className="text-right px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Tax</th>
              <th className="text-right px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Total</th>
              <th className="text-right px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bookings.map((b: any) => (
              <tr key={b.id} className="hover:bg-slate-50/60 transition">
                <td className="px-5 py-3 text-xs text-slate-600 font-medium whitespace-nowrap">{b.check_in}</td>
                <td className="px-5 py-3">
                  <p className="text-sm font-semibold text-slate-800">{b.guestName}</p>
                  <p className="text-[10px] text-slate-400">{b.booking_ref || b.id?.slice(0, 8)}</p>
                </td>
                <td className="px-5 py-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <span className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center text-[10px]">{b.roomNumber}</span>
                    {b.roomType}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${
                    b.status === "CHECKED-IN" ? "bg-emerald-50 text-emerald-700" :
                    b.status === "CONFIRMED" ? "bg-amber-50 text-amber-700" :
                    b.status === "CHECKED-OUT" ? "bg-slate-100 text-slate-600" :
                    "bg-slate-100 text-slate-500"
                  }`}>{b.status}</span>
                </td>
                <td className="px-5 py-3 text-right text-xs text-slate-600 font-medium">{fmtC(b.roomCharge)}</td>
                <td className="px-5 py-3 text-right text-xs text-slate-600 font-medium">{fmtC(b.taxAmount)}</td>
                <td className="px-5 py-3 text-right text-sm font-bold text-slate-800">{fmtC(b.totalAmount)}</td>
                <td className="px-5 py-3 text-right">
                  {b.balanceDue > 0 ? (
                    <span className="text-sm font-bold text-rose-600">{fmtC(b.balanceDue)}</span>
                  ) : (
                    <span className="text-xs font-bold text-emerald-600">✓ Paid</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-900 text-white">
            <tr>
              <td colSpan={4} className="px-5 py-4 text-sm font-bold uppercase tracking-wider">Grand Total</td>
              <td className="px-5 py-4 text-right text-sm font-bold">{fmtC(stats.totalRevenue)}</td>
              <td className="px-5 py-4 text-right text-sm font-bold">{fmtC(stats.totalTax)}</td>
              <td className="px-5 py-4 text-right text-sm font-bold text-emerald-400">{fmtC(stats.totalRevenue + stats.totalTax)}</td>
              <td className="px-5 py-4 text-right text-sm font-bold text-rose-400">{fmtC(stats.totalDue)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── GST REPORT ───
function GstReport({ data, stats }: any) {
  const bookings = data.bookings || [];
  if (bookings.length === 0) return <EmptyState />;

  return (
    <div className="space-y-6">
      {/* GST Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center text-sm">🧾</div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Tax Collected</p>
          </div>
          <p className="text-3xl font-bold text-slate-900">{fmtC(stats.totalTax)}</p>
          <p className="text-xs text-slate-500 mt-1">{bookings.length} taxable bookings</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center text-sm">📊</div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CGST @ 2.5%</p>
          </div>
          <p className="text-3xl font-bold text-slate-900">{fmtC(stats.cgst)}</p>
          <p className="text-xs text-slate-500 mt-1">Central GST portion</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-sm">📊</div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SGST @ 2.5%</p>
          </div>
          <p className="text-3xl font-bold text-slate-900">{fmtC(stats.sgst)}</p>
          <p className="text-xs text-slate-500 mt-1">State GST portion</p>
        </div>
      </div>

      {/* B2B vs B2C */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">B2B (Company with GST)</p>
              <p className="text-xs text-slate-500 mt-0.5">Corporate bookings</p>
            </div>
            <span className="text-2xl">🏢</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{fmtC(stats.companyRevenue)}</p>
          <p className="text-xs text-slate-500 mt-1">{stats.companyBookings.length} bookings</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">B2C (Individual Guests)</p>
              <p className="text-xs text-slate-500 mt-0.5">Retail bookings</p>
            </div>
            <span className="text-2xl">👤</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{fmtC(stats.totalRevenue - stats.companyRevenue)}</p>
          <p className="text-xs text-slate-500 mt-1">{bookings.length - stats.companyBookings.length} bookings</p>
        </div>
      </div>

      {/* GST Detail Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">GST Breakdown — Line by Line</h2>
          <p className="text-xs text-slate-500 mt-0.5">All taxable transactions with CGST/SGST split</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Date</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Invoice / Guest</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">GSTIN</th>
                <th className="text-right px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Taxable Value</th>
                <th className="text-right px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">CGST 2.5%</th>
                <th className="text-right px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">SGST 2.5%</th>
                <th className="text-right px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bookings.map((b: any) => (
                <tr key={b.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3 text-xs text-slate-600 font-medium whitespace-nowrap">{b.check_in}</td>
                  <td className="px-5 py-3">
                    <p className="text-sm font-semibold text-slate-800">{b.guestName}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{b.booking_ref || b.id?.slice(0, 8)}</p>
                  </td>
                  <td className="px-5 py-3 text-xs font-mono text-slate-600">{b.guestGst || "—"}</td>
                  <td className="px-5 py-3 text-right text-xs text-slate-600 font-medium">{fmtC(b.roomCharge)}</td>
                  <td className="px-5 py-3 text-right text-xs text-slate-600 font-medium">{fmtC(b.taxAmount / 2)}</td>
                  <td className="px-5 py-3 text-right text-xs text-slate-600 font-medium">{fmtC(b.taxAmount / 2)}</td>
                  <td className="px-5 py-3 text-right text-sm font-bold text-slate-800">{fmtC(b.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-900 text-white">
              <tr>
                <td colSpan={3} className="px-5 py-4 text-sm font-bold uppercase tracking-wider">Grand Total</td>
                <td className="px-5 py-4 text-right text-sm font-bold">{fmtC(stats.totalRevenue)}</td>
                <td className="px-5 py-4 text-right text-sm font-bold text-sky-400">{fmtC(stats.cgst)}</td>
                <td className="px-5 py-4 text-right text-sm font-bold text-emerald-400">{fmtC(stats.sgst)}</td>
                <td className="px-5 py-4 text-right text-sm font-bold">{fmtC(stats.totalRevenue + stats.totalTax)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── PAYMENT REPORT ───
function PaymentReport({ stats }: any) {
  const methods = Object.entries(stats.byMethod || {}).sort((a: any, b: any) => b[1].amount - a[1].amount);
  if (methods.length === 0) return <EmptyState />;

  const total = methods.reduce((s, [, v]: any) => s + v.amount, 0);
  const colorMap: any = {
    Cash: "from-emerald-500 to-teal-600",
    Card: "from-sky-500 to-cyan-600",
    UPI: "from-violet-500 to-purple-600",
    "Bank Transfer": "from-amber-500 to-orange-600",
    Other: "from-slate-600 to-slate-800",
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {methods.map(([method, data]: any) => {
          const pct = total > 0 ? Math.round((data.amount / total) * 100) : 0;
          return (
            <div key={method} className={`bg-gradient-to-br ${colorMap[method] || colorMap.Other} rounded-2xl p-5 text-white shadow-lg relative overflow-hidden`}>
              <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-white/10 -mr-12 -mt-12" />
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-80 relative">{method}</p>
              <p className="text-3xl font-bold tracking-tight mt-2 relative">{fmtCShort(data.amount)}</p>
              <p className="text-xs opacity-80 mt-1 relative">{data.count} payments · {pct}% of total</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Payment Method Distribution</h3>
        <div className="space-y-3">
          {methods.map(([method, data]: any) => {
            const pct = total > 0 ? (data.amount / total) * 100 : 0;
            const barColor: any = {
              Cash: "bg-emerald-500", Card: "bg-sky-500", UPI: "bg-violet-500", "Bank Transfer": "bg-amber-500",
            };
            return (
              <div key={method}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-700">{method}</span>
                  <span className="text-xs font-bold text-slate-900">{fmtC(data.amount)} <span className="text-slate-400 font-medium">({pct.toFixed(1)}%)</span></span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className={`h-full ${barColor[method] || "bg-slate-500"} transition-all duration-700`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── GUEST REPORT ───
function GuestReport({ data }: any) {
  const bookings = data.bookings || [];
  if (bookings.length === 0) return <EmptyState />;

  const byGuest: Record<string, any> = {};
  bookings.forEach((b: any) => {
    const key = b.guestName;
    if (!byGuest[key]) byGuest[key] = { name: b.guestName, phone: b.guestPhone, email: b.guestEmail, country: b.guest?.country || "—", count: 0, spent: 0, lastStay: b.check_in };
    byGuest[key].count += 1;
    byGuest[key].spent += b.totalAmount;
    if (b.check_in > byGuest[key].lastStay) byGuest[key].lastStay = b.check_in;
  });
  const guests = Object.values(byGuest).sort((a: any, b: any) => b.spent - a.spent);
  const topGuests = guests.slice(0, 10);
  const byCountry: Record<string, number> = {};
  guests.forEach((g: any) => { byCountry[g.country] = (byCountry[g.country] || 0) + 1; });
  const countries = Object.entries(byCountry).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Top Spenders</h3>
              <p className="text-xs text-slate-500 mt-0.5">Highest revenue guests this period</p>
            </div>
            <span className="text-2xl">🏆</span>
          </div>
          <div className="space-y-2">
            {topGuests.slice(0, 5).map((g: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white ${i === 0 ? "bg-gradient-to-br from-amber-400 to-orange-500" : i === 1 ? "bg-gradient-to-br from-slate-400 to-slate-600" : i === 2 ? "bg-gradient-to-br from-amber-700 to-amber-900" : "bg-slate-700"}`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{g.name}</p>
                  <p className="text-[10px] text-slate-400">{g.count} bookings · {g.country}</p>
                </div>
                <p className="text-sm font-bold text-slate-900">{fmtC(g.spent)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🌍</span>
            <h3 className="text-sm font-bold text-slate-900">Guest Origins</h3>
          </div>
          <div className="space-y-3">
            {countries.map(([country, count]: any, i) => {
              const pct = guests.length > 0 ? (count / guests.length) * 100 : 0;
              return (
                <div key={country}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-slate-700">{country}</span>
                    <span className="text-xs font-bold text-slate-900">{count} <span className="text-slate-400">({pct.toFixed(0)}%)</span></span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-slate-700 to-slate-900 transition-all duration-700" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">All Guests ({guests.length})</h3>
          <p className="text-xs text-slate-500 mt-0.5">Complete guest activity in this period</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Guest</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Country</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Bookings</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Last Stay</th>
                <th className="text-right px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Spent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {guests.map((g: any, i: number) => (
                <tr key={i} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center text-xs font-bold">
                        {g.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{g.name}</p>
                        <p className="text-[10px] text-slate-400">{g.phone || "No phone"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-600">{g.country}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-xs font-bold text-slate-700">{g.count}</span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-600">{g.lastStay}</td>
                  <td className="px-5 py-3 text-right font-bold text-slate-900">{fmtC(g.spent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── OCCUPANCY REPORT ───
function OccupancyReport({ data, stats }: any) {
  const bookings = data.bookings || [];
  if (bookings.length === 0) return <EmptyState />;

  // By room type
  const byRoomType: Record<string, { count: number; revenue: number; nights: number }> = {};
  bookings.forEach((b: any) => {
    const t = b.roomType || "Standard";
    if (!byRoomType[t]) byRoomType[t] = { count: 0, revenue: 0, nights: 0 };
    byRoomType[t].count += 1;
    byRoomType[t].revenue += b.roomCharge;
    const nights = Math.max(1, Math.round((new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000));
    byRoomType[t].nights += nights;
  });

  const sortedTypes = Object.entries(byRoomType).sort((a: any, b: any) => b[1].revenue - a[1].revenue);
  const totalRev = sortedTypes.reduce((s, [, v]: any) => s + v.revenue, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Nights Sold</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{stats.totalNights}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ADR (Avg Daily Rate)</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{fmtCShort(stats.adr)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Room Types Active</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{sortedTypes.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Revenue by Room Type</h3>
          <p className="text-xs text-slate-500 mt-0.5">Performance breakdown per category</p>
        </div>
        <div className="p-6 space-y-5">
          {sortedTypes.map(([type, data]: any) => {
            const pct = totalRev > 0 ? (data.revenue / totalRev) * 100 : 0;
            return (
              <div key={type}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{type}</p>
                    <p className="text-[10px] text-slate-400">{data.count} bookings · {data.nights} nights</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">{fmtC(data.revenue)}</p>
                    <p className="text-[10px] text-slate-400">{pct.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-slate-700 to-slate-900 transition-all duration-700" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 text-center">
      <div className="text-6xl mb-4 opacity-30">📊</div>
      <p className="text-slate-500 font-semibold">No data available</p>
      <p className="text-slate-400 text-sm mt-1">Try changing the date range or booking dates</p>
    </div>
  );
}