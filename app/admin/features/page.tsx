"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase"; // আপনার Supabase পাথ অনুযায়ী পরিবর্তন করুন

export default function AdminFeaturesPage() {
  const [modules, setModules] = useState<any[]>([]);
  const [selectedHotel, setSelectedHotel] = useState<string>("");
  const [hotels, setHotels] = useState<any[]>([]);
  const [hotelFeatures, setHotelFeatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (selectedHotel) loadHotelFeatures(); }, [selectedHotel]);

  async function loadData() {
    setLoading(true);
    const { data: m } = await supabase.from("feature_modules").select("*").order("display_order");
    const { data: h } = await supabase.from("hotels").select("id, name").order("name");
    setModules(m || []);
    setHotels(h || []);
    setLoading(false);
  }

  async function loadHotelFeatures() {
    const { data } = await supabase.from("hotel_features").select("*").eq("hotel_id", selectedHotel);
    setHotelFeatures(data || []);
  }

  async function toggleFeature(featureCode: string) {
    const existing = hotelFeatures.find(f => f.feature_code === featureCode);
    if (existing) {
      await supabase.from("hotel_features").update({ is_enabled: !existing.is_enabled }).eq("id", existing.id);
    } else {
      await supabase.from("hotel_features").insert({
        hotel_id: selectedHotel,
        feature_code: featureCode,
        is_enabled: true,
        purchased_at: new Date().toISOString(),
      });
    }
    loadHotelFeatures();
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Feature Management</h1>
        <p className="text-sm text-slate-500">Enable or disable features for specific hotels.</p>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 mb-6">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Select Hotel</label>
        <select 
          value={selectedHotel} 
          onChange={(e) => setSelectedHotel(e.target.value)} 
          className="w-full max-w-md p-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none"
        >
          <option value="">-- Choose a Hotel --</option>
          {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </div>

      {selectedHotel && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map(m => {
            const isEnabled = hotelFeatures.find(f => f.feature_code === m.code)?.is_enabled;
            return (
              <div key={m.code} className={`p-5 border-2 rounded-2xl transition-all ${isEnabled ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-2xl mb-1">{m.icon}</p>
                    <h3 className="font-bold text-lg text-slate-800">{m.name}</h3>
                    <p className="text-xs text-slate-500 mb-2">{m.description}</p>
                    <p className="text-sm font-semibold text-slate-700">₹{m.price_monthly}/month</p>
                  </div>
                  <button
                    onClick={() => toggleFeature(m.code)}
                    className={`px-3 py-1.5 rounded-lg text-white text-xs font-bold transition ${isEnabled ? "bg-rose-500 hover:bg-rose-600" : "bg-emerald-600 hover:bg-emerald-700"}`}
                  >
                    {isEnabled ? "Disable" : "Enable"}
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
