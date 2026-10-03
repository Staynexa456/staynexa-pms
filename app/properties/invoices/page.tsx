"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../supabase";
import { useActiveHotel } from "../../lib/use-active-hotel";
import {
  generateInvoicePDF,
  formatInvoiceDate,
  type InvoiceData,
} from "../../lib/invoice-generator";

type InvoiceRecord = {
  id: string;
  invoiceNumber: string;
  date: string;
  type: "subscription" | "addon";
  description: string;
  amount: number;
  paymentId?: string;
  periodStart?: string;
  periodEnd?: string;
};

export default function InvoicesPage() {
  const { hotelId, loading: hotelLoading } = useActiveHotel();
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [hotelInfo, setHotelInfo] = useState<any>(null);

  const loadInvoices = useCallback(async () => {
    if (!hotelId) {
      setInvoices([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);

      const { data: hotel } = await supabase
        .from("hotels")
        .select("*")
        .eq("id", hotelId)
        .maybeSingle();
      setHotelInfo(hotel);

      // Subscription invoices
      const { data: subs } = await supabase
        .from("subscription_history")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("status", "active")
        .order("start_date", { ascending: false });

      const subInvoices: InvoiceRecord[] = (subs || []).map((s: any) => ({
        id: s.id,
        invoiceNumber: `SUB-${String(s.id).slice(-8).toUpperCase()}`,
        date: s.start_date || s.created_at,
        type: "subscription",
        description: `${s.plan_name || s.plan || "Subscription"} Plan`,
        amount: Number(s.amount) || 0,
        paymentId: s.payment_id,
        periodStart: s.start_date,
        periodEnd: s.end_date,
      }));

      // Addon invoices
      const { data: reqs } = await supabase
        .from("feature_requests")
        .select("*, feature_modules(name)")
        .eq("hotel_id", hotelId)
        .eq("status", "approved")
        .eq("payment_status", "verified")
        .order("requested_at", { ascending: false });

      const addonInvoices: InvoiceRecord[] = (reqs || []).map((r: any) => ({
        id: r.id,
        invoiceNumber: `ADD-${String(r.id).slice(-8).toUpperCase()}`,
        date: r.requested_at,
        type: "addon",
        description: `${r.feature_modules?.name || r.feature_code} Add-on`,
        amount: Number(r.amount_paid) || 0,
        paymentId: r.payment_id,
      }));

      setInvoices([...subInvoices, ...addonInvoices]);
    } catch (err) {
      console.error("[Invoices] Load error:", err);
    } finally {
      setLoading(false);
    }
  }, [hotelId]);

  useEffect(() => {
    if (hotelLoading) return;
    loadInvoices();
  }, [loadInvoices, hotelLoading]);

  const handleDownload = (invoice: InvoiceRecord) => {
    const data: InvoiceData = {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: formatInvoiceDate(invoice.date),
      type: invoice.type,
      hotel: {
        name: hotelInfo?.name || "Hotel",
        city: hotelInfo?.city,
        state: hotelInfo?.state,
        address: hotelInfo?.address,
        phone: hotelInfo?.phone,
        email: hotelInfo?.email,
        gst_number: hotelInfo?.gst_number,
      },
      items: [
        {
          description: invoice.description,
          quantity: 1,
          amount: invoice.amount,
        },
      ],
      taxRate: 18,
      paymentId: invoice.paymentId,
      planName: invoice.description,
      periodStart: invoice.periodStart ? formatInvoiceDate(invoice.periodStart) : undefined,
      periodEnd: invoice.periodEnd ? formatInvoiceDate(invoice.periodEnd) : undefined,
    };
    generateInvoicePDF(data, "download");
  };

  if (loading || hotelLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-teal-600 animate-spin" />
      </div>
    );
  }

  const totalAmount = invoices.reduce((s, i) => s + i.amount, 0);
  const fmt = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Invoices</h1>
          <p className="text-sm text-slate-500 mt-1">
            {invoices.length} invoice{invoices.length !== 1 ? "s" : ""} · Total {fmt(totalAmount)}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Invoices</p>
            <p className="text-2xl font-bold text-slate-900 mt-2">{invoices.length}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 border-l-4 border-l-emerald-500">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Paid</p>
            <p className="text-2xl font-bold text-emerald-600 mt-2">{fmt(totalAmount)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 border-l-4 border-l-sky-500">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hotel</p>
            <p className="text-sm font-bold text-slate-800 mt-2 truncate">{hotelInfo?.name || "—"}</p>
          </div>
        </div>

        {invoices.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
            <p className="text-5xl mb-4 opacity-40">📄</p>
            <p className="font-semibold text-slate-700">No invoices yet</p>
            <p className="text-sm text-slate-400 mt-1">
              Invoices will appear here after you purchase a plan or add-on.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Invoice #</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Description</th>
                  <th className="text-center px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-3 text-xs font-mono font-bold text-slate-800">{inv.invoiceNumber}</td>
                    <td className="px-5 py-3 text-xs text-slate-600">{formatInvoiceDate(inv.date)}</td>
                    <td className="px-5 py-3 text-sm text-slate-700">{inv.description}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-full ${inv.type === "subscription" ? "bg-purple-100 text-purple-700" : "bg-teal-100 text-teal-700"}`}>
                        {inv.type === "subscription" ? "Subscription" : "Add-on"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-sm font-bold text-slate-900">{fmt(inv.amount)}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => handleDownload(inv)}
                        className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg transition"
                      >
                        📄 Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
