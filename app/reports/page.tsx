"use client";

import React from "react";
import Link from "next/link";

const CATEGORIES = [
  { slug: "property", title: "Property Reports", desc: "Master, Flash Manager, Guest Ledger, Room Revenue & more.", icon: "🏢", color: "from-slate-900 to-slate-700" },
  { slug: "front-desk", title: "Front Desk Reports", desc: "Arrivals, Departures, Day Use, Room Upgrades, and Guest Notes.", icon: "🛎", color: "from-blue-900 to-blue-700" },
  { slug: "payment", title: "Payment Reports", desc: "Gateway, Cash, Refunds, Transfers, and OTA Payments.", icon: "💳", color: "from-emerald-900 to-emerald-700" },
  { slug: "service", title: "Service Reports", desc: "Service Revenue and Addon Sales reports.", icon: "🛠", color: "from-amber-900 to-amber-700" },
  { slug: "tax", title: "Tax Reports", desc: "GST and Room Taxes for compliance and filing.", icon: "🧾", color: "from-rose-900 to-rose-700" },
  { slug: "pos", title: "POS Reports", desc: "Shopwise, hourly, and category-wise outlet sales.", icon: "🛒", color: "from-violet-900 to-violet-700" },
  { slug: "customers", title: "Customer Reports", desc: "Guest list, Top spenders, Origins, and Repeat guests.", icon: "👥", color: "from-indigo-900 to-indigo-700" },
  { slug: "log", title: "Log Reports", desc: "User activity and audit logs.", icon: "📋", color: "from-slate-800 to-slate-600" },
];

export default function ReportsHubPage() {
  return (
    <div className="p-8 lg:p-10 max-w-7xl mx-auto">
      {/* ═══ HEADER ═══ */}
      <div className="mb-10">
        <div className="flex items-start gap-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center shadow-lg shadow-slate-900/20 shrink-0">
            <span className="text-2xl">📊</span>
          </div>
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight leading-none">Reports Hub</h1>
            <p className="text-sm text-slate-500 mt-3 max-w-2xl">
              Select a report category below to view detailed analytics, export data, and gain insights into your property's performance.
            </p>
          </div>
        </div>
      </div>

      {/* ═══ CATEGORY GRID ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {CATEGORIES.map(cat => (
          <Link
            key={cat.slug}
            href={`/reports/${cat.slug}`}
            className="group relative bg-white rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 p-6 flex flex-col overflow-hidden"
          >
            {/* Top gradient line */}
            <div className={`absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r ${cat.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
            
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
                {cat.icon}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 leading-snug">{cat.title}</h3>
                <p className="text-xs text-slate-400 mt-1 font-medium uppercase tracking-wider">Analytics</p>
              </div>
            </div>
            
            <p className="text-sm text-slate-500 leading-relaxed flex-1">
              {cat.desc}
            </p>

            <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-slate-900">
              View Reports
              <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}