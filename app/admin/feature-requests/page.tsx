"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../supabase";
import { formatInvoiceDate } from "../../lib/invoice-generator";

export default function FeatureRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("feature_requests")
      .select("*, hotels(name, email), feature_modules(name, price_monthly)")
      .eq("status", "pending")
      .order("requested_at", { ascending: false });

    if (error) console.error("Error loading requests:", error);
    else setRequests(data || []);
    setLoading(false);
  }

  async function approve(req: any) {
    if (!confirm(`Are you sure you want to approve ${req.feature_modules?.name} for ${req.hotels?.name}?`)) return;

    setProcessingId(req.id);
    try {
      const { error: reqError } = await supabase
        .from("feature_requests")
        .update({ status: "approved", payment_status: "verified" })
        .eq("id", req.id);
      if (reqError) throw reqError;

      const { error: featureError } = await supabase.from("hotel_features").upsert({
        hotel_id: req.hotel_id,
        feature_code: req.feature_code,
        is_enabled: true,
        purchased_at: new Date().toISOString(),
      }, { onConflict: "hotel_id,feature_code" });
      if (featureError) throw featureError;

      // ✅ Email: Addon Activated
      const featureEmail = req.hotels?.email;
      if (featureEmail) {
        fetch("/api/emails/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "addonPurchased",
            to: featureEmail,
            data: {
              hotelName: req.hotels?.name || "Your Hotel",
              addonName: req.feature_modules?.name || "Add-on",
              amount: req.amount_paid || 0,
            },
          }),
        }).catch((e) => console.warn("[Email] Failed:", e));

        // ✅ Invoice Email
        const invoiceNumber = `ADD-${String(req.id).slice(-8).toUpperCase()}`;
        fetch("/api/emails/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "invoiceGenerated",
            to: featureEmail,
            data: {
              hotelName: req.hotels?.name || "Your Hotel",
              invoiceNumber,
              amount: req.amount_paid || 0,
              planName: req.feature_modules?.name || "Add-on",
              invoiceDate: formatInvoiceDate(new Date().toISOString()),
              type: "addon",
            },
          }),
        }).catch((e) => console.warn("[Email] Invoice failed:", e));
      }

      load();
    } catch (err: any) {
      alert("Failed to approve: " + err.message);
    } finally {
      setProcessingId(null);
    }
  }

  async function reject(req: any) {
    if (!confirm(`Are you sure you want to reject this request?`)) return;

    setProcessingId(req.id);
    try {
      const { error } = await supabase
        .from("feature_requests")
        .update({ status: "rejected" })
        .eq("id", req.id);
      if (error) throw error;
      load();
    } catch (err: any) {
      alert("Failed to reject: " + err.message);
    } finally {
      setProcessingId(null);
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto min-h-screen bg-slate-950 text-white flex justify-center items-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-purple-500 border-t-transparent animate-spin" />
          <p className="text-slate-400">Loading requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto bg-slate-950 min-h-screen text-white">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Feature Requests</h1>
        <p className="text-sm text-slate-400 mt-1">Approve or reject feature requests from hotels. Verify UTR numbers before approval.</p>
      </div>

      {requests.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 p-12 rounded-2xl text-center text-slate-500">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-lg font-medium">No pending feature requests.</p>
          <p className="text-sm mt-1">When a hotel requests a new feature, it will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => {
            const isProcessing = processingId === req.id;
            return (
              <div key={req.id} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-bold text-xl text-white">{req.hotels?.name}</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase">Pending</span>
                  </div>

                  <p className="text-sm text-slate-400">
                    Requested Feature: <span className="font-semibold text-teal-400">{req.feature_modules?.name}</span>
                  </p>

                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                    <span>Price: ₹{req.feature_modules?.price_monthly}/month</span>
                    <span>•</span>
                    <span>Date: {new Date(req.requested_at).toLocaleDateString()}</span>
                  </div>

                  <div className="mt-4">
                    {req.payment_status === 'pending_verification' ? (
                      <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl inline-block">
                        <p className="text-xs font-bold text-amber-400 mb-1">⚠️ Payment Awaiting Verification</p>
                        <p className="text-[11px] text-slate-300">
                          UTR / Transaction ID: <span className="font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded">{req.payment_id}</span>
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Amount Paid: <span className="font-bold text-amber-400">₹{req.amount_paid}</span>
                        </p>
                        <p className="text-[10px] text-slate-500 mt-2">
                          👉 Check your bank statement. If the amount matches, click Approve.
                        </p>
                      </div>
                    ) : req.payment_status === 'paid' || req.payment_status === 'verified' ? (
                      <span className="inline-block text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-lg">
                        💰 Payment Received & Verified
                      </span>
                    ) : (
                      <span className="inline-block text-xs font-bold text-slate-400 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                        ⏳ No Payment Information
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 w-full md:w-auto shrink-0">
                  <button
                    onClick={() => approve(req)}
                    disabled={isProcessing}
                    className="flex-1 md:flex-none px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition shadow-lg shadow-emerald-600/20"
                  >
                    {isProcessing ? "Processing..." : "✓ Approve & Enable"}
                  </button>
                  <button
                    onClick={() => reject(req)}
                    disabled={isProcessing}
                    className="flex-1 md:flex-none px-6 py-3 bg-slate-800 hover:bg-rose-600 disabled:opacity-50 text-slate-300 hover:text-white rounded-xl text-sm font-bold transition"
                  >
                    ✕ Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
