"use client";

import { useEffect, useState } from "react";
import { fetchDashboardStats, fetchBookings } from "./db";
import { getActiveHotelId } from "./active-hotel";

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const hotelId = getActiveHotelId() || undefined;
      const [s, b] = await Promise.all([
        fetchDashboardStats(hotelId),
        fetchBookings(hotelId),
      ]);
      setStats(s);
      setBookings(b);
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("hotel-changed", handler);
    return () => window.removeEventListener("hotel-changed", handler);
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading dashboard…</div>;
  }

  return (
    <div className="p-6 lg:p-8">
      <h1 className="font-serif text-4xl font-semibold text-navy mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Total Bookings" value={stats?.totalBookings ?? 0} color="blue" />
        <Stat label="Today Check-ins" value={stats?.todayCheckIns ?? 0} color="green" />
        <Stat label="Today Check-outs" value={stats?.todayCheckOuts ?? 0} color="rose" />
        <Stat label="In House" value={stats?.inHouse ?? 0} color="purple" />
      </div>

      <div className="bg-white rounded-2xl border p-6 mb-6">
        <p className="text-xs uppercase text-muted font-semibold mb-2">Total Revenue</p>
        <p className="text-3xl font-bold text-navy">
          ₹{(stats?.revenue ?? 0).toLocaleString("en-IN")}
        </p>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-navy">Recent Bookings</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Guest</th>
              <th className="px-4 py-3">Room</th>
              <th className="px-4 py-3">Check-in</th>
              <th className="px-4 py-3">Check-out</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {bookings.slice(0, 10).map((b: any) => (
              <tr key={b.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">
                  {b.primaryGuest?.name ?? b.guest?.name ?? "Guest"}
                </td>
                <td className="px-4 py-3">
                  {b.roomNumber ?? b.room?.room_number ?? "—"}
                </td>
                <td className="px-4 py-3">{b.check_in ?? b.checkIn}</td>
                <td className="px-4 py-3">{b.check_out ?? b.checkOut}</td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-1 rounded bg-gray-100">
                    {b.status}
                  </span>
                </td>
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No bookings yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: "from-blue-500 to-blue-600",
    green: "from-emerald-500 to-emerald-600",
    rose: "from-rose-500 to-rose-600",
    purple: "from-purple-500 to-purple-600",
  };
  return (
    <div className="bg-white rounded-2xl border p-5">
      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colors[color]} mb-3`} />
      <p className="text-xs uppercase text-muted font-semibold">{label}</p>
      <p className="text-2xl font-bold text-navy mt-1">{value}</p>
    </div>
  );
}