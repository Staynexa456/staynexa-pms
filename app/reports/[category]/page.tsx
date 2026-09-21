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
    subtitle: "Comprehensive insights into your property's performance, revenue, and operations.",
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
    subtitle: "Daily operational reports for arrivals, departures, and guest management.",
    icon: "🛎",
    reports: [
      { slug: "room-bookings", title: "Room bookings report", desc: "Room booking report provides a comprehensive breakdown of room categories, including room count, nights booked, rate plans, occupancy details." },
      { slug: "day-use", title: "Day use report", desc: "All the day use bookings, same day checkin and checkouts for the given date range" },
      { slug: "new-bookings", title: "New bookings report", desc: "All the new reservations from all the sources. Including walk-ins, OTA bookings, etc." },
      { slug: "arrivals", title: "Arrivals report", desc: "Guests arrivals report for the given date" },
      { slug: "departures", title: "Departures report", desc: "Guests departures report for the given date" },
      { slug: "on-hold", title: "On-hold report", desc: "Bookings that went on-hold for the given date (based on stay date)" },
      { slug: "no-show", title: "No Show Report", desc: "View all no-show bookings for the selected date." },
      { slug: "room-upgrade", title: "Room upgrade report", desc: "Room upgrades performed using Magic Link for the given date range" },
      { slug: "early-checkin", title: "Early checkin report", desc: "Early check-ins performed using Magic Link for the given date range" },
      { slug: "late-checkout", title: "Late checkout report", desc: "Late check-outs performed using Magic Link for the given date range" },
      { slug: "booking-notes", title: "Booking notes report", desc: "All the booking notes entered for the given date range" },
      { slug: "customer-notes", title: "Customer notes report", desc: "All the customer notes entered for the given date range" },
      { slug: "rate-plan-count", title: "Rate plan count report", desc: "The rate plan report will give you a count on the number of rate plans opted by guests." },
    ],
  },
  payment: {
    title: "Payment Reports",
    subtitle: "Track transactions, refunds, settlements, and payment gateway performance.",
    icon: "💳",
    reports: [
      { slug: "gateway", title: "Payment gateway report", desc: "All the information about payments processed via payment gateways: Stripe, Razorpay, etc." },
      { slug: "cash-counter", title: "Cash & Counter report", desc: "All the cash and other offline payment transactions can be accessed in this report" },
      { slug: "refunds", title: "Refunds report", desc: "This report provides payment gateway and cash refund information for the given date range." },
      { slug: "transfers", title: "Transfers report", desc: "Payment settlement report for applicable payment gateways: Stripe and Razorpay." },
      { slug: "by-type", title: "Payments by payment type", desc: "Payments report by payment type, like visa, mastercard, etc" },
      { slug: "counter-type", title: "Counter by payment type", desc: "Counter report by payment type, like cash, offline card, etc" },
      { slug: "ota-payment", title: "OTA payment report", desc: "The OTA payment report provides insight into the amount a guest has paid to the OTA at the time of booking creation." },
    ],
  },
  service: {
    title: "Service Reports",
    subtitle: "Revenue and sales reports for addons and auxiliary services.",
    icon: "🛠",
    reports: [
      { slug: "service-revenue", title: "Service revenue report", desc: "Report of all the addons serviced, like folio addons" },
      { slug: "service-sales", title: "Service sales report", desc: "Datewise report of sales revenue. Has per day, occupancy%, ADR, REVPAR, payment collected, etc." },
    ],
  },
  tax: {
    title: "Tax Reports",
    subtitle: "GST, room taxes, and compliance reports for filing.",
    icon: "🧾",
    reports: [
      { slug: "room-taxes", title: "Room taxes report", desc: "Booking wise tax report" },
      { slug: "gst", title: "GST report", desc: "Complete GST report" },
    ],
  },
  pos: {
    title: "POS Reports",
    subtitle: "Point of Sale performance across all outlets and categories.",
    icon: "🛒",
    reports: [
      { slug: "shopwise-revenue", title: "Shopwise revenue report", desc: "Report describes the revenue collected across all the outlets for the particular hotel." },
      { slug: "alloutlets-daysales", title: "All outlets Day wise sales", desc: "Consolidated sales of all your restaurant day wise" },
      { slug: "alloutlets-hourly", title: "All outlets hourly sales", desc: "A report of hourly variation in your item sales" },
      { slug: "alloutlets-category", title: "All outlets category summary", desc: "Get the summary of categories" },
      { slug: "alloutlets-orders", title: "All outlets order wise sales", desc: "Get the summary of order wise sales summary report" },
    ],
  },
  log: {
    title: "Log Reports",
    subtitle: "System and user activity logs for auditing.",
    icon: "📋",
    reports: [
      { slug: "user-log", title: "User log report", desc: "Detailed report of user logs for given operation type and sub-operation type" },
    ],
  },
  "booking-engine": { title: "Booking Engine Reports", subtitle: "Analytics for your direct booking engine.", icon: "🌐", reports: [] },
  customers: {
    title: "Customers Reports",
    subtitle: "Guest demographics, loyalty, and spending behavior.",
    icon: "👥",
    reports: [
      { slug: "guest-list", title: "Guest list report", desc: "Complete directory of all guests with contact and booking history." },
      { slug: "top-spenders", title: "Top spenders report", desc: "Guests with the highest revenue contribution in selected date range." },
      { slug: "guest-origins", title: "Guest origins report", desc: "Country-wise breakdown of guest nationality and booking volume." },
      { slug: "repeat-guests", title: "Repeat guests report", desc: "Guests with multiple stays — loyalty tracking report." },
    ],
  },
  "channel-manager": { title: "Channel Manager Reports", subtitle: "OTA and channel performance.", icon: "🔗", reports: [] },
  "direct-billing": { title: "Direct Billing Reports", subtitle: "Corporate and direct billing accounts.", icon: "📄", reports: [] },
  customised: { title: "Customized Reports", subtitle: "Build your own reports.", icon: "⚙", reports: [] },
  expense: { title: "Expense Report", subtitle: "Operational expenses.", icon: "💵", reports: [] },
  tally: { title: "Tally Reports", subtitle: "Accounting integration reports.", icon: "↻", reports: [] },
  space: { title: "Space Reports", subtitle: "Banquet and event space utilization.", icon: "📦", reports: [] },
  "scheduled-emails": { title: "Scheduled Emails", subtitle: "Automated report delivery.", icon: "✉", reports: [] },
};

export default function ReportCategoryPage() {
  const params = useParams();
  const category = String(params?.category || "property");
  const config = CATEGORIES[category];

  if (!config) {
    return (
      <div className="p-12 text-center flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-4xl mb-6">🔍</div>
        <h2 className="text-2xl font-bold text-slate-800">Report category not found</h2>
        <p className="text-slate-500 mt-2 mb-6">The category "{category}" does not exist.</p>
        <Link href="/reports/property" className="px-6 py-3 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition">
          Go to Reports
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 lg:p-10 max-w-7xl mx-auto">
      <div className="mb-10">
        <div className="flex items-start gap-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center shadow-lg shadow-slate-900/20 shrink-0">
            <span className="text-2xl">{config.icon}</span>
          </div>
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight leading-none">{config.title}</h1>
            <p className="text-sm text-slate-500 mt-3 max-w-2xl">{config.subtitle}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {config.reports.map(report => (
          <div key={report.slug} className="group bg-white rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 p-6 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-900 to-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-start justify-between mb-4 gap-3">
              <h3 className="text-lg font-bold text-slate-900 leading-snug">{report.title}</h3>
              {report.badge && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                  {report.badge}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 leading-relaxed flex-1 min-h-[60px]">{report.desc}</p>
            <Link
              href={`/reports/${category}/${report.slug}`}
              className="mt-6 inline-flex items-center justify-center gap-2 px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-all w-full group-hover:shadow-md"
            >
              Open Report
              <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        ))}
        {config.reports.length === 0 && (
          <div className="col-span-full text-center py-24 bg-white rounded-2xl border border-dashed border-slate-300">
            <p className="text-6xl mb-4 opacity-30">📭</p>
            <p className="text-lg font-bold text-slate-700">Coming Soon</p>
            <p className="text-sm text-slate-400 mt-2">This report category will be available shortly.</p>
          </div>
        )}
      </div>
    </div>
  );
}