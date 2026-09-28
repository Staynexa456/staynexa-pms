// app/book/[slug]/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  fetchHotelBySlug,
  fetchPublicConfig,
  fetchPublicRoomTypes,
  fetchPublicAddons,
  validatePromoCode,
  checkAvailabilityBatch,
  computeTax,
  getPriceForOccupancy,
  type PublicHotel,
  type PublicRoomType,
  type PublicRatePlan,
  type BookingEngineConfig,
} from "../../lib/public-booking";
import { createReservation } from "../../db";

// ─── Helpers ───
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function nightsBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.max(1, Math.round((new Date(by, bm - 1, bd).getTime() - new Date(ay, am - 1, ad).getTime()) / 86400000));
}
function prettyDate(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[m - 1]} ${y}`;
}
function weekdayShort(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[new Date(y, m - 1, d).getDay()];
}

// ─── Script Loaders ───
function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve();
    if ((window as any).Razorpay) return resolve();
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    document.body.appendChild(script);
  });
}
function loadCashfreeScript(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve();
    if ((window as any).Cashfree) return resolve();
    const script = document.createElement("script");
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.onload = () => resolve();
    document.body.appendChild(script);
  });
}

export default function PublicBookingPage() {
  const params = useParams();
  const slug = (params?.slug as string) || "";

  const [hotel, setHotel] = useState<PublicHotel | null>(null);
  const [config, setConfig] = useState<BookingEngineConfig | null>(null);
  const [roomTypes, setRoomTypes] = useState<PublicRoomType[]>([]);
  const [addons, setAddons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [disabled, setDisabled] = useState(false);

  const [checkIn, setCheckIn] = useState(todayISO());
  const [checkOut, setCheckOut] = useState(addDays(todayISO(), 1));
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);

  const [availability, setAvailability] = useState<Record<string, number>>({});
  const [checkingAvail, setCheckingAvail] = useState(false);
  const [bookingRoom, setBookingRoom] = useState<{ room: PublicRoomType; plan: PublicRatePlan } | null>(null);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // Filter & Sort
  const [sortBy, setSortBy] = useState<"popular" | "price-asc" | "price-desc">("popular");
  const [maxPrice, setMaxPrice] = useState<number>(50000);

  const nights = nightsBetween(checkIn, checkOut);

  // ═══════════════════════════════════════════════
  // Load data
  // ═══════════════════════════════════════════════
  const load = useCallback(async () => {
    if (!slug) return;
    try {
      setLoading(true);
      const h = await fetchHotelBySlug(slug);
      if (!h) { setNotFound(true); setLoading(false); return; }
      setHotel(h);

      const [c, rt, ad] = await Promise.all([
        fetchPublicConfig(h.id),
        fetchPublicRoomTypes(h.id),
        fetchPublicAddons(h.id),
      ]);

      if (!c || !c.is_enabled) { setDisabled(true); setLoading(false); return; }
      setConfig(c);
      setRoomTypes(rt);
      setAddons(ad);
    } catch (err) {
      console.error(err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  // ═══════════════════════════════════════════════
  // Check availability
  // ═══════════════════════════════════════════════
  const checkAllAvailability = useCallback(async () => {
    if (!hotel || roomTypes.length === 0) return;
    setCheckingAvail(true);
    try {
      const results = await checkAvailabilityBatch(hotel.id, checkIn, checkOut);
      setAvailability(results);
    } catch (err) { console.error(err); }
    finally { setCheckingAvail(false); }
  }, [hotel, roomTypes, checkIn, checkOut]);

  useEffect(() => {
    if (hotel && roomTypes.length > 0) checkAllAvailability();
  }, [hotel, roomTypes, checkIn, checkOut, checkAllAvailability]);

  const handleBookingCreated = () => { setBookingRoom(null); checkAllAvailability(); };
  const scrollToRooms = () => { document.getElementById("rooms-section")?.scrollIntoView({ behavior: "smooth" }); };

  // ═══════════════════════════════════════════════
  // Filter + Sort
  // ═══════════════════════════════════════════════
  const filteredRooms = useMemo(() => {
    return roomTypes
      .filter((r) => (r.base_price || 0) <= maxPrice)
      .sort((a, b) => {
        if (sortBy === "price-asc") return (a.base_price || 0) - (b.base_price || 0);
        if (sortBy === "price-desc") return (b.base_price || 0) - (a.base_price || 0);
        return 0;
      });
  }, [roomTypes, sortBy, maxPrice]);

  // ═══════════════════════════════════════════════
  // Loading / Not Found states
  // ═══════════════════════════════════════════════
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center animate-pulse">
            <span className="text-2xl">🏨</span>
          </div>
          <p className="text-xs text-slate-400 font-medium tracking-widest uppercase">Loading</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center max-w-md">
          <p className="text-6xl mb-4">🏨</p>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Hotel Not Found</h1>
          <p className="text-sm text-slate-500">The booking link doesn't match any hotel.</p>
        </div>
      </div>
    );
  }

  if (disabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center max-w-md">
          <p className="text-6xl mb-4">⏸</p>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Booking Temporarily Unavailable</h1>
          <p className="text-sm text-slate-500">Please contact the hotel directly.</p>
        </div>
      </div>
    );
  }

  const themeColor = config?.theme_color || "#0f172a";

  return (
    <div className="min-h-screen bg-white font-sans antialiased">
      {/* ═══ HEADER ═══ */}
      <header className="absolute top-0 left-0 right-0 z-40 px-6 lg:px-16 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {config?.logo_url ? (
            <img src={config.logo_url} alt={hotel?.name} className="h-11 object-contain" />
          ) : (
            <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-serif text-lg bg-white/10 backdrop-blur-md border border-white/20">
              {hotel?.name?.charAt(0) || "H"}
            </div>
          )}
          <div className="hidden md:block">
            <h1 className="text-base font-serif font-semibold text-white tracking-wide">{hotel?.name}</h1>
            {hotel?.city && (
              <p className="text-[10px] text-white/60 uppercase tracking-[0.2em]">
                {hotel.city}{hotel.state ? `, ${hotel.state}` : ""}
              </p>
            )}
          </div>
        </div>
        <nav className="hidden lg:flex items-center gap-8 text-sm text-white/80">
          <a href="#rooms-section" className="hover:text-white transition">Rooms</a>
          {config?.show_about_section !== false && config?.about_description && (<a href="#about-section" className="hover:text-white transition">About</a>)}
          {config?.show_amenities_section !== false && config?.amenities && config.amenities.length > 0 && (<a href="#amenities-section" className="hover:text-white transition">Amenities</a>)}
          {config?.show_gallery_section !== false && config?.gallery_images && config.gallery_images.length > 0 && (<a href="#gallery-section" className="hover:text-white transition">Gallery</a>)}
          {config?.show_map !== false && config?.map_embed_url && (<a href="#map-section" className="hover:text-white transition">Location</a>)}
        </nav>
        {config?.contact_phone && (
          <a href={`tel:${config.contact_phone}`} className="hidden md:flex items-center gap-2 text-xs font-medium text-white/80 hover:text-white transition tracking-wide">
            <span className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">📞</span>
            {config.contact_phone}
          </a>
        )}
      </header>

      {/* ═══ HERO ═══ */}
      {config?.show_hero_banner !== false ? (
        <section className="relative h-[680px] overflow-hidden">
          <div className="absolute inset-0 bg-cover bg-center scale-105 animate-[zoom_20s_ease-in-out_infinite]" style={{ backgroundImage: config?.hero_banner_url ? `url(${config.hero_banner_url})` : roomTypes[0]?.photo_url ? `url(${roomTypes[0].photo_url})` : "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)" }} />
          <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, rgba(15,23,42,${config?.hero_overlay_opacity || 0.6}) 0%, rgba(15,23,42,${(config?.hero_overlay_opacity || 0.6) * 0.5}) 50%, rgba(15,23,42,${(config?.hero_overlay_opacity || 0.6) * 1.1}) 100%)` }} />
          <div className="relative h-full flex flex-col items-center justify-center text-center px-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-6">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] tracking-[0.2em] uppercase text-white/90 font-medium">Now Accepting Bookings</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-serif font-semibold text-white mb-6 max-w-4xl leading-[1.05] tracking-tight">
              {config?.hero_title || hotel?.name}
            </h1>
            <div className="w-24 h-[2px] bg-gradient-to-r from-transparent via-white/60 to-transparent mx-auto mb-6" />
            <p className="text-lg md:text-xl text-white/85 max-w-2xl font-light leading-relaxed">
              {config?.hero_subtitle || "An unforgettable stay awaits you"}
            </p>
          </div>
        </section>
      ) : (
        <section className="relative pt-40 pb-24 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
          <div className="relative text-center px-6">
            <h1 className="text-5xl md:text-7xl font-serif font-semibold text-white mb-6 max-w-4xl mx-auto leading-tight">{config?.hero_title || hotel?.name}</h1>
            <div className="w-24 h-[2px] bg-gradient-to-r from-transparent via-white/60 to-transparent mx-auto mb-6" />
            <p className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto font-light">{config?.hero_subtitle || "An unforgettable stay awaits you"}</p>
          </div>
        </section>
      )}

      {/* ═══ SEARCH BAR (with Adults/Children) ═══ */}
      <section className="relative px-4 -mt-20 z-20">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-3xl shadow-[0_25px_70px_-20px_rgba(0,0,0,0.3)] border border-slate-100/50 p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2 block">Check-in</label>
                <input type="date" value={checkIn} min={todayISO()} onChange={(e) => { setCheckIn(e.target.value); if (e.target.value >= checkOut) setCheckOut(addDays(e.target.value, 1)); }} className="w-full px-3 py-3 border-b border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-slate-900 bg-transparent" />
                <p className="text-[10px] text-slate-400 mt-1">{weekdayShort(checkIn)}</p>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2 block">Check-out</label>
                <input type="date" value={checkOut} min={addDays(checkIn, 1)} onChange={(e) => setCheckOut(e.target.value)} className="w-full px-3 py-3 border-b border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-slate-900 bg-transparent" />
                <p className="text-[10px] text-slate-400 mt-1">{weekdayShort(checkOut)}</p>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2 block">Adults</label>
                <select value={adults} onChange={(e) => setAdults(Number(e.target.value))} className="w-full px-3 py-3 border-b border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-slate-900 bg-transparent">
                  {[1, 2, 3, 4, 5, 6].map((n) => (<option key={n} value={n}>{n} Adult{n > 1 ? "s" : ""}</option>))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2 block">Children</label>
                <select value={children} onChange={(e) => setChildren(Number(e.target.value))} className="w-full px-3 py-3 border-b border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-slate-900 bg-transparent">
                  {[0, 1, 2, 3, 4].map((n) => (<option key={n} value={n}>{n} Child{n !== 1 ? "ren" : ""}</option>))}
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={() => { checkAllAvailability(); scrollToRooms(); }} disabled={checkingAvail} className="w-full py-4 rounded-2xl text-[11px] font-bold text-white transition hover:opacity-95 disabled:opacity-50 uppercase tracking-[0.2em] shadow-lg shadow-slate-900/20" style={{ background: themeColor }}>
                  {checkingAvail ? "Searching..." : "Check Availability"}
                </button>
              </div>
            </div>
            <div className="mt-5 pt-5 border-t border-slate-100 flex items-center justify-center gap-3 text-xs text-slate-500 flex-wrap">
              <span>🗓️</span>
              <span className="font-medium">{prettyDate(checkIn)} — {prettyDate(checkOut)}</span>
              <span className="text-slate-300">|</span>
              <span className="font-semibold text-slate-700">{nights} {nights > 1 ? "nights" : "night"}</span>
              <span className="text-slate-300">|</span>
              <span className="font-semibold text-emerald-600">👥 {adults} Adult{adults > 1 ? "s" : ""}{children > 0 ? `, ${children} Child${children > 1 ? "ren" : ""}` : ""}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ ROOMS ═══ */}
      <section id="rooms-section" className="px-6 lg:px-16 py-24 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-[11px] tracking-[0.4em] uppercase text-slate-400 mb-3 font-medium">Rooms & Suites</p>
          <h2 className="text-4xl md:text-5xl font-serif font-semibold text-slate-900 tracking-tight">Choose Your Perfect Stay</h2>
          <div className="w-20 h-[2px] bg-gradient-to-r from-transparent via-slate-400 to-transparent mx-auto mt-6" />
        </div>

        {roomTypes.length > 0 && (
          <div className="mb-8 bg-slate-50/70 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sort:</span>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:border-teal-500 outline-none">
                <option value="popular">Recommended</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Max Price:</span>
              <select value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:border-teal-500 outline-none">
                <option value="50000">Any Price</option>
                <option value="2000">Under ₹2,000</option>
                <option value="3000">Under ₹3,000</option>
                <option value="5000">Under ₹5,000</option>
                <option value="8000">Under ₹8,000</option>
                <option value="15000">Under ₹15,000</option>
              </select>
            </div>
            <span className="ml-auto text-xs text-slate-500 font-medium">
              {filteredRooms.length} room {filteredRooms.length === 1 ? "type" : "types"} available
            </span>
          </div>
        )}

        {filteredRooms.length === 0 && (
          <div className="bg-slate-50 rounded-3xl border border-slate-100 p-20 text-center">
            <p className="text-5xl mb-4">🔍</p>
            <p className="font-semibold text-slate-700 text-lg">No rooms match your filters</p>
            <p className="text-sm text-slate-400 mt-1">Try adjusting your filters or dates</p>
          </div>
        )}

        <div className="space-y-8">
          {filteredRooms.map((room) => {
            const avail = availability[room.room_type];
            const isAvailable = avail === undefined ? true : avail > 0;

            return (
              <div key={room.room_type} className={`group bg-white rounded-3xl border overflow-hidden transition-all duration-500 ${isAvailable ? "border-slate-200 hover:border-slate-300 hover:shadow-[0_30px_70px_-25px_rgba(0,0,0,0.2)]" : "border-slate-200 opacity-75"}`}>
                <div className="flex flex-col lg:flex-row">
                  {/* Image */}
                  <div className="lg:w-[420px] h-72 lg:h-auto bg-slate-100 shrink-0 relative overflow-hidden">
                    <RoomPhotoGallery photos={room.photos && room.photos.length > 0 ? room.photos : room.photo_url ? [room.photo_url] : []} roomType={room.room_type} />
                    <div className="absolute top-4 left-4 right-4 flex items-start justify-between pointer-events-none z-10">
                      <div className="flex flex-col gap-2">
                        {isAvailable && avail !== undefined && (
                          <span className="px-3 py-1.5 bg-emerald-500 text-white rounded-full text-[10px] font-bold uppercase tracking-wider shadow-lg backdrop-blur-sm">✓ {avail} Available</span>
                        )}
                        {!isAvailable && (<span className="px-3 py-1.5 bg-slate-900 text-white rounded-full text-[10px] font-bold uppercase tracking-wider shadow-lg">Sold Out</span>)}
                      </div>
                      {room.rate_plans && room.rate_plans.length > 1 && (
                        <span className="px-3 py-1.5 bg-white/95 backdrop-blur-sm text-slate-800 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm">{room.rate_plans.length} Rates</span>
                      )}
                    </div>
                    {!isAvailable && (
                      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-[2px] flex flex-col items-center justify-center z-20">
                        <span className="text-4xl mb-3">🚫</span>
                        <span className="px-6 py-3 bg-white text-slate-900 rounded-full text-xs font-bold uppercase tracking-[0.2em] shadow-xl mb-3">Sold Out</span>
                        <p className="text-white/80 text-xs font-medium mb-4">Not available for {prettyDate(checkIn)} — {prettyDate(checkOut)}</p>
                        <button onClick={() => { const nextDay = addDays(checkIn, 1); const nextDayOut = addDays(nextDay, 1); setCheckIn(nextDay); setCheckOut(nextDayOut); setTimeout(() => checkAllAvailability(), 100); }} className="px-5 py-2.5 rounded-xl bg-white text-slate-900 text-[11px] font-bold uppercase tracking-[0.15em] hover:bg-teal-50 transition shadow-lg">📅 Try Next Day</button>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-7 lg:p-9">
                    <div className="mb-5">
                      <h3 className="text-2xl lg:text-3xl font-serif font-semibold text-slate-900 mb-2 tracking-tight">{room.room_type}</h3>
                      <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                        <span className="flex items-center gap-1.5"><span className="text-slate-400">👤</span> Max {room.max_adults} Adults</span>
                        {room.max_children > 0 && (<span className="flex items-center gap-1.5"><span className="text-slate-400">🧒</span> Max {room.max_children} Children</span>)}
                        {room.total_rooms && (<span className="flex items-center gap-1.5"><span className="text-slate-400">🏨</span> {room.total_rooms} Rooms</span>)}
                      </div>
                    </div>

                    {/* Quick Details */}
                    <div className="flex flex-wrap gap-2 mb-5">
                      {room.bed_type && (<span className="text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold">🛏️ {room.bed_type}{room.bed_count && room.bed_count > 1 ? ` × ${room.bed_count}` : ""}</span>)}
                      {room.room_size && (<span className="text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold">📐 {room.room_size}</span>)}
                      {room.view_type && (<span className="text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold">👁️ {room.view_type}</span>)}
                      {room.floor_type && (<span className="text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold">🏢 {room.floor_type}</span>)}
                      {room.amenities && room.amenities.slice(0, 3).map((a: string, i: number) => (<span key={i} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-teal-50 text-teal-700 font-semibold">✓ {a}</span>))}
                      {room.amenities && room.amenities.length > 3 && (<span className="text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-50 text-slate-500 font-semibold">+{room.amenities.length - 3} more</span>)}
                    </div>

                    {room.description && (<p className="text-sm text-slate-500 mb-6 leading-relaxed line-clamp-2">{room.description}</p>)}

                    {/* Rate Plans (with adult-based price) */}
                    <div className="space-y-3">
                      {room.rate_plans.map((plan, idx) => {
                        // ✅ Occupancy অনুযায়ী দাম
                        const perNight = getPriceForOccupancy(plan, adults, children);
                        const total = perNight * nights;
                        const isFirst = idx === 0;
                        return (
                          <div key={plan.code} className={`flex items-center justify-between p-5 rounded-2xl transition border-2 ${isFirst ? "border-teal-500/30 bg-gradient-to-r from-teal-50/50 to-emerald-50/30" : "border-slate-100 hover:border-slate-200 bg-white"}`}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="text-[10px] font-bold px-2.5 py-1 rounded-md text-white uppercase tracking-wider" style={{ background: isFirst ? themeColor : "#64748b" }}>{plan.code}</span>
                                <p className="text-base font-bold text-slate-800 truncate">{plan.name}</p>
                                {isFirst && (<span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 uppercase tracking-wider">Best Value</span>)}
                              </div>
                              {plan.description && (<p className="text-xs text-slate-500 mt-1 line-clamp-1">{plan.description}</p>)}
                              <p className="text-[10px] text-emerald-600 font-bold mt-1">✓ Price for {adults} Adult{adults > 1 ? "s" : ""}{children > 0 ? ` + ${children} Child${children > 1 ? "ren" : ""}` : ""}</p>
                            </div>
                            <div className="text-right ml-4 shrink-0">
                              {!isAvailable && (<span className="inline-block mb-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 uppercase tracking-wider">Sold Out</span>)}
                              <p className={`text-2xl lg:text-3xl font-serif font-bold tracking-tight ${isAvailable ? "text-slate-900" : "text-slate-400 line-through"}`}>₹{total.toLocaleString("en-IN")}</p>
                              <p className="text-[11px] text-slate-500 font-medium">₹{perNight.toLocaleString("en-IN")} × {nights} night{nights > 1 ? "s" : ""}</p>
                              {isAvailable ? (
                                <button onClick={() => setBookingRoom({ room, plan })} className="mt-2 px-6 py-2.5 rounded-xl text-[11px] font-bold text-white uppercase tracking-[0.15em] transition hover:opacity-90 shadow-md" style={{ background: isFirst ? themeColor : "#0f172a" }}>Book Now</button>
                              ) : (
                                <button onClick={() => { const nextDay = addDays(checkIn, 1); const nextDayOut = addDays(nextDay, 1); setCheckIn(nextDay); setCheckOut(nextDayOut); setTimeout(() => checkAllAvailability(), 100); document.getElementById("rooms-section")?.scrollIntoView({ behavior: "smooth" }); }} className="mt-2 px-6 py-2.5 rounded-xl text-[11px] font-bold text-rose-600 uppercase tracking-[0.15em] bg-rose-50 border-2 border-rose-200 hover:bg-rose-100 transition shadow-sm">🔄 Check Another Date</button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ═══ ABOUT ═══ */}
      {config?.show_about_section !== false && (config?.about_description || config?.about_title) && (
        <section id="about-section" className="px-6 lg:px-16 py-24 bg-slate-50">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <p className="text-[11px] tracking-[0.4em] uppercase text-slate-400 mb-3 font-medium">About Us</p>
                <h2 className="text-4xl md:text-5xl font-serif font-semibold text-slate-900 mb-6 tracking-tight leading-tight">{config?.about_title || "Welcome to Our Hotel"}</h2>
                <div className="w-20 h-[2px] bg-gradient-to-r from-slate-400 to-transparent mb-6" />
                <p className="text-base text-slate-600 leading-relaxed whitespace-pre-wrap">{config?.about_description || ""}</p>
              </div>
              {config?.about_image_url && (<div className="relative h-[500px] rounded-3xl overflow-hidden shadow-2xl"><img src={config.about_image_url} alt="About" className="w-full h-full object-cover" /></div>)}
            </div>
          </div>
        </section>
      )}

      {/* ═══ AMENITIES ═══ */}
      {config?.show_amenities_section !== false && config?.amenities && config.amenities.length > 0 && (
        <section id="amenities-section" className="px-6 lg:px-16 py-24 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-[11px] tracking-[0.4em] uppercase text-slate-400 mb-3 font-medium">Facilities</p>
              <h2 className="text-4xl md:text-5xl font-serif font-semibold text-slate-900 tracking-tight">Hotel Amenities</h2>
              <div className="w-20 h-[2px] bg-gradient-to-r from-transparent via-slate-400 to-transparent mx-auto mt-6" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {config.amenities.map((amenity, idx) => (
                <div key={idx} className="bg-gradient-to-br from-slate-50 to-white rounded-2xl p-6 border border-slate-100 hover:border-slate-300 hover:shadow-md transition-all duration-300 text-center">
                  <p className="text-sm font-semibold text-slate-800">{amenity}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ GALLERY ═══ */}
      {config?.show_gallery_section !== false && config?.gallery_images && config.gallery_images.length > 0 && (
        <section id="gallery-section" className="px-6 lg:px-16 py-24 bg-slate-50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-[11px] tracking-[0.4em] uppercase text-slate-400 mb-3 font-medium">Photo Gallery</p>
              <h2 className="text-4xl md:text-5xl font-serif font-semibold text-slate-900 tracking-tight">{config?.gallery_title || "Photo Gallery"}</h2>
              <div className="w-20 h-[2px] bg-gradient-to-r from-transparent via-slate-400 to-transparent mx-auto mt-6" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {config.gallery_images.map((url, idx) => (
                <div key={idx} className={`rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 cursor-pointer ${idx === 0 ? "col-span-2 row-span-2 h-[450px]" : "h-[215px]"}`}>
                  <img src={url} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ TESTIMONIALS ═══ */}
      {config?.show_testimonials !== false && config?.testimonials && config.testimonials.length > 0 && (
        <section className="px-6 lg:px-16 py-24 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-[11px] tracking-[0.4em] uppercase text-slate-400 mb-3 font-medium">Testimonials</p>
              <h2 className="text-4xl md:text-5xl font-serif font-semibold text-slate-900 tracking-tight">What Our Guests Say</h2>
              <div className="w-20 h-[2px] bg-gradient-to-r from-transparent via-slate-400 to-transparent mx-auto mt-6" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {config.testimonials.map((t: any, idx: number) => (
                <div key={idx} className="bg-gradient-to-br from-slate-50 to-white rounded-3xl p-7 border border-slate-100 hover:shadow-lg transition">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md" style={{ background: themeColor }}>{(t.name || "G").charAt(0).toUpperCase()}</div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{t.name || "Guest"}</p>
                      <p className="text-xs text-amber-500 mt-0.5">{"★".repeat(t.rating || 5)}</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed italic">"{t.review || ""}"</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ MAP ═══ */}
      {config?.show_map !== false && config?.map_embed_url && (
        <section id="map-section" className="px-6 lg:px-16 py-24 bg-slate-50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-[11px] tracking-[0.4em] uppercase text-slate-400 mb-3 font-medium">Location</p>
              <h2 className="text-4xl md:text-5xl font-serif font-semibold text-slate-900 tracking-tight">Find Us Here</h2>
              <div className="w-20 h-[2px] bg-gradient-to-r from-transparent via-slate-400 to-transparent mx-auto mt-6" />
            </div>
            <div className="rounded-3xl overflow-hidden shadow-2xl border border-slate-200 h-[500px]">
              <iframe src={config.map_embed_url.includes("<iframe") ? config.map_embed_url.match(/src="([^"]+)"/)?.[1] || "" : config.map_embed_url} className="w-full h-full border-0" allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
            </div>
          </div>
        </section>
      )}

      {/* ═══ FAQ ═══ */}
      {config?.show_faq && config?.faqs && config.faqs.length > 0 && (
        <section className="px-6 lg:px-16 py-24 bg-white">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-[11px] tracking-[0.4em] uppercase text-slate-400 mb-3 font-medium">FAQ</p>
              <h2 className="text-4xl md:text-5xl font-serif font-semibold text-slate-900 tracking-tight">Frequently Asked Questions</h2>
              <div className="w-20 h-[2px] bg-gradient-to-r from-transparent via-slate-400 to-transparent mx-auto mt-6" />
            </div>
            <div className="space-y-3">
              {config.faqs.map((faq: any, idx: number) => (
                <div key={idx} className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden hover:border-slate-200 transition">
                  <button onClick={() => setActiveFaq(activeFaq === idx ? null : idx)} className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 hover:bg-slate-100 transition">
                    <span className="text-sm font-semibold text-slate-800">{faq.question || ""}</span>
                    <span className="text-slate-400 text-xl shrink-0 transition-transform">{activeFaq === idx ? "−" : "+"}</span>
                  </button>
                  {activeFaq === idx && (<div className="px-6 pb-5 text-sm text-slate-600 leading-relaxed">{faq.answer || ""}</div>)}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ FOOTER ═══ */}
      <footer className="bg-slate-900 text-white mt-20">
        <div className="max-w-6xl mx-auto px-6 lg:px-16 py-20">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="md:col-span-2">
              <h3 className="text-3xl font-serif font-semibold mb-4">{hotel?.name}</h3>
              <div className="w-14 h-[2px] bg-gradient-to-r from-white/50 to-transparent mb-5" />
              {config?.contact_address && (<p className="text-sm text-slate-400 leading-relaxed mb-5">{config.contact_address}</p>)}
              <div className="flex items-center gap-3 mt-4">
                {config?.facebook_url && (<a href={config.facebook_url} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition">📘</a>)}
                {config?.instagram_url && (<a href={config.instagram_url} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition">📷</a>)}
                {config?.whatsapp_number && (<a href={`https://wa.me/${config.whatsapp_number.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition">💬</a>)}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500 mb-5">Contact</p>
              {config?.contact_phone && (<p className="text-sm text-slate-300 mb-2">📞 {config.contact_phone}</p>)}
              {config?.contact_email && (<p className="text-sm text-slate-300">✉️ {config.contact_email}</p>)}
              {config?.check_in_time && (<p className="text-xs text-slate-500 mt-4">Check-in: {config.check_in_time}</p>)}
              {config?.check_out_time && (<p className="text-xs text-slate-500">Check-out: {config.check_out_time}</p>)}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500 mb-5">Legal</p>
              <div className="flex flex-col gap-3">
                {config?.terms_url && (<a href={config.terms_url} className="text-sm text-slate-300 hover:text-white transition">Terms & Conditions</a>)}
                {config?.privacy_url && (<a href={config.privacy_url} className="text-sm text-slate-300 hover:text-white transition">Privacy Policy</a>)}
              </div>
            </div>
          </div>
          <div className="mt-16 pt-8 border-t border-white/10 text-center">
            <p className="text-xs text-slate-500">{config?.footer_text || `© ${new Date().getFullYear()} ${hotel?.name}. All rights reserved.`}</p>
            <p className="text-[11px] text-slate-600 mt-3 tracking-wider">Powered by <span className="text-slate-400 font-medium">Staynexa PMS</span></p>
          </div>
        </div>
      </footer>

      {/* ═══ BOOKING MODAL ═══ */}
      {bookingRoom && hotel && (
        <BookingModal hotel={hotel} room={bookingRoom.room} plan={bookingRoom.plan} checkIn={checkIn} checkOut={checkOut} adults={adults} children={children} accentColor={themeColor} config={config} addons={addons} onClose={() => setBookingRoom(null)} onSuccess={handleBookingCreated} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// PHOTO GALLERY
// ═══════════════════════════════════════════════
function RoomPhotoGallery({ photos, roomType }: { photos: string[]; roomType: string }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  if (!photos || photos.length === 0) {
    return (<div className="w-full h-full flex items-center justify-center text-6xl text-slate-300">🛏️</div>);
  }

  return (
    <>
      <div className="w-full h-full relative group">
        <img src={photos[activeIdx]} alt={roomType} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[1.2s] cursor-pointer" onClick={() => setFullscreen(true)} />
        {photos.length > 1 && (
          <div className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-[10px] font-bold z-10">📷 {activeIdx + 1} / {photos.length}</div>
        )}
        {photos.length > 1 && (
          <>
            <button onClick={(e) => { e.stopPropagation(); setActiveIdx((prev) => (prev - 1 + photos.length) % photos.length); }} className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-slate-900 flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition font-bold z-10">‹</button>
            <button onClick={(e) => { e.stopPropagation(); setActiveIdx((prev) => (prev + 1) % photos.length); }} className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-slate-900 flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition font-bold z-10">›</button>
          </>
        )}
        {photos.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 max-w-[90%] overflow-x-auto px-2 py-1.5 bg-slate-900/60 backdrop-blur-md rounded-full z-10">
            {photos.slice(0, 6).map((url, idx) => (
              <button key={idx} onClick={(e) => { e.stopPropagation(); setActiveIdx(idx); }} className={`w-8 h-8 rounded-full overflow-hidden border-2 shrink-0 transition ${activeIdx === idx ? "border-amber-400 scale-110" : "border-white/40 hover:border-white"}`}>
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
            {photos.length > 6 && (<div className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center text-[10px] font-bold shrink-0">+{photos.length - 6}</div>)}
          </div>
        )}
      </div>
      {fullscreen && (
        <div className="fixed inset-0 bg-slate-950/95 z-[200] flex flex-col" onClick={() => setFullscreen(false)}>
          <div className="flex items-center justify-between p-4 text-white">
            <div className="text-sm font-semibold">{roomType} — {activeIdx + 1} / {photos.length}</div>
            <button onClick={() => setFullscreen(false)} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-2xl">×</button>
          </div>
          <div className="flex-1 flex items-center justify-center px-4 relative" onClick={(e) => e.stopPropagation()}>
            <img src={photos[activeIdx]} alt={roomType} className="max-h-[80vh] max-w-[90vw] object-contain rounded-xl shadow-2xl" />
            {photos.length > 1 && (
              <>
                <button onClick={() => setActiveIdx((prev) => (prev - 1 + photos.length) % photos.length)} className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-2xl backdrop-blur-md">‹</button>
                <button onClick={() => setActiveIdx((prev) => (prev + 1) % photos.length)} className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-2xl backdrop-blur-md">›</button>
              </>
            )}
          </div>
          {photos.length > 1 && (
            <div className="p-4 flex gap-2 overflow-x-auto justify-center bg-slate-900/50">
              {photos.map((url, idx) => (
                <button key={idx} onClick={(e) => { e.stopPropagation(); setActiveIdx(idx); }} className={`w-16 h-16 rounded-lg overflow-hidden border-2 shrink-0 transition ${activeIdx === idx ? "border-amber-400 scale-105" : "border-white/20 hover:border-white/60"}`}>
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════
// BOOKING MODAL (adult-based pricing)
// ═══════════════════════════════════════════════
function BookingModal({ hotel, room, plan, checkIn, checkOut, adults, children, accentColor, config, addons, onClose, onSuccess }: { hotel: PublicHotel; room: PublicRoomType; plan: PublicRatePlan; checkIn: string; checkOut: string; adults: number; children: number; accentColor: string; config: BookingEngineConfig | null; addons: any[]; onClose: () => void; onSuccess: () => void; }) {
  const nights = nightsBetween(checkIn, checkOut);
  // ✅ Occupancy অনুযায়ী দাম
  const pricePerNight = getPriceForOccupancy(plan, adults, children);
  const subtotal = pricePerNight * nights;
  const tax = computeTax(subtotal);
  const total = subtotal + tax;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ ref: string; name: string; paymentStatus: "paid" | "pending" | "none"; } | null>(null);
  const [upiQR, setUpiQR] = useState<{ qrCodeUrl: string; upiId: string; amount: number; deepLink: string; orderId: string; } | null>(null);
  const [upiBookingInfo, setUpiBookingInfo] = useState<{ bookingId: string; bookingRef: string; roomNumber: string; } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [selectedAddons, setSelectedAddons] = useState<Record<string, boolean>>({});

  const addonsTotal = Object.keys(selectedAddons).reduce((sum, id) => { if (selectedAddons[id]) { const addon = addons.find((a) => a.id === id); return sum + (addon?.price || 0); } return sum; }, 0);

  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  const discountAmount = appliedPromo ? (appliedPromo.discount_type === "percentage" ? (total * appliedPromo.discount_value) / 100 : appliedPromo.discount_value) : 0;
  const grandTotal = Math.max(0, total + addonsTotal - discountAmount);
  const paymentEnabled = config?.payment_enabled === true;

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true); setPromoError(null);
    const { validatePromoCode } = await import("../../lib/public-booking");
    const promo = await validatePromoCode(hotel.id, promoCode.trim());
    setPromoLoading(false);
    if (!promo) { setPromoError("Invalid or expired promo code"); setAppliedPromo(null); return; }
    if (total < promo.min_order_amount) { setPromoError(`Minimum order ₹${promo.min_order_amount} required`); setAppliedPromo(null); return; }
    setAppliedPromo(promo); setPromoError(null);
  };

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) { setError("Please enter your full name"); return; }
    if (!phone.trim()) { setError("Please enter your phone number"); return; }
    if (phone.replace(/\D/g, "").length < 10) { setError("Please enter a valid phone number"); return; }
    setSubmitting(true);
    try {
      const booking = await createReservation({
        roomType: room.room_type, checkIn, checkOut, ratePlan: plan.code, source: "bookingengine",
        primaryGuest: { name: name.trim(), phone: phone.trim(), email: email.trim(), address: "", city: "", state: "", pincode: "" },
        adults, children, infants: 0, amount: subtotal + addonsTotal, tax,
        discount: discountAmount, promoCode: appliedPromo?.code || null,
        notes: notes.trim() || `Online booking · ${plan.name}`, hotelId: hotel.id,
        selectedAddons: addons.filter((a) => selectedAddons[a.id]).map((a) => ({ id: a.id, name: a.name, price: a.price })),
      });
      const bookingId = (booking as any)?.id;
      const bookingRef = (booking as any)?.booking_ref;
      if (!bookingId || !bookingRef) throw new Error("Booking created but reference ID missing.");
      if (paymentEnabled && config?.payment_gateway && config.payment_gateway !== "none") { await handlePaymentFlow(bookingId, bookingRef); return; }
      await triggerNotifications(bookingId, bookingRef);
      setConfirmation({ ref: bookingRef, name: name.trim(), paymentStatus: "none" });
      setSubmitting(false);
    } catch (err: any) { console.error(err); setError(err?.message || "Booking failed."); setSubmitting(false); }
  };

  const handlePaymentFlow = async (bookingId: string, bookingRef: string) => {
    setPaymentProcessing(true); setUpiBookingInfo({ bookingId, bookingRef, roomNumber: "" });
    try {
      const res = await fetch("/api/payments/create-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hotelId: hotel.id, amount: grandTotal, bookingRef, bookingId, customerName: name.trim(), customerPhone: phone.trim(), customerEmail: email.trim() }) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Payment init failed");
      if (data.gateway === "upi_qr") { setUpiQR({ qrCodeUrl: data.qrCodeUrl, upiId: data.upiId, amount: data.amount, deepLink: data.deepLink, orderId: data.orderId }); setPaymentProcessing(false); return; }
      if (data.gateway === "razorpay") {
        await loadRazorpayScript();
        const options = { key: data.publicKey, amount: data.amount, currency: "INR", name: hotel.name, description: `Booking ${bookingRef}`, order_id: data.orderId, prefill: { name: name.trim(), contact: phone.trim(), email: email.trim() }, theme: { color: accentColor }, handler: async function (response: any) { await verifyPayment({ hotelId: hotel.id, gateway: "razorpay", orderId: response.razorpay_order_id, paymentId: response.razorpay_payment_id, signature: response.razorpay_signature, bookingId, bookingRef }); }, modal: { ondismiss: () => { setPaymentProcessing(false); setSubmitting(false); setError("Payment cancelled."); } } };
        const razorpay = new (window as any).Razorpay(options); razorpay.open();
      } else if (data.gateway === "cashfree") { await loadCashfreeScript(); const cashfree = (window as any).Cashfree({ mode: data.mode || "production" }); cashfree.checkout({ paymentSessionId: data.paymentLink, redirectTarget: "_modal" }); }
    } catch (err: any) { console.error(err); setError(err.message || "Payment failed"); setPaymentProcessing(false); setSubmitting(false); }
  };

  const verifyPayment = async (params: any) => {
    try {
      const res = await fetch("/api/payments/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params) });
      const data = await res.json();
      if (data.success) { await triggerNotifications(params.bookingId, params.bookingRef); setConfirmation({ ref: params.bookingRef, name: name.trim(), paymentStatus: "paid" }); } else { setError(data.error || "Payment verification failed"); }
    } catch (err) { setError("Payment error."); } finally { setPaymentProcessing(false); setSubmitting(false); }
  };

  const handleUPIConfirm = async () => {
    if (!upiBookingInfo || !upiQR) return;
    setVerifying(true);
    try {
      const res = await fetch("/api/payments/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hotelId: hotel.id, gateway: "upi_qr", orderId: upiQR.orderId, bookingId: upiBookingInfo.bookingId, bookingRef: upiBookingInfo.bookingRef }) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Verification failed");
      await triggerNotifications(upiBookingInfo.bookingId, upiBookingInfo.bookingRef);
      setUpiQR(null); setConfirmation({ ref: upiBookingInfo.bookingRef, name: name.trim(), paymentStatus: "pending" });
    } catch (err) { setError("Could not confirm."); } finally { setVerifying(false); setPaymentProcessing(false); setSubmitting(false); }
  };

  const triggerNotifications = async (bookingId: string, bookingRef: string) => {
    try {
      const { triggerBookingNotifications } = await import("../../lib/notifications");
      await triggerBookingNotifications({ hotelId: hotel.id, bookingId, bookingRef, guestName: name.trim(), guestPhone: phone.trim(), guestEmail: email.trim(), roomType: room.room_type, roomNumber: "", checkIn, checkOut, nights, total: grandTotal, hotelName: hotel.name, hotelPhone: config?.contact_phone ?? undefined });
    } catch (notifErr) { console.error(notifErr); }
  };

  if (upiQR) {
    return (
      <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-[100] p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] tracking-[0.3em] uppercase text-slate-400 font-semibold">Pay via UPI</p>
                <h3 className="text-xl font-serif font-semibold text-slate-900 mt-1">Scan QR Code</h3>
              </div>
              <button onClick={() => { setUpiQR(null); setPaymentProcessing(false); setSubmitting(false); }} disabled={verifying} className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 text-slate-400 flex items-center justify-center border border-slate-200 disabled:opacity-50">×</button>
            </div>
          </div>
          <div className="p-8 space-y-6">
            <div className="flex flex-col items-center">
              <div className="p-4 bg-white rounded-2xl border-2 border-slate-100 shadow-sm"><img src={upiQR.qrCodeUrl} alt="UPI QR" className="w-64 h-64" /></div>
              <p className="text-xs text-slate-500 mt-4 text-center">Scan with any UPI app — GPay, PhonePe, Paytm</p>
            </div>
            <div className="p-5 bg-slate-50 rounded-2xl text-center border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Amount to Pay</p>
              <p className="text-3xl font-serif font-bold text-slate-900">₹{upiQR.amount.toLocaleString("en-IN")}</p>
              <p className="text-xs text-slate-500 mt-2 font-mono break-all">{upiQR.upiId}</p>
            </div>
            <a href={upiQR.deepLink} className="block w-full py-3.5 rounded-xl text-xs font-bold text-white text-center uppercase tracking-[0.2em] bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 transition shadow-lg">📱 Open UPI App</a>
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl"><p className="text-[11px] text-amber-800 leading-relaxed"><strong>ℹ️ Important:</strong> After paying, click <strong>"I've Paid"</strong> below.</p></div>
          </div>
          <div className="px-8 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
            <button onClick={() => { setUpiQR(null); setPaymentProcessing(false); setSubmitting(false); }} disabled={verifying} className="px-6 py-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-white transition uppercase tracking-[0.15em] disabled:opacity-50">Cancel</button>
            <button onClick={handleUPIConfirm} disabled={verifying} className="px-6 py-3 rounded-xl text-xs font-bold text-white disabled:opacity-50 transition flex-1 uppercase tracking-[0.15em] bg-slate-900 hover:bg-slate-800">{verifying ? "Submitting..." : "✓ I've Paid"}</button>
          </div>
        </div>
      </div>
    );
  }

  if (confirmation) {
    return (
      <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-[100] p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
          <div className="p-10 text-center border-b border-slate-100">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-slate-900 flex items-center justify-center text-4xl text-white">✓</div>
            <p className="text-[11px] tracking-[0.3em] uppercase text-slate-400 mb-2">{confirmation.paymentStatus === "paid" ? "Confirmed" : confirmation.paymentStatus === "pending" ? "Pending" : "Confirmed"}</p>
            <h3 className="text-3xl font-serif font-semibold text-slate-900 mb-2">Your Stay Awaits</h3>
            <p className="text-sm text-slate-500">{confirmation.paymentStatus === "paid" ? "Payment confirmed." : confirmation.paymentStatus === "pending" ? "Awaiting payment verification." : "A confirmation has been sent to you."}</p>
          </div>
          <div className="p-8 space-y-5">
            <div className="text-center">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.3em] mb-2">Booking Reference</p>
              <p className="text-2xl font-serif font-bold text-slate-900 tracking-wider">{confirmation.ref}</p>
            </div>
            <div className="p-5 bg-slate-50 rounded-2xl space-y-3 text-sm border border-slate-100">
              <div className="flex justify-between"><span className="text-slate-500">Guest</span><span className="font-semibold text-slate-800">{confirmation.name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Room</span><span className="font-semibold text-slate-800">{room.room_type}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Guests</span><span className="font-semibold text-slate-800">{adults} Adult{adults > 1 ? "s" : ""}{children > 0 ? `, ${children} Child` : ""}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Check-in</span><span className="font-semibold text-slate-800">{prettyDate(checkIn)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Check-out</span><span className="font-semibold text-slate-800">{prettyDate(checkOut)}</span></div>
              <div className="flex justify-between pt-3 border-t border-slate-200"><span className="text-slate-500">Total</span><span className="font-serif font-bold text-lg text-slate-900">₹{grandTotal.toLocaleString("en-IN")}</span></div>
            </div>
          </div>
          <div className="px-8 py-5 border-t border-slate-100 bg-slate-50">
            <button onClick={() => { onClose(); onSuccess(); }} className="w-full py-3.5 rounded-xl text-xs font-bold text-white uppercase tracking-[0.2em] bg-slate-900 hover:bg-slate-800 transition">Done</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] tracking-[0.3em] uppercase text-slate-400 font-semibold">Reserve Your Stay</p>
            <button onClick={onClose} disabled={paymentProcessing} className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 text-slate-400 flex items-center justify-center border border-slate-200 disabled:opacity-50">×</button>
          </div>
          <h3 className="text-2xl font-serif font-semibold text-slate-900">{room.room_type}</h3>
          <p className="text-xs text-slate-500 mt-1 font-medium">{plan.name} · {plan.code}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Check-in</span><span className="font-semibold text-slate-800">{prettyDate(checkIn)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Check-out</span><span className="font-semibold text-slate-800">{prettyDate(checkOut)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Guests</span><span className="font-semibold text-slate-800">{adults} Adult{adults > 1 ? "s" : ""}{children > 0 ? `, ${children} Child${children > 1 ? "ren" : ""}` : ""}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Nights</span><span className="font-semibold text-slate-800">{nights}</span></div>
            <div className="flex justify-between pt-3 border-t border-slate-200"><span className="text-slate-500 text-xs">Your Rate Tier</span><span className="font-bold text-emerald-600 text-xs">{adults === 1 && children === 0 ? "1A (Single)" : adults === 2 && children === 0 ? "2A (Double)" : adults >= 3 ? "2A + Extra Adults" : `${adults}A + ${children}C`}</span></div>
          </div>

          {addons.length > 0 && (
            <div className="space-y-4 pt-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em]">Enhance Your Stay</p>
              <div className="grid grid-cols-1 gap-3">
                {addons.map((addon) => (
                  <label key={addon.id} className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition ${selectedAddons[addon.id] ? "border-teal-500 bg-teal-50/50" : "border-slate-100 hover:border-slate-300"}`}>
                    <div className="flex items-center gap-3">
                      <input type="checkbox" checked={selectedAddons[addon.id] || false} onChange={(e) => setSelectedAddons((prev) => ({ ...prev, [addon.id]: e.target.checked }))} className="w-4 h-4 text-teal-600 rounded" />
                      <div><p className="text-sm font-semibold text-slate-800">{addon.name}</p>{addon.description && (<p className="text-[11px] text-slate-500">{addon.description}</p>)}</div>
                    </div>
                    <p className="text-sm font-bold text-slate-900">+₹{addon.price.toLocaleString("en-IN")}</p>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3 pt-2">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em]">Have a Promo Code?</p>
            <div className="flex gap-2">
              <input type="text" placeholder="Enter code" value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none" />
              <button onClick={handleApplyPromo} disabled={promoLoading || !promoCode} className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 disabled:opacity-50">{promoLoading ? "..." : "Apply"}</button>
            </div>
            {promoError && <p className="text-xs text-rose-500 font-medium">{promoError}</p>}
            {appliedPromo && (<p className="text-xs text-emerald-600 font-bold">✅ Promo Applied: -₹{discountAmount.toLocaleString("en-IN")}<button onClick={() => { setAppliedPromo(null); setPromoCode(""); }} className="text-slate-400 underline ml-2">Remove</button></p>)}
          </div>

          <div className="p-5 bg-slate-900 rounded-2xl space-y-3 text-sm text-white">
            <div className="flex justify-between"><span className="text-slate-400">₹{pricePerNight.toLocaleString("en-IN")} × {nights} night{nights > 1 ? "s" : ""}</span><span>₹{subtotal.toLocaleString("en-IN")}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Taxes (GST)</span><span>₹{tax.toLocaleString("en-IN")}</span></div>
            {addonsTotal > 0 && (<div className="flex justify-between"><span className="text-slate-400">Add-ons</span><span>₹{addonsTotal.toLocaleString("en-IN")}</span></div>)}
            {discountAmount > 0 && (<div className="flex justify-between text-emerald-400"><span>Discount</span><span>-₹{discountAmount.toLocaleString("en-IN")}</span></div>)}
            <div className="flex justify-between pt-3 border-t border-white/10"><span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Total</span><span className="font-serif font-bold text-xl">₹{grandTotal.toLocaleString("en-IN")}</span></div>
          </div>

          <div className="space-y-5">
            <div><label className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2 block">Full Name *</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" className="w-full px-4 py-3 border-b border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-slate-900 bg-transparent" autoFocus disabled={paymentProcessing} /></div>
            <div><label className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2 block">Phone Number *</label><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" className="w-full px-4 py-3 border-b border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-slate-900 bg-transparent" disabled={paymentProcessing} /></div>
            <div><label className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2 block">Email (Optional)</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" className="w-full px-4 py-3 border-b border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-slate-900 bg-transparent" disabled={paymentProcessing} /></div>
            <div><label className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2 block">Special Requests (Optional)</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Any special requests..." className="w-full px-4 py-3 border-b border-slate-200 text-sm font-medium text-slate-800 resize-none outline-none focus:border-slate-900 bg-transparent" disabled={paymentProcessing} /></div>
          </div>

          {error && (
            <div className="p-5 bg-gradient-to-br from-rose-50 to-orange-50 border-2 border-rose-200 rounded-2xl">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0"><span className="text-xl">⚠️</span></div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-rose-800 mb-1">Booking Unavailable</p>
                  <p className="text-xs text-rose-700 leading-relaxed">{error}</p>
                  <button onClick={() => { onClose(); setTimeout(() => { document.getElementById("rooms-section")?.scrollIntoView({ behavior: "smooth" }); }, 100); }} className="mt-3 px-4 py-2 bg-rose-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-rose-700 transition">← Choose Another Room</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-8 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <button onClick={onClose} disabled={submitting || paymentProcessing} className="px-6 py-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-white transition uppercase tracking-[0.15em] disabled:opacity-50">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting || paymentProcessing} className="px-6 py-3 rounded-xl text-xs font-bold text-white disabled:opacity-50 transition flex-1 uppercase tracking-[0.15em] shadow-lg" style={{ background: accentColor }}>
            {paymentProcessing ? "Processing payment..." : submitting ? "Creating booking..." : paymentEnabled ? `Pay ₹${grandTotal.toLocaleString("en-IN")}` : `Confirm · ₹${grandTotal.toLocaleString("en-IN")}`}
          </button>
        </div>
      </div>
    </div>
  );
}
