"use client";

import React from "react";

export default function FrontDeskReportsHubPage() {
  const reports = [
    {
      title: "Arrival report",
      description: "List of all guests arriving today with their reservation details.",
      href: "/reports/front-desk/arrival",
    },
    {
      title: "Departure report",
      description: "List of all guests checking out today with their balances.",
      href: "/reports/front-desk/departure",
    },
    {
      title: "In-house report",
      description: "Complete list of currently checked-in guests.",
      href: "/reports/front-desk/in-house",
    },
    {
      title: "No-show report",
      description: "Guests who did not show up for their reservations.",
      href: "/reports/front-desk/no-show",
    },
    {
      title: "Cancellation report",
      description: "All cancelled bookings for the selected date range.",
      href: "/reports/front-desk/cancellation",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-8 pt-8 pb-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-2xl shadow-lg">
            🛎️
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Front Desk Reports</h1>
            <p className="text-sm text-slate-500 mt-1">
              Daily operational reports for reception and front office.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reports.map((report) => (
            <a
              key={report.href}
              href={report.href}
              className="block bg-white rounded-2xl border border-slate-200 p-6 hover:border-teal-400 hover:shadow-lg transition group"
            >
              <div className="flex flex-col h-full">
                <h3 className="text-lg font-bold text-slate-900 mb-3 group-hover:text-teal-700 transition">
                  {report.title}
                </h3>
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
