// app/settings/property/page.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../../supabase";

type RoomCategory = {
  id: string;
  hotel_id: string;
  room_type: string;
  description?: string;
  max_adults: number;
  max_children: number;
  max_infants: number;
  photos?: string[];
  amenities?: string[];
  bed_type?: string;
  bed_count?: number;
  room_size?: string;
  view_type?: string;
  floor_type?: string;
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
  const [newAmenity, setNewAmenity] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ═══════════════════════════════════════════════
  // LOAD — Uses owner_id PRIMARY (syncs with sidebar)
  // ═══════════════════════════════════════════════
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        let hId = "";
        let hName = "";

        // ── PRIORITY 1: Get user's own hotel via owner_id ──
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: hotels } = await supabase
            .from("hotels")
            .select("id, name")
            .eq("owner_id", user.id)
            .order("created_at", { ascending: true })
            .limit(1);

          if (hotels && hotels.length > 0) {
            hId = hotels[0].id;
            hName = hotels[0].name;
          }
        }

        // ── PRIORITY 2: Fallback to localStorage ──
        if (!hId && typeof window !== "undefined") {
          hId = localStorage.getItem("selected_hotel_id") || "";
          hName = localStorage.getItem("selected_hotel_name") || "";
        }

        if (!hId) {
          setLoading(false);
          return;
        }

        // Update localStorage with correct hotel
        if (typeof window !== "undefined") {
          localStorage.setItem("selected_hotel_id", hId);
          localStorage.setItem("selected_hotel_name", hName);
        }

        setHotelId(hId);
        setHotelName(hName);

        // Load rooms
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
                max_adults: r.max_adults ?? 2,
                max_children: r.max_children ?? 0,
                max_infants: r.max_infants ?? 0,
                photos: Array.isArray(r.photos) ? r.photos : [],
                amenities: Array.isArray(r.amenities) ? r.amenities : [],
                bed_type: r.bed_type || "",
                bed_count: r.bed_count || 1,
                room_size: r.room_size || "",
                view_type: r.view_type || "",
                floor_type: r.floor_type || "",
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
  // UPLOAD PHOTO
  // ═══════════════════════════════════════════════
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !editModal || !hotelId) return;
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of files) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${hotelId}/${editModal.room_type.replace(/\s+/g, "-")}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;

        const { data, error } = await supabase.storage
          .from("room-photos")
          .upload(fileName, file, { cacheControl: "3600", upsert: false });

        if (error) {
          console.error("Upload error:", error);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from("room-photos")
          .getPublicUrl(data.path);

        uploadedUrls.push(urlData.publicUrl);
      }

      if (uploadedUrls.length > 0) {
        const newPhotos = [...(editModal.photos || []), ...uploadedUrls];
        setEditModal({ ...editModal, photos: newPhotos });
        setMessage(`✓ ${uploadedUrls.length} photo(s) uploaded!`);
        setTimeout(() => setMessage(null), 2000);
      }
    } catch (err: any) {
      setMessage(`⚠️ Upload error: ${err.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removePhoto = async (idx: number) => {
    if (!editModal) return;
    const photos = [...(editModal.photos || [])];
    const urlToRemove = photos[idx];
    try {
      const path = urlToRemove.split("/room-photos/")[1];
      if (path) await supabase.storage.from("room-photos").remove([path]);
    } catch (err) {
      console.error("Delete error:", err);
    }
    photos.splice(idx, 1);
    setEditModal({ ...editModal, photos });
  };

  const movePhoto = (idx: number, direction: "left" | "right") => {
    if (!editModal) return;
    const photos = [...(editModal.photos || [])];
    const newIdx = direction === "left" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= photos.length) return;
    [photos[idx], photos[newIdx]] = [photos[newIdx], photos[idx]];
    setEditModal({ ...editModal, photos });
  };

  // ═══════════════════════════════════════════════
  // AMENITY
  // ═══════════════════════════════════════════════
  const addAmenity = () => {
    if (!newAmenity.trim() || !editModal) return;
    const amenities = [...(editModal.amenities || []), newAmenity.trim()];
    setEditModal({ ...editModal, amenities });
    setNewAmenity("");
  };

  const removeAmenity = (idx: number) => {
    if (!editModal) return;
    const amenities = [...(editModal.amenities || [])];
    amenities.splice(idx, 1);
    setEditModal({ ...editModal, amenities });
  };

  // ═══════════════════════════════════════════════
  // SAVE — Robust (Handles missing columns)
  // ═══════════════════════════════════════════════
  const handleSave = async () => {
    if (!editModal || !hotelId) return;
    setSaving(true);
    setMessage(null);

    try {
      // Build update object — only include fields that exist
      const updateData: Record<string, any> = {};

      if (editModal.description !== undefined) updateData.description = editModal.description || "";
      if (editModal.max_adults !== undefined) updateData.max_adults = editModal.max_adults || 2;
      if (editModal.max_children !== undefined) updateData.max_children = editModal.max_children || 0;
      if (editModal.max_infants !== undefined) updateData.max_infants = editModal.max_infants || 0;
      if (editModal.photos !== undefined) updateData.photos = editModal.photos || [];
      if (editModal.amenities !== undefined) updateData.amenities = editModal.amenities || [];
      if (editModal.bed_type !== undefined) updateData.bed_type = editModal.bed_type || null;
      if (editModal.bed_count !== undefined) updateData.bed_count = editModal.bed_count || 1;
      if (editModal.room_size !== undefined) updateData.room_size = editModal.room_size || null;
      if (editModal.view_type !== undefined) updateData.view_type = editModal.view_type || null;
      if (editModal.floor_type !== undefined) updateData.floor_type = editModal.floor_type || null;

      const { error } = await supabase
        .from("rooms")
        .update(updateData)
        .eq("hotel_id", hotelId)
        .eq("room_type", editModal.room_type);

      if (error) throw error;

      setMessage(`✓ ${editModal.room_type} updated successfully!`);
      setTimeout(() => setMessage(null), 3000);

      setCategories(prev => prev.map(c =>
        c.room_type === editModal.room_type ? { ...c, ...editModal } : c
      ));
      setEditModal(null);
      setNewAmenity("");
    } catch (err: any) {
      console.error(err);
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
        {/* HEADER */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Property Details</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage room types, photos, capacity, amenities
          </p>
          {hotelName && (
            <div className="mt-3 inline-flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-full px-4 py-1.5">
              <span className="text-teal-600">🏨</span>
              <span className="text-xs font-bold text-teal-800">{hotelName}</span>
              <span className="text-[10px] text-teal-600 bg-teal-100 px-2 py-0.5 rounded-full">
                {categories.length} room type{categories.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        {message && (
          <div className={`p-4 rounded-xl mb-6 text-sm font-bold ${
            message.startsWith("✓")
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-rose-50 text-rose-700 border border-rose-200"
          }`}>
            {message}
          </div>
        )}

        {/* ROOM CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((cat) => (
            <div key={cat.room_type} className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-lg transition">
              <div className="h-48 bg-slate-100 relative">
                {cat.photos && cat.photos.length > 0 ? (
                  <>
                    <img src={cat.photos[0]} alt={cat.room_type} className="w-full h-full object-cover" />
                    {cat.photos.length > 1 && (
                      <div className="absolute bottom-2 right-2 bg-slate-900/80 text-white px-2.5 py-1 rounded-full text-[10px] font-bold">
                        📷 {cat.photos.length}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl text-slate-300">🛏️</div>
                )}
                <span className="absolute top-3 left-3 bg-slate-900/80 text-white px-3 py-1 rounded-full text-[10px] font-bold">
                  {cat.total_rooms} Room{(cat.total_rooms || 0) !== 1 ? "s" : ""}
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

                {cat.amenities && cat.amenities.length > 0 && (
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-teal-700 mb-3 flex-wrap">
                    {cat.amenities.slice(0, 3).map((a: string, i: number) => (
                      <span key={i} className="bg-teal-50 px-2 py-1 rounded-md">✓ {a}</span>
                    ))}
                    {cat.amenities.length > 3 && (
                      <span className="bg-slate-50 px-2 py-1 rounded-md text-slate-500">+{cat.amenities.length - 3}</span>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-3 text-xs font-semibold text-slate-600 mb-4 flex-wrap">
                  <span>👤 {cat.max_adults}A</span>
                  <span>🧒 {cat.max_children}C</span>
                  <span>🍼 {cat.max_infants}I</span>
                </div>

                <button
                  onClick={() => { setEditModal({ ...cat }); setNewAmenity(""); }}
                  className="w-full py-2.5 bg-teal-500 text-white rounded-xl text-xs font-bold uppercase hover:bg-teal-600 transition"
                >
                  ✏️ Edit Details & Capacity
                </button>
              </div>
            </div>
          ))}

          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center p-8 min-h-[380px]">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-2xl mb-3">+</div>
            <p className="text-sm font-bold text-slate-700">Create New Room Type</p>
          </div>
        </div>
      </div>

      {/* EDIT MODAL */}
      {editModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Edit {editModal.room_type}</h3>
                <p className="text-xs text-slate-500">Photos, details, amenities, capacity</p>
              </div>
              <button onClick={() => setEditModal(null)} className="w-8 h-8 rounded-full bg-white border flex items-center justify-center text-slate-400">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* PHOTOS */}
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-2">
                  📸 Room Photos ({editModal.photos?.length || 0})
                </label>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {(editModal.photos || []).map((url, idx) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 group">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <span className="absolute top-1 left-1 bg-slate-900/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">{idx + 1}</span>
                      <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1">
                        {idx > 0 && (
                          <button onClick={() => movePhoto(idx, "left")} className="w-7 h-7 rounded-full bg-white text-slate-800 flex items-center justify-center text-xs">‹</button>
                        )}
                        <button onClick={() => removePhoto(idx)} className="w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center text-xs">×</button>
                        {idx < (editModal.photos?.length || 0) - 1 && (
                          <button onClick={() => movePhoto(idx, "right")} className="w-7 h-7 rounded-full bg-white text-slate-800 flex items-center justify-center text-xs">›</button>
                        )}
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="aspect-square rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center hover:border-teal-400 hover:bg-teal-50 transition disabled:opacity-50"
                  >
                    {uploading ? (
                      <>
                        <div className="w-6 h-6 rounded-full border-2 border-teal-500 border-t-transparent animate-spin mb-1" />
                        <span className="text-[9px] font-bold text-teal-600">Uploading...</span>
                      </>
                    ) : (
                      <>
                        <span className="text-2xl text-slate-400 mb-1">📷</span>
                        <span className="text-[9px] font-bold text-slate-500">Upload Photos</span>
                      </>
                    )}
                  </button>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
              </div>

              {/* DESCRIPTION */}
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase block mb-2">📝 Description</label>
                <textarea
                  value={editModal.description || ""}
                  onChange={(e) => setEditModal({ ...editModal, description: e.target.value })}
                  rows={3}
                  placeholder="Comfortable room with modern amenities..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500 resize-none"
                />
              </div>

              {/* BED / SIZE / VIEW / FLOOR */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">🛏️ Bed Type</label>
                  <input type="text" value={editModal.bed_type || ""} onChange={(e) => setEditModal({ ...editModal, bed_type: e.target.value })} placeholder="King Bed" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-teal-500" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">🔢 Bed Count</label>
                  <input type="number" value={editModal.bed_count || 1} onChange={(e) => setEditModal({ ...editModal, bed_count: parseInt(e.target.value) || 1 })} min={1} max={10} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-teal-500" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">📐 Room Size</label>
                  <input type="text" value={editModal.room_size || ""} onChange={(e) => setEditModal({ ...editModal, room_size: e.target.value })} placeholder="300 sqft" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-teal-500" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">👁️ View Type</label>
                  <input type="text" value={editModal.view_type || ""} onChange={(e) => setEditModal({ ...editModal, view_type: e.target.value })} placeholder="City View" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-teal-500" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">🏢 Floor Type</label>
                <input type="text" value={editModal.floor_type || ""} onChange={(e) => setEditModal({ ...editModal, floor_type: e.target.value })} placeholder="e.g., Ground Floor / Upper Floor" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-teal-500" />
              </div>

              {/* AMENITIES */}
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase block mb-2">
                  ✨ Amenities ({editModal.amenities?.length || 0})
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {(editModal.amenities || []).map((a, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 bg-teal-50 text-teal-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                      ✓ {a}
                      <button onClick={() => removeAmenity(idx)} className="ml-1 text-teal-500 hover:text-rose-500 font-bold">×</button>
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {["WiFi", "AC", "TV", "Hot Water", "Balcony", "Mini Bar", "Room Service", "Geyser", "Towels", "Toiletries", "Attached Bathroom", "Wardrobe"].map((suggestion) => {
                    const already = (editModal.amenities || []).includes(suggestion);
                    return (
                      <button
                        key={suggestion}
                        onClick={() => {
                          if (already) return;
                          const amenities = [...(editModal.amenities || []), suggestion];
                          setEditModal({ ...editModal, amenities });
                        }}
                        disabled={already}
                        className={`text-[10px] px-2 py-1 rounded-md font-semibold ${already ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-slate-100 text-slate-700 hover:bg-teal-100 hover:text-teal-700"}`}
                      >
                        + {suggestion}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newAmenity}
                    onChange={(e) => setNewAmenity(e.target.value)}
                    placeholder="Custom amenity..."
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-teal-500"
                    onKeyDown={(e) => e.key === "Enter" && addAmenity()}
                  />
                  <button onClick={addAmenity} disabled={!newAmenity.trim()} className="px-4 py-2 bg-teal-500 text-white rounded-lg text-xs font-bold hover:bg-teal-600 disabled:opacity-50">Add</button>
                </div>
              </div>

              {/* MAX CAPACITY */}
              <div className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-2xl p-5 border-2 border-teal-200">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center text-white text-sm">👥</div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Maximum Capacity</h4>
                    <p className="text-[10px] text-slate-500">Applied in booking engine</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    { key: "max_adults", label: "Max Adults", min: 1, max: 20 },
                    { key: "max_children", label: "Max Children", min: 0, max: 20 },
                    { key: "max_infants", label: "Max Infants", min: 0, max: 10 },
                  ].map(({ key, label, min, max }) => (
                    <div key={key}>
                      <label className="text-xs font-semibold text-slate-600 block mb-2">{label}</label>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setEditModal({ ...editModal, [key]: Math.max(min, (editModal[key] || 0) - 1) })}
                          className="w-10 h-10 rounded-xl border-2 border-slate-200 bg-white font-bold text-slate-600 hover:border-teal-400"
                        >−</button>
                        <input
                          type="number"
                          value={editModal[key] || 0}
                          onChange={(e) => setEditModal({ ...editModal, [key]: parseInt(e.target.value) || 0 })}
                          min={min}
                          max={max}
                          className="flex-1 text-center text-xl font-bold py-2 border-2 border-slate-200 rounded-xl outline-none focus:border-teal-500 bg-white"
                        />
                        <button
                          onClick={() => setEditModal({ ...editModal, [key]: (editModal[key] || 0) + 1 })}
                          className="w-10 h-10 rounded-xl border-2 border-slate-200 bg-white font-bold text-slate-600 hover:border-teal-400"
                        >+</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-5 border-t bg-slate-50 flex gap-3">
              <button onClick={() => setEditModal(null)} className="px-6 py-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-white">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 bg-teal-600 text-white rounded-xl text-xs font-bold uppercase hover:bg-teal-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Update Room"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
