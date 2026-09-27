// app/settings/property/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../supabase";
import { useActiveHotel } from "../../lib/use-active-hotel";

type RoomType = {
  id?: string;
  hotel_id: string;
  room_type: string;
  description: string;
  short_description: string;
  max_adults: number;
  max_children: number;
  max_occupancy: number;
  photo_url: string;
  photos: string[];
  base_price: number;
  room_size: string;
  bed_type: string;
  bed_count: number;
  view_type: string;
  floor_type: string;
  amenities: string[];
  room_features: string[];
  is_active: boolean;
  display_order: number;
};

const EMPTY_FORM: RoomType = {
  hotel_id: "",
  room_type: "",
  description: "",
  short_description: "",
  max_adults: 2,
  max_children: 1,
  max_occupancy: 2,
  photo_url: "",
  photos: [],
  base_price: 0,
  room_size: "",
  bed_type: "King Bed",
  bed_count: 1,
  view_type: "",
  floor_type: "",
  amenities: [],
  room_features: [],
  is_active: true,
  display_order: 0,
};

const BED_TYPES = ["King Bed", "Queen Bed", "Twin Beds", "Single Bed", "Double Bed", "Sofa Cum Bed"];
const VIEW_TYPES = ["City View", "Garden View", "Pool View", "Sea View", "Mountain View", "No View", "Balcony View"];
const FLOOR_TYPES = ["Ground Floor", "1st Floor", "2nd Floor", "3rd Floor", "4th Floor", "5th Floor+", "Top Floor"];
const COMMON_AMENITIES = ["WiFi", "AC", "TV", "Mini Bar", "Safe", "Hair Dryer", "Iron", "Tea/Coffee Maker", "Kettle", "Work Desk"];
const COMMON_FEATURES = ["Balcony", "Bathtub", "Shower", "Jacuzzi", "Private Pool", "Kitchenette", "Living Area", "Dining Area"];

export default function PropertyDetailsPage() {
  const { hotelId } = useActiveHotel();
  const [types, setTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<RoomType | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"basic" | "photos" | "details" | "amenities">("basic");
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [newAmenity, setNewAmenity] = useState("");
  const [newFeature, setNewFeature] = useState("");

  const load = useCallback(async () => {
    if (!hotelId) return;
    setLoading(true);
    const { data } = await supabase
      .from("room_type_details")
      .select("*")
      .eq("hotel_id", hotelId)
      .order("display_order");
    if (data) setTypes(data);
    setLoading(false);
  }, [hotelId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.room_type.trim()) return alert("Room type name is required");

    setSaving(true);
    const payload = {
      hotel_id: hotelId,
      room_type: editing.room_type.trim(),
      description: editing.description || "",
      short_description: editing.short_description || "",
      max_adults: Number(editing.max_adults),
      max_children: Number(editing.max_children),
      max_occupancy: Number(editing.max_occupancy),
      photo_url: editing.photo_url || editing.photos?.[0] || "",
      photos: editing.photos || [],
      base_price: Number(editing.base_price),
      room_size: editing.room_size || "",
      bed_type: editing.bed_type || "",
      bed_count: Number(editing.bed_count) || 1,
      view_type: editing.view_type || "",
      floor_type: editing.floor_type || "",
      amenities: editing.amenities || [],
      room_features: editing.room_features || [],
      is_active: editing.is_active,
      display_order: Number(editing.display_order || 0),
    };

    const { error } = editing.id
      ? await supabase.from("room_type_details").update(payload).eq("id", editing.id)
      : await supabase.from("room_type_details").insert(payload);

    setSaving(false);
    if (error) return alert("Error: " + error.message);
    setEditing(null);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this room type? All associated rooms must be removed first.")) return;
    const { error } = await supabase.from("room_type_details").delete().eq("id", id);
    if (error) return alert("Error: " + error.message);
    load();
  };

  const handleCreateNew = () => {
    setEditing({
      ...EMPTY_FORM,
      hotel_id: hotelId || "",
      display_order: types.length,
    });
    setActiveTab("basic");
  };

  const handleEdit = (t: RoomType) => {
    setEditing({
      ...EMPTY_FORM,
      ...t,
      photos: t.photos || [],
      amenities: t.amenities || [],
      room_features: t.room_features || [],
    });
    setActiveTab("basic");
  };

  // Photo handlers
  const addPhoto = () => {
    if (!editing || !newPhotoUrl.trim()) return;
    setEditing({ ...editing, photos: [...(editing.photos || []), newPhotoUrl.trim()] });
    setNewPhotoUrl("");
  };
  const removePhoto = (idx: number) => {
    if (!editing) return;
    setEditing({
      ...editing,
      photos: (editing.photos || []).filter((_, i) => i !== idx),
    });
  };
  const movePhoto = (idx: number, dir: -1 | 1) => {
    if (!editing) return;
    const photos = [...(editing.photos || [])];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= photos.length) return;
    [photos[idx], photos[newIdx]] = [photos[newIdx], photos[idx]];
    setEditing({ ...editing, photos });
  };

  // Amenity handlers
  const toggleAmenity = (a: string) => {
    if (!editing) return;
    const list = editing.amenities || [];
    setEditing({
      ...editing,
      amenities: list.includes(a) ? list.filter((x) => x !== a) : [...list, a],
    });
  };
  const addCustomAmenity = () => {
    if (!editing || !newAmenity.trim()) return;
    setEditing({
      ...editing,
      amenities: [...(editing.amenities || []), newAmenity.trim()],
    });
    setNewAmenity("");
  };

  // Feature handlers
  const toggleFeature = (f: string) => {
    if (!editing) return;
    const list = editing.room_features || [];
    setEditing({
      ...editing,
      room_features: list.includes(f) ? list.filter((x) => x !== f) : [...list, f],
    });
  };
  const addCustomFeature = () => {
    if (!editing || !newFeature.trim()) return;
    setEditing({
      ...editing,
      room_features: [...(editing.room_features || []), newFeature.trim()],
    });
    setNewFeature("");
  };

  if (loading) {
    return (
      <div className="p-10 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full border-4 border-slate-200 border-t-teal-500 animate-spin" />
          <p className="text-xs text-slate-500 font-medium tracking-wider uppercase">Loading rooms...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Property Details</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage room types, photos, capacity, amenities and pricing
          </p>
        </div>

        {/* Room Type Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {types.map((t) => {
            const coverPhoto = t.photos?.[0] || t.photo_url;
            return (
              <div
                key={t.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl hover:border-slate-300 transition-all duration-300 group"
              >
                {coverPhoto ? (
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={coverPhoto}
                      alt={t.room_type}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm font-bold text-slate-900 shadow-md">
                      ₹{Number(t.base_price).toLocaleString("en-IN")}
                    </div>
                    {t.photos && t.photos.length > 1 && (
                      <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-[10px] font-bold">
                        📷 {t.photos.length} photos
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-48 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                    <span className="text-6xl text-slate-300">🏨</span>
                  </div>
                )}
                <div className="p-5">
                  <h3 className="font-bold text-lg text-slate-900 mb-1">{t.room_type}</h3>
                  <p className="text-xs text-slate-500 line-clamp-2 mb-3 min-h-[32px]">
                    {t.short_description || t.description || "No description"}
                  </p>

                  {/* Quick Info Badges */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {t.bed_type && (
                      <span className="text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-700 font-medium">
                        🛏️ {t.bed_type}
                      </span>
                    )}
                    {t.room_size && (
                      <span className="text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-700 font-medium">
                        📐 {t.room_size}
                      </span>
                    )}
                    {t.view_type && (
                      <span className="text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-700 font-medium">
                        👁️ {t.view_type}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-600 mb-4 pt-3 border-t border-slate-100">
                    <span className="flex items-center gap-1">
                      <span className="text-slate-400">👤</span> {t.max_adults}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-slate-400">🧒</span> {t.max_children}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-slate-400">🏨</span> {t.bed_count || 1} bed
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(t)}
                      className="flex-1 py-2 rounded-lg bg-teal-50 text-teal-700 text-xs font-bold hover:bg-teal-100 transition"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleDelete(t.id!)}
                      className="px-3 py-2 rounded-lg bg-rose-50 text-rose-600 text-xs font-bold hover:bg-rose-100 transition"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Create New Card */}
          <button
            onClick={handleCreateNew}
            className="rounded-2xl border-2 border-dashed border-slate-300 hover:border-teal-400 hover:bg-teal-50/30 transition flex flex-col items-center justify-center p-8 min-h-[420px]"
          >
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <span className="text-3xl text-slate-400">+</span>
            </div>
            <p className="font-bold text-slate-700">Create New Room Type</p>
            <p className="text-xs text-slate-500 mt-1 text-center px-4">
              Setup a new category for your inventory
            </p>
          </button>
        </div>
      </div>

      {/* ═══════════════ EDIT MODAL ═══════════════ */}
      {editing && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[94vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-slate-800 to-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <span className="text-xl">🏨</span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    {editing.id ? "Edit Room Type" : "Create Room Type"}
                  </h2>
                  <p className="text-[11px] text-slate-300">
                    {editing.id ? "Update room details" : "Setup a new room category"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditing(null)}
                disabled={saving}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center disabled:opacity-50"
              >
                ×
              </button>
            </div>

            {/* Tabs */}
            <div className="px-6 bg-slate-50 border-b border-slate-200 flex gap-1 overflow-x-auto">
              {[
                { id: "basic", label: "📝 Basic Info" },
                { id: "photos", label: `📷 Photos (${editing.photos?.length || 0})` },
                { id: "details", label: "🛏️ Room Details" },
                { id: "amenities", label: `✨ Amenities (${(editing.amenities?.length || 0) + (editing.room_features?.length || 0)})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition ${
                    activeTab === tab.id
                      ? "border-teal-500 text-teal-700"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* BASIC INFO TAB */}
              {activeTab === "basic" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                      Room Type Name *
                    </label>
                    <input
                      type="text"
                      value={editing.room_type}
                      onChange={(e) => setEditing({ ...editing, room_type: e.target.value })}
                      placeholder="e.g., Deluxe Room"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                      Short Description
                    </label>
                    <input
                      type="text"
                      value={editing.short_description || ""}
                      onChange={(e) => setEditing({ ...editing, short_description: e.target.value })}
                      placeholder="One-line summary for cards (e.g., Spacious room with city view)"
                      maxLength={100}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none transition"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      {(editing.short_description || "").length}/100 characters
                    </p>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                      Full Description
                    </label>
                    <textarea
                      value={editing.description}
                      onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                      placeholder="Detailed description of the room..."
                      rows={4}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none resize-none transition"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                        Max Adults
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={editing.max_adults}
                        onChange={(e) => setEditing({ ...editing, max_adults: Number(e.target.value) })}
                        className="w-full px-3 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                        Max Children
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editing.max_children}
                        onChange={(e) => setEditing({ ...editing, max_children: Number(e.target.value) })}
                        className="w-full px-3 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                        Max Occupancy
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={editing.max_occupancy || 2}
                        onChange={(e) => setEditing({ ...editing, max_occupancy: Number(e.target.value) })}
                        className="w-full px-3 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                      Base Price (₹) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={editing.base_price}
                        onChange={(e) => setEditing({ ...editing, base_price: Number(e.target.value) })}
                        placeholder="2500"
                        className="w-full pl-9 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      💡 This price will be shown on your booking engine
                    </p>
                  </div>
                </div>
              )}

              {/* PHOTOS TAB */}
              {activeTab === "photos" && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <p className="text-xs text-blue-800 leading-relaxed">
                      <strong>📸 Tip:</strong> Upload high-quality photos. The first photo will be the cover. Use free tools like <a href="https://imgbb.com" target="_blank" className="underline font-bold">ImgBB</a> or <a href="https://cloudinary.com" target="_blank" className="underline font-bold">Cloudinary</a> to host images, then paste URLs here.
                    </p>
                  </div>

                  {/* Add Photo Input */}
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={newPhotoUrl}
                      onChange={(e) => setNewPhotoUrl(e.target.value)}
                      placeholder="https://example.com/room-photo.jpg"
                      onKeyDown={(e) => e.key === "Enter" && addPhoto()}
                      className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none"
                    />
                    <button
                      onClick={addPhoto}
                      disabled={!newPhotoUrl.trim()}
                      className="px-5 py-2.5 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-700 disabled:opacity-50 transition"
                    >
                      + Add
                    </button>
                  </div>

                  {/* Photo Gallery */}
                  {(!editing.photos || editing.photos.length === 0) ? (
                    <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
                      <p className="text-5xl mb-3">📷</p>
                      <p className="text-sm font-bold text-slate-700">No photos added yet</p>
                      <p className="text-xs text-slate-400 mt-1">Add your first photo URL above</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {editing.photos.map((url, idx) => (
                        <div
                          key={idx}
                          className="relative group rounded-xl overflow-hidden border-2 border-slate-200 hover:border-teal-400 transition"
                        >
                          <img
                            src={url}
                            alt={`Photo ${idx + 1}`}
                            className="w-full h-40 object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f1f5f9' width='100' height='100'/%3E%3Ctext x='50' y='55' text-anchor='middle' fill='%23cbd5e1' font-size='14'%3EInvalid%3C/text%3E%3C/svg%3E";
                            }}
                          />
                          {idx === 0 && (
                            <span className="absolute top-2 left-2 px-2 py-0.5 bg-amber-500 text-white text-[9px] font-bold rounded-full uppercase tracking-wider">
                              Cover
                            </span>
                          )}
                          <div className="absolute inset-0 bg-slate-900/70 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                            {idx > 0 && (
                              <button
                                onClick={() => movePhoto(idx, -1)}
                                className="w-8 h-8 rounded-full bg-white text-slate-900 flex items-center justify-center text-xs font-bold hover:bg-teal-100"
                                title="Move left"
                              >
                                ←
                              </button>
                            )}
                            {idx < editing.photos!.length - 1 && (
                              <button
                                onClick={() => movePhoto(idx, 1)}
                                className="w-8 h-8 rounded-full bg-white text-slate-900 flex items-center justify-center text-xs font-bold hover:bg-teal-100"
                                title="Move right"
                              >
                                →
                              </button>
                            )}
                            <button
                              onClick={() => removePhoto(idx)}
                              className="w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center text-xs font-bold hover:bg-rose-600"
                              title="Remove"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ROOM DETAILS TAB */}
              {activeTab === "details" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                        Room Size
                      </label>
                      <input
                        type="text"
                        value={editing.room_size || ""}
                        onChange={(e) => setEditing({ ...editing, room_size: e.target.value })}
                        placeholder="e.g., 350 sq.ft"
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                        Floor
                      </label>
                      <select
                        value={editing.floor_type || ""}
                        onChange={(e) => setEditing({ ...editing, floor_type: e.target.value })}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none bg-white"
                      >
                        <option value="">Select Floor</option>
                        {FLOOR_TYPES.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                        Bed Type
                      </label>
                      <select
                        value={editing.bed_type || ""}
                        onChange={(e) => setEditing({ ...editing, bed_type: e.target.value })}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none bg-white"
                      >
                        <option value="">Select Bed Type</option>
                        {BED_TYPES.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                        Number of Beds
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={editing.bed_count || 1}
                        onChange={(e) => setEditing({ ...editing, bed_count: Number(e.target.value) })}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                      View Type
                    </label>
                    <select
                      value={editing.view_type || ""}
                      onChange={(e) => setEditing({ ...editing, view_type: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none bg-white"
                    >
                      <option value="">Select View</option>
                      {VIEW_TYPES.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                      Display Order
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editing.display_order || 0}
                      onChange={(e) => setEditing({ ...editing, display_order: Number(e.target.value) })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Lower number = shown first on booking engine
                    </p>
                  </div>
                </div>
              )}

              {/* AMENITIES TAB */}
              {activeTab === "amenities" && (
                <div className="space-y-6">
                  {/* Room Amenities */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3 block">
                      🛋️ In-Room Amenities
                    </label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {COMMON_AMENITIES.map((a) => {
                        const selected = (editing.amenities || []).includes(a);
                        return (
                          <button
                            key={a}
                            onClick={() => toggleAmenity(a)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                              selected
                                ? "bg-teal-500 text-white shadow-md"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {selected ? "✓ " : ""}
                            {a}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newAmenity}
                        onChange={(e) => setNewAmenity(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addCustomAmenity()}
                        placeholder="Add custom amenity..."
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none"
                      />
                      <button
                        onClick={addCustomAmenity}
                        disabled={!newAmenity.trim()}
                        className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 disabled:opacity-50"
                      >
                        + Add
                      </button>
                    </div>
                  </div>

                  {/* Room Features */}
                  <div className="pt-4 border-t border-slate-100">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3 block">
                      ⭐ Special Features
                    </label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {COMMON_FEATURES.map((f) => {
                        const selected = (editing.room_features || []).includes(f);
                        return (
                          <button
                            key={f}
                            onClick={() => toggleFeature(f)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                              selected
                                ? "bg-amber-500 text-white shadow-md"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {selected ? "✓ " : ""}
                            {f}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newFeature}
                        onChange={(e) => setNewFeature(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addCustomFeature()}
                        placeholder="Add custom feature..."
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none"
                      />
                      <button
                        onClick={addCustomFeature}
                        disabled={!newFeature.trim()}
                        className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 disabled:opacity-50"
                      >
                        + Add
                      </button>
                    </div>
                  </div>

                  {/* Current Selection Summary */}
                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Selected ({(editing.amenities?.length || 0) + (editing.room_features?.length || 0)} items)
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {editing.amenities?.map((a) => (
                        <span
                          key={a}
                          className="px-2.5 py-1 bg-teal-50 text-teal-700 rounded-full text-[10px] font-semibold"
                        >
                          {a}
                        </span>
                      ))}
                      {editing.room_features?.map((f) => (
                        <span
                          key={f}
                          className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-[10px] font-semibold"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                {editing.id ? (
                  <span>
                    Editing: <strong className="text-slate-800">{editing.room_type}</strong>
                  </span>
                ) : (
                  <span>Creating new room type</span>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setEditing(null)}
                  disabled={saving}
                  className="px-5 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-white transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2.5 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-700 transition disabled:opacity-50 shadow-md"
                >
                  {saving ? "Saving..." : editing.id ? "✓ Update" : "+ Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
