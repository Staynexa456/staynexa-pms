"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../supabase";

export default function AdminFeaturesPage() {
  const [modules, setModules] = useState<any[]>([]);
  const [selectedHotel, setSelectedHotel] = useState<string>("");
  const [hotels, setHotels] = useState<any[]>([]);
  const [hotelFeatures, setHotelFeatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Edit Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<any>(null);
  const [saving, setSaving] = useState(false);

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

  // ✅ Edit বাটনে ক্লিক করলে মডাল ওপেন করা
  const handleEditClick = (module: any) => {
    setEditingFeature({ ...module }); // কপি করা হচ্ছে যাতে সঠিকভাবে এডিট করা যায়
    setIsEditModalOpen(true);
  };

  // ✅ ফিচার সেভ করা (Supabase-এ আপডেট করা)
  const handleSaveFeature = async () => {
    if (!editingFeature) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("feature_modules")
        .update({
          name: editingFeature.name,
          description: editingFeature.description,
          price_monthly: Number(editingFeature.price_monthly),
          price_yearly: Number(editingFeature.price_yearly),
          icon: editingFeature.icon,
          is_active: editingFeature.is_active,
        })
        .eq("id", editingFeature.id);

      if (error) throw error;
      
      await loadData(); // ডেটা রিফ্রেশ করা
      setIsEditModalOpen(false);
      setEditingFeature(null);
    } catch (err: any) {
      alert("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Feature Management</h1>
        <p className="text-sm text-slate-500">Enable or disable features for specific hotels. Click Edit to change pricing/names.</p>
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
                  <div className="flex-1">
                    <p className="text-2xl mb-1">{m.icon}</p>
                    <h3 className="font-bold text-lg text-slate-800">{m.name}</h3>
                    <p className="text-xs text-slate-500 mb-2">{m.description}</p>
                    <p className="text-sm font-semibold text-slate-700">₹{m.price_monthly}/month</p>
                  </div>
                  
                  {/* ✅ Edit এবং Enable/Disable বাটন */}
                  <div className="flex flex-col gap-2 ml-2">
                    <button
                      onClick={() => handleEditClick(m)}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => toggleFeature(m.code)}
                      className={`px-3 py-1.5 rounded-lg text-white text-xs font-bold transition ${isEnabled ? "bg-rose-500 hover:bg-rose-600" : "bg-emerald-600 hover:bg-emerald-700"}`}
                    >
                      {isEnabled ? "Disable" : "Enable"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ✅ Edit Feature Modal */}
      {isEditModalOpen && editingFeature && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)} />
          
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">Edit Feature Module</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Feature Name</label>
                <input
                  type="text"
                  value={editingFeature.name}
                  onChange={(e) => setEditingFeature({ ...editingFeature, name: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Description</label>
                <textarea
                  value={editingFeature.description || ""}
                  onChange={(e) => setEditingFeature({ ...editingFeature, description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Monthly Price (₹)</label>
                  <input
                    type="number"
                    value={editingFeature.price_monthly}
                    onChange={(e) => setEditingFeature({ ...editingFeature, price_monthly: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Yearly Price (₹)</label>
                  <input
                    type="number"
                    value={editingFeature.price_yearly}
                    onChange={(e) => setEditingFeature({ ...editingFeature, price_yearly: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Icon (Emoji)</label>
                  <input
                    type="text"
                    value={editingFeature.icon}
                    onChange={(e) => setEditingFeature({ ...editingFeature, icon: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none"
                  />
                </div>
                <div className="flex items-center mt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingFeature.is_active}
                      onChange={(e) => setEditingFeature({ ...editingFeature, is_active: e.target.checked })}
                      className="w-5 h-5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Active in list</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveFeature}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 transition"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
