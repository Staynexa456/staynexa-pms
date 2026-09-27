// app/settings/rooms/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../../supabase";
import { useActiveHotel } from "../../../lib/use-active-hotel";

type Room = {
  id?: string;
  hotel_id: string;
  room_number: string;
  room_type: string;
  base_price: number;
  is_active: boolean;
};

export default function RoomsManagerPage() {
  const { hotelId } = useActiveHotel();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ room_number: "", room_type: "", base_price: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!hotelId) return;
    setLoading(true);
    const [roomsRes, typesRes] = await Promise.all([
      supabase.from("rooms").select("*").eq("hotel_id", hotelId).order("room_number"),
      supabase.from("room_type_details").select("room_type").eq("hotel_id", hotelId),
    ]);
    if (roomsRes.data) setRooms(roomsRes.data);
    if (typesRes.data) setTypes(typesRes.data.map(t => t.room_type));
    setLoading(false);
  }, [hotelId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!form.room_number || !form.room_type || !form.base_price) return alert("All fields are required");
    setSaving(true);
    const { error } = await supabase.from("rooms").insert({
      hotel_id: hotelId,
      room_number: form.room_number,
      room_type: form.room_type,
      base_price: Number(form.base_price),
      is_active: true,
    });
    setSaving(false);
    if (error) return alert("Error: " + error.message);
    setForm({ room_number: "", room_type: "", base_price: "" });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this room?")) return;
    await supabase.from("rooms").delete().eq("id", id);
    load();
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from("rooms").update({ is_active: !current }).eq("id", id);
    load();
  };

  const grouped = rooms.reduce((acc: Record<string, Room[]>, r) => {
    acc[r.room_type] = acc[r.room_type] || [];
    acc[r.room_type].push(r);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Rooms & Inventory</h1>
        <p className="text-sm text-slate-500 mb-6">Add individual rooms. Availability is checked against bookings automatically.</p>

        {/* Add Room Form */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-8 shadow-sm">
          <p className="text-sm font-bold text-slate-700 mb-4">Add New Room</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <input placeholder="Room Number (e.g., 101)" value={form.room_number} onChange={(e) => setForm({ ...form, room_number: e.target.value })} className="px-4 py-2 border rounded-xl text-sm" />
            <select value={form.room_type} onChange={(e) => setForm({ ...form, room_type: e.target.value })} className="px-4 py-2 border rounded-xl text-sm">
              <option value="">Select Category...</option>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="number" placeholder="Base Price (₹/night)" value={form.base_price} onChange={(e) => setForm({ ...form, base_price: e.target.value })} className="px-4 py-2 border rounded-xl text-sm" />
          </div>
          <button onClick={handleAdd} disabled={saving} className="px-6 py-2.5 rounded-xl bg-teal-600 text-white font-bold text-sm hover:bg-teal-700 transition disabled:opacity-50">
            {saving ? "Saving..." : "+ Add Room"}
          </button>
        </div>

        {/* Rooms Grouped by Category */}
        {loading ? <p className="text-slate-500">Loading...</p> : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([type, list]) => (
              <div key={type} className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
                  <p className="font-bold text-slate-800">{type}</p>
                  <span className="text-xs font-bold bg-teal-50 text-teal-700 px-3 py-1 rounded-full">{list.length} rooms</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {list.map((room) => (
                    <div key={room.id} className={`group flex items-center gap-2 px-3 py-1.5 rounded-full border-2 ${room.is_active ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-100"}`}>
                      <button onClick={() => toggleActive(room.id!, room.is_active)} className={`text-xs font-bold ${room.is_active ? "text-emerald-700" : "text-slate-500"}`}>
                        {room.room_number} · ₹{room.base_price}
                      </button>
                      <button onClick={() => handleDelete(room.id!)} className="text-rose-400 hover:text-rose-600 text-xs">×</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
