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
import { createGroupReservation } from "../../db"; // 🆕 Import group function

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

// ═══════════════════════════════════════════════
// PUBLIC BOOKING PAGE
// ═══════════════════════════════════════════════
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
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const [expandedDesc, setExpandedDesc] = useState<Record<string, boolean>>({});

  const [sortBy, setSortBy] = useState<"popular" | "price-asc" | "price-desc">("popular");
  const [maxPrice, setMaxPrice] = useState<number>(50000);

  // 🆕 CART STATE
  const [cart, setCart] = useState<Array<{ room: PublicRoomType; plan: PublicRatePlan; adults: number; children: number }>>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isGroupCheckout, setIsGroupCheckout] = useState(false);

  const nights = nightsBetween(checkIn, checkOut);

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

  const checkAllAvailability = useCallback(async () => {
    if (!hotel || roomTypes.length === 0) return;
    setCheckingAvail(true);
    try {
      const results = await checkAvailabilityBatch(hotel.id, checkIn, checkOut);
      setAvailability(results);
    } catch (err) {
      console.error(err);
    } finally {
      setCheckingAvail(false);
    }
  }, [hotel, roomTypes, checkIn, checkOut]);

  useEffect(() => {
    if (hotel && roomTypes.length > 0) checkAllAvailability();
  }, [hotel, roomTypes, checkIn, checkOut, checkAllAvailability]);

  const handleBookingCreated = () => { 
    setCart([]); 
    setIsGroupCheckout(false); 
    checkAllAvailability(); 
  };
  
  const scrollToRooms = () => { document.getElementById("rooms-section")?.scrollIntoView({ behavior: "smooth" }); };

  // 🆕 CART ACTIONS
  const handleAddToCart = (room: PublicRoomType, plan: PublicRatePlan, roomAdults: number, roomChildren: number) => {
    setCart(prev => [...prev, { room, plan, adults: roomAdults, children: roomChildren }]);
    setIsCartOpen(true);
  };

  const handleRemoveFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCart([]);
    setIsCartOpen(false);
    setIsGroupCheckout(false);
  };

  const filteredRooms = useMemo(() => {
    return roomTypes
      .filter((r) => (r.base_price || 0) <= maxPrice)
      .sort((a, b) => {
        if (sortBy === "price-asc") return (a.base_price || 0) - (b.base_price || 0);
        if (sortBy === "price-desc") return (b.base_price || 0) - (a.base_price || 0);
        return 0;
      });
  }, [roomTypes, sortBy, maxPrice]);

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
      {/* HEADER */}
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

      {/* HERO */}
      {config?.show_hero_banner !== false ? (
        <section className="relative h-[680px] overflow-hidden">
          <div className="absolute inset-0 bg-cover bg-center scale-105" style={{ backgroundImage: config?.hero_banner_url ? `url(${config.hero_banner_url})` : roomTypes[0]?.photo_url ? `url(${roomTypes[0].photo_url})` : "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)" }} />
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

      {/* SEARCH BAR */}
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

      {/* ROOMS */}
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
                        <button onClick={() => { const nextDay = addDays(checkIn, 1); const nextDayOut = addDays(nextDay, 1); setCheckIn(nextDay); setCheckOut(nextDayOut); setTimeout(() => checkAllAvailability(), 100); }} className="px-5 py-2.5 rounded-xl bg-white text-slate-900 text-[11px] font-bold uppercase tracking-[0.15em] hover:bg-teal-50 transition shadow-lg">📅 Try Next Day</button>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 p-7 lg:p-9">
                    <div className="mb-5">
                      <h3 className="text-2xl lg:text-3xl font-serif font-semibold text-slate-900 mb-2 tracking-tight">{room.room_type}</h3>
                      <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                        <span className="flex items-center gap-1.5"><span className="text-slate-400">👤</span> Max {room.max_adults} Adults</span>
                        {room.max_children > 0 && (<span className="flex items-center gap-1.5"><span className="text-slate-400">🧒</span> Max {room.max_children} Children</span>)}
                        {room.total_rooms && (<span className="flex items-center gap-1.5"><span className="text-slate-400">🏨</span> {room.total_rooms} Rooms</span>)}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-5">
                      {room.bed_type && (<span className="text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold">🛏️ {room.bed_type}{room.bed_count && room.bed_count > 1 ? ` × ${room.bed_count}` : ""}</span>)}
                      {room.room_size && (<span className="text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold">📐 {room.room_size}</span>)}
                      {room.view_type && (<span className="text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold">👁️ {room.view_type}</span>)}
                      {room.amenities && room.amenities.slice(0, 3).map((a: string, i: number) => (<span key={i} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-teal-50 text-teal-700 font-semibold">✓ {a}</span>))}
                      {room.amenities && room.amenities.length > 3 && (<span className="text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-50 text-slate-500 font-semibold">+{room.amenities.length - 3} more</span>)}
                    </div>

                    {room.description && (
                      <div className="mb-6">
                        <p className={`text-sm text-slate-500 leading-relaxed ${expandedDesc[room.room_type] ? "" : "line-clamp-2"}`}>
                          {room.description}
                        </p>
                        {room.description.length > 100 && (
                          <button
                            onClick={() => setExpandedDesc((prev) => ({ ...prev, [room.room_type]: !prev[room.room_type] }))}
                            className="text-xs font-bold text-teal-600 underline mt-1.5 hover:text-teal-700"
                          >
                            {expandedDesc[room.room_type] ? "Read less" : "Read more"}
                          </button>
                        )}
                      </div>
                    )}

                    <div className="space-y-3">
                      {room.rate_plans.map((plan, idx) => {
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
                                <button 
                                  onClick={() => handleAddToCart(room, plan, adults, children)} 
                                  className="mt-2 px-6 py-2.5 rounded-xl text-[11px] font-bold text-white uppercase tracking-[0.15em] transition hover:opacity-90 shadow-md" 
                                  style={{ background: isFirst ? themeColor : "#0f172a" }}
                                >
                                  + Add to Booking
                                </button>
                              ) : (
                                <button onClick={() => { const nextDay = addDays(checkIn, 1); const nextDayOut = addDays(nextDay, 1); setCheckIn(nextDay); setCheckOut(nextDayOut); setTimeout(() => checkAllAvailability(), 100); }} className="mt-2 px-6 py-2.5 rounded-xl text-[11px] font-bold text-rose-600 uppercase tracking-[0.15em] bg-rose-50 border-2 border-rose-200 hover:bg-rose-100 transition shadow-sm">🔄 Check Another Date</button>
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

      {/* ABOUT */}
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

      {/* AMENITIES */}
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

      {/* GALLERY */}
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

      {/* TESTIMONIALS */}
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

      {/* MAP */}
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

      {/* FAQ */}
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

      {/* FOOTER */}
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

      {/* 🆕 CART SIDEBAR */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[90] flex justify-end">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsCartOpen(false)} />
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-slide-in-right">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="text-xl font-serif font-bold text-slate-900">Your Selection</h2>
                <p className="text-xs text-slate-500">{cart.length} room{cart.length > 1 ? 's' : ''} added</p>
              </div>
              <button onClick={() => setIsCartOpen(false)} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-800">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-4xl mb-4">🛒</p>
                  <p className="text-sm text-slate-500">Your cart is empty.</p>
                </div>
              ) : (
                cart.map((item, idx) => (
                  <div key={idx} className="flex gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 relative group">
                    <div className="w-16 h-16 rounded-xl bg-slate-200 overflow-hidden shrink-0">
                      {item.room.photos?.[0] ? <img src={item.room.photos[0]} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl">🛏️</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{item.room.room_type}</p>
                      <p className="text-[10px] text-slate-500">{item.plan.name} · {item.adults} Adult{item.adults > 1 ? 's' : ''}{item.children > 0 ? `, ${item.children} Child` : ''}</p>
                      <p className="text-sm font-bold text-emerald-600 mt-1">
                        ₹{((getPriceForOccupancy(item.plan, item.adults, item.children)) * nights).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <button onClick={() => handleRemoveFromCart(idx)} className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-rose-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">×</button>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-6 border-t border-slate-100 bg-slate-50 space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">Subtotal</span>
                  <span className="font-bold text-slate-900">
                    ₹{cart.reduce((sum, item) => sum + (getPriceForOccupancy(item.plan, item.adults, item.children) * nights), 0).toLocaleString("en-IN")}
                  </span>
                </div>
                <button 
                  onClick={() => { setIsCartOpen(false); setIsGroupCheckout(true); }}
                  className="w-full py-4 rounded-2xl text-[11px] font-bold text-white uppercase tracking-[0.2em] shadow-lg transition hover:opacity-90"
                  style={{ background: themeColor }}
                >
                  Continue to Checkout →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🆕 GROUP BOOKING MODAL */}
      {isGroupCheckout && hotel && cart.length > 0 && (
        <GroupBookingModal
          hotel={hotel}
          cart={cart}
          checkIn={checkIn}
          checkOut={checkOut}
          accentColor={themeColor}
          config={config}
          addons={addons}
          onClose={clearCart}
          onSuccess={handleBookingCreated}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// ROOM PHOTO GALLERY
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
        {photos.length > 1 && (<div className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-[10px] font-bold z-10">📷 {activeIdx + 1} / {photos.length}</div>)}
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
// 🆕 GROUP BOOKING MODAL
// ═══════════════════════════════════════════════
function GroupBookingModal({
  hotel, cart, checkIn, checkOut, accentColor, config, addons, onClose, onSuccess,
}: {
  hotel: PublicHotel;
  cart: Array<{ room: PublicRoomType; plan: PublicRatePlan; adults: number; children: number }>;
  checkIn: string;
  checkOut: string;
  accentColor: string;
  config: BookingEngineConfig | null;
  addons: any[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const nights = nightsBetween(checkIn, checkOut);
  
  // Calculate Totals for all rooms in cart
  let grandSubtotal = 0;
  let grandTax = 0;
  const roomDataArray = cart.map(item => {
    const pricePerNight = getPriceForOccupancy(item.plan, item.adults, item.children);
    const subtotal = pricePerNight * nights;
    const tax = computeTax(subtotal);
    grandSubtotal += subtotal;
    grandTax += tax;
    return { ...item, subtotal, tax };
  });
  
  const grandTotal = grandSubtotal + grandTax;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const name = `${firstName.trim()} ${lastName.trim()}`.trim();
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    ref: string;
    name: string;
    paymentStatus: "paid" | "pending" | "none";
    paymentType: "full" | "partial" | "pay_at_property";
    amountPaid: number;
    amountPending: number;
    roomCount: number;
  } | null>(null);

  const [paymentOption, setPaymentOption] = useState<"full" | "partial" | "pay_at_property">("full");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [cancellationModalOpen, setCancellationModalOpen] = useState(false);

  // Payment Config
  const paymentEnabled = config?.payment_enabled === true;
  const partialEnabled = config?.allow_partial_payment === true;
  const partialPct = config?.partial_payment_pct || 50;

  const amountToPayNow =
    paymentOption === "full"
      ? grandTotal
      : paymentOption === "partial"
      ? Math.round(grandTotal * (partialPct / 100))
      : 0;
  const amountPending = grandTotal - amountToPayNow;

  const handleSubmit = async () => {
    setError(null);
    if (config?.show_terms_checkbox !== false && !termsAccepted) {
      setError("Please accept the Terms & Conditions to continue");
      return;
    }
    if (!firstName.trim()) { setError("Please enter your first name"); return; }
    if (!lastName.trim()) { setError("Please enter your last name"); return; }
    if (!phone.trim()) { setError("Please enter your phone number"); return; }
    if (phone.replace(/\D/g, "").length < 10) { setError("Please enter a valid phone number"); return; }

    setSubmitting(true);
    try {
      // Call createGroupReservation
      const result = await createGroupReservation({
        hotelId: hotel.id,
        checkIn,
        checkOut,
        source: "bookingengine",
        primaryGuest: { name: name, phone: phone.trim(), email: email.trim(), address: "", city: "", state: "", pincode: "" },
        notes: notes.trim() || `Group booking (${cart.length} rooms)`,
        rooms: roomDataArray.map(item => ({
          roomType: item.room.room_type,
          adults: item.adults,
          children: item.children,
          infants: 0,
          amount: item.subtotal,
          tax: item.tax,
          ratePlan: item.plan.code,
        })),
      });

      const bookingId = result.bookings[0]?.id;
      const bookingRef = result.mainBookingRef;
      if (!bookingId || !bookingRef) throw new Error("Booking created but reference ID missing.");

      // Save payment type to DB for all group bookings
      try {
        const { supabase } = await import("../../supabase");
        const bookingIds = result.bookings.map((b: any) => b.id);
        await supabase
          .from("bookings")
          .update({
            payment_type: paymentOption,
            advance_paid: 0,
            pending_amount: amountPending,
          })
          .in("id", bookingIds);
      } catch (err) {
        console.warn("[Save payment type] failed:", err);
      }

      // Pay at Property — skip payment
      if (paymentOption === "pay_at_property" || !paymentEnabled || config?.payment_gateway === "none") {
        await triggerNotifications(bookingId, bookingRef, paymentOption, 0, amountPending);
        setConfirmation({
          ref: bookingRef,
          name: name,
          paymentStatus: "none",
          paymentType: paymentOption,
          amountPaid: 0,
          amountPending: amountPending,
          roomCount: cart.length,
        });
        setSubmitting(false);
        return;
      }

      // Online payment
      await handlePaymentFlow(bookingId, bookingRef, amountToPayNow);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Booking failed.");
      setSubmitting(false);
    }
  };

  const handlePaymentFlow = async (bookingId: string, bookingRef: string, amountToCharge: number) => {
    setPaymentProcessing(true);
    try {
      const res = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotelId: hotel.id,
          amount: amountToCharge,
          bookingRef,
          bookingId,
          customerName: name,
          customerPhone: phone.trim(),
          customerEmail: email.trim(),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Payment init failed");

      if (data.gateway === "upi_qr") {
        // For group bookings, we'll simplify and use the same UPI flow, but it's recommended to add a dedicated UPI modal.
        // For now, let's assume Razorpay or Cashfree is used for group bookings.
        throw new Error("UPI QR not supported for group booking yet. Please use another payment method.");
      }

      if (data.gateway === "razorpay") {
        await loadRazorpayScript();
        const options = {
          key: data.publicKey,
          amount: data.amount,
          currency: "INR",
          name: hotel.name,
          description: `Group Booking ${bookingRef}`,
          order_id: data.orderId,
          prefill: { name: name, contact: phone.trim(), email: email.trim() },
          theme: { color: accentColor },
          handler: async function (response: any) {
            await verifyPayment({
              hotelId: hotel.id,
              gateway: "razorpay",
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              bookingId,
              bookingRef,
              amountPaid: amountToCharge,
            });
          },
          modal: {
            ondismiss: () => {
              setPaymentProcessing(false);
              setSubmitting(false);
              setError("Payment cancelled.");
            },
          },
        };
        const razorpay = new (window as any).Razorpay(options);
        razorpay.open();
      } else if (data.gateway === "cashfree") {
        await loadCashfreeScript();
        const cashfree = (window as any).Cashfree({ mode: data.mode || "production" });
        cashfree.checkout({ paymentSessionId: data.paymentLink, redirectTarget: "_modal" });
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Payment failed");
      setPaymentProcessing(false);
      setSubmitting(false);
    }
  };

  const verifyPayment = async (params: any) => {
    try {
      const res = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (data.success) {
        try {
          const { supabase } = await import("../../supabase");
          // Update all bookings in the group with the advance paid
          const groupId = cart.length > 0 ? (await supabase.from('bookings').select('group_id').eq('id', params.bookingId).single()).data?.group_id : null;
          if (groupId) {
            await supabase
              .from("bookings")
              .update({
                advance_paid: params.amountPaid,
                paid: params.amountPaid,
              })
              .eq("group_id", groupId);
          } else {
             await supabase
              .from("bookings")
              .update({
                advance_paid: params.amountPaid,
                paid: params.amountPaid,
              })
              .eq("id", params.bookingId);
          }
        } catch (err) {
          console.warn("[Save advance] failed:", err);
        }

        await triggerNotifications(params.bookingId, params.bookingRef, paymentOption, params.amountPaid, amountPending);
        setConfirmation({
          ref: params.bookingRef,
          name: name,
          paymentStatus: "paid",
          paymentType: paymentOption,
          amountPaid: params.amountPaid,
          amountPending: amountPending,
          roomCount: cart.length,
        });
      } else {
        setError(data.error || "Payment verification failed");
      }
    } catch (err) {
      setError("Payment error.");
    } finally {
      setPaymentProcessing(false);
      setSubmitting(false);
    }
  };

  const triggerNotifications = async (
    bookingId: string,
    bookingRef: string,
    payType: "full" | "partial" | "pay_at_property",
    paidAmount: number,
    pendingAmount: number
  ) => {
    try {
      const { triggerBookingNotifications } = await import("../../lib/notifications");
      
      // Build rooms summary string for group booking
      const roomsSummary = cart.map((item, idx) => 
        `Room ${idx + 1}: ${item.room.room_type} (${item.adults} Adult${item.adults > 1 ? 's' : ''}${item.children > 0 ? `, ${item.children} Child` : ''}) - ₹${((getPriceForOccupancy(item.plan, item.adults, item.children)) * nights).toLocaleString("en-IN")}`
      ).join('\n');

      await triggerBookingNotifications({
        hotelId: hotel.id,
        bookingId,
        bookingRef,
        guestName: name,
        guestPhone: phone.trim(),
        guestEmail: email.trim(),
        roomType: cart[0]?.room.room_type || "Multiple Rooms",
        roomNumber: cart[0] ? "Multiple" : "",
        roomsSummary: roomsSummary,
        roomsCount: cart.length,
        checkIn,
        checkOut,
        nights,
        total: grandTotal,
        hotelName: hotel.name,
        hotelPhone: config?.contact_phone ?? undefined,
        adults: cart.reduce((sum, item) => sum + item.adults, 0),
        children: cart.reduce((sum, item) => sum + item.children, 0),
        paymentType: payType,
        amountPaid: paidAmount,
        amountPending: pendingAmount,
        partialPct: partialPct,
      });
    } catch (notifErr) {
      console.error(notifErr);
    }
  };

  // ═══ SUCCESS SCREEN ═══
  if (confirmation) {
    const isPaid = confirmation.paymentType === "full" || confirmation.amountPending <= 0;
    const isPartial = confirmation.paymentType === "partial" && confirmation.amountPending > 0;
    const isPayAtProperty = confirmation.paymentType === "pay_at_property";

    return (
      <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-[100] p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
          <div className="p-10 text-center border-b border-slate-100">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-slate-900 flex items-center justify-center text-4xl text-white">✓</div>
            <p className="text-[11px] tracking-[0.3em] uppercase text-slate-400 mb-2">
              {isPaid ? "Confirmed & Paid" : isPartial ? "Partial Paid" : "Confirmed"}
            </p>
            <h3 className="text-3xl font-serif font-semibold text-slate-900 mb-2">Your Stay Awaits</h3>
            <p className="text-sm text-slate-500">
              {isPaid ? "Payment confirmed. A voucher has been sent to you." : isPartial ? "Advance received. A voucher has been sent to you." : "Booking confirmed. A voucher has been sent to you."}
            </p>
          </div>
          <div className="p-8 space-y-5">
            <div className="text-center">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.3em] mb-2">Booking Reference</p>
              <p className="text-2xl font-serif font-bold text-slate-900 tracking-wider">{confirmation.ref}</p>
            </div>
            <div className="p-5 bg-slate-50 rounded-2xl space-y-3 text-sm border border-slate-100">
              <div className="flex justify-between"><span className="text-slate-500">Guest</span><span className="font-semibold text-slate-800">{confirmation.name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Rooms Booked</span><span className="font-semibold text-slate-800">{confirmation.roomCount} Room{confirmation.roomCount > 1 ? 's' : ''}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Check-in</span><span className="font-semibold text-slate-800">{prettyDate(checkIn)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Check-out</span><span className="font-semibold text-slate-800">{prettyDate(checkOut)}</span></div>

              <div className="pt-3 border-t border-slate-200 space-y-2">
                <div className="flex justify-between"><span className="text-slate-500">Total</span><span className="font-serif font-bold text-slate-900">₹{grandTotal.toLocaleString("en-IN")}</span></div>
                {confirmation.amountPaid > 0 && (
                  <div className="flex justify-between"><span className="text-emerald-600 font-medium">✓ Paid Now</span><span className="font-bold text-emerald-600">₹{confirmation.amountPaid.toLocaleString("en-IN")}</span></div>
                )}
                {confirmation.amountPending > 0 && (
                  <div className="flex justify-between"><span className="text-amber-600 font-medium">⏳ Pending</span><span className="font-bold text-amber-600">₹{confirmation.amountPending.toLocaleString("en-IN")}</span></div>
                )}
              </div>
            </div>
            {isPartial && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center">
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  <strong>ℹ️</strong> ₹{confirmation.amountPending.toLocaleString("en-IN")} payable at check-in
                </p>
              </div>
            )}
            {isPayAtProperty && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-center">
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  <strong>ℹ️</strong> Full amount ₹{confirmation.amountPending.toLocaleString("en-IN")} payable at check-in
                </p>
              </div>
            )}
          </div>
          <div className="px-8 py-5 border-t border-slate-100 bg-slate-50">
            <button onClick={() => { onClose(); onSuccess(); }} className="w-full py-3.5 rounded-xl text-xs font-bold text-white uppercase tracking-[0.2em] bg-slate-900 hover:bg-slate-800 transition">Done</button>
          </div>
        </div>
      </div>
    );
  }

  // ═══ MAIN FORM ═══
  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] tracking-[0.3em] uppercase text-slate-400 font-semibold">Group Reservation</p>
            <button onClick={onClose} disabled={paymentProcessing} className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 text-slate-400 flex items-center justify-center border border-slate-200 disabled:opacity-50">×</button>
          </div>
          <h3 className="text-2xl font-serif font-semibold text-slate-900">Complete Your Booking</h3>
          <p className="text-xs text-slate-500 mt-1 font-medium">{cart.length} Room{cart.length > 1 ? 's' : ''} selected</p>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {/* Cart Summary */}
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em]">Rooms Summary</p>
            {roomDataArray.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-sm border-b border-slate-200 pb-3 last:border-0 last:pb-0">
                <div>
                  <p className="font-semibold text-slate-800">{item.room.room_type}</p>
                  <p className="text-[10px] text-slate-500">{item.plan.name} · {item.adults} Adult{item.adults > 1 ? 's' : ''}{item.children > 0 ? `, ${item.children} Child` : ''}</p>
                </div>
                <p className="font-bold text-slate-900">₹{item.subtotal.toLocaleString("en-IN")}</p>
              </div>
            ))}
          </div>

          <div className="p-5 bg-slate-900 rounded-2xl text-white space-y-3">
            <div className="flex justify-between text-sm"><span className="text-slate-400">Subtotal ({nights} night{nights > 1 ? 's' : ''})</span><span>₹{grandSubtotal.toLocaleString("en-IN")}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-400">Taxes & Fees (GST)</span><span>₹{grandTax.toLocaleString("en-IN")}</span></div>
            <div className="flex justify-between pt-3 border-t border-white/10">
              <span className="text-[11px] uppercase tracking-[0.2em] text-slate-300 font-bold">Total Amount</span>
              <span className="font-serif font-bold text-2xl">₹{grandTotal.toLocaleString("en-IN")}</span>
            </div>
          </div>

          {/* Payment Options */}
          {paymentEnabled && config?.payment_gateway !== "none" && (
            <div className="space-y-3">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em]">💳 Payment Options</p>
              <div className="space-y-2.5">
                {config?.show_full_payment !== false && (
                  <label className={`flex items-start justify-between gap-3 p-4 rounded-2xl border-2 cursor-pointer transition ${paymentOption === "full" ? "border-teal-500 bg-teal-50/50 shadow-sm" : "border-slate-200 hover:border-slate-300"}`}>
                    <div className="flex items-start gap-3">
                      <input type="radio" name="payment_option" checked={paymentOption === "full"} onChange={() => setPaymentOption("full")} className="mt-1 w-4 h-4 text-teal-600 focus:ring-teal-500" />
                      <div>
                        <p className="text-sm font-bold text-slate-900">💳 Full Payment</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Pay entire amount now</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-slate-900">₹{grandTotal.toLocaleString("en-IN")}</p>
                      <p className="text-[10px] text-emerald-600 font-bold">✓ No pending</p>
                    </div>
                  </label>
                )}

                {config?.show_partial_payment !== false && config?.allow_partial_payment && (
                  <label className={`flex items-start justify-between gap-3 p-4 rounded-2xl border-2 cursor-pointer transition ${paymentOption === "partial" ? "border-teal-500 bg-teal-50/50 shadow-sm" : "border-slate-200 hover:border-slate-300"}`}>
                    <div className="flex items-start gap-3">
                      <input type="radio" name="payment_option" checked={paymentOption === "partial"} onChange={() => setPaymentOption("partial")} className="mt-1 w-4 h-4 text-teal-600 focus:ring-teal-500" />
                      <div>
                        <p className="text-sm font-bold text-slate-900">💰 {config?.partial_payment_label || "Pay Advance"} ({partialPct}%)</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Rest at check-in</p>
                        <span className="inline-block mt-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 uppercase tracking-wider">Popular</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-emerald-600">₹{Math.round(grandTotal * partialPct / 100).toLocaleString("en-IN")}</p>
                      <p className="text-[10px] text-amber-600 font-bold">⏳ ₹{(grandTotal - Math.round(grandTotal * partialPct / 100)).toLocaleString("en-IN")} pending</p>
                    </div>
                  </label>
                )}

                {config?.show_pay_at_property !== false && (
                  <label className={`flex items-start justify-between gap-3 p-4 rounded-2xl border-2 cursor-pointer transition ${paymentOption === "pay_at_property" ? "border-teal-500 bg-teal-50/50 shadow-sm" : "border-slate-200 hover:border-slate-300"}`}>
                    <div className="flex items-start gap-3">
                      <input type="radio" name="payment_option" checked={paymentOption === "pay_at_property"} onChange={() => setPaymentOption("pay_at_property")} className="mt-1 w-4 h-4 text-teal-600 focus:ring-teal-500" />
                      <div>
                        <p className="text-sm font-bold text-slate-900">🏨 Pay at Property</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Pay entire amount at check-in</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-slate-500">₹0 now</p>
                      <p className="text-[10px] text-amber-600 font-bold">⏳ ₹{grandTotal.toLocaleString("en-IN")} at hotel</p>
                    </div>
                  </label>
                )}
              </div>

              {paymentOption !== "pay_at_property" && (
                <div className="p-3 bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 rounded-xl text-center">
                  <p className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">You will pay now</p>
                  <p className="text-2xl font-serif font-bold text-teal-900 mt-0.5">₹{amountToPayNow.toLocaleString("en-IN")}</p>
                  {amountPending > 0 && (
                    <p className="text-[10px] text-amber-700 mt-1">₹{amountPending.toLocaleString("en-IN")} will be pending</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Guest Details Form */}
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2 block">First Name *</label>
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" className="w-full px-4 py-3 border-b border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-slate-900 bg-transparent" autoFocus disabled={paymentProcessing} />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2 block">Last Name *</label>
                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" className="w-full px-4 py-3 border-b border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-slate-900 bg-transparent" disabled={paymentProcessing} />
              </div>
            </div>
            <div><label className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2 block">Phone Number *</label><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" className="w-full px-4 py-3 border-b border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-slate-900 bg-transparent" disabled={paymentProcessing} /></div>
            <div><label className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2 block">Email (Optional)</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" className="w-full px-4 py-3 border-b border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-slate-900 bg-transparent" disabled={paymentProcessing} /></div>
            <div><label className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2 block">Special Requests (Optional)</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Any special requests..." className="w-full px-4 py-3 border-b border-slate-200 text-sm font-medium text-slate-800 resize-none outline-none focus:border-slate-900 bg-transparent" disabled={paymentProcessing} /></div>
          </div>

          {/* Terms */}
          {config?.show_terms_checkbox !== false && (
            <div className="pt-2">
              <div className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <input type="checkbox" id="terms-checkbox-group" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="w-5 h-5 mt-0.5 text-teal-600 rounded focus:ring-teal-500 cursor-pointer" />
                <label htmlFor="terms-checkbox-group" className="text-xs text-slate-700 leading-relaxed cursor-pointer">
                  By proceeding, I agree to the hotel's{" "}
                  <button type="button" onClick={(e) => { e.preventDefault(); setTermsModalOpen(true); }} className="text-teal-600 underline font-bold hover:text-teal-700">terms and conditions</button>
                  {config?.show_cancellation_policy !== false && (
                    <>
                      {" "}and{" "}
                      <button type="button" onClick={(e) => { e.preventDefault(); setCancellationModalOpen(true); }} className="text-teal-600 underline font-bold hover:text-teal-700">cancellation policies</button>
                    </>
                  )}
                  .
                </label>
              </div>
            </div>
          )}

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
            {paymentProcessing
              ? "Processing payment..."
              : submitting
              ? "Creating group booking..."
              : paymentOption === "pay_at_property"
              ? `Confirm Group Booking`
              : `Proceed to Pay ₹${amountToPayNow.toLocaleString("en-IN")}`}
          </button>
        </div>
      </div>

      {/* Terms Modal */}
      {termsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="px-6 py-5 bg-gradient-to-r from-slate-800 to-slate-900 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Terms and Conditions</h3>
              <button onClick={() => setTermsModalOpen(false)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{config?.terms_and_conditions || "Terms and conditions not configured yet."}</div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button onClick={() => { setTermsModalOpen(false); setTermsAccepted(true); }} className="px-6 py-2.5 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-700 transition uppercase tracking-wider">✓ I Understand</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Policy Modal */}
      {cancellationModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="px-6 py-5 bg-gradient-to-r from-slate-800 to-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl">🚫</div>
                <div>
                  <h3 className="text-lg font-bold text-white">Cancellation Policies</h3>
                  <p className="text-[11px] text-slate-400">Please read before booking</p>
                </div>
              </div>
              <button onClick={() => setCancellationModalOpen(false)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="p-5 bg-rose-50 border-l-4 border-rose-400 rounded-r-xl">
                <p className="text-sm font-bold text-rose-800 mb-2">Cancellation Policy:</p>
                <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {config?.cancellation_policy || "Cancellation policy not configured. Please contact the hotel directly."}
                </div>
              </div>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-xs text-blue-800 leading-relaxed">
                  <strong>ℹ️ Note:</strong> For any cancellation or modification, please contact the hotel directly. Refunds (if applicable) will be processed within 5-7 business days.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button onClick={() => setCancellationModalOpen(false)} className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition uppercase tracking-wider">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
