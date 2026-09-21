"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const SIDEBAR_ITEMS = [
  { slug: "property", label: "Property reports", icon: "🏢" },
  { slug: "front-desk", label: "Front desk reports", icon: "🛎" },
  { slug: "payment", label: "Payment reports", icon: "💳" },
  { slug: "service", label: "Service summary", icon: "🛠" },
  { slug: "tax", label: "Tax report", icon: "🧾" },
  { slug: "pos", label: "POS report", icon: "🛒" },
  { slug: "log", label: "Log report", icon: "📋" },
  { slug: "booking-engine", label: "Booking engine report", icon: "🌐" },
  { slug: "customers", label: "Customers report", icon: "👥" },
  { slug: "channel-manager", label: "Channel manager reports", icon: "🔗" },
  { slug: "direct-billing", label: "Direct billing report", icon: "📄" },
  { slug: "customised", label: "Customised report", icon: "⚙" },
  { slug: "expense", label: "Expense report", icon: "💵" },
  { slug: "tally", label: "Tally report", icon: "↻" },
  { slug: "space", label: "Space report", icon: "📦" },
  { slug: "scheduled-emails", label: "Scheduled emails", icon: "✉" },
];

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-[#fafafa]">
      {/* SIDEBAR */}
      <aside className="w-64 shrink-0 bg-white border-r border-slate-200 min-h-screen sticky top-0 max-h-screen overflow-y-auto">
        <div className="px-4 py-4 border-b border-slate-100">
          <Link href="/reports" className="flex items-center gap-2 text-slate-700 hover:text-slate-900 transition">
            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-lg">📊</div>
            <div>
              <p className="text-sm font-bold text-slate-900">Reports Hub</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Analytics</p>
            </div>
          </Link>
        </div>

        <nav className="p-2">
          {SIDEBAR_ITEMS.map((item) => {
            const isActive = pathname?.startsWith(`/reports/${item.slug}`) ||
              (item.slug === "property" && (pathname === "/reports" || pathname === "/reports/property"));
            return (
              <Link
                key={item.slug}
                href={`/reports/${item.slug}`}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  isActive
                    ? "bg-slate-900 text-white font-semibold shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* CONTENT */}
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}