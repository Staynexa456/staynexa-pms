"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  {
    group: "Property Setup",
    items: [
      { href: "/settings/property", label: "Property details", icon: "🏨" },
      { href: "/settings/rate-plans", label: "Rate plans", icon: "🏷️" },
      { href: "/settings/folio", label: "Folio setup", icon: "📄" },
      { href: "/settings/shift", label: "Shift setup", icon: "⏰" },
      { href: "/settings/hourly", label: "Hourly price config", icon: "⏱️" },
      { href: "/settings/flexible-slot", label: "Flexible slot", icon: "🧩" },
      { href: "/settings/addons", label: "Addons", icon: "➕" },
      { href: "/settings/other", label: "Other settings", icon: "⚙️" },
      { href: "/settings/pos-device", label: "POS device config", icon: "📱" },
    ],
  },
  {
    group: "Operations",
    items: [
      { href: "/settings/policies", label: "Policies and terms", icon: "🛡️" },
      { href: "/settings/taxes", label: "Taxes and fees", icon: "💰" },
      { href: "/settings/notifications", label: "Notifications", icon: "🔔" },
      { href: "/settings/channel-manager", label: "Channel manager", icon: "🔗" },
      { href: "/settings/booking-engine", label: "Booking engine", icon: "🌐" },
      { href: "/settings/magic-link", label: "Magic link and kiosk", icon: "✨" },
      { href: "/settings/users", label: "Users and controls", icon: "👥" },
      { href: "/settings/booking-import", label: "Booking import", icon: "📥" },
    ],
  },
];

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Property Setup</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure your property, rates, policies, and integrations
          </p>
        </div>

        {SECTIONS.map((section) => (
          <div key={section.group} className="mb-8">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">
              {section.group}
            </h2>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {section.items.map((item, idx) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition group ${
                    idx !== section.items.length - 1 ? "border-b border-slate-100" : ""
                  }`}
                >
                  <span className="text-2xl">{item.icon}</span>
                  <span className="flex-1 font-semibold text-slate-700 group-hover:text-teal-600 transition">
                    {item.label}
                  </span>
                  <svg
                    className="w-5 h-5 text-slate-300 group-hover:text-teal-500 transition"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}