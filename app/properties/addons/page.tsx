"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useActiveHotel } from "@/lib/use-active-hotel"; // আপনার হুকের পাথ অনুযায়ী পরিবর্তন করুন

export default function HotelAddonsPage() {
  const { hotelId } = useActiveHotel();
  const [modules, setModules] = useState<any[]>([]);
  const [myFeatures, setMyFeatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (hotelId) load(); }, [hotelId]);

  async function load() {
    setLoading(true);
    const { data: m } = await supabase.from("feature_modules").select("*").eq("is_active", true).order("display_order");
    const { data: f } = await supabase.from("hotel_features").select("*").eq("hotel_id", hotelId);
    setModules(m || []);
    setMyFeatures(f || []);
    setLoading(false);
  }

  async function requestFeature(featureCode: string) {
    try {
      await supabase.from("feature_requests").insert({
        hotel_id: hotelId,
        feature_code: featureCode,
        status: "pending",
      });
      alert("Request sent successfully! Admin will review it shortly.");
    } catch (err) {
      alert("Failed to send request. Please try again.");
    }
  }

  if (loading) return <div className="p-6">Loading add-ons...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Add-ons & Features</h1>
        <p className="text-sm text-slate-500 mt-1">Select the features you want to enable for your hotel. Requests will be reviewed by the admin.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {modules.map(m => {
          const owned = myFeatures.find(f => f.feature_code === m.code && f.is_enabled);
          return (
            <div key={m.code} className={`p-6 border-2 rounded-2xl flex flex-col justify-between transition-all ${owned ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white hover:shadow-lg"}`}>
              <div>
                <p className="text-3xl mb-3">{m.icon}</p>
                <h3 className="font-bold text-lg text-slate-800">{m.name}</h3>
                <p className="text-xs text-slate-500 mb-5 leading-relaxed">{m.description}</p>
              </div>
              <div>
                <p className="font-bold text-slate-800 mb-3 text-lg">₹{m.price_monthly}<span className="text-sm font-normal text-slate-500">/month</span></p>
                {owned ? (
                  <span className="block text-center text-emerald-700 font-bold text-sm bg-emerald-100 py-3 rounded-xl">✓ Active</span>
                ) : (
                  <button
                    onClick={() => requestFeature(m.code)}
                    className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-sm transition shadow-md shadow-teal-600/20"
                  >
                    Request to Buy
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
