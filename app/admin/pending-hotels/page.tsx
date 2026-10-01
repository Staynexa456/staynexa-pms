"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../supabase";

export default function PendingHotelsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("feature_requests")
      .select("*, hotels(name, city, email, phone, owner_id)")
      .eq("feature_code", "subscription")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) console.error("Error:", error);
    setRequests(data || []);
    setLoading(false);
  }

  async function approve(req: any) {
    if (!confirm(`Approve payment for "${req.hotels?.name}"? Hotel will be activated.`)) return;
    setProcessingId(req.id);
    try {
      // ১. হোটেল অ্যাক্টিভ করা
      const { error: hotelErr } = await supabase
        .from("hotels")
        .update({ is_active: true })
        .eq("id", req.hotel_id);
      if (hotelErr) throw hotelErr;

      // ২. সাবস্ক্রিপশন চালু করা
      await supabase
        .from("subscription_history")
        .update({ status: "active" })
        .eq("hotel_id", req.hotel_id)
        .eq("status", "pending_payment");

      // ৩. রিকোয়েস্ট স্ট্যাটাস আপডেট
      await supabase
        .from("feature_requests")
        .update({ status: "approved", payment_status: "verified" })
        .eq("id", req.id);

      // ✅ ৪. Email: হোটেল মালিককে Subscription Activated জানানো
      const ownerEmail = req.hotels?.email;
      if (ownerEmail) {
        fetch("/api/emails/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "subscriptionActivated",
            to: ownerEmail,
            data: {
              hotelName: req.hotels?.name || "Your Hotel",
              planName: req.notes?.match(/Plan: ([^.]+)/)?.[1]?.trim() || "Subscription",
              amount: req.amount_paid || 0,
            },
          }),
        }).catch((e) => console.warn("[Email] Failed:", e));
      }

      alert(`✅ ${req.hotels?.name} activated successfully!`);
      load();
    } catch (err: any) {
      alert("Failed: " + err.message);
    } finally {
      setProcessingId(null);
    }
  }

  async function reject(req: any) {
    if (!confirm(`Reject payment for "${req.hotels?.name}"?`)) return;
    setProcessingId(req.id);
    try {
      await supabase.from("feature_requests").update({ status: "rejected" }).eq("id", req.id);
      alert("Request rejected.");
      load();
    } catch (err: any) {
      alert("Failed: " + err.message);
    } finally {
      setProcessingId(null);
    }
  }

  if (loading) {
    return (
      <div className="p-6 min-h-screen bg-slate-950 text-white flex justify-center items-center">
        <div className="w-12 h-12 rounded-full border-4 border-purple-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto bg-slate-950 min-h-screen text-white">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Pending Hotel Activations</h1>
        <p className="text-sm text-slate-400 mt-1">
          Approve new hotel subscriptions. Verify UTR with your bank statement before approving.
        </p>
      </div>

      {requests.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 p-12 rounded-2xl text-center text-slate-500">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-lg font-medium">No pending hotel activations.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => {
            const isProcessing = processingId === req.id;
            return (
              <div key={req.id} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row justify-between gap-6">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-1">{req.hotels?.name}</h3>
                  <p className="text-sm text-slate-400">
                    📍 {req.hotels?.city || "No city"} · ✉ {req.hotels?.email || "No email"} · 📞 {req.hotels?.phone || "No phone"}
                  </p>

                  <div className="mt-4 bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl">
                    <p className="text-xs font-bold text-amber-400 mb-2">⚠️ Payment Awaiting Verification</p>
                    <p className="text-[11px] text-slate-300">
                      UTR: <span className="font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded">{req.payment_id}</span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Amount: <span className="font-bold text-amber-400">₹{req.amount_paid}</span>
                    </p>
                    <p className="text-[10px] text-slate-500 mt-2">
                      👉 Check bank statement. If received, click Approve.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 w-full md:w-52 shrink-0">
                  <button
                    onClick={() => approve(req)}
                    disabled={isProcessing}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition shadow-lg shadow-emerald-600/20"
                  >
                    {isProcessing ? "Processing..." : "✓ Approve & Activate"}
                  </button>
                  <button
                    onClick={() => reject(req)}
                    disabled={isProcessing}
                    className="px-6 py-3 bg-slate-800 hover:bg-rose-600 disabled:opacity-50 text-slate-300 hover:text-white rounded-xl text-sm font-bold transition"
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
