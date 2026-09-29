// app/admin/hotels/[id]/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../supabase";

type HotelDetail = {
  id: string;
  name: string;
  slug: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  gst_number: string | null;
  owner_id: string | null;
  is_active: boolean;
  subscription_plan: string | null;
  subscription_expires_at: string | null;
  created_at: string;
};

type HotelStats = {
  rooms: number;
  bookings: number;
  revenue: number;
  guests: number;
};

export default function HotelDetailPage() {
  const params = useParams();
  const router = useRouter();
  const hotelId = (params?.id as string) || "";

  const [hotel, setHotel] = useState<HotelDetail | null>(null);
  const [owner, setOwner] = useState<any>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [stats, setStats] = useState<HotelStats>({ rooms: 0, bookings: 0, revenue: 0, guests: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "rooms" | "bookings" | "payments">("overview");

  useEffect(() => {
    if (!hotelId) return;

    async function load() {
      setLoading(true);

      // Get hotel
      const { data: h, error: hErr } = await supabase
        .from("hotels")
        .select("*")
        .eq("id", hotelId)
        .maybeSingle();

      if (hErr || !h) {
        setLoading(false);
        return;
      }
      setHotel(h);

      // Get owner
      if (h.owner_id) {
        const { data: ownerData } = await supabase
          .from("hotel_users")
          .select("*")
          .eq("user_id", h.owner_id)
          .eq("role", "owner")
          .maybeSingle();
        setOwner(ownerData);
      }

      // Get rooms
      const { data: roomData } = await supabase
        .from("rooms")
        .select("*")
        .eq("hotel_id", hotelId)
        .order("room_number");
      setRooms(roomData || []);

      // Get bookings
      const { data: bookingData } = await supabase
        .from("bookings")
        .select(`
          *,
          guest:guests!primary_guest_id (name, phone, email),
          room:rooms!room_id (room_number, room_type)
        `)
        .eq("hotel_id", hotelId)
        .order("created_at", { ascending: false })
        .limit(50);
      setRecentBookings(bookingData || []);

      // Calculate stats
      const totalBookings = bookingData?.length || 0;
      const totalRevenue = (bookingData || []).reduce(
        (sum, b: any) => sum + (Number(b.amount) || 0) + (Number(b.tax) || 0),
        0
      );
      const uniqueGuests = new Set(
        (bookingData || []).map((b: any) => b.primary_guest_id).filter(Boolean)
      ).size;

      setStats({
        rooms: roomData?.length || 0,
        bookings: totalBookings,
        revenue: totalRevenue,
        guests: uniqueGuests,
      });

      setLoading(false);
    }

    load();
  }, [hotelId]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 rounded-full border-4 border-purple-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!hotel) {
    return (
      <div className="p-8 text-center">
        <p className="text-6xl mb-4">🏨</p>
        <h1 className="text-2xl font-bold text-white mb-2">Hotel Not Found</h1>
        <p className="text-slate-400 mb-6">This hotel does not exist or has been deleted.</p>
        <Link
          href="/admin/hotels"
          className="inline-block px-5 py-3 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 transition"
        >
          ← Back to Hotels
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Back button */}
      <Link
        href="/admin/hotels"
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6 transition"
      >
        ← Back to All Hotels
      </Link>

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/30 border border-purple-500/30 rounded-2xl p-6 mb-6">
        <div className="flex items-start gap-6 flex-wrap">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-3xl text-white font-bold shrink-0">
            {hotel.name?.charAt(0).toUpperCase()}
          </div>

          <div className="flex-1 min-w-[250px]">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h1 className="text-3xl font-bold text-white">{hotel.name}</h1>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                hotel.is_active
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-rose-500/20 text-rose-400"
              }`}>
                {hotel.is_active ? "ACTIVE" : "INACTIVE"}
              </span>
              {hotel.subscription_plan && (
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-400 uppercase">
                  {hotel.subscription_plan} PLAN
                </span>
              )}
            </div>
            <p className="text-sm text-slate-300">
              📍 {hotel.city || "—"}{hotel.state ? `, ${hotel.state}` : ""}
            </p>
            {hotel.slug && (
              <a
                href={`https://book.staynexa.in/${hotel.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-purple-400 hover:text-purple-300 mt-1 inline-block"
              >
                🔗 book.staynexa.in/{hotel.slug}
              </a>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-3 text-center">
              <p className="text-2xl font-bold text-white">{stats.rooms}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Rooms</p>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-3 text-center">
              <p className="text-2xl font-bold text-white">{stats.bookings}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Bookings</p>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-3 text-center">
              <p className="text-2xl font-bold text-white">{stats.guests}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Guests</p>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-3 text-center">
              <p className="text-2xl font-bold text-emerald-400">
                ₹{Math.round(stats.revenue / 1000)}K
              </p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Revenue</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {[
          { key: "overview", label: "Overview", icon: "📋" },
          { key: "rooms", label: `Rooms (${rooms.length})`, icon: "🛏️" },
          { key: "bookings", label: `Bookings (${recentBookings.length})`, icon: "📅" },
          { key: "payments", label: "Payments", icon: "💰" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition ${
              activeTab === tab.key
                ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                : "bg-slate-900 text-slate-400 hover:bg-slate-800"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Hotel Info */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4">Hotel Information</h2>
            <div className="space-y-3 text-sm">
              <Row label="Hotel Name" value={hotel.name} />
              <Row label="Slug" value={hotel.slug || "—"} />
              <Row label="City" value={hotel.city || "—"} />
              <Row label="State" value={hotel.state || "—"} />
              <Row label="Address" value={hotel.address || "—"} />
              <Row label="Phone" value={hotel.phone || "—"} />
              <Row label="Email" value={hotel.email || "—"} />
              <Row label="GST Number" value={hotel.gst_number || "—"} />
              <Row
                label="Created"
                value={new Date(hotel.created_at).toLocaleDateString("en-IN")}
              />
            </div>
          </div>

          {/* Owner Info */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4">Owner Information</h2>
            {owner ? (
              <div className="space-y-3 text-sm">
                <Row label="Name" value={owner.name || "—"} />
                <Row label="Email" value={owner.email || "—"} />
                <Row label="Phone" value={owner.phone || "—"} />
                <Row label="Role" value={owner.role || "—"} />
                <Row
                  label="Status"
                  value={owner.status === "active" ? "✅ Active" : `⏳ ${owner.status}`}
                />
                <Row
                  label="Joined"
                  value={new Date(owner.created_at).toLocaleDateString("en-IN")}
                />
              </div>
            ) : (
              <p className="text-sm text-slate-500">No owner assigned</p>
            )}
          </div>

          {/* Subscription Info */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4">Subscription</h2>
            <div className="space-y-3 text-sm">
              <Row
                label="Plan"
                value={hotel.subscription_plan?.toUpperCase() || "Free"}
              />
              <Row
                label="Expires"
                value={
                  hotel.subscription_expires_at
                    ? new Date(hotel.subscription_expires_at).toLocaleDateString("en-IN")
                    : "No expiry"
                }
              />
            </div>
            <Link
              href="/admin/subscriptions"
              className="inline-block mt-4 text-xs font-bold text-purple-400 hover:text-purple-300"
            >
              Manage Subscription →
            </Link>
          </div>

          {/* Booking Engine URL */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4">Booking Engine</h2>
            {hotel.slug ? (
              <>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl mb-3">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Public URL
                  </p>
                  <a
                    href={`https://book.staynexa.in/${hotel.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-purple-400 hover:text-purple-300 break-all"
                  >
                    https://book.staynexa.in/{hotel.slug}
                  </a>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`https://book.staynexa.in/${hotel.slug}`);
                  }}
                  className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-700 transition"
                >
                  📋 Copy URL
                </button>
              </>
            ) : (
              <p className="text-sm text-slate-500">No slug configured</p>
            )}
          </div>
        </div>
      )}

      {/* Rooms Tab */}
      {activeTab === "rooms" && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          {rooms.length === 0 ? (
            <p className="p-8 text-center text-slate-500">No rooms found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-950">
                  <tr>
                    <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase">Room #</th>
                    <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase">Type</th>
                    <th className="text-center px-5 py-3 text-[10px] font-bold text-slate-500 uppercase">Max Adults</th>
                    <th className="text-center px-5 py-3 text-[10px] font-bold text-slate-500 uppercase">Max Children</th>
                    <th className="text-right px-5 py-3 text-[10px] font-bold text-slate-500 uppercase">Base Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {rooms.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/40">
                      <td className="px-5 py-3 text-white font-bold">{r.room_number}</td>
                      <td className="px-5 py-3 text-slate-300">{r.room_type}</td>
                      <td className="px-5 py-3 text-center text-slate-400">{r.max_adults || 2}</td>
                      <td className="px-5 py-3 text-center text-slate-400">{r.max_children || 0}</td>
                      <td className="px-5 py-3 text-right text-emerald-400 font-bold">
                        ₹{(r.base_price || 0).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Bookings Tab */}
      {activeTab === "bookings" && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          {recentBookings.length === 0 ? (
            <p className="p-8 text-center text-slate-500">No bookings yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-950">
                  <tr>
                    <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase">Ref</th>
                    <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase">Guest</th>
                    <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase">Room</th>
                    <th className="text-center px-5 py-3 text-[10px] font-bold text-slate-500 uppercase">Dates</th>
                    <th className="text-center px-5 py-3 text-[10px] font-bold text-slate-500 uppercase">Status</th>
                    <th className="text-right px-5 py-3 text-[10px] font-bold text-slate-500 uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {recentBookings.slice(0, 30).map((b) => (
                    <tr key={b.id} className="hover:bg-slate-800/40">
                      <td className="px-5 py-3 font-mono text-xs text-slate-400">{b.booking_ref}</td>
                      <td className="px-5 py-3 text-slate-300">{b.guest?.name || "—"}</td>
                      <td className="px-5 py-3 text-slate-400 text-xs">
                        {b.room?.room_number || "—"}
                      </td>
                      <td className="px-5 py-3 text-center text-xs text-slate-400">
                        {b.check_in} → {b.check_out}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          b.status === "CONFIRMED"
                            ? "bg-blue-500/20 text-blue-400"
                            : b.status === "CHECKED-IN"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : b.status === "CANCELLED"
                            ? "bg-rose-500/20 text-rose-400"
                            : "bg-slate-700 text-slate-300"
                        }`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-emerald-400 font-bold">
                        ₹{((Number(b.amount) || 0) + (Number(b.tax) || 0)).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === "payments" && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
          <p className="text-4xl mb-3">💰</p>
          <p className="text-slate-400">Payment details available in Reports page</p>
          <Link
            href={`/reports?hotel=${hotel.id}`}
            className="inline-block mt-4 text-xs font-bold text-purple-400 hover:text-purple-300"
          >
            View Reports →
          </Link>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4 py-1.5 border-b border-slate-800 last:border-0">
      <span className="text-slate-500 text-xs font-medium">{label}</span>
      <span className="text-slate-200 text-xs font-semibold text-right break-all">
        {value}
      </span>
    </div>
  );
}
