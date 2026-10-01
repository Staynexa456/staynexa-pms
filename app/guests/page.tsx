"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../supabase";
import { useActiveHotel } from "../lib/use-active-hotel";
import { updateGuest } from "../db";

type GuestRecord = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  company?: string;
  gst?: string;
  idType?: string;
  idNumber?: string;
  created_at?: string;
  // computed
  totalBookings?: number;
  totalSpent?: number;
  lastStay?: string;
};

export default function GuestsPage() {
  const { hotelId, loading: hotelLoading } = useActiveHotel();
  const [guests, setGuests] = useState<GuestRecord[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "name" | "spent">("recent");
  const [selectedGuest, setSelectedGuest] = useState<GuestRecord | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Partial<GuestRecord>>({});
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // ─── Load Guests (only this hotel's guests) ───
  const loadGuests = useCallback(async () => {
    if (!hotelId) {
      setGuests([]);
      setBookings([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);

      // ১. এই হোটেলের সব বুকিং আনা
      const { data: bookingsData, error: bErr } = await supabase
        .from("bookings")
        .select(
          `id, primary_guest_id, check_in, check_out, status, amount, tax, paid, booking_ref, source`
        )
        .eq("hotel_id", hotelId)
        .order("check_in", { ascending: false });

      if (bErr) throw bErr;

      const allBookings = bookingsData || [];
      setBookings(allBookings);

      // ২. ইউনিক গেস্ট আইডি বের করা
      const guestIds = Array.from(
        new Set(
          allBookings
            .map((b: any) => b.primary_guest_id)
            .filter(Boolean)
        )
      );

      if (guestIds.length === 0) {
        setGuests([]);
        setLoading(false);
        return;
      }

      // ৩. গেস্ট ডেটা আনা
      const { data: guestsData, error: gErr } = await supabase
        .from("guests")
        .select("*")
        .in("id", guestIds);

      if (gErr) throw gErr;

      // ৪. প্রতিটি গেস্টের বুকিং সংখ্যা এবং মোট খরচ হিসাব করা
      const enrichedGuests: GuestRecord[] = (guestsData || []).map((g: any) => {
        const guestBookings = allBookings.filter(
          (b: any) => b.primary_guest_id === g.id && b.status !== "CANCELLED"
        );
        const totalSpent = guestBookings.reduce(
          (sum: number, b: any) =>
            sum + (Number(b.amount) || 0) + (Number(b.tax) || 0),
          0
        );
        const lastStay = guestBookings[0]?.check_in || null;

        return {
          ...g,
          totalBookings: guestBookings.length,
          totalSpent,
          lastStay: lastStay || undefined,
        };
      });

      setGuests(enrichedGuests);
    } catch (err) {
      console.error("[Guests] Load error:", err);
      showToast("⚠ Failed to load guests");
    } finally {
      setLoading(false);
    }
  }, [hotelId]);

  useEffect(() => {
    if (hotelLoading) return;
    loadGuests();
    const handler = () => loadGuests();
    window.addEventListener("hotel-changed", handler);
    window.addEventListener("booking-updated", handler);
    return () => {
      window.removeEventListener("hotel-changed", handler);
      window.removeEventListener("booking-updated", handler);
    };
  }, [loadGuests, hotelLoading]);

  // ─── Filter & Sort ───
  const filteredGuests = useMemo(() => {
    let list = [...guests];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (g) =>
          (g.name || "").toLowerCase().includes(q) ||
          (g.phone || "").toLowerCase().includes(q) ||
          (g.email || "").toLowerCase().includes(q) ||
          (g.city || "").toLowerCase().includes(q) ||
          (g.company || "").toLowerCase().includes(q)
      );
    }

    switch (sortBy) {
      case "name":
        list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        break;
      case "spent":
        list.sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0));
        break;
      case "recent":
      default:
        list.sort((a, b) => {
          const da = a.lastStay ? new Date(a.lastStay).getTime() : 0;
          const db = b.lastStay ? new Date(b.lastStay).getTime() : 0;
          return db - da;
        });
        break;
    }

    return list;
  }, [guests, searchQuery, sortBy]);

  // ─── Stats ───
  const stats = useMemo(() => {
    const total = guests.length;
    const totalSpent = guests.reduce((s, g) => s + (g.totalSpent || 0), 0);
    const totalBookings = guests.reduce((s, g) => s + (g.totalBookings || 0), 0);
    const repeatGuests = guests.filter((g) => (g.totalBookings || 0) > 1).length;
    return { total, totalSpent, totalBookings, repeatGuests };
  }, [guests]);

  // ─── Guest Booking History ───
  const guestBookings = useMemo(() => {
    if (!selectedGuest) return [];
    return bookings
      .filter((b: any) => b.primary_guest_id === selectedGuest.id)
      .sort(
        (a: any, b: any) =>
          new Date(b.check_in).getTime() - new Date(a.check_in).getTime()
      );
  }, [selectedGuest, bookings]);

  // ─── Save Guest Edit ───
  const handleSaveGuest = async () => {
    if (!selectedGuest) return;
    try {
      await updateGuest(selectedGuest.id, editForm);
      showToast("✅ Guest updated successfully");
      setEditMode(false);
      setSelectedGuest(null);
      setEditForm({});
      await loadGuests();
    } catch (err: any) {
      showToast(`⚠ ${err.message || "Failed to update"}`);
    }
  };

  // ─── Loading / Empty States ───
  if (loading || hotelLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-slate-200 border-t-teal-600 animate-spin" />
          <p className="text-slate-500 font-medium text-sm">Loading guests...</p>
        </div>
      </div>
    );
  }

  const fmtINR = (n: number) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
  const fmtDate = (iso?: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* ─── Header ─── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Guests</h1>
            <p className="text-sm text-slate-500 mt-1">
              {stats.total} guests · {stats.totalBookings} total bookings
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                🔍
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, phone, email..."
                className="pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500 bg-white w-64"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-teal-500 bg-white"
            >
              <option value="recent">Recently Stayed</option>
              <option value="name">Name (A-Z)</option>
              <option value="spent">Highest Spent</option>
            </select>
            <button
              onClick={loadGuests}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* ─── Stats Cards ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Total Guests
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-2">{stats.total}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 border-l-4 border-l-emerald-500">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Total Spent
            </p>
            <p className="text-2xl font-bold text-emerald-600 mt-2">
              {fmtINR(stats.totalSpent)}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 border-l-4 border-l-amber-500">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Repeat Guests
            </p>
            <p className="text-2xl font-bold text-amber-600 mt-2">
              {stats.repeatGuests}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 border-l-4 border-l-sky-500">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Total Bookings
            </p>
            <p className="text-2xl font-bold text-sky-600 mt-2">
              {stats.totalBookings}
            </p>
          </div>
        </div>

        {/* ─── Guests Table ─── */}
        {filteredGuests.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
            <p className="text-5xl mb-4 opacity-40">👥</p>
            <h3 className="text-lg font-bold text-slate-700 mb-1">
              {guests.length === 0 ? "No guests yet" : "No guests match your search"}
            </h3>
            <p className="text-sm text-slate-400">
              {guests.length === 0
                ? "Guests will appear here once bookings are made."
                : "Try a different search term."}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Guest
                    </th>
                    <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="text-center px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Bookings
                    </th>
                    <th className="text-right px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Total Spent
                    </th>
                    <th className="text-right px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Last Stay
                    </th>
                    <th className="text-right px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredGuests.map((g) => (
                    <tr key={g.id} className="hover:bg-slate-50 transition">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 text-white flex items-center justify-center font-bold text-sm shrink-0">
                            {(g.name || "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">
                              {g.name || "Unknown"}
                            </p>
                            {g.company && (
                              <p className="text-[10px] text-slate-400 truncate">
                                🏢 {g.company}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="text-xs space-y-0.5">
                          {g.phone && <p className="text-slate-700">📞 {g.phone}</p>}
                          {g.email && (
                            <p className="text-slate-500 truncate max-w-[180px]">
                              ✉ {g.email}
                            </p>
                          )}
                          {!g.phone && !g.email && (
                            <p className="text-slate-400">—</p>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-xs text-slate-600">
                          {[g.city, g.state, g.country].filter(Boolean).join(", ") ||
                            "—"}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="inline-block px-2.5 py-1 bg-teal-50 text-teal-700 rounded-full text-xs font-bold">
                          {g.totalBookings || 0}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <p className="text-sm font-bold text-slate-800">
                          {fmtINR(g.totalSpent || 0)}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <p className="text-xs text-slate-500">
                          {fmtDate(g.lastStay)}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedGuest(g);
                            setEditForm({
                              name: g.name,
                              phone: g.phone,
                              email: g.email,
                              address: g.address,
                              city: g.city,
                              state: g.state,
                              pincode: g.pincode,
                              country: g.country,
                              company: g.company,
                              gst: g.gst,
                            });
                            setEditMode(false);
                          }}
                          className="px-3 py-1.5 text-xs font-bold text-teal-600 hover:bg-teal-50 rounded-lg transition"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ─── Guest Detail Modal ─── */}
      {selectedGuest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              setSelectedGuest(null);
              setEditMode(false);
              setEditForm({});
            }}
          />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 flex items-start justify-between sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white text-2xl font-bold">
                  {(selectedGuest.name || "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {selectedGuest.name || "Unknown Guest"}
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {selectedGuest.phone || "No phone"} ·{" "}
                    {selectedGuest.email || "No email"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedGuest(null);
                  setEditMode(false);
                  setEditForm({});
                }}
                className="text-white/70 hover:text-white text-2xl font-bold"
              >
                ✕
              </button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3 p-6 border-b border-slate-100">
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Bookings
                </p>
                <p className="text-lg font-bold text-slate-800 mt-1">
                  {selectedGuest.totalBookings || 0}
                </p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3 text-center">
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                  Total Spent
                </p>
                <p className="text-lg font-bold text-emerald-700 mt-1">
                  {fmtINR(selectedGuest.totalSpent || 0)}
                </p>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 text-center">
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                  Last Stay
                </p>
                <p className="text-xs font-bold text-amber-700 mt-1">
                  {fmtDate(selectedGuest.lastStay)}
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="p-6">
              {!editMode ? (
                <>
                  {/* Details View */}
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-slate-700">
                      Guest Details
                    </h3>
                    <button
                      onClick={() => setEditMode(true)}
                      className="px-3 py-1.5 bg-teal-600 text-white text-xs font-bold rounded-lg hover:bg-teal-700"
                    >
                      ✏️ Edit
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                    {[
                      { label: "Name", value: selectedGuest.name },
                      { label: "Phone", value: selectedGuest.phone },
                      { label: "Email", value: selectedGuest.email },
                      { label: "Company", value: selectedGuest.company },
                      { label: "GST", value: selectedGuest.gst },
                      { label: "Address", value: selectedGuest.address },
                      { label: "City", value: selectedGuest.city },
                      { label: "State", value: selectedGuest.state },
                      { label: "Pincode", value: selectedGuest.pincode },
                      { label: "Country", value: selectedGuest.country },
                    ].map((f) => (
                      <div key={f.label} className="bg-slate-50 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {f.label}
                        </p>
                        <p className="text-sm text-slate-800 mt-0.5">
                          {f.value || "—"}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Booking History */}
                  <h3 className="text-sm font-bold text-slate-700 mb-3">
                    Booking History ({guestBookings.length})
                  </h3>
                  {guestBookings.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">
                      No bookings found
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {guestBookings.slice(0, 10).map((b: any) => (
                        <div
                          key={b.id}
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-xl"
                        >
                          <div>
                            <p className="text-xs font-bold text-slate-800">
                              {b.booking_ref || b.id.slice(0, 8)}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {fmtDate(b.check_in)} → {fmtDate(b.check_out)}
                            </p>
                          </div>
                          <div className="text-right">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                b.status === "CHECKED-IN"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : b.status === "CONFIRMED"
                                  ? "bg-amber-100 text-amber-700"
                                  : b.status === "CHECKED-OUT"
                                  ? "bg-slate-100 text-slate-600"
                                  : "bg-rose-100 text-rose-700"
                              }`}
                            >
                              {b.status}
                            </span>
                            <p className="text-xs font-bold text-slate-700 mt-1">
                              {fmtINR(
                                (Number(b.amount) || 0) + (Number(b.tax) || 0)
                              )}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Edit Form */}
                  <h3 className="text-sm font-bold text-slate-700 mb-4">
                    Edit Guest
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { key: "name", label: "Name" },
                      { key: "phone", label: "Phone" },
                      { key: "email", label: "Email" },
                      { key: "company", label: "Company" },
                      { key: "gst", label: "GST" },
                      { key: "address", label: "Address" },
                      { key: "city", label: "City" },
                      { key: "state", label: "State" },
                      { key: "pincode", label: "Pincode" },
                      { key: "country", label: "Country" },
                    ].map((f) => (
                      <div key={f.key}>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          {f.label}
                        </label>
                        <input
                          type="text"
                          value={(editForm as any)[f.key] || ""}
                          onChange={(e) =>
                            setEditForm({ ...editForm, [f.key]: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-teal-500"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2 mt-6">
                    <button
                      onClick={() => {
                        setEditMode(false);
                        setEditForm({});
                      }}
                      className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveGuest}
                      className="px-5 py-2 bg-teal-600 text-white text-sm font-bold rounded-lg hover:bg-teal-700"
                    >
                      Save Changes
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Toast ─── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl text-sm font-semibold">
          {toast}
        </div>
      )}
    </div>
  );
}
