"use client";

import React from "react";

export default function PaymentsReportHubPage() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* ═══════════════ LEFT SIDEBAR (Reports Navigation) ═══════════════ */}
      <aside className="w-64 bg-white border-r border-slate-200 p-4 shrink-0 hidden lg:block">
        <div className="mb-6">
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white">
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-xl">
              📊
            </div>
            <div>
              <h2 className="text-sm font-bold">Reports Hub</h2>
              <p className="text-[10px] text-white/60 uppercase tracking-wider">
                Analytics
              </p>
            </div>
          </div>
        </div>

        <nav className="space-y-1">
          {[
            { label: "Property reports", icon: "🏨", href: "/reports/property" },
            { label: "Front desk reports", icon: "🛎️", href: "/reports/front-desk" },
            { label: "Payment reports", icon: "💳", href: "/reports/payments", active: true },
            { label: "Service summary", icon: "🧾", href: "/reports/service" },
            { label: "Tax report", icon: "📑", href: "/reports/tax" },
            { label: "POS report", icon: "🛒", href: "/reports/pos" },
            { label: "Log report", icon: "📋", href: "/reports/log" },
            { label: "Booking engine", icon: "🌐", href: "/reports/booking-engine" },
            { label: "Customers report", icon: "👥", href: "/reports/customers" },
            { label: "Channel manager", icon: "🔗", href: "/reports/channel" },
            { label: "Direct billing", icon: "📄", href: "/reports/direct-billing" },
            { label: "Customised report", icon: "⚙️", href: "/reports/custom" },
            { label: "Expense report", icon: "💸", href: "/reports/expense" },
            { label: "Tally report", icon: "📊", href: "/reports/tally" },
            { label: "Space report", icon: "🏢", href: "/reports/space" },
            { label: "Scheduled emails", icon: "📧", href: "/reports/emails" },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                item.active
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
      </aside>

      {/* ═══════════════ MAIN CONTENT ═══════════════ */}
      <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-2xl shadow-lg shadow-teal-500/20">
                💳
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">
                  Payment Reports
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Track transactions, refunds, settlements, and payment gateway performance.
                </p>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════
              🆕 PENDING PAYMENT VERIFICATION CARD (Featured)
              ═══════════════════════════════════════════════ */}
          <a
            href="/reports/payments/pending"
            className="block bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 rounded-2xl border-2 border-amber-300 p-6 hover:border-amber-500 hover:shadow-xl transition group relative mb-8 overflow-hidden"
          >
            {/* Decorative background */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-200/30 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
            
            <div className="relative flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-3xl shadow-lg shadow-amber-500/30 shrink-0">
                ⏳
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="text-xl font-bold text-slate-900 group-hover:text-amber-700 transition">
                    Pending Payment Verification
                  </h3>
                  <span className="text-[10px] font-bold bg-amber-500 text-white px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm">
                    Action Required
                  </span>
                </div>
                <p className="text-sm text-slate-600">
                  Verify UPI / manual payments from guests before confirming their bookings
                </p>
              </div>
              <span className="text-amber-500 group-hover:text-amber-700 group-hover:translate-x-1 text-3xl transition-all shrink-0">
                →
              </span>
            </div>
          </a>

          {/* ═══════════════ PAYMENT REPORT CARDS GRID ═══════════════ */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Payment Gateway Report */}
            <ReportCard
              title="Payment gateway report"
              description="All the information about payments processed via payment gateways: Stripe, Razorpay, etc."
              href="/reports/payments/gateway"
            />

            {/* Cash & Counter Report */}
            <ReportCard
              title="Cash & Counter report"
              description="All the cash and other offline payment transactions can be accessed in this report."
              href="/reports/payments/cash-counter"
            />

            {/* Refunds Report */}
            <ReportCard
              title="Refunds report"
              description="This report provides payment gateway and cash refund information for the given date range."
              href="/reports/payments/refunds"
            />

            {/* Transfers Report */}
            <ReportCard
              title="Transfers report"
              description="Payment settlement report for applicable payment gateways: Stripe and Razorpay."
              href="/reports/payments/transfers"
            />

            {/* Payments by Payment Type */}
            <ReportCard
              title="Payments by payment type"
              description="Payments report by payment type, like visa, mastercard, etc."
              href="/reports/payments/by-type"
            />

            {/* Counter by Payment Type */}
            <ReportCard
              title="Counter by payment type"
              description="Counter report by payment type, like cash, offline card, etc."
              href="/reports/payments/counter"
            />

            {/* OTA Payment Report */}
            <ReportCard
              title="OTA payment report"
              description="The OTA payment report provides insight into the amount a guest has paid to the OTA at the time of booking creation."
              href="/reports/payments/ota"
            />
          </div>
        </div>
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════
// REUSABLE REPORT CARD COMPONENT
// ═══════════════════════════════════════════════
function ReportCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="block bg-white rounded-2xl border border-slate-200 p-6 hover:border-teal-400 hover:shadow-lg transition group"
    >
      <div className="flex flex-col h-full">
        <h3 className="text-lg font-bold text-slate-900 mb-3 group-hover:text-teal-700 transition">
          {title}
        </h3>
        <p className="text-sm text-slate-500 leading-relaxed mb-6 flex-1">
          {description}
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
  );
}
