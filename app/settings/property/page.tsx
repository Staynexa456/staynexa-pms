// app/settings/property/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../supabase";

type RoomCategory = {
  id: string;
  hotel_id: string;
  room_type: string;
  description?: string;
  short_description?: string;
  base_price: number;
  max_adults: number;
  max_children: number;
  max_infants: number;
  photos?: string[];
  amenities?: string[];
  bed_type?: string;
  bed_count?: number;
  room_size?: string;
  view_type?: string;
  total_rooms?: number;
  [key: string]: any;
};

type Hotel = {
  id: string;
  name: string;
  owner_id?: string;
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

  // ═══════════════════════════════════════════════
  // LOAD EVERYTHING
  // ═══════════════════════════════════════════════
  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        const { data: allHotels } = await supabase
          .from("hotels")
          .select("id, name, owner_id")
          .order("name");

        if (!allHotels || allHotels.length === 0) {
          setLoading(false);
          return;
        }

        // Count rooms per hotel
        const hotelsWithCount: Hotel[] = [];
        for (const h of allHotels) {
          const { count } = await supabase
            .from("rooms")
            .select("id", { count: "exact", head: true })
            .eq("hotel_id", h.id);
          hotelsWithCount.push({
            id: h.id,
            name: h.name,
            owner_id: h.owner_id,
            room_count: count || 0,
          });
        }
        setHotels(hotelsWithCount);

        // Auto-select user's hotel with rooms
        let selected: Hotel | null = null;
        if (user) {
          const own = hotelsWithCount.find(h => h.owner_id === user.id && (h.room_count || 0) > 0);
          if (own) selected = own;
        }
        if (!selected) {
          const withRooms = hotelsWithCount
            .filter(h => (h.room_count || 0) > 0)
            .sort((a, b) => (b.room_count || 0) - (a.room_count || 0));
          if (withRooms.length > 0) selected = withRooms[0];
        }
        if (!selected) selected = hotelsWithCount[0];

        setHotelId(selected.id);
        setHotelName(selected.name);

        await loadRooms(selected.id);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    }
    load();
  }, []);

  // ═══════════════════════════════════════════════
  // LOAD ROOMS
  // ═══════════════════════════════════════════════
  const loadRooms = async (hId: string) => {
    setLoading(true);
    try {
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
              short_description: r.short_description || "",
              base_price: r.base_price || 0,
              max_adults: r.max_adults ?? 2,
              max_children: r.max_children ?? 0,
              max_infants: r.max_infants ?? 0,
              photos: r.photos || [],
              amenities: r.amenities || [],
              bed_type: r.bed_type,
              bed_count: r.bed_count,
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
  };

  // ═══════════════════════════════════════════════
  // HOTEL CHANGE
  // ═══════════════════════════════════════════════
  const handleHotelChange = async (newId: string) => {
    const picked = hotels.find(h => h.id === newId);
    if (!picked) return;
    setHotelId(newId);
    setHotelName(picked.name);
    setCategories([]);
    await loadRooms(newId);
  };

  // ═══════════════════════════════════════════════
  // SAVE (updates ALL rooms of this type)
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
          photos: editModal.photos,
          amenities: editModal.amenities,
          bed_type: editModal.bed_type,
          room_size: editModal.room_size,
          view_type: editModal.view_type,
        })
        .eq("hotel_id", hotelId)
        .eq("room_type", editModal.room_type);

      if (error) throw error;

      setMessage(`✓ ${editModal.room_type} updated successfully!`);
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
        {/* ══════════════════════════════════════════ */}
        {/* HEADER */}
        {/* ══════════════════════════════════════════ */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Property Details</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage room types, photos, capacity, amenities and pricing
          </p>
        </div>

        {/* Hotel Selector */}
        {hotels.length > 1 && (
          <div className="mb-6 bg-white rounded-2xl border border-slate-200 p-4">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              🏨 Select Property
            </label>
            <select
              value={hotelId}
              onChange={(e) => handleHotelChange(e.target.value)}
              className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-teal-500"
            >
              {hotels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} — {h.room_count} rooms
                </option>
              ))}
            </select>
          </div>
        )}

        {message && (
          <div className={`p-4 rounded-xl mb-6 text-sm font-bold ${
            message.startsWith('✓')
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}>
            {message}
          </div>
        )}

        {/* ══════════════════════════════════════════ */}
        {/* ROOM CARDS GRID — আসল ডিজাইন */}
        {/* ══════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((cat) => (
            <div
              key={cat.room_type}
              className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-lg transition"
            >
              {/* Room Image */}
              <div className="h-48 bg-slate-100 relative">
                {cat.photos?.[0] ? (
                  <img src={cat.photos[0]} alt={cat.room_type} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl text-slate-300">
                    🛏️
                  </div>
                )}
                <span className="absolute top-3 right-3 bg-white/95 px-3 py-1 rounded-full text-xs font-bold text-slate-800 shadow">
                  ₹{cat.base_price.toLocaleString("en-IN")}
                </span>
                <span className="absolute top-3 left-3 bg-slate-900/80 text-white px-3 py-1 rounded-full text-[10px] font-bold">
                  {cat.total_rooms} Room{(cat.total_rooms || 0) !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Room Details */}
              <div className="p-5">
                <h3 className="text-lg font-serif font-bold text-slate-900 mb-1">
                  {cat.room_type}
                </h3>
                <p className="text-xs text-slate-500 mb-3 line-clamp-2">
                  {cat.description || `Comfortable ${cat.room_type} with modern amenities.`}
                </p>

                {/* Feature Chips */}
                <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-600 mb-3 flex-wrap">
                  {cat.bed_type && (
                    <span className="bg-slate-100 px-2 py-1 rounded-md flex items-center gap-1">
                      🛏️ {cat.bed_type}
                    </span>
                  )}
                  {cat.room_size && (
                    <span className="bg-slate-100 px-2 py-1 rounded-md flex items-center gap-1">
                      📐 {cat.room_size}
                    </span>
                  )}
                  {cat.view_type && (
                    <span className="bg-slate-100 px-2 py-1 rounded-md flex items-center gap-1">
                      👁️ {cat.view_type}
                    </span>
                  )}
                </div>

                {/* Capacity */}
                <div className="flex items-center gap-3 text-xs font-semibold text-slate-600 mb-4 flex-wrap">
                  <span className="flex items-center gap-1">
                    <span className="text-blue-500">👤</span> {cat.max_adults} Adults
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-pink-500">🧒</span> {cat.max_children} Children
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-purple-500">🍼</span> {cat.max_infants} Infants
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditModal(cat)}
                    className="flex-1 py-2.5 bg-teal-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-teal-600 transition"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Create New Room Type */}
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center p-8 hover:border-teal-400 transition cursor-pointer min-h-[380px]">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-2xl mb-3">
              +
            </div>
            <p className="text-sm font-bold text-slate-700">Create New Room Type</p>
            <p className="text-xs text-slate-400 mt-1 text-center">
              Setup a new category for your inventory
            </p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/* EDIT MODAL — সম্পূর্ণ রুম ডিটেইলস + Capacity */}
      {/* ═══════════════════════════════════════════════ */}
      {editModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Edit {editModal.room_type}
                </h3>
                <p className="text-xs text-slate-500">
                  Manage photos, capacity, amenities and pricing
                </p>
              </div>
              <button
                onClick={() => setEditModal(null)}
                className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-800"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              {/* ═══ PHOTOS ═══ */}
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-2">
                  📸 Room Photos
                </label>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {(editModal.photos || []).map((url, idx) => (
                    <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-slate-100">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => {
                          const newPhotos = [...(editModal.photos || [])];
                          newPhotos.splice(idx, 1);
                          setEditModal({ ...editModal, photos: newPhotos });
                        }}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px]"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 shrink-0">
                    📷
                  </div>
                </div>
              </div>

              {/* ═══ DESCRIPTION ═══ */}
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-2">
                  📝 Description
                </label>
                <textarea
                  value={editModal.description}
                  onChange={(e) => setEditModal({ ...editModal, description: e.target.value })}
                  rows={3}
                  placeholder="Comfortable room with modern amenities..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-teal-500 resize-none"
                />
              </div>

              {/* ═══ BED / SIZE / VIEW ═══ */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    🛏️ Bed
                  </label>
                  <input
                    type="text"
                    value={editModal.bed_type || ""}
                    onChange={(e) => setEditModal({ ...editModal, bed_type: e.target.value })}
                    placeholder="King Bed"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    📐 Size
                  </label>
                  <input
                    type="text"
                    value={editModal.room_size || ""}
                    onChange={(e) => setEditModal({ ...editModal, room_size: e.target.value })}
                    placeholder="300 sqft"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    👁️ View
                  </label>
                  <input
                    type="text"
                    value={editModal.view_type || ""}
                    onChange={(e) => setEditModal({ ...editModal, view_type: e.target.value })}
                    placeholder="City View"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              {/* ═══ BASE PRICE ═══ */}
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-2">
                  💰 Base Price per Night (₹)
                </label>
                <input
                  type="number"
                  value={editModal.base_price}
                  onChange={(e) => setEditModal({ ...editModal, base_price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-teal-500"
                />
              </div>

              {/* ═══ CAPACITY ═══ */}
              <div className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-2xl p-5 border-2 border-teal-200">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center text-white font-bold text-sm">
                    👥
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Maximum Capacity</h4>
                    <p className="text-[10px] text-slate-500">Auto-applies in booking engine</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Adults */}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-2">
                      Max Adults <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setEditModal({ ...editModal, max_adults: Math.max(1, editModal.max_adults - 1) })}
                        className="w-10 h-10 rounded-xl border-2 border-slate-200 bg-white flex items-center justify-center text-lg font-bold text-slate-600 hover:border-teal-400 hover:text-teal-600"
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
                        className="w-10 h-10 rounded-xl border-2 border-slate-200 bg-white flex items-center justify-center text-lg font-bold text-slate-600 hover:border-teal-400 hover:text-teal-600"
                      >+</button>
                    </div>
                  </div>

                  {/* Children */}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-2">Max Children</label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setEditModal({ ...editModal, max_children: Math.max(0, editModal.max_children - 1) })}
                        className="w-10 h-10 rounded-xl border-2 border-slate-200 bg-white flex items-center justify-center text-lg font-bold text-slate-600 hover:border-teal-400 hover:text-teal-600"
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
                        className="w-10 h-10 rounded-xl border-2 border-slate-200 bg-white flex items-center justify-center text-lg font-bold text-slate-600 hover:border-teal-400 hover:text-teal-600"
                      >+</button>
                    </div>
                  </div>

                  {/* Infants */}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-2">Max Infants</label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setEditModal({ ...editModal, max_infants: Math.max(0, editModal.max_infants - 1) })}
                        className="w-10 h-10 rounded-xl border-2 border-slate-200 bg-white flex items-center justify-center text-lg font-bold text-slate-600 hover:border-teal-400 hover:text-teal-600"
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
                        className="w-10 h-10 rounded-xl border-2 border-slate-200 bg-white flex items-center justify-center text-lg font-bold text-slate-600 hover:border-teal-400 hover:text-teal-600"
                      >+</button>
                    </div>
                  </div>
                </div>

                <div className="mt-3 p-3 bg-white border border-amber-200 rounded-lg">
                  <p className="text-[10px] text-amber-800 leading-relaxed">
                    <strong>ℹ️</strong> এই লিমিট বুকিং ইঞ্জিনে অটোমেটিক প্রয়োগ হবে।
                  </p>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="px-6 py-5 border-t border-slate-100 bg-slate-50 flex gap-3">
              <button
                onClick={() => setEditModal(null)}
                className="px-6 py-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 bg-teal-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-teal-700 disabled:opacity-50"
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