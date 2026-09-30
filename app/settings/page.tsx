// app/settings/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useActiveHotel } from "../lib/use-active-hotel";
import { getHotelFeatures } from "../lib/feature-check";

// আপনার সেটিংস কার্ডগুলোর ডেটা (এখানে featureCode যোগ করা হয়েছে)
const SETTINGS_CARDS = [
  { title: "Folio Setup", desc: "Invoice, PDF, print settings", icon: "📄", href: "/settings/folio", featureCode: "pms" },
  { title: "Shift Setup", desc: "Staff shifts and handover", icon: "⏱️", href: "/settings/shifts", featureCode: "pms" },
  { title: "Hourly Price Config", desc: "Hourly booking rates", icon: "⏳", href: "/settings/hourly", featureCode: "pms", tag: "NEW" },
  { title: "Flexible Slot", desc: "Custom time-based slots", icon: "🎛️", href: "/settings/flexible-slots", featureCode: "pms", tag: "NEW" },
  { title: "Addons", desc: "Extra services and fees", icon: "➕", href: "/settings/addons", featureCode: "pms" },
  { title: "Room Type Details", desc: "Edit descriptions, photos, amenities, size", icon: "🛏️", href: "/settings/room-type-details", featureCode: "pms" },
{ title: "Rooms & Inventory", desc: "Add room numbers, manage inventory", icon: "🏠", href: "/settings/room-types", featureCode: "pms" },
  { title: "Promo Codes", desc: "Coupons and discount codes", icon: "🏷️", href: "/settings/promo-codes", featureCode: "pms", tag: "NEW" },
  { title: "Other Settings", desc: "Miscellaneous options", icon: "⚙️", href: "/settings/other", featureCode: "pms" },
  { title: "POS Device Config", desc: "Point of sale terminals", icon: "📱", href: "/settings/pos", featureCode: "pos" },
  { title: "Policies & Terms", desc: "Cancellation, amendment", icon: "📜", href: "/settings/policies", featureCode: "pms" },
  { title: "Taxes & Fees", desc: "GST, service charges", icon: "💰", href: "/settings/taxes", featureCode: "pms" },
  { title: "Notifications", desc: "Email, SMS, WhatsApp", icon: "🔔", href: "/settings/notifications", featureCode: "pms" },
  { title: "Channel Manager", desc: "OTA integrations", icon: "📡", href: "/settings/channels", featureCode: "channel_manager" },
  { title: "Booking Engine", desc: "Direct booking widget", icon: "🌐", href: "/settings/booking-engine", featureCode: "booking_engine" },
  { title: "Magic Link & Kiosk", desc: "Self check-in links", icon: "🔗", href: "/settings/magic-link", featureCode: "pms", tag: "BETA" },
  { title: "Users & Controls", desc: "Staff, roles, permissions", icon: "👥", href: "/settings/users", featureCode: "pms" },
  { title: "Booking Import", desc: "Import from Excel/CSV", icon: "📥", href: "/settings/import", featureCode: "pms" },
];

export default function SettingsPage() {
  const { hotelId } = useActiveHotel();
  const [features, setFeatures] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (hotelId) {
      getHotelFeatures(hotelId).then((data) => {
        setFeatures(data);
        setLoading(false);
      });
    }
  }, [hotelId]);

  // ✅ চেক করা হচ্ছে কোনো ফিচার চালু আছে কি না
  const hasFeature = (featureCode?: string) => {
    if (!featureCode) return true;
    // 'pms' সবসময় চালু থাকবে (বেস ফিচার)
    if (featureCode === "pms") return true;
    return features.includes(featureCode);
  };

  if (loading) {
    return <div className="p-6">Loading settings...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-sm text-slate-500">Manage your hotel's configuration and preferences.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SETTINGS_CARDS.map((card) => {
          // ✅ যদি ফিচারটি চালু না থাকে, তবে কার্ডটি রেন্ডার হবে না
          if (!hasFeature(card.featureCode)) return null;

          return (
            <Link
              key={card.title}
              href={card.href}
              className="flex items-start gap-4 p-5 bg-white rounded-2xl border border-slate-200 hover:border-teal-500 hover:shadow-lg transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-xl group-hover:bg-teal-50 transition-colors">
                {card.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-800 group-hover:text-teal-600 transition-colors">{card.title}</h3>
                  {card.tag && (
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      card.tag === "NEW" ? "bg-emerald-100 text-emerald-700" : "bg-purple-100 text-purple-700"
                    }`}>
                      {card.tag}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">{card.desc}</p>
              </div>
              <div className="text-slate-300 group-hover:text-teal-500 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
