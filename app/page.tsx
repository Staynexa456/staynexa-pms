"use client";

import { useEffect, useState, useCallback } from "react";
import { format, addDays, subDays } from "date-fns";
import {
  fetchDashboardStats,
  fetchBookingsByKpi,
  fetchRoomCategoryAvailability,
  invalidateCache,
  type DashboardKpi,
} from "./db";
import { getActiveHotelId } from "./active-hotel";

type Booking = any;

type Hotel = {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
};

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [roomAvailability, setRoomAvailability] = useState<any[]>([]);
  const [activeKpi, setActiveKpi] = useState<DashboardKpi>("newBookings");
  const [loading, setLoading] = useState(true);
  const [hotel, setHotel] = useState<Hotel>({});
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [sortBy, setSortBy] = useState<"name" | "checkIn" | "checkOut" | "bookingMade" | "bookingId" | "room">("bookingMade");
  const [searchQuery, setSearchQuery] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const hotelId = getActiveHotelId() || undefined;
      const [s, b, r] = await Promise.all([
        fetchDashboardStats(hotelId),
        fetchBookingsByKpi(hotelId, activeKpi),
        fetchRoomCategoryAvailability(hotelId),
      ]);
      setStats(s);
      setBookings(b);
      setRoomAvailability(r);

      // Load hotel details
      if (hotelId) {
        const { supabase } = await import('./supabase');
        const { data } = await supabase
          .from('hotels')
          .select('name, address, city, state')
          .eq('id', hotelId)
          .maybeSingle();
        if (data) setHotel(data);
      }
    } catch (err) {
      console.error('[dashboard] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [activeKpi]);

  useEffect(() => {
    loadAll();
    const handler = () => loadAll();
    window.addEventListener('hotel-changed', handler);

    // Auto-refresh every 30 seconds
    const interval = setInterval(loadAll, 30_000);

    return () => {
      window.removeEventListener('hotel-changed', handler);
      clearInterval(interval);
    };
  }, [loadAll]);

  const handleKpiClick = (kpi: DashboardKpi) => {
    setActiveKpi(kpi);
  };

  const handleRefresh = () => {
    invalidateCache();
    loadAll();
  };

  // Sort bookings
  const sortedBookings = [...bookings]
    .filter((b) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        (b.primaryGuest?.name || '').toLowerCase().includes(q) ||
        (b.primaryGuest?.phone || '').includes(q) ||
        (b.roomNumber || '').toLowerCase().includes(q) ||
        (b.booking_ref || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name': return (a.primaryGuest?.name || '').localeCompare(b.primaryGuest?.name || '');
        case 'checkIn': return (a.check_in || '').localeCompare(b.check_in || '');
        case 'checkOut': return (a.check_out || '').localeCompare(b.check_out || '');
        case 'room': return (a.roomNumber || '').localeCompare(b.roomNumber || '');
        case 'bookingId': return (a.booking_ref || '').localeCompare(b.booking_ref || '');
        default: return (b.created_at || '').localeCompare(a.created_at || '');
      }
    });

  const kpis: { key: DashboardKpi; label: string; count: number; color: string }[] = stats
    ? [
        { key: 'newBookings', label: 'New bookings', count: stats.newBookings, color: 'bg-blue-100 text-blue-900 border-blue-300' },
        { key: 'inHouse', label: 'In-house', count: stats.inHouse, color: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
        { key: 'arrivals', label: 'Arrivals', count: stats.arrivals, color: 'bg-yellow-100 text-yellow-900 border-yellow-300' },
        { key: 'departures', label: 'Departures', count: stats.departures, color: 'bg-sky-100 text-sky-900 border-sky-300' },
        { key: 'cancellations', label: 'Cancellations', count: stats.cancellations, color: 'bg-rose-100 text-rose-900 border-rose-300' },
        { key: 'onHold', label: 'On hold', count: stats.onHold, color: 'bg-slate-200 text-slate-800 border-slate-400' },
        { key: 'noShows', label: 'No shows', count: stats.noShows, color: 'bg-slate-300 text-slate-900 border-slate-500' },
        { key: 'magicLink', label: 'Magic link', count: stats.magicLink, color: 'bg-indigo-100 text-indigo-900 border-indigo-300' },
      ]
    : [];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* LEFT COLUMN */}
        <div>
          {/* HEADER */}
          <div className="mb-6">
            <h1 className="text-3xl font-semibold text-gray-900 mb-1">
              {(() => {
                const h = new Date().getHours();
                if (h < 12) return "Good morning";
                if (h < 17) return "Good afternoon";
                return "Good evening";
              })()}
            </h1>
            <p className="text-sm text-gray-600 flex items-center gap-2">
              Here is what going on with your property on
              <button
                onClick={() => setSelectedDate(new Date())}
                className="px-3 py-1 border rounded-md text-xs font-medium bg-white hover:bg-gray-50 flex items-center gap-2"
              >
                📅 {format(selectedDate, 'dd MMM yyyy')}
                <span className="text-gray-400">▾</span>
              </button>
            </p>
          </div>

          {/* KPI CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-5">
            {kpis.map((k) => (
              <button
                key={k.key}
                onClick={() => handleKpiClick(k.key)}
                className={`rounded-lg p-3 text-center transition-all border-2 ${
                  activeKpi === k.key
                    ? 'ring-2 ring-offset-1 ring-blue-500 ' + k.color
                    : k.color + ' opacity-80 hover:opacity-100'
                }`}
              >
                <div className="text-2xl font-bold">{k.count}</div>
                <div className="text-[11px] font-medium uppercase tracking-wide mt-1">
                  {k.label}
                </div>
              </button>
            ))}
          </div>

          {/* SEARCH + FILTERS */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <input
              type="text"
              placeholder="Search tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-2 border rounded-md text-sm w-64 bg-white"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border rounded-md text-sm bg-white"
            >
              <option value="bookingMade">Booking made on</option>
              <option value="name">Name</option>
              <option value="checkIn">Check-in</option>
              <option value="checkOut">Check-out</option>
              <option value="bookingId">Booking ID</option>
              <option value="room">Room number</option>
            </select>
            <select className="px-3 py-2 border rounded-md text-sm bg-white">
              <option>All</option>
            </select>
            <button className="px-3 py-2 border rounded-md text-sm bg-white hover:bg-gray-50 flex items-center gap-1.5">
              <span>⬇</span> Download
            </button>
            <button
              onClick={handleRefresh}
              className="px-3 py-2 border rounded-md text-sm bg-white hover:bg-gray-50 ml-auto"
              disabled={loading}
            >
              {loading ? '⏳ Loading…' : '🔄 Refresh'}
            </button>
            <span className="text-xs text-gray-500">
              {sortedBookings.length} results found
            </span>
          </div>

          {/* BOOKINGS LIST */}
          <div className="space-y-3">
            {loading && (
              <div className="bg-white rounded-lg border p-12 text-center text-gray-500">
                Loading bookings…
              </div>
            )}

            {!loading && sortedBookings.length === 0 && (
              <div className="bg-white rounded-lg border p-12 text-center text-gray-500">
                No {kpis.find((k) => k.key === activeKpi)?.label.toLowerCase() || 'bookings'} for this property.
              </div>
            )}

            {!loading && sortedBookings.map((b) => (
              <BookingRow key={b.id} booking={b} />
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN — Availability */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border p-4">
            <h2 className="font-semibold text-gray-900 mb-3">Availability Today</h2>

            <div className="grid grid-cols-3 gap-2 text-xs text-gray-500 font-medium mb-2 px-1">
              <div>Room category</div>
              <div className="text-center">Inventory</div>
              <div className="text-right">Base Price</div>
            </div>

            {roomAvailability.length === 0 ? (
              <p className="text-sm text-gray-400 py-3 text-center">No rooms configured</p>
            ) : (
              <div className="space-y-1">
                {roomAvailability.map((r) => (
                  <div key={r.name} className="grid grid-cols-3 gap-2 text-sm py-2 border-b last:border-b-0">
                    <div className="truncate font-medium text-gray-700">{r.name}</div>
                    <div className={`text-center font-semibold ${r.inventory === 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {r.inventory}
                    </div>
                    <div className="text-right text-gray-600">
                      ₹ {Number(r.base_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 text-sm py-3 mt-2 border-t font-semibold text-gray-900">
              <div>Total Available</div>
              <div className="text-center text-emerald-600">
                {roomAvailability.reduce((s, r) => s + (r.inventory || 0), 0)}
              </div>
              <div></div>
            </div>
          </div>

          {/* Razorpay promo card (like Stayflexi) */}
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
            <span className="inline-block bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded mb-2">
              OVERDUE
            </span>
            <h3 className="font-semibold text-gray-900 text-sm mb-2">
              Complete Razorpay onboarding
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed mb-3">
              As per RBI guidelines, all merchants should complete the KYC process in order to use Razorpay payment gateway.
            </p>
            <button className="w-full bg-black text-white text-sm font-medium py-2 rounded-md hover:bg-gray-800">
              SETUP NOW
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// BOOKING ROW COMPONENT
// ─────────────────────────────────────────────
function BookingRow({ booking: b }: { booking: any }) {
  const [expanded, setExpanded] = useState(false);

  const statusColors: Record<string, string> = {
    CONFIRMED: 'bg-amber-100 text-amber-800',
    'CHECKED-IN': 'bg-emerald-100 text-emerald-800',
    'CHECKED-OUT': 'bg-gray-200 text-gray-700',
    CANCELLED: 'bg-rose-100 text-rose-800',
    'ON-HOLD': 'bg-purple-100 text-purple-800',
    BLOCKED: 'bg-slate-200 text-slate-700',
  };

  const status = b.status || 'CONFIRMED';
  const checkInFmt = b.check_in ? format(new Date(b.check_in), 'MMM dd, yyyy hh:mm a') : '—';
  const checkOutFmt = b.check_out ? format(new Date(b.check_out), 'MMM dd, yyyy hh:mm a') : '—';
  const balance = Number(b.amount || 0) - Number(b.paid_amount || 0);

  return (
    <div className="bg-white rounded-lg border hover:shadow-sm transition">
      <div className="p-4 flex items-start gap-4">
        {/* Room number badge */}
        <div className="flex flex-col items-center min-w-[60px] pt-1">
          <span className="text-lg font-bold text-gray-900">{b.roomNumber ?? '—'}</span>
          <span className="text-[10px] text-gray-400">🔑</span>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-3 mb-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-gray-900">{b.primaryGuest?.name ?? 'Guest'}</h3>
                {b.is_no_show && (
                  <span className="text-[10px] font-bold bg-rose-600 text-white px-1.5 py-0.5 rounded">
                    NO SHOW
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">{b.primaryGuest?.phone || 'NA'}</p>
              <p className="text-xs text-gray-700 mt-1">
                <span className="font-medium">{checkInFmt}</span> - <span className="font-medium">{checkOutFmt}</span>
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">{b.booking_ref}</p>
            </div>

            {/* Right — Amount + status */}
            <div className="text-right shrink-0">
              <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded ${statusColors[status] || 'bg-gray-100'}`}>
                {status}
              </span>
              <p className="text-base font-bold text-gray-900 mt-1">
                ₹ {Number(b.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <p className={`text-xs ${balance > 0 ? 'text-rose-600 font-medium' : 'text-gray-400'}`}>
                Bal: ₹ {balance.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Room type row */}
          <div className="flex items-center justify-between gap-4 mt-3">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs">🏨</div>
              <div>
                <p className="font-medium text-gray-800 text-sm">{b.roomType ?? 'Room'}</p>
                <p className="text-[11px] text-gray-500">{b.rate_plan || 'Room Only'} · 👥 ({b.adults || 0} / {b.children || 0})</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {status === 'CONFIRMED' && (
                <button className="px-3 py-1.5 border rounded-md text-xs font-medium hover:bg-gray-50">
                  Check-in
                </button>
              )}
              <button className="px-3 py-1.5 border rounded-md text-xs font-medium hover:bg-gray-50">
                View folio
              </button>
              <button className="px-3 py-1.5 bg-black text-white rounded-md text-xs font-medium hover:bg-gray-800 flex items-center gap-1">
                ✨ Send magic link
              </button>
              <button
                onClick={() => setExpanded(!expanded)}
                className="px-2 py-1.5 text-gray-400 hover:text-gray-700"
              >
                {expanded ? '▲' : '▼'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t bg-gray-50 px-4 py-3 text-xs text-gray-600 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><span className="text-gray-400">Email:</span> {b.primaryGuest?.email || '—'}</div>
          <div><span className="text-gray-400">Booking source:</span> {b.source || '—'}</div>
          <div><span className="text-gray-400">Notes:</span> {b.notes || '—'}</div>
          <div><span className="text-gray-400">Hotel:</span> {b.hotelName || '—'}</div>
        </div>
      )}
    </div>
  );
}