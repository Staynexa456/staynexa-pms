"use client";

import React, { useState } from "react";

type SummaryReportViewProps = {
  title: string;
  date: string;
  onDateChange: (date: string) => void;
  onPrint: () => void;
};

export default function SummaryReportView({ title, date, onDateChange, onPrint }: SummaryReportViewProps) {
  const [comparisonMode, setComparisonMode] = useState(false);
  const [detailedView, setDetailedView] = useState(false);

  // ডেমো ডেটা (ভবিষ্যতে ডেটাবেস থেকে ক্যালকুলেট করে বসাতে হবে)
  const propertyMetrics = [
    { label: "Rooms Sold", today: "37", mtd: "1107", ytd: "12233" },
    { label: "Occupancy", today: "69.81%", mtd: "93.34%", ytd: "85.65%" },
    { label: "ADR - Average Daily Rate", today: "Rs. 1696.95", mtd: "Rs. 1694.62", ytd: "Rs. 1755.20" },
    { label: "RevPAR - Revenue Per Available Room", today: "Rs. 1184.66", mtd: "Rs. 1581.74", ytd: "Rs. 1503.28" },
  ];

  const revenueMetrics = [
    { label: "Room revenue", today: "Rs. 62786.98", mtd: "Rs. 1875946.75", ytd: "Rs. 21471392.09" },
    { label: "POS Revenue", today: "Rs. 0", mtd: "Rs. 0", ytd: "Rs. 0" },
    { label: "Services Revenue", today: "Rs. 0", mtd: "Rs. 27263.00", ytd: "Rs. 506634.00" },
    { label: "Booking Fee", today: "Rs. 0", mtd: "Rs. 0", ytd: "Rs. 0" },
    { label: "Room Discount", today: "Rs. 0", mtd: "Rs. 0", ytd: "Rs. 0" },
    { label: "Total", today: "Rs. 62786.98", mtd: "Rs. 1903209.75", ytd: "Rs. 21978026.09", isTotal: true },
  ];

  const inventoryMetrics = [
    { label: "Total Rooms", value: "55" },
    { label: "Out Of Order Rooms", value: "2" },
    { label: "Sold Rooms", value: "37" },
    { label: "Available Rooms", value: "16" },
  ];

  const houseMetrics = [
    { label: "Today Bookings", value: "1" },
    { label: "In House", value: "46" },
    { label: "Today Arrivals", value: "7" },
    { label: "Expected Arrivals", value: "8" },
    { label: "Today Departures", value: "19" },
    { label: "Pending Departures", value: "17" },
    { label: "Cancellations", value: "5" },
    { label: "On Hold", value: "0" },
    { label: "No Shows", value: "0" },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 pb-12">
      {/* ═══ HEADER ═══ */}
      <div className="bg-white border-b border-slate-200 px-8 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button className="text-slate-500 hover:text-slate-900">☰</button>
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Select date</span>
            <input 
              type="date" 
              value={date} 
              onChange={(e) => onDateChange(e.target.value)} 
              className="bg-transparent text-xs font-medium text-slate-700 outline-none" 
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs font-semibold text-slate-600">Comparison mode</span>
            <div onClick={() => setComparisonMode(!comparisonMode)} className={`w-10 h-5 rounded-full p-0.5 transition ${comparisonMode ? "bg-slate-900" : "bg-slate-300"}`}>
              <div className={`w-4 h-4 rounded-full bg-white transition ${comparisonMode ? "translate-x-5" : ""}`} />
            </div>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs font-semibold text-slate-600">Detailed view</span>
            <div onClick={() => setDetailedView(!detailedView)} className={`w-10 h-5 rounded-full p-0.5 transition ${detailedView ? "bg-slate-900" : "bg-slate-300"}`}>
              <div className={`w-4 h-4 rounded-full bg-white transition ${detailedView ? "translate-x-5" : ""}`} />
            </div>
          </label>
          <button onClick={onPrint} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition">
            🖨️
          </button>
          <button className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1">
            ← Back
          </button>
        </div>
      </div>

      {/* ═══ CONTENT ═══ */}
      <div className="px-8 py-6 space-y-6 max-w-7xl mx-auto">
        {/* Property Report Section */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Property Report</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-white border-b border-slate-100">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-700">Metric</th>
                <th className="px-5 py-3 text-right text-xs font-bold text-slate-700">{date}</th>
                <th className="px-5 py-3 text-right text-xs font-bold text-slate-700">Month to Date (MTD)</th>
                <th className="px-5 py-3 text-right text-xs font-bold text-slate-700">Year to Date (YTD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {propertyMetrics.map((m, i) => (
                <tr key={i} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3.5 text-slate-600">{m.label}</td>
                  <td className="px-5 py-3.5 text-right font-semibold text-slate-800 tabular-nums">{m.today}</td>
                  <td className="px-5 py-3.5 text-right font-semibold text-slate-800 tabular-nums">{m.mtd}</td>
                  <td className="px-5 py-3.5 text-right font-semibold text-slate-800 tabular-nums">{m.ytd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Revenue Report Section */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Revenue Report</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-white border-b border-slate-100">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-700">Metric</th>
                <th className="px-5 py-3 text-right text-xs font-bold text-slate-700">{date}</th>
                <th className="px-5 py-3 text-right text-xs font-bold text-slate-700">Month to Date (MTD)</th>
                <th className="px-5 py-3 text-right text-xs font-bold text-slate-700">Year to Date (YTD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {revenueMetrics.map((m, i) => (
                <tr key={i} className={`hover:bg-slate-50/50 ${m.isTotal ? "bg-slate-50 font-bold" : ""}`}>
                  <td className={`px-5 py-3.5 ${m.isTotal ? "text-slate-900" : "text-slate-600"}`}>{m.label}</td>
                  <td className={`px-5 py-3.5 text-right tabular-nums ${m.isTotal ? "text-slate-900" : "text-slate-800 font-semibold"}`}>{m.today}</td>
                  <td className={`px-5 py-3.5 text-right tabular-nums ${m.isTotal ? "text-slate-900" : "text-slate-800 font-semibold"}`}>{m.mtd}</td>
                  <td className={`px-5 py-3.5 text-right tabular-nums ${m.isTotal ? "text-slate-900" : "text-slate-800 font-semibold"}`}>{m.ytd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Inventory & House Reports (Two Columns) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Inventory Report</p>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-white border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-bold text-slate-700">Metric</th>
                  <th className="px-5 py-3 text-right text-xs font-bold text-slate-700">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {inventoryMetrics.map((m, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3.5 text-slate-600">{m.label}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-slate-800 tabular-nums">{m.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">House Report</p>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-white border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-bold text-slate-700">Metric</th>
                  <th className="px-5 py-3 text-right text-xs font-bold text-slate-700">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {houseMetrics.map((m, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3.5 text-slate-600">{m.label}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-slate-800 tabular-nums">{m.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}