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
  amenities?: string[];
  bed_type?: string;
  room_size?: string;
  view_type?: string;
  total_rooms?: number;
};

type Hotel = {
  id: string;
  name: string;
  room_count?: number;
};

export default function PropertySettingsPage() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [hotelId, setHotelId] = useState<string>("");
  const [hotelName, setHotelName] = useState<string>("");
  const [categories, setCategories] = useState<RoomCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState<RoomCategory | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  // ═══════════════════════════════════════════════
  // STEP 1: LOAD HOTELS AND PICK THE BEST ONE
  // ═══════════════════════════════════════════════
  useEffect(() => {
    async function loadHotels() {
      const logs: string[] = [];
      try {
        logs.push("🚀 Loading hotels...");

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        logs.push(`👤 User: ${user?.id || "NOT LOGGED IN"}`);

        // Fetch ALL hotels with room counts
        const { data: allHotels, error: hotelsErr } = await supabase
          .from("hotels")
          .select("id, name, owner_id")
          .order("name");

        if (hotelsErr) {
          logs.push(`❌ Hotels error: ${hotelsErr.message}`);
          setDebugLog(logs);
          setLoading(false);
          return;
        }

        logs.push(`📊 Total hotels: ${allHotels?.length || 0}`);

        if (!allHotels || allHotels.length === 0) {
          logs.push("❌ NO HOTELS IN DATABASE");
          setDebugLog(logs);
          setLoading(false);
          return;
        }

        // For each hotel, get room count
        const hotelsWithCount: Hotel[] = [];
        for (const h of allHotels) {
          const { count } = await supabase
            .from("rooms")
            .select("id", { count: "exact", head: true })
            .eq("hotel_id", h.id);
          hotelsWithCount.push({
            id: h.id,
            name: h.name,
            room_count: count || 0,
          });
          logs.push(`  • ${h.name}: ${count || 0} rooms${h.owner_id === user?.id ? " ⭐ (Your hotel)" : ""}`);
        }

        setHotels(hotelsWithCount);

        // ═══ SMART SELECTION LOGIC ═══
        // Priority: 1) Saved in localStorage, 2) User's own hotel, 3) Hotel with most rooms
        let selectedHotel: Hotel | null = null;
        
        // Priority 1: localStorage
        const savedHotelId = typeof window !== "undefined" 
          ? localStorage.getItem("selected_hotel_id") 
          : null;
        
        if (savedHotelId) {
          const saved = hotelsWithCount.find(h => h.id === savedHotelId);
          if (saved && (saved.room_count || 0) > 0) {
            selectedHotel = saved;
            logs.push(`✓ Using saved hotel: ${saved.name}`);
          }
        }

        // Priority 2: User's own hotel (owner_id matches)
        if (!selectedHotel && user) {
          const ownHotel = allHotels.find(h => h.owner_id === user.id);
          if (ownHotel) {
            const ownHotelWithCount = hotelsWithCount.find(h => h.id === ownHotel.id);
            if (ownHotelWithCount && (ownHotelWithCount.room_count || 0) > 0) {
              selectedHotel = ownHotelWithCount;
              logs.push(`✓ Using YOUR hotel: ${ownHotel.name}`);
            }
          }
        }

        // Priority 3: Hotel with most rooms
        if (!selectedHotel) {
          const withRooms = hotelsWithCount.filter(h => (h.room_count || 0) > 0);
          if (withRooms.length > 0) {
            selectedHotel = withRooms.sort((a, b) => (b.room_count || 0) - (a.room_count || 0))[0];
            logs.push(`✓ Using hotel with most rooms: ${selectedHotel.name} (${selectedHotel.room_count} rooms)`);
          }
        }

        // Fallback: Just use first hotel
        if (!selectedHotel) {
          selectedHotel = hotelsWithCount[0];
          logs.push(`⚠️ Fallback: ${selectedHotel.name}`);
        }

        setHotelId(selectedHotel.id);
        setHotelName(selectedHotel.name);
        
        if (typeof window !== "undefined") {
          localStorage.setItem("selected_hotel_id", selectedHotel.id);
          localStorage.setItem("selected_hotel_name", selectedHotel.name);
        }

        setDebugLog(logs);
      } catch (err: any) {
        logs.push(`💥 Exception: ${err?.message}`);
        setDebugLog(logs);
        setLoading(false);
      }
    }
    loadHotels();
  }, []);

  // ═══════════════════════════════════════════════
  // STEP 2: LOAD ROOMS FOR SELECTED HOTEL
  // ═══════════════════════════════════════════════
  useEffect(() => {
    async function loadRooms() {
      if (!hotelId) return;
      const logs = [...debugLog];
      try {
        logs.push(`🚪 Loading rooms for: ${hotelId}`);

        const { data: rooms, error: roomErr } = await supabase
          .from("rooms")
          .select("*")
          .eq("hotel_id", hotelId)
          .order("room_type");

        if (roomErr) {
          logs.push(`❌ Room error: ${roomErr.message}`);
          setDebugLog(logs);
          setLoading(false);
          return;
        }

        logs.push(`✅ Rooms loaded: ${rooms?.length || 0}`);

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
                amenities: r.amenities || [],
                bed_type: r.bed_type,
                room_size: r.room_size,
                view_type: r.view_type,
                total_rooms: 0,
              };
            }
            grouped[r.room_type].total_rooms = (grouped[r.room_type].total_rooms || 0) + 1;
          });
          setCategories(Object.values(grouped));
          logs.push(`📦 Categories: ${Object.keys(grouped).length}`);
        } else {
          setCategories([]);
          logs.push("⚠️ No rooms found");
        }

        setDebugLog(logs);
      } catch (err: any) {
        logs.push(`💥 Room exception: ${err?.message}`);
        setDebugLog(logs);
      } finally {
        setLoading(false);
      }
    }
    loadRooms();
  }, [hotelId]);

  // ═══════════════════════════════════════════════
  // HOTEL CHANGE
  // ═══════════════════════════════════════════════
  const handleHotelChange = (newHotelId: string) => {
    const picked = hotels.find(h => h.id === newHotelId);
    if (!picked) return;
    setHotelId(newHotelId);
    setHotelName(picked.name);
    setLoading(true);
    setCategories([]);
    if (typeof window !== "undefined") {
      localStorage.setItem("selected_hotel_id", newHotelId);
      localStorage.setItem("selected_hotel_name", picked.name);
    }
  };

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
          max_adults: editModal.max_adults,
          max_children: editModal.max_children,
          max_infants: editModal.max_infants,
          base_price: editModal.base_price,
          description: editModal.description,
        })
        .eq("hotel_id", hotelId)
        .eq("room_type", editModal.room_type);

      if (error) throw error;

      setMessage(`✓ ${editModal.room_type} saved successfully!`);
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
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="mb-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Property Details</h1>
              <p className="text-sm text-slate-500 mt-1">
                Manage room types, capacity, amenities and pricing
              </p>
            </div>
          </div>

          {/* HOTEL SELECTOR */}
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              🏨 Hotel:
            </label>
            <select
              value={hotelId}
              onChange={(e) => handleHotelChange(e.target.value)}
              className="px-4 py-2 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-teal-500 min-w-[200px]"
            >
              {hotels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({(h.room_count || 0)} rooms)
                </option>
              ))}
            </select>
            {categories.length > 0 && (
              <span className="text-xs font-bold text-teal-600 bg-teal-50 px-3 py-1.5 rounded-full">
                ✓ {categories.length} Room Type{categories.length !== 1 ? 's' : ''} Loaded
              </span>
            )}
          </div>
        </div>

        {/* DEBUG */}
        <details className="mb-6 bg-white rounded-xl p-3 border border-slate-200">
          <summary className="text-xs text-slate-500 cursor-pointer font-mono font-semibold">
            🔍 Debug Info ({debugLog.length})
          </summary>
          <div className="text-[10px] text-slate-600 mt-2 space-y-1 font-mono max-h-60 overflow-y-auto">
            {debugLog.map((log, i) => (
              <div key={i} className="leading-relaxed">{log}</div>
            ))}
          </div>
        </details>

        {message && (
          <div className={`p-4 rounded-xl mb-6 text-sm font-bold ${message.startsWith('✓') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
            {message}
          </div>
        )}

        {/* EMPTY STATE */}
        {categories.length === 0 && (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-2xl shrink-0">⚠️</div>
              <div>
                <p className="text-base font-bold text-amber-900 mb-2">
                  No Room Types Found
                </p>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Selected hotel: <strong>{hotelName}</strong><br />
                  Hotel ID: <code className="bg-amber-100 px-1 rounded text-[10px]">{hotelId}</code>
                </p>
                <p className="text-xs text-amber-800 mt-3">
                  Try changing the hotel from the dropdown above. Hotels with 0 rooms will show empty.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ROOM CARDS */}
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
                  {cat.total_rooms} Room{cat.total_rooms !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="p-5">
                <h3 className="text-lg font-serif font-bold text-slate-900 mb-1">{cat.room_type}</h3>
                <p className="text-xs text-slate-500 mb-3 line-clamp-2">{cat.description || "No description"}</p>

                <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 mb-4 flex-wrap">
                  <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full">👤 {cat.max_adults}A</span>
                  <span className="bg-pink-50 text-pink-700 px-2 py-1 rounded-full">🧒 {cat.max_children}C</span>
                  <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded-full">🍼 {cat.max_infants}I</span>
                </div>

                <button
                  onClick={() => setEditModal(cat)}
                  className="w-full py-2.5 bg-teal-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-teal-600 transition"
                >
                  ✏️ Edit Capacity & Details
                </button>
              </div>
            </div>
          ))}

          {categories.length > 0 && (
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center p-8 hover:border-teal-400 transition cursor-pointer min-h-[300px]">
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-2xl mb-3">+</div>
              <p className="text-sm font-bold text-slate-700">Create New Room Type</p>
              <p className="text-xs text-slate-400 mt-1 text-center">Setup a new category</p>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/* EDIT MODAL */}
      {/* ═══════════════════════════════════════════════ */}
      {editModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Edit {editModal.room_type}</h3>
                <p className="text-xs text-slate-500">Set capacity, pricing, and details</p>
              </div>
              <button onClick={() => setEditModal(null)} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-800">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-2">Base Price per Night (₹)</label>
                <input 
                  type="number"
                  value={editModal.base_price}
                  onChange={(e) => setEditModal({ ...editModal, base_price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-2">Description</label>
                <textarea 
                  value={editModal.description}
                  onChange={(e) => setEditModal({ ...editModal, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-teal-500 resize-none"
                />
              </div>

              <div className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-2xl p-5 border-2 border-teal-200">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center text-white font-bold text-sm">👥</div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Maximum Capacity</h4>
                    <p className="text-[10px] text-slate-500">Auto-applies in booking engine</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-2">
                      Max Adults <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setEditModal({ ...editModal, max_adults: Math.max(1, editModal.max_adults - 1) })}
                        className="w-10 h-10 rounded-xl border-2 border-slate-200 bg-white flex items-center justify-center text-lg font-bold text-slate-600 hover:border-teal-400 hover:text-teal-600 transition"
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
                        className="w-10 h-10 rounded-xl border-2 border-slate-200 bg-white flex items-center justify-center text-lg font-bold text-slate-600 hover:border-teal-400 hover:text-teal-600 transition"
                      >+</button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-2">Max Children</label>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setEditModal({ ...editModal, max_children: Math.max(0, editModal.max_children - 1) })}
                        className="w-10 h-10 rounded-xl border-2 border-slate-200 bg-white flex items-center justify-center text-lg font-bold text-slate-600 hover:border-teal-400 hover:text-teal-600 transition"
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
                        className="w-10 h-10 rounded-xl border-2 border-slate-200 bg-white flex items-center justify-center text-lg font-bold text-slate-600 hover:border-teal-400 hover:text-teal-600 transition"
                      >+</button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-2">Max Infants</label>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setEditModal({ ...editModal, max_infants: Math.max(0, editModal.max_infants - 1) })}
                        className="w-10 h-10 rounded-xl border-2 border-slate-200 bg-white flex items-center justify-center text-lg font-bold text-slate-600 hover:border-teal-400 hover:text-teal-600 transition"
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
                        className="w-10 h-10 rounded-xl border-2 border-slate-200 bg-white flex items-center justify-center text-lg font-bold text-slate-600 hover:border-teal-400 hover:text-teal-600 transition"
                      >+</button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-white border border-amber-200 rounded-lg">
                  <p className="text-[10px] text-amber-800 leading-relaxed">
                    <strong>ℹ️ Note:</strong> এই লিমিট বুকিং ইঞ্জিনে অটোমেটিক প্রয়োগ হবে। গেস্ট এর বেশি Adults/Children সিলেক্ট করতে পারবে না।
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 border-t border-slate-100 bg-slate-50 flex gap-3">
              <button 
                onClick={() => setEditModal(null)} 
                className="px-6 py-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-white transition"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave} 
                disabled={saving}
                className="flex-1 py-3 bg-teal-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-teal-700 transition disabled:opacity-50"
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