"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type ReportDef = {
  slug: string;
  title: string;
  desc: string;
  badge?: string;
};

type CategoryConfig = {
  title: string;
  subtitle: string;
  icon: string;
  reports: ReportDef[];
};

const CATEGORIES: Record<string, CategoryConfig> = {
  property: {
    title: "Property Reports",
    subtitle: "Property reports content goes here.",
    icon: "🏢",
    reports: [
      { slug: "master", title: "Master report", desc: "Get all the details of bookings, customer information, payments, and taxes in a single report.", badge: "Most used" },
      { slug: "flash-manager", title: "Flash manager report", desc: "Summary of today, month-to-date, and year-to-date occupancy, ADR, RevPAR, Taxes, and other essential metrics." },
      { slug: "guest-ledger", title: "Guest ledger report", desc: "Shows the change in outstanding balance owed by in-house guests after considering revenue, taxes, payments, transfers, and direct billing." },
      { slug: "room-revenue", title: "Room revenue report", desc: "A detailed view of the room revenue, services revenue, taxes, payments, and refunds grouped by booking id. A helpful report for daily auditing." },
      { slug: "sales", title: "Sales report", desc: "Date-wise performance report of the hotel. Occupancy, ADR, RevPAR, Revenue, payments, and other vital metrics." },
      { slug: "room-inventory", title: "Room inventory report", desc: "Date-wise room inventory metrics like Total rooms, available rooms, blocked rooms, and sold rooms." },
      { slug: "shift", title: "Shift report", desc: "Summary of all payment-related transactions performed by hotel staff during their shift." },
      { slug: "bar-pricing", title: "BAR pricing report", desc: "The BAR Pricing Report provides a detailed view of rates for default occupancy as set at the room level." },
      { slug: "folio", title: "Folio report", desc: "A quick snapshot of guest folio balances and payments made. Useful for end-of-the-day balancing." },
      { slug: "archived-folio", title: "Archived folio report", desc: "Archived folio report provides a detailed view of all the archived folios." },
    ],
  },
  "front-desk": {
    title: "Front Desk Reports",
    subtitle: "Front desk reports content goes here.",
    icon: "🛎",
    reports: [
      { slug: "room-bookings", title: "Room bookings report", desc: "Room booking report provides a comprehensive breakdown of room categories, including room count, nights booked, rate plans, occupancy details along with other details." },
      { slug: "day-use", title: "Day use report", desc: "All the day use bookings, same day checkin and checkouts for the given date range" },
      { slug: "new-bookings", title: "New bookings report", desc: "All the new reservations from all the sources. Including walk-ins, OTA bookings, etc., for the given date." },
      { slug: "arrivals", title: "Arrivals report", desc: "Guests arrivals report for the given date" },
      { slug: "departures", title: "Departures report", desc: "Guests departures report for the given date" },
      { slug: "on-hold", title: "On-hold report", desc: "Bookings that went on-hold for the given date (based on stay date)" },
      { slug: "no-show", title: "No Show Report", desc: "View all no-show bookings for the selected date." },
      { slug: "room-upgrade", title: "Room upgrade report", desc: "Room upgrades performed using Magic Link for the given date range" },
      { slug: "early-checkin", title: "Early checkin report", desc: "Early check-ins performed using Magic Link for the given date range" },
      { slug: "late-checkout", title: "Late checkout report", desc: "Late check-outs performed using Magic Link for the given date range" },
      { slug: "booking-notes", title: "Booking notes report", desc: "All the booking notes entered for the given date range" },
      { slug: "customer-notes", title: "Customer notes report", desc: "All the customer notes entered for the given date range" },
      { slug: "rate-plan-count", title: "Rate plan count report", desc: "The rate plan report will give you a count on the number of rate plans opted by guests so that the hotel can prepare meals accordingly." },
    ],
  },
  payment: {
    title: "Payment Reports",
    subtitle: "Payment reports content goes here.",
    icon: "💳",
    reports: [
      { slug: "gateway", title: "Payment gateway report", desc: "All the information about payments processed via payment gateways: for Stripe, and Razorpay, we do include transfer information." },
      { slug: "cash-counter", title: "Cash & Counter report", desc: "All the cash and other offline payment transactions can be accessed in this report" },
      { slug: "refunds", title: "Refunds report", desc: "This report provides payment gateway and cash refund information for the given date range." },
      { slug: "transfers", title: "Transfers report", desc: "Payment settlement report for applicable payment gateways: Stripe and Razorpay." },
      { slug: "by-type", title: "Payments report by payment type", desc: "Payments report by payment type, like visa, mastercard, etc" },
      { slug: "counter-type", title: "Counter report by payment type", desc: "Counter report by payment type, like cash, offline card, etc" },
      { slug: "ota-payment", title: "OTA payment report", desc: "The OTA payment report provides insight into the amount a guest has paid to the OTA at the time of booking creation." },
    ],
  },
  service: {
    title: "Service Reports",
    subtitle: "Service reports content goes here.",
    icon: "🛠",
    reports: [
      { slug: "service-revenue", title: "Service revenue report", desc: "Report of all the addons serviced, like folio addons" },
      { slug: "service-sales", title: "Service sales report", desc: "Datewise report of sales revenue. Has per day, occupancy%, ADR, REVPAR, payment collected, etc." },
    ],
  },
  tax: {
    title: "Tax Reports",
    subtitle: "Tax reports content goes here.",
    icon: "🧾",
    reports: [
      { slug: "room-taxes", title: "Room taxes report", desc: "Booking wise tax report" },
      { slug: "gst", title: "GST report", desc: "Complete GST report" },
    ],
  },
  pos: {
    title: "POS Reports",
    subtitle: "POS reports content goes here.",
    icon: "🛒",
    reports: [
      { slug: "shopwise-revenue", title: "Shopwise revenue report", desc: "Report describes the revenue collected across all the outlets for the particular hotel." },
      { slug: "alloutlets-daysales", title: "All outlets Day wise sales summary report", desc: "Consolidated sales of all your restaurant day wise" },
      { slug: "alloutlets-hourly", title: "All outlets hourly items sales summary report", desc: "A report of hourly variation in your item sales" },
      { slug: "alloutlets-category", title: "All outlets itemwise category summary report", desc: "Get the summary of categories" },
      { slug: "alloutlets-orders", title: "All outlets order wise sales summary report", desc: "Get the summary of order wise sales summary report" },
    ],
  },
  log: {
    title: "Log Reports",
    subtitle: "Log reports content goes here.",
    icon: "📋",
    reports: [
      { slug: "user-log", title: "User log report", desc: "Detailed report of user logs for given operation type and sub-operation type" },
    ],
  },
  "booking-engine": {
    title: "Booking Engine Reports",
    subtitle: "Booking engine reports content goes here.",
    icon: "🌐",
    reports: [],
  },
  customers: {
    title: "Customers Reports",
    subtitle: "Customers reports content goes here.",
    icon: "👥",
    reports: [
      { slug: "guest-list", title: "Guest list report", desc: "Complete directory of all guests with contact and booking history." },
      { slug: "top-spenders", title: "Top spenders report", desc: "Guests with the highest revenue contribution in selected date range." },
      { slug: "guest-origins", title: "Guest origins report", desc: "Country-wise breakdown of guest nationality and booking volume." },
      { slug: "repeat-guests", title: "Repeat guests report", desc: "Guests with multiple stays — loyalty tracking report." },
    ],
  },
  "channel-manager": {
    title: "Channel Manager Reports",
    subtitle: "Channel manager reports content goes here.",
    icon: "🔗",
    reports: [],
  },
  "direct-billing": {
    title: "Direct Billing Reports",
    subtitle: "Direct billing reports content goes here.",
    icon: "📄",
    reports: [],
  },
  customised: {
    title: "Customized Reports",
    subtitle: "Customized reports content goes here.",
    icon: "⚙",
    reports: [],
  },
  expense: {
    title: "Expense Report",
    subtitle: "Expense reports content goes here.",
    icon: "💵",
    reports: [],
  },
  tally: {
    title: "Tally Reports",
    subtitle: "Tally reports content goes here.",
    icon: "↻",
    reports: [],
  },
  space: {
    title: "Space Reports",
    subtitle: "Space reports content goes here.",
    icon: "📦",
    reports: [],
  },
  "scheduled-emails": {
    title: "Scheduled Emails",
    subtitle: "Scheduled emails content goes here.",
    icon: "✉",
    reports: [],
  },
};

export default function ReportCategoryPage() {
  const params = useParams();
  const category = String(params?.category || "property");
  const config = CATEGORIES[category];

  if (!config) {
    return (
      <div className="p-12 text-center">
        <p className="text-6xl mb-4">🔍</p>
        <h2 className="text-xl font-bold text-slate-800">Report not found</h2>
        <Link href="/reports/property" className="mt-4 inline-block px-5 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-semibold">Go to Reports</Link>
      </div>
    );
  }

  return (
    <div className="p-8 lg:p-10">
      <div className="mb-8">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-lg border border-slate-200 flex items-center justify-center text-lg shrink-0">
            <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight leading-none">{config.title}</h1>
            <p className="text-sm text-slate-400 mt-2">{config.subtitle}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {config.reports.map(report => (
          <div key={report.slug} className="bg-white rounded-2xl border border-slate-200 hover:border-slate-400 hover:shadow-md transition-all p-6 flex flex-col">
            <div className="flex items-start justify-between mb-3 gap-2">
              <h3 className="text-base font-bold text-slate-900 leading-snug">{report.title}</h3>
              {report.badge && (
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded bg-slate-100 text-slate-600 shrink-0">{report.badge}</span>
              )}
            </div>
            <p className="text-sm text-slate-500 leading-relaxed flex-1 min-h-[60px]">{report.desc}</p>
            <Link
              href={`/reports/${category}/${report.slug}`}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 bg-black hover:bg-slate-800 text-white rounded-full text-sm font-semibold transition-all self-start"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              Open Report
            </Link>
          </div>
        ))}
        {config.reports.length === 0 && (
          <div className="col-span-3 text-center py-20">
            <p className="text-6xl mb-4 opacity-30">📭</p>
            <p className="text-slate-500 font-semibold">Coming soon</p>
            <p className="text-xs text-slate-400 mt-1">This report category will be available shortly</p>
          </div>
        )}
      </div>
    </div>
  );
}