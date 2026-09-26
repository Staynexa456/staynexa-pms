"use client";

import React from "react";

export default function PaymentsReportHubPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="px-8 pt-8 pb-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-2xl shadow-lg shadow-slate-900/20">
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

      <div className="px-8 pb-8 max-w-7xl">
        {/* Pending Card */}
        <a
          href="/reports/payments/pending"
          className="block bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 rounded-2xl border-2 border-amber-300 p-6 hover:border-amber-500 hover:shadow-xl transition group relative mb-8 overflow-hidden"
        >
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
            <span className="text-amber-500 group-hover:text-amber-700 text-3xl transition-all shrink-0">→</span>
          </div>
        </a>

        {/* Report Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ReportCard
            title="Payment gateway report"
            description="All the information about payments processed via payment gateways: Stripe, Razorpay, etc."
            href="/reports/payments/gateway"
          />
          <ReportCard
            title="Cash & Counter report"
            description="All the cash and other offline payment transactions can be accessed in this report."
            href="/reports/payments/cash-counter"
          />
          <ReportCard
            title="Refunds report"
            description="This report provides payment gateway and cash refund information for the given date range."
            href="/reports/payments/refunds"
          />
          <ReportCard
            title="Transfers report"
            description="Payment settlement report for applicable payment gateways: Stripe and Razorpay."
            href="/reports/payments/transfers"
          />
          <ReportCard
            title="Payments by payment type"
            description="Payments report by payment type, like visa, mastercard, etc."
            href="/reports/payments/by-type"
          />
          <ReportCard
            title="Counter by payment type"
            description="Counter report by payment type, like cash, offline card, etc."
            href="/reports/payments/counter"
          />
          <ReportCard
            title="OTA payment report"
            description="The OTA payment report provides insight into the amount a guest has paid to the OTA at the time of booking creation."
            href="/reports/payments/ota"
          />
        </div>
      </div>
    </div>
  );
}

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
