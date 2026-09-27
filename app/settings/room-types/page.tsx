// app/settings/room-types/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../../supabase";
import { useActiveHotel } from "../../../lib/use-active-hotel";

type RoomType = {
  id?: string;
  hotel_id: string;
  room_type: string;
  description: string;
  max_adults: number;
  max_children: number;
  photo_url: string;
  is_active: boolean;
  display_order: number;
};

export default function RoomTypesManagerPage() {
  const { hotelId } = useActiveHotel();
  const [types, setTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({
    room_type: "", description: "", max_adults: "2", max_children: "0",
    photo_url: "", is_active: true, display_order: "0"
  });
  const [saving, setSaving] = useState(false);

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

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setForm({ room_type: "", description: "", max_adults: "2", max_children: "0", photo_url: "", is_active: true, display_order: "0" });
    setEditing(null);
  };

  const handleSave = async () => {
    if (!form.room_type.trim()) return alert("Room type name is required");
    setSaving(true);
    const payload = {
      hotel_id: hotelId,
      room_type: form.room_type.trim(),
      description: form.description,
      max_adults: Number(form.max_adults),
      max_children: Number(form.max_children),
      photo_url: form.photo_url,
      is_active: form.is_active,
      display_order: Number(form.display_order),
    };

    const { error } = editing
      ? await supabase.from("room_type_details").update(payload).eq("id", editing)
      : await supabase.from("room_type_details").insert(payload);

    setSaving(false);
    if (error) return alert("Error: " + error.message);
    resetForm();
    load();
  };

  const handleEdit = (t: RoomType) => {
    setEditing(t.id!);
    setForm({
      room_type: t.room_type, description: t.description || "", max_adults: String(t.max_adults),
      max_children: String(t.max_children), photo_url: t.photo_url || "", is_active: t.is_active,
      display_order: String(t.display_order || 0),
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this room type? All associated rooms must be removed first.")) return;
    const { error } = await supabase.from("room_type_details").delete().eq("id", id);
    if (error) return alert("Error: " + error.message);
    load();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Room Categories</h1>
        <p className="text-sm text-slate-500 mb-6">Define your room types (Deluxe, Suite, etc). These will appear on your booking engine.</p>

        {/* Form */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-8 shadow-sm">
          <p className="text-sm font-bold text-slate-700 mb-4">{editing ? "Edit Room Type" : "Add New Room Type"}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <input placeholder="Name (e.g., Deluxe Room)" value={form.room_type} onChange={(e) => setForm({ ...form, room_type: e.target.value })} className="px-4 py-2 border rounded-xl text-sm" />
            <input placeholder="Photo URL" value={form.photo_url} onChange={(e) => setForm({ ...form, photo_url: e.target.value })} className="px-4 py-2 border rounded-xl text-sm" />
            <input type="number" placeholder="Max Adults" value={form.max_adults} onChange={(e) => setForm({ ...form, max_adults: e.target.value })} className="px-4 py-2 border rounded-xl text-sm" />
            <input type="number" placeholder="Max Children" value={form.max_children} onChange={(e) => setForm({ ...form, max_children: e.target.value })} className="px-4 py-2 border rounded-xl text-sm" />
            <input type="number" placeholder="Display Order" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: e.target.value })} className="px-4 py-2 border rounded-xl text-sm" />
            <textarea placeholder="Description" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="px-4 py-2 border rounded-xl text-sm md:col-span-2" />
          </div>
          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 rounded-xl bg-teal-600 text-white font-bold text-sm hover:bg-teal-700 transition disabled:opacity-50">
              {saving ? "Saving..." : editing ? "Update" : "+ Add Category"}
            </button>
            {editing && <button onClick={resetForm} className="px-6 py-2.5 rounded-xl border border-slate-300 text-slate-600 text-sm font-bold">Cancel</button>}
          </div>
        </div>

        {/* List */}
        {loading ? <p className="text-slate-500">Loading...</p> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {types.map((t) => (
              <div key={t.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                {t.photo_url && <img src={t.photo_url} alt={t.room_type} className="w-full h-40 object-cover" />}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-bold text-slate-800 text-lg">{t.room_type}</p>
                      <p className="text-xs text-slate-500">Max {t.max_adults} Adults · {t.max_children} Children</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${t.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {t.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 line-clamp-2">{t.description}</p>
                  <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
                    <button onClick={() => handleEdit(t)} className="text-teal-600 hover:text-teal-700 text-sm font-bold">Edit</button>
                    <button onClick={() => handleDelete(t.id!)} className="text-rose-500 hover:text-rose-700 text-sm font-bold ml-auto">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
