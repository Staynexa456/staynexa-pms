"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useActiveHotel } from "../../lib/use-active-hotel";
import {
  fetchRoomTypeDetails,
  upsertRoomTypeDetail,
  deleteRoomTypeDetail,
  type RoomTypeDetail,
} from "../../lib/property-settings";
import { fetchInventory } from "../../lib/inventory";

export default function PropertyDetailsPage() {
  const { hotelId, loading: hotelLoading } = useActiveHotel();
  const [details, setDetails] = useState<RoomTypeDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<RoomTypeDetail | null>(null);
  const [roomTypesFromInventory, setRoomTypesFromInventory] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  const load = useCallback(async () => {
    if (!hotelId) { setLoading(false); return; }
    try {
      setLoading(true);
      const [detailsData, inventory] = await Promise.all([
        fetchRoomTypeDetails(hotelId),
        fetchInventory(hotelId),
      ]);
      setDetails(detailsData);
      const uniqueTypes = Array.from(new Set(inventory.map((r) => r.room_type)));
      setRoomTypesFromInventory(uniqueTypes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [hotelId]);

  useEffect(() => {
    if (hotelLoading) return;
    load();
  }, [load, hotelLoading]);

  const handleSave = async (data: Partial<RoomTypeDetail> & { room_type: string }) => {
    if (!hotelId) return;
    try {
      await upsertRoomTypeDetail(hotelId, data);
      showToast(`✅ ${data.room_type} saved`);
      setEditing(null);
      await load();
    } catch (err: any) {
      showToast(`⚠ ${err?.message || "Failed to save"}`);
    }
  };

  const handleDelete = async (roomType: string) => {
    if (!hotelId) return;
    if (!confirm(`Delete ${roomType} details?`)) return;
    try {
      await deleteRoomTypeDetail(hotelId, roomType);
      showToast(`🗑 Deleted`);
      await load();
    } catch (err: any) {
      showToast(`⚠ ${err?.message || "Failed to delete"}`);
    }
  };

  // Missing types (in inventory but no details yet)
  const missingTypes = roomTypesFromInventory.filter(
    (t) => !details.some((d) => d.room_type === t)
  );

  if (hotelLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-14 h-14 rounded-full border-4 border-slate-200 border-t-teal-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Property details</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage room types, photos, capacity, and amenities
          </p>
        </div>

        {/* Existing types grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {details.map((detail) => (
            <div
              key={detail.id}
              className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition overflow-hidden"
            >
              <div className="relative h-40 bg-slate-100">
                {detail.photo_url ? (
                  <img
                    src={detail.photo_url}
                    alt={detail.room_type}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl text-slate-300">
                    🛏️
                  </div>
                )}
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => setEditing(detail)}
                    className="w-8 h-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center text-slate-600 hover:text-teal-600 shadow-sm"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(detail.room_type)}
                    className="w-8 h-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center text-slate-600 hover:text-rose-600 shadow-sm"
                  >
                    🗑
                  </button>
                </div>
              </div>
              <div className="p-4">
                <h3 className="text-lg font-bold text-slate-900">{detail.room_type}</h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2 h-8">
                  {detail.description || "No description"}
                </p>
                <div className="flex items-center gap-3 mt-3 text-[10px] font-bold text-slate-500">
                  <span className="px-2 py-1 bg-slate-100 rounded-full">👤 Max {detail.max_adults}</span>
                  <span className="px-2 py-1 bg-slate-100 rounded-full">👶 Max {detail.max_children}</span>
                </div>
              </div>
            </div>
          ))}

          {/* Add new type card */}
          <button
            onClick={() =>
              setEditing({
                hotel_id: hotelId || "",
                room_type: roomTypesFromInventory[0] || "",
                max_adults: 2,
                max_children: 1,
                amenities: [],
                base_price: 0,
                is_active: true,
                display_order: details.length,
              })
            }
            className="border-2 border-dashed border-slate-300 rounded-2xl min-h-[280px] flex flex-col items-center justify-center gap-3 hover:border-teal-400 hover:bg-teal-50/30 transition group"
          >
            <div className="w-14 h-14 rounded-full bg-slate-100 group-hover:bg-teal-100 flex items-center justify-center text-3xl text-slate-400 group-hover:text-teal-600 transition">
              +
            </div>
            <div className="text-center">
              <p className="font-bold text-slate-700 group-hover:text-teal-700 transition">
                Create New Room Type
              </p>
              <p className="text-xs text-slate-400 mt-1">Setup a new category for your inventory</p>
            </div>
          </button>
        </div>

        {details.length === 0 && missingTypes.length === 0 && (
          <div className="mt-8 p-8 bg-yellow-50 border-2 border-yellow-200 rounded-2xl text-center">
            <p className="text-sm font-bold text-yellow-800">
              ⚠ No room types found. Add rooms in Inventory first.
            </p>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editing && (
        <RoomTypeDetailModal
          initial={editing}
          roomTypeOptions={roomTypesFromInventory}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl text-sm font-semibold z-[100] shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// MODAL COMPONENT
// ═══════════════════════════════════════════════

function RoomTypeDetailModal({
  initial,
  roomTypeOptions,
  onClose,
  onSave,
}: {
  initial: RoomTypeDetail;
  roomTypeOptions: string[];
  onClose: () => void;
  onSave: (data: Partial<RoomTypeDetail> & { room_type: string }) => Promise<void>;
}) {
  const [roomType, setRoomType] = useState(initial.room_type);
  const [description, setDescription] = useState(initial.description || "");
  const [maxAdults, setMaxAdults] = useState(initial.max_adults);
  const [maxChildren, setMaxChildren] = useState(initial.max_children);
  const [photoUrl, setPhotoUrl] = useState(initial.photo_url || "");
  const [basePrice, setBasePrice] = useState(initial.base_price);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!roomType.trim()) {
      alert("Room type name is required");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        room_type: roomType.trim(),
        description: description.trim(),
        max_adults: maxAdults,
        max_children: maxChildren,
        photo_url: photoUrl.trim(),
        base_price: basePrice,
        amenities: initial.amenities || [],
        is_active: true,
        display_order: initial.display_order || 0,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-slate-900 to-slate-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-xl">
              🏨
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">
                {initial.id ? "Edit Room Type" : "New Room Type"}
              </h3>
              <p className="text-slate-300 text-xs mt-0.5">
                Configure details and photo
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white text-3xl leading-none">
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Room Type *
            </label>
            <input
              type="text"
              value={roomType}
              onChange={(e) => setRoomType(e.target.value)}
              placeholder="e.g., Deluxe Room"
              className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe the room amenities and features..."
              className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm resize-none outline-none focus:border-teal-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Max Adults
              </label>
              <input
                type="number"
                value={maxAdults}
                onChange={(e) => setMaxAdults(Number(e.target.value) || 1)}
                min={1}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Max Children
              </label>
              <input
                type="number"
                value={maxChildren}
                onChange={(e) => setMaxChildren(Number(e.target.value) || 0)}
                min={0}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Photo URL
            </label>
            <input
              type="url"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://example.com/room.jpg"
              className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500"
            />
            {photoUrl && (
              <div className="mt-2 h-32 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                <img
                  src={photoUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Base Price (₹)
            </label>
            <input
              type="number"
              value={basePrice}
              onChange={(e) => setBasePrice(Number(e.target.value) || 0)}
              min={0}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500 font-bold"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-600 hover:bg-white transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !roomType.trim()}
            className="px-6 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-teal-500/30 disabled:opacity-50 transition"
          >
            {saving ? "Saving..." : initial.id ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}