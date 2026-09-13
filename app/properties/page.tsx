"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { getUserHotels, createHotel, updateHotel, deactivateHotel, type Hotel } from "../db";
import { getActiveHotelId, setActiveHotelId } from "../active-hotel";

export default function PropertiesPage() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editing, setEditing] = useState<Hotel | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    city: "",
    state: "",
    address: "",
    phone: "",
    email: "",
    gst_number: "",
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const load = async () => {
    setLoading(true);
    const data = await getUserHotels();
    setHotels(data);
    setActiveId(getActiveHotelId() || (data[0]?.id ?? null));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      showToast("Please enter a property name");
      return;
    }
    setCreating(true);
    try {
      const hotel = await createHotel({
        name: form.name.trim(),
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        address: form.address.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        gst_number: form.gst_number.trim() || undefined,
      });
      showToast(`✅ ${hotel.name} created`);
      setForm({ name: "", city: "", state: "", address: "", phone: "", email: "", gst_number: "" });
      setShowCreateForm(false);
      await load();
    } catch (err) {
      console.error(err);
      showToast("⚠ Failed to create property");
    } finally {
      setCreating(false);
    }
  };

  const handleSave = async () => {
    if (!editing) return;
    try {
      await updateHotel(editing.id, {
        name: editing.name,
        city: editing.city || "",
        state: editing.state || "",
        address: editing.address || "",
        phone: editing.phone || "",
        email: editing.email || "",
        gst_number: editing.gst_number || "",
      });
      showToast("✅ Property updated");
      setEditing(null);
      await load();
    } catch {
      showToast("⚠ Failed to update");
    }
  };

  const handleDeactivate = async (hotel: Hotel) => {
    if (!confirm(`Deactivate "${hotel.name}"? Bookings will be preserved.`)) return;
    try {
      await deactivateHotel(hotel.id);
      showToast("Property deactivated");
      await load();
    } catch {
      showToast("⚠ Failed to deactivate");
    }
  };

  const handleSetActive = (hotel: Hotel) => {
    setActiveHotelId(hotel.id);
    setActiveId(hotel.id);
    showToast(`Active: ${hotel.name}`);
    setTimeout(() => {
      window.location.href = "/";
    }, 800);
  };

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-gold-dark font-semibold mb-1">
            Your Portfolio
          </p>
          <h1 className="font-serif text-4xl text-navy">Properties</h1>
          <p className="text-muted mt-1 text-sm">
            Manage all your hotels from one account ·{" "}
            <span className="font-medium text-navy">
              {hotels.length} {hotels.length === 1 ? "property" : "properties"}
            </span>
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-5 py-3 bg-gradient-to-b from-gold-light to-gold text-navy font-semibold text-sm rounded-xl shadow-lg shadow-gold/30 hover:-translate-y-0.5 transition-all"
        >
          + Add New Property
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-2xl p-12 text-center border border-navy/5">
          <div className="w-10 h-10 mx-auto rounded-full border-4 border-gold border-t-transparent animate-spin" />
          <p className="text-navy font-medium mt-4">Loading properties…</p>
        </div>
      )}

      {/* Empty */}
      {!loading && hotels.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center border border-navy/5">
          <div className="text-5xl mb-4">🏨</div>
          <h3 className="font-serif text-2xl text-navy mb-2">No properties yet</h3>
          <p className="text-muted text-sm mb-6">
            Add your first hotel to start managing bookings.
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-6 py-3 bg-gradient-to-b from-navy to-navy-light text-cream rounded-xl font-semibold text-sm shadow-lg shadow-navy/20 hover:-translate-y-0.5 transition-all"
          >
            + Create your first property
          </button>
        </div>
      )}

      {/* Properties Grid */}
      {!loading && hotels.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {hotels.map((hotel) => {
            const isActive = activeId === hotel.id;
            return (
              <div
                key={hotel.id}
                className={`bg-white rounded-2xl border-2 overflow-hidden transition-all ${
                  isActive
                    ? "border-gold shadow-lg shadow-gold/10"
                    : "border-navy/5 hover:border-navy/15"
                }`}
              >
                {/* Header */}
                <div className={`px-5 py-4 ${isActive ? "bg-gradient-to-br from-gold/10 to-transparent" : "bg-gradient-to-br from-navy/5 to-transparent"}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="w-12 h-12 rounded-xl bg-navy text-gold flex items-center justify-center font-serif text-2xl font-bold">
                      {hotel.name.charAt(0).toUpperCase()}
                    </div>
                    {isActive && (
                      <span className="text-[10px] uppercase tracking-widest font-bold text-gold-dark bg-gold/15 px-2.5 py-1 rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                  <h3 className="font-serif text-xl text-navy leading-tight">
                    {hotel.name}
                  </h3>
                  {(hotel.city || hotel.state) && (
                    <p className="text-xs text-muted mt-1">
                      📍 {[hotel.city, hotel.state].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>

                {/* Body */}
                <div className="px-5 py-4 space-y-1.5 text-xs">
                  {hotel.phone && <p className="text-navy/70">📞 {hotel.phone}</p>}
                  {hotel.email && <p className="text-navy/70 truncate">✉️ {hotel.email}</p>}
                  {hotel.gst_number && <p className="text-navy/70">🏛 GST: {hotel.gst_number}</p>}
                  <p className="text-navy/70">
                    🕐 Check-in {hotel.check_in_time || "14:00"} · Check-out {hotel.check_out_time || "11:00"}
                  </p>
                </div>

                {/* Actions */}
                <div className="px-5 py-4 border-t border-navy/5 flex gap-2">
                  {!isActive ? (
                    <button
                      onClick={() => handleSetActive(hotel)}
                      className="flex-1 py-2.5 bg-navy text-cream rounded-lg text-xs font-semibold hover:bg-navy-light transition"
                    >
                      Switch to this
                    </button>
                  ) : (
                    <Link
                      href="/"
                      className="flex-1 py-2.5 bg-gradient-to-b from-gold-light to-gold text-navy rounded-lg text-xs font-semibold text-center hover:-translate-y-0.5 transition-all"
                    >
                      Open Dashboard →
                    </Link>
                  )}
                  <button
                    onClick={() => setEditing(hotel)}
                    className="px-3 py-2.5 border border-navy/10 rounded-lg text-xs font-medium text-navy hover:bg-cream transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeactivate(hotel)}
                    className="px-3 py-2.5 border border-rose-200 rounded-lg text-xs font-medium text-rose-500 hover:bg-rose-50 transition"
                    title="Deactivate"
                  >
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Form Modal */}
      {showCreateForm && (
        <>
          <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-[250]" onClick={() => setShowCreateForm(false)} />
          <div className="fixed inset-4 md:inset-8 lg:inset-16 xl:inset-24 bg-white rounded-3xl shadow-2xl z-[260] flex flex-col overflow-hidden">
            <div className="px-8 py-5 border-b border-navy/5 flex justify-between items-center bg-gradient-to-r from-cream/40 via-white to-cream/40">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-gold-dark font-semibold">
                  New Property
                </p>
                <h2 className="font-serif text-2xl text-navy mt-0.5">Add a hotel</h2>
              </div>
              <button
                onClick={() => setShowCreateForm(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-muted hover:bg-navy/5 transition text-xl"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-5">
              <div>
                <label className="text-xs font-semibold text-navy/70 uppercase tracking-wider block mb-2">
                  Property name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. The Grand Palace Hotel"
                  className="w-full px-4 py-3 border-2 border-navy/10 rounded-xl text-sm text-navy outline-none focus:border-gold focus:ring-4 focus:ring-gold/10"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-navy/70 uppercase tracking-wider block mb-2">
                    City
                  </label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="Bengaluru"
                    className="w-full px-4 py-3 border-2 border-navy/10 rounded-xl text-sm text-navy outline-none focus:border-gold focus:ring-4 focus:ring-gold/10"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-navy/70 uppercase tracking-wider block mb-2">
                    State
                  </label>
                  <input
                    type="text"
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                    placeholder="Karnataka"
                    className="w-full px-4 py-3 border-2 border-navy/10 rounded-xl text-sm text-navy outline-none focus:border-gold focus:ring-4 focus:ring-gold/10"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-navy/70 uppercase tracking-wider block mb-2">
                  Full address
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="123 Main Street, Area"
                  className="w-full px-4 py-3 border-2 border-navy/10 rounded-xl text-sm text-navy outline-none focus:border-gold focus:ring-4 focus:ring-gold/10"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-navy/70 uppercase tracking-wider block mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full px-4 py-3 border-2 border-navy/10 rounded-xl text-sm text-navy outline-none focus:border-gold focus:ring-4 focus:ring-gold/10"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-navy/70 uppercase tracking-wider block mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="hello@hotel.com"
                    className="w-full px-4 py-3 border-2 border-navy/10 rounded-xl text-sm text-navy outline-none focus:border-gold focus:ring-4 focus:ring-gold/10"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-navy/70 uppercase tracking-wider block mb-2">
                  GST number (optional)
                </label>
                <input
                  type="text"
                  value={form.gst_number}
                  onChange={(e) => setForm({ ...form, gst_number: e.target.value })}
                  placeholder="29ABCDE1234F1Z5"
                  className="w-full px-4 py-3 border-2 border-navy/10 rounded-xl text-sm text-navy outline-none focus:border-gold focus:ring-4 focus:ring-gold/10"
                />
              </div>

              <div className="bg-cream/60 border border-navy/10 rounded-xl p-4 text-xs text-navy/70">
                💡 <strong>Tip:</strong> We&apos;ll auto-create 5 default rooms (101, 102, 201, 202, 301) so you can start taking bookings immediately.
              </div>
            </div>

            <div className="px-8 py-5 border-t border-navy/5 flex gap-3 justify-end bg-cream/30">
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-5 py-3 border border-navy/10 rounded-xl font-medium text-navy hover:bg-cream transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="px-7 py-3 bg-gradient-to-b from-navy to-navy-light text-cream rounded-xl font-semibold shadow-lg shadow-navy/20 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:transform-none"
              >
                {creating ? "Creating…" : "Create Property"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Edit Modal */}
      {editing && (
        <>
          <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-[250]" onClick={() => setEditing(null)} />
          <div className="fixed inset-4 md:inset-8 lg:inset-16 xl:inset-24 bg-white rounded-3xl shadow-2xl z-[260] flex flex-col overflow-hidden">
            <div className="px-8 py-5 border-b border-navy/5 flex justify-between items-center bg-gradient-to-r from-cream/40 via-white to-cream/40">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-gold-dark font-semibold">
                  Edit Property
                </p>
                <h2 className="font-serif text-2xl text-navy mt-0.5">{editing.name}</h2>
              </div>
              <button onClick={() => setEditing(null)} className="w-9 h-9 rounded-full flex items-center justify-center text-muted hover:bg-navy/5 transition text-xl">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-5">
              <div>
                <label className="text-xs font-semibold text-navy/70 uppercase tracking-wider block mb-2">Name</label>
                <input
                  type="text"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-navy/10 rounded-xl text-sm text-navy outline-none focus:border-gold focus:ring-4 focus:ring-gold/10"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-navy/70 uppercase tracking-wider block mb-2">City</label>
                  <input
                    type="text"
                    value={editing.city || ""}
                    onChange={(e) => setEditing({ ...editing, city: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-navy/10 rounded-xl text-sm text-navy outline-none focus:border-gold focus:ring-4 focus:ring-gold/10"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-navy/70 uppercase tracking-wider block mb-2">State</label>
                  <input
                    type="text"
                    value={editing.state || ""}
                    onChange={(e) => setEditing({ ...editing, state: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-navy/10 rounded-xl text-sm text-navy outline-none focus:border-gold focus:ring-4 focus:ring-gold/10"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-navy/70 uppercase tracking-wider block mb-2">Address</label>
                <input
                  type="text"
                  value={editing.address || ""}
                  onChange={(e) => setEditing({ ...editing, address: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-navy/10 rounded-xl text-sm text-navy outline-none focus:border-gold focus:ring-4 focus:ring-gold/10"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-navy/70 uppercase tracking-wider block mb-2">Phone</label>
                  <input
                    type="tel"
                    value={editing.phone || ""}
                    onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-navy/10 rounded-xl text-sm text-navy outline-none focus:border-gold focus:ring-4 focus:ring-gold/10"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-navy/70 uppercase tracking-wider block mb-2">Email</label>
                  <input
                    type="email"
                    value={editing.email || ""}
                    onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-navy/10 rounded-xl text-sm text-navy outline-none focus:border-gold focus:ring-4 focus:ring-gold/10"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-navy/70 uppercase tracking-wider block mb-2">GST number</label>
                <input
                  type="text"
                  value={editing.gst_number || ""}
                  onChange={(e) => setEditing({ ...editing, gst_number: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-navy/10 rounded-xl text-sm text-navy outline-none focus:border-gold focus:ring-4 focus:ring-gold/10"
                />
              </div>
            </div>

            <div className="px-8 py-5 border-t border-navy/5 flex gap-3 justify-end bg-cream/30">
              <button onClick={() => setEditing(null)} className="px-5 py-3 border border-navy/10 rounded-xl font-medium text-navy hover:bg-cream transition">
                Cancel
              </button>
              <button onClick={handleSave} className="px-7 py-3 bg-gradient-to-b from-navy to-navy-light text-cream rounded-xl font-semibold shadow-lg shadow-navy/20 hover:-translate-y-0.5 transition-all">
                Save Changes
              </button>
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 bg-navy text-cream px-6 py-3 rounded-lg shadow-2xl z-[300] text-sm font-medium">
          {toast}
        </div>
      )}
    </div>
  );
}
