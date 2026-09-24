"use client";

import React, { useState } from "react";
import Link from "next/link";

type SectionItem = {
  href: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  badge?: "new" | "beta";
};

type Section = {
  group: string;
  items: SectionItem[];
};

const SECTIONS: Section[] = [
  {
    group: "Property Setup",
    items: [
      { href: "/settings/property", label: "Property Details", description: "Room types, photos, capacity", icon: "🏨", color: "bg-blue-100 text-blue-700" },
      { href: "/settings/rate-plans", label: "Rate Plans", description: "EP, CP, MAP, AP pricing", icon: "🏷️", color: "bg-amber-100 text-amber-700" },
      { href: "/settings/folio", label: "Folio Setup", description: "Invoice, PDF, print settings", icon: "📄", color: "bg-emerald-100 text-emerald-700" },
      { href: "/settings/shift", label: "Shift Setup", description: "Staff shifts and handover", icon: "⏰", color: "bg-purple-100 text-purple-700" },
      { href: "/settings/hourly", label: "Hourly Price Config", description: "Hourly booking rates", icon: "⏱️", color: "bg-cyan-100 text-cyan-700", badge: "new" },
      { href: "/settings/flexible-slot", label: "Flexible Slot", description: "Custom time-based slots", icon: "🧩", color: "bg-pink-100 text-pink-700", badge: "new" },
      { href: "/settings/addons", label: "Addons", description: "Extra services and fees", icon: "➕", color: "bg-teal-100 text-teal-700" },
      { href: "/settings/other", label: "Other Settings", description: "Miscellaneous options", icon: "⚙️", color: "bg-slate-100 text-slate-700" },
      { href: "/settings/pos-device", label: "POS Device Config", description: "Point of sale terminals", icon: "📱", color: "bg-indigo-100 text-indigo-700" },
    ],
  },
  {
    group: "Operations",
    items: [
      { href: "/settings/policies", label: "Policies & Terms", description: "Cancellation, amendment", icon: "🛡️", color: "bg-rose-100 text-rose-700" },
      { href: "/settings/taxes", label: "Taxes & Fees", description: "GST, service charges", icon: "💰", color: "bg-emerald-100 text-emerald-700" },
      { href: "/settings/notifications", label: "Notifications", description: "Email, SMS, WhatsApp", icon: "🔔", color: "bg-yellow-100 text-yellow-700" },
      { href: "/settings/channel-manager", label: "Channel Manager", description: "OTA integrations", icon: "🔗", color: "bg-blue-100 text-blue-700" },
      { href: "/settings/booking-engine", label: "Booking Engine", description: "Direct booking widget", icon: "🌐", color: "bg-purple-100 text-purple-700" },
      { href: "/settings/magic-link", label: "Magic Link & Kiosk", description: "Self check-in links", icon: "✨", color: "bg-pink-100 text-pink-700", badge: "beta" },
      { href: "/settings/users", label: "Users & Controls", description: "Staff, roles, permissions", icon: "👥", color: "bg-cyan-100 text-cyan-700" },
      { href: "/settings/booking-import", label: "Booking Import", description: "Import from Excel/CSV", icon: "📥", color: "bg-teal-100 text-teal-700" },
    ],
  },
];

export default function SettingsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSections = SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.label.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    }),
  })).filter((s) => s.items.length > 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-5xl mx-auto p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center text-2xl shadow-lg">
              ⚙️
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Property Setup</h1>
              <p className="text-sm text-slate-500">
                Configure your property, rates, policies, and integrations
              </p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search settings..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 focus:border-teal-500 rounded-xl text-sm outline-none transition shadow-sm"
            />
          </div>
        </div>

        {/* Sections */}
        {filteredSections.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <p className="text-5xl mb-3">🔍</p>
            <p className="font-bold text-slate-700">No settings found</p>
            <p className="text-sm text-slate-500 mt-1">Try a different search term</p>
          </div>
        )}

        {filteredSections.map((section) => (
          <div key={section.group} className="mb-8">
            <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-3 px-1">
              {section.group}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group bg-white rounded-2xl border border-slate-200 hover:border-teal-300 hover:shadow-lg hover:shadow-teal-100/50 p-5 transition-all duration-200 flex items-start gap-4"
                >
                  <div className={`w-12 h-12 rounded-xl ${item.color} flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform`}>
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-slate-800 group-hover:text-teal-700 transition">
                        {item.label}
                      </h3>
                      {item.badge && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${
                            item.badge === "new"
                              ? "bg-emerald-500 text-white"
                              : "bg-purple-500 text-white"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2">
                      {item.description}
                    </p>
                  </div>
                  <svg
                    className="w-5 h-5 text-slate-300 group-hover:text-teal-500 group-hover:translate-x-1 transition-all shrink-0 mt-1"
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