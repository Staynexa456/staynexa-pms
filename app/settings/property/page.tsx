// app/settings/property/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../supabase";

type RoomCategory = {
  id: string;
  hotel_id: string;
  room_type: string;
  description?: string;
  base_price: number;
  max_adults: number;
  max_children: number;
  max_infants: number;
  photos?: string[];
  bed_type?: string;
  room_size?: string;
  view_type?: string;
  total_rooms?: number;
  [key: string]: any;
};

export default function PropertySettingsPage() {
  const [hotelId, setHotelId] = useState<string>("");
  const [hotelName, setHotelName] = useState<string>("");
  const [categories, setCategories] = useState<RoomCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState<RoomCategory | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // ═══════════════════════════════════════════════
  // LOAD ROOMS — Uses localStorage (same as sidebar)
  // ═══════════════════════════════════════════════
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        let hId = "";
        let hName = "";

        // Priority 1: localStorage (matches sidebar)
        if (typeof window !== "undefined") {
          hId = localStorage.getItem("selected_hotel_id") || "";
          hName = localStorage.getItem("selected_hotel_name") || "";
        }

        // Priority 2: User's own hotel
        if (!hId) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: hotels } = await supabase
              .from("hotels")
              .select("id, name")
              .eq("owner_id", user.id)
              .limit(1);
            if (hotels && hotels.length > 0) {
              hId = hotels[0].id;
              hName = hotels[0].name;
            }
          }
        }

        if (!hId) {
          setLoading(false);
          return;
        }

        // Save for next visit
        if (typeof window !== "undefined") {
          localStorage.setItem("selected_hotel_id", hId);
          localStorage.setItem("selected_hotel_name", hName);
        }

        setHotelId(hId);
        setHotelName(hName);

        // Load rooms for this hotel
        const { data: rooms } = await supabase
          .from("rooms")
          .select("*")
          .eq("hotel_id", hId);

        if (rooms && rooms.length > 0) {
          const grouped: Record<string, RoomCategory> = {};
          rooms.forEach((r: any) => {
            if (!grouped[r.room_type]) {
              grouped[r.room_type] = {
                id: r.id,
                hotel_id: r.hotel_id,
                room_type: r.room_type,
                description: r.description || "",
                base_price: r.base_price || 0,
                max_adults: r.max_adults ?? 2,
                max_children: r.max_children ?? 0,
                max_infants: r.max_infants ?? 0,
                photos: r.photos || [],
                bed_type: r.bed_type,
                room_size: r.room_size,
                view_type: r.view_type,
                total_rooms: 0,
              };
            }
            grouped[r.room_type].total_rooms = (grouped[r.room_type].total_rooms || 0) + 1;
          });
          setCategories(Object.values(grouped));
        } else {
          setCategories([]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ═══════════════════════════════════════════════
  // SAVE
  // ═══════════════════════════════════════════════
  const handleSave = async () => {
    if (!editModal || !hotelId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("rooms")
        .update({
          description: editModal.description,
          base_price: editModal.base_price,
          max_adults: editModal.max_adults,
          max_children: editModal.max_children,
          max_infants: editModal.max_infants,
          bed_type: editModal.bed_type,
          room_size: editModal.room_size,
          view_type: editModal.view_type,
        })
        .eq("hotel_id", hotelId)
        .eq("room_type", editModal.room_type);

      if (error) throw error;

      setMessage(`✓ ${editModal.room_type} updated!`);
      setTimeout(() => setMessage(null), 3000);

      setCategories(prev => prev.map(c =>
        c.room_type === editModal.room_type ? { ...c, ...editModal } : c
      ));
      setEditModal(null);
    } catch (err: any) {
      setMessage(`⚠️ Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-teal-500 border-t-transparent animate-spin" />
          <p className="text-slate-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Property Details</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage room types, photos, capacity, amenities and pricing
          </p>
          {hotelName && (
            <div className="mt-3 inline-flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-full px-4 py-1.5">
              <span className="text-teal-600">🏨</span>
              <span className="text-xs font-bold text-teal-800">{hotelName}</span>
            </div>
          )}
        </div>

        {message && (
          <div className={`p-4 rounded-xl mb-6 text-sm font-bold ${
            message.startsWith('✓')
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}>
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((cat) => (
            <div key={cat.room_type} className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-lg transition">
              <div className="h-48 bg-slate-100 relative">
                {cat.photos?.[0] ? (
                  <img src={cat.photos[0]} alt={cat.room_type} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl text-slate-300">🛏️</div>
                )}
                <span className="absolute top-3 right-3 bg-white/95 px-3 py-1 rounded-full text-xs font-bold text-slate-800 shadow">
                  ₹{cat.base_price.toLocaleString("en-IN")}
                </span>
                <span className="absolute top-3 left-3 bg-slate-900/80 text-white px-3 py-1 rounded-full text-[10px] font-bold">
                  {cat.total_rooms} Room{(cat.total_rooms || 0) !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="p-5">
                <h3 className="text-lg font-serif font-bold text-slate-900 mb-1">{cat.room_type}</h3>
                <p className="text-xs text-slate-500 mb-3 line-clamp-2">
                  {cat.description || `Comfortable ${cat.room_type}`}
                </p>
                <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-600 mb-3 flex-wrap">
                  {cat.bed_type && <span className="bg-slate-100 px-2 py-1 rounded-md">🛏️ {cat.bed_type}</span>}
                  {cat.room_size && <span className="bg-slate-100 px-2 py-1 rounded-md">📐 {cat.room_size}</span>}
                  {cat.view_type && <span className="bg-slate-100 px-2 py-1 rounded-md">👁️ {cat.view_type}</span>}
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold text-slate-600 mb-4 flex-wrap">
                  <span>👤 {cat.max_adults}A</span>
                  <span>🧒 {cat.max_children}C</span>
                  <span>🍼 {cat.max_infants}I</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditModal(cat)}
                    className="flex-1 py-2.5 bg-teal-500 text-white rounded-xl text-xs font-bold uppercase hover:bg-teal-600 transition"
                  >
                    ✏️ Edit
                  </button>
                  <button className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition">
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}

          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center p-8 min-h-[380px]">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-2xl mb-3">+</div>
            <p className="text-sm font-bold text-slate-700">Create New Room Type</p>
            <p className="text-xs text-slate-400 mt-1">Setup a new category</p>
          </div>
        </div>
      </div>

      {editModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Edit {editModal.room_type}</h3>
                <p className="text-xs text-slate-500">Update details and capacity</p>
              </div>
              <button onClick={() => setEditModal(null)} className="w-8 h-8 rounded-full bg-white border flex items-center justify-center text-slate-400">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase block mb-2">📝 Description</label>
                <textarea
                  value={editModal.description}
                  onChange={(e) => setEditModal({ ...editModal, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">🛏️ Bed</label>
                  <input
                    type="text"
                    value={editModal.bed_type || ""}
                    onChange={(e) => setEditModal({ ...editModal, bed_type: e.target.value })}
                    placeholder="King Bed"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">📐 Size</label>
                  <input
                    type="text"
                    value={editModal.room_size || ""}
                    onChange={(e) => setEditModal({ ...editModal, room_size: e.target.value })}
                    placeholder="300 sqft"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">👁️ View</label>
                  <input
                    type="text"
                    value={editModal.view_type || ""}
                    onChange={(e) => setEditModal({ ...editModal, view_type: e.target.value })}
                    placeholder="City View"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase block mb-2">💰 Base Price (₹)</label>
                <input
                  type="number"
                  value={editModal.base_price}
                  onChange={(e) => setEditModal({ ...editModal, base_price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500"
                />
              </div>

              <div className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-2xl p-5 border-2 border-teal-200">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center text-white text-sm">👥</div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Maximum Capacity</h4>
                    <p className="text-[10px] text-slate-500">Applies in booking engine</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-2">Max Adults *</label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setEditModal({ ...editModal, max_adults: Math.max(1, editModal.max_adults - 1) })}
                        className="w-10 h-10 rounded-xl border-2 border-slate-200 bg-white font-bold text-slate-600 hover:border-teal-400"
                      >−</button>
                      <input
                        type="number"
                        value={editModal.max_adults}
                        onChange={(e) => setEditModal({ ...editModal, max_adults: parseInt(e.target.value) || 1 })}
                        min={1}
                        max={20}
                        className="flex-1 text-center text-xl font-bold py-2 border-2 border-slate-200 rounded-xl outline-none focus:border-teal-500 bg-white"
                      />
                      <button
                        onClick={() => setEditModal({ ...editModal, max_adults: editModal.max_adults + 1 })}
                        className="w-10 h-10 rounded-xl border-2 border-slate-200 bg-white font-bold text-slate-600 hover:border-teal-400"
                      >+</button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-2">Max Children</label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setEditModal({ ...editModal, max_children: Math.max(0, editModal.max_children - 1) })}
                        className="w-10 h-10 rounded-xl border-2 border-slate-200 bg-white font-bold text-slate-600 hover:border-teal-400"
                      >−</button>
                      <input
                        type="number"
                        value={editModal.max_children}
                        onChange={(e) => setEditModal({ ...editModal, max_children: parseInt(e.target.value) || 0 })}
                        min={0}
                        max={20}
                        className="flex-1 text-center text-xl font-bold py-2 border-2 border-slate-200 rounded-xl outline-none focus:border-teal-500 bg-white"
                      />
                      <button
                        onClick={() => setEditModal({ ...editModal, max_children: editModal.max_children + 1 })}
                        className="w-10 h-10 rounded-xl border-2 border-slate-200 bg-white font-bold text-slate-600 hover:border-teal-400"
                      >+</button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-2">Max Infants</label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setEditModal({ ...editModal, max_infants: Math.max(0, editModal.max_infants - 1) })}
                        className="w-10 h-10 rounded-xl border-2 border-slate-200 bg-white font-bold text-slate-600 hover:border-teal-400"
                      >−</button>
                      <input
                        type="number"
                        value={editModal.max_infants}
                        onChange={(e) => setEditModal({ ...editModal, max_infants: parseInt(e.target.value) || 0 })}
                        min={0}
                        max={10}
                        className="flex-1 text-center text-xl font-bold py-2 border-2 border-slate-200 rounded-xl outline-none focus:border-teal-500 bg-white"
                      />
                      <button
                        onClick={() => setEditModal({ ...editModal, max_infants: editModal.max_infants + 1 })}
                        className="w-10 h-10 rounded-xl border-2 border-slate-200 bg-white font-bold text-slate-600 hover:border-teal-400"
                      >+</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 border-t bg-slate-50 flex gap-3">
              <button onClick={() => setEditModal(null)} className="px-6 py-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-600">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 bg-teal-600 text-white rounded-xl text-xs font-bold uppercase hover:bg-teal-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Update"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
