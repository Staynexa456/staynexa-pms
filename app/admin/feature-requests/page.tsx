"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../supabase";

export default function FeatureRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("feature_requests")
      .select("*, hotels(name), feature_modules(name, price_monthly)")
      .eq("status", "pending")
      .order("requested_at", { ascending: false });
    setRequests(data || []);
    setLoading(false);
  }

  async function approve(req: any) {
    try {
      await supabase.from("feature_requests").update({ status: "approved" }).eq("id", req.id);
      await supabase.from("hotel_features").upsert({
        hotel_id: req.hotel_id,
        feature_code: req.feature_code,
        is_enabled: true,
        purchased_at: new Date().toISOString(),
      }, { onConflict: "hotel_id,feature_code" });
      load();
    } catch (err) {
      console.error(err);
      alert("Failed to approve request.");
    }
  }

  async function reject(req: any) {
    await supabase.from("feature_requests").update({ status: "rejected" }).eq("id", req.id);
    load();
  }

  if (loading) return <div className="p-6">Loading requests...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Feature Requests</h1>
        <p className="text-sm text-slate-500">Approve or reject feature requests from hotels.</p>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500">
          No pending feature requests.
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(r => (
            <div key={r.id} className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
              <div>
                <p className="font-bold text-lg text-slate-800">{r.hotels?.name}</p>
                <p className="text-sm text-slate-600 mt-1">
                  Requested: <span className="font-semibold text-teal-700">{r.feature_modules?.name}</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">Price: ₹{r.feature_modules?.price_monthly}/month</p>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <button onClick={() => approve(r)} className="flex-1 md:flex-none px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition">
                  Approve
                </button>
                <button onClick={() => reject(r)} className="flex-1 md:flex-none px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-sm font-bold transition">
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
