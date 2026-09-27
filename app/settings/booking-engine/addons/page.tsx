// app/settings/booking-engine/addons/page.tsx
"use client";
import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../../supabase"; // 👈 3 levels up
import { useActiveHotel } from "../../../lib/use-active-hotel"; // 👈 3 levels up

type Addon = { id?: string; hotel_id: string; name: string; description: string; price: number; is_active: boolean; };

export default function AddonsManagerPage() {
  const { hotelId } = useActiveHotel();
  const [addons, setAddons] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", description: "", price: "" });
  const [saving, setSaving] = useState(false);

  const loadAddons = useCallback(async () => {
    if (!hotelId) return;
    setLoading(true);
    const { data, error } = await supabase.from("hotel_addons").select("*").eq("hotel_id", hotelId).order("price");
    if (data) setAddons(data);
    if (error) console.error(error);
    setLoading(false);
  }, [hotelId]);

  useEffect(() => { loadAddons(); }, [loadAddons]);

  const handleAdd = async () => {
    if (!form.name || !form.price) return alert("Please fill name and price");
    setSaving(true);
    const { error } = await supabase.from("hotel_addons").insert({ hotel_id: hotelId, name: form.name, description: form.description, price: Number(form.price), is_active: true });
    setSaving(false);
    if (error) return alert("Error: " + error.message);
    setForm({ name: "", description: "", price: "" });
    loadAddons();
  };

  const toggleActive = async (id: string, current: boolean) => { await supabase.from("hotel_addons").update({ is_active: !current }).eq("id", id); loadAddons(); };
  const handleDelete = async (id: string) => { if (!confirm("Delete?")) return; await supabase.from("hotel_addons").delete().eq("id", id); loadAddons(); };

  return (
    <div className="min-h-screen bg-slate-50 p-6"><div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Manage Add-ons (Upsells)</h1>
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-8 shadow-sm">
        <p className="text-sm font-bold text-slate-700 mb-4">Add New Add-on</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <input placeholder="Name (e.g., Breakfast)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-4 py-2 border rounded-xl text-sm" />
          <input placeholder="Description (Optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="px-4 py-2 border rounded-xl text-sm" />
          <input type="number" placeholder="Price (₹)" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="px-4 py-2 border rounded-xl text-sm" />
        </div>
        <button onClick={handleAdd} disabled={saving} className="px-6 py-2.5 rounded-xl bg-teal-600 text-white font-bold text-sm hover:bg-teal-700 transition">{saving ? "Saving..." : "+ Add Add-on"}</button>
      </div>
      {loading ? <p className="text-slate-500">Loading...</p> : (
        <div className="space-y-3">
          {addons.map((addon) => (
            <div key={addon.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between">
              <div><p className="font-bold text-slate-800">{addon.name}</p><p className="text-xs text-slate-500">{addon.description || "No description"}</p></div>
              <div className="flex items-center gap-4">
                <p className="font-bold text-slate-900">₹{addon.price}</p>
                <button onClick={() => toggleActive(addon.id!, addon.is_active)} className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${addon.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{addon.is_active ? "Active" : "Inactive"}</button>
                <button onClick={() => handleDelete(addon.id!)} className="text-rose-500 hover:text-rose-700 text-sm font-bold">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div></div>
  );
}
