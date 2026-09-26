"use client";

import React from "react";

export default function PaymentsReportHubPage() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Left Sidebar */}
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
            { label: "Property reports", icon: "🏨" },
            { label: "Front desk reports", icon: "🛎️" },
            { label: "Payment reports", icon: "💳", active: true },
            { label: "Service summary", icon: "🧾" },
            { label: "Tax report", icon: "📑" },
            { label: "POS report", icon: "🛒" },
            { label: "Log report", icon: "📋" },
            { label: "Booking engine", icon: "🌐" },
            { label: "Customers report", icon: "👥" },
            { label: "Channel manager", icon: "🔗" },
            { label: "Direct billing", icon: "📄" },
            { label: "Customised report", icon: "⚙️" },
            { label: "Expense report", icon: "💸" },
            { label: "Tally report", icon: "📊" },
            { label: "Space report", icon: "🏢" },
            { label: "Scheduled emails", icon: "📧" },
          ].map((item) => (
            <button
              key={item.label}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                item.active
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-7xl">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-2xl shadow-lg">
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

          {/* 🆕 PENDING PAYMENT VERIFICATION CARD */}
          <a
            href="/reports/payments/pending"
            className="block bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 rounded-2xl border-2 border-amber-300 p-6 hover:border-amber-500 hover:shadow-xl transition group relative mb-8 overflow-hidden"
          >
            <div className="relative flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-3xl shadow-lg shrink-0">
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
              <span className="text-amber-500 group-hover:text-amber-700 text-3xl transition-all shrink-0">
                →
              </span>
            </div>
          </a>

          {/* Report Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ReportCard
              title="Payment gateway report"
              description="All the information about payments processed via payment gateways: Stripe, Razorpay, etc."
            />
            <ReportCard
              title="Cash & Counter report"
              description="All the cash and other offline payment transactions can be accessed in this report."
            />
            <ReportCard
              title="Refunds report"
              description="This report provides payment gateway and cash refund information for the given date range."
            />
            <ReportCard
              title="Transfers report"
              description="Payment settlement report for applicable payment gateways: Stripe and Razorpay."
            />
            <ReportCard
              title="Payments by payment type"
              description="Payments report by payment type, like visa, mastercard, etc."
            />
            <ReportCard
              title="Counter by payment type"
              description="Counter report by payment type, like cash, offline card, etc."
            />
            <ReportCard
              title="OTA payment report"
              description="The OTA payment report provides insight into the amount a guest has paid to the OTA at the time of booking creation."
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function ReportCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="block bg-white rounded-2xl border border-slate-200 p-6 hover:border-teal-400 hover:shadow-lg transition group cursor-pointer">
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
    </div>
  );
}
