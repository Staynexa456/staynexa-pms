"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../supabase";
import { getUserHotels, createHotel, updateHotel, deactivateHotel, type Hotel } from "../db";
import { getActiveHotelId, setActiveHotelId } from "../active-hotel";

export default function PropertiesPage() {
  const router = useRouter();
  const [hotels, setHotels] = useState<(Hotel & { userRole?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHotel, setEditingHotel] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadHotels(); }, []);

  async function loadHotels() {
    setLoading(true);
    const data = await getUserHotels();
    setHotels(data);
    setLoading(false);
  }

  // ✅ নতুন প্রপার্টি অ্যাড করার মডাল ওপেন
  const handleAddNew = () => {
    setEditingHotel({
      name: "",
      city: "",
      state: "",
      address: "",
      phone: "",
      email: "",
      gst_number: "",
    });
    setIsModalOpen(true);
  };

  // ✅ প্রপার্টি এডিট করার মডাল ওপেন
  const handleEdit = (hotel: any) => {
    setEditingHotel({ ...hotel });
    setIsModalOpen(true);
  };

  // ✅ প্রপার্টি সেভ করা (নতুন হলে Create, পুরনো হলে Update)
  const handleSave = async () => {
    if (!editingHotel || !editingHotel.name) {
      alert("Please enter a property name.");
      return;
    }
    setSaving(true);
    try {
      if (editingHotel.id) {
        // Update
        await updateHotel(editingHotel.id, {
          name: editingHotel.name,
          city: editingHotel.city,
          state: editingHotel.state,
          address: editingHotel.address,
          phone: editingHotel.phone,
          email: editingHotel.email,
          gst_number: editingHotel.gst_number,
        });
      } else {
        // Create new
        await createHotel({
          name: editingHotel.name,
          city: editingHotel.city,
          state: editingHotel.state,
          address: editingHotel.address,
          phone: editingHotel.phone,
          email: editingHotel.email,
          gst_number: editingHotel.gst_number,
        });
      }
      await loadHotels();
      setIsModalOpen(false);
      setEditingHotel(null);
    } catch (err: any) {
      alert("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ✅ প্রপার্টি ডিলিট করা
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to deactivate this property?")) return;
    try {
      await deactivateHotel(id);
      await loadHotels();
    } catch (err: any) {
      alert("Failed to delete: " + err.message);
    }
  };

  // ✅ প্রপার্টিতে সুইচ করা
  const handleSwitch = (hotel: Hotel) => {
    setActiveHotelId(hotel.id);
    window.dispatchEvent(new CustomEvent("hotel-changed", { detail: hotel.id }));
    router.push("/");
  };

  if (loading) return <div className="p-6">Loading properties...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Properties</h1>
          <p className="text-sm text-slate-500 mt-1">Manage all your hotels from one account</p>
        </div>
        <button
          onClick={handleAddNew}
          className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold shadow-md transition"
        >
          + Add New Property
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {hotels.map((hotel) => (
          <div key={hotel.id} className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-slate-800">{hotel.name}</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${hotel.is_active !== false ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                  {hotel.is_active !== false ? "ACTIVE" : "INACTIVE"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                📍 {hotel.city || "No city"}{hotel.state ? `, ${hotel.state}` : ""}
              </p>

              <div className="space-y-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl mb-4">
                {hotel.phone && <p>📞 {hotel.phone}</p>}
                {hotel.email && <p>✉️ {hotel.email}</p>}
                {hotel.gst_number && <p>🏢 GST: {hotel.gst_number}</p>}
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => handleSwitch(hotel)}
                className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition"
              >
                Open Dashboard →
              </button>
              <button
                onClick={() => handleEdit(hotel)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(hotel.id)}
                className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-xl transition"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit/Create Modal */}
      {isModalOpen && editingHotel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
              <h2 className="text-lg font-bold text-slate-800">{editingHotel.id ? "Edit Property" : "Add New Property"}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Property Name *</label>
                <input type="text" value={editingHotel.name} onChange={(e) => setEditingHotel({ ...editingHotel, name: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none" placeholder="e.g. The Grand Palace Hotel" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">City</label>
                  <input type="text" value={editingHotel.city || ""} onChange={(e) => setEditingHotel({ ...editingHotel, city: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">State</label>
                  <input type="text" value={editingHotel.state || ""} onChange={(e) => setEditingHotel({ ...editingHotel, state: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Full Address</label>
                <input type="text" value={editingHotel.address || ""} onChange={(e) => setEditingHotel({ ...editingHotel, address: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Phone</label>
                  <input type="text" value={editingHotel.phone || ""} onChange={(e) => setEditingHotel({ ...editingHotel, phone: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Email</label>
                  <input type="email" value={editingHotel.email || ""} onChange={(e) => setEditingHotel({ ...editingHotel, email: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">GST Number (Optional)</label>
                <input type="text" value={editingHotel.gst_number || ""} onChange={(e) => setEditingHotel({ ...editingHotel, gst_number: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none" />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 sticky bottom-0">
              <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 transition">
                {saving ? "Saving..." : "Save Property"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
