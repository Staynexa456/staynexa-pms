"use client";

import React from "react";

export default function PropertyReportsHubPage() {
  const reports = [
    {
      title: "Night Audit Report",
      description: "End-of-day audit with all transactions, cash drawer, revenue breakdown, and reconciliation.",
      href: "/reports/property/night-audit",
      badge: "NEW",
      badgeColor: "amber",
    },
    {
      title: "Master report",
      description: "Get all the details of bookings, customer information, payments, and taxes in a single report.",
      href: "/reports/property/master",
      badge: "MOST USED",
      badgeColor: "amber",
    },
    {
      title: "Flash manager report",
      description: "Summary of today, month-to-date, and year-to-date occupancy, ADR, RevPAR, Taxes, and other essential metrics.",
      href: "/reports/property/flash",
    },
    {
      title: "Guest ledger report",
      description: "Shows the change in outstanding balance owed by in-house guests after considering revenue, taxes, payments, transfers, and direct billing.",
      href: "/reports/property/guest-ledger",
    },
    {
      title: "Room revenue report",
      description: "A detailed view of the room revenue, services revenue, taxes, payments, and refunds grouped by booking id. A helpful report for daily auditing.",
      href: "/reports/property/room-revenue",
    },
    {
      title: "Sales report",
      description: "Date-wise performance report of the hotel. Occupancy, ADR, RevPAR, Revenue, payments, and other vital metrics.",
      href: "/reports/property/sales",
    },
    {
      title: "Room inventory report",
      description: "Date-wise room inventory metrics like Total rooms, available rooms, blocked rooms, and sold rooms.",
      href: "/reports/property/room-inventory",
    },
    {
      title: "Shift report",
      description: "Summary of all payment-related transactions performed by hotel staff during their shift.",
      href: "/reports/property/shift",
    },
    {
      title: "BAR pricing report",
      description: "The BAR Pricing Report provides a detailed view of rates for default occupancy as set at the room level.",
      href: "/reports/property/bar-pricing",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-8 pt-8 pb-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-2xl shadow-lg shadow-slate-900/20">
            📊
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Property Reports
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Comprehensive insights into your property's performance, revenue, and operations.
            </p>
          </div>
        </div>

        {/* Report Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reports.map((report) => (
            <a
              key={report.href}
              href={report.href}
              className="block bg-white rounded-2xl border border-slate-200 p-6 hover:border-teal-400 hover:shadow-lg transition group"
            >
              <div className="flex flex-col h-full">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-teal-700 transition">
                    {report.title}
                  </h3>
                  {report.badge && (
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                        report.badgeColor === "amber"
                          ? "bg-amber-100 text-amber-700 border border-amber-200"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {report.badge}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 leading-relaxed mb-6 flex-1">
                  {report.description}
                </p>
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-900 group-hover:text-teal-700 transition uppercase tracking-wider">
                    Open Report
                  </span>
                  <span className="text-slate-400 group-hover:text-teal-600 group-hover:translate-x-1 transition-all">
                    →
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
