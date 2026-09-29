// app/book/[slug]/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  fetchHotelBySlug,
  fetchPublicConfig,
  fetchPublicRoomTypes,
  fetchPublicAddons,
  checkAvailabilityBatch,
  computeTax,
  getPriceForOccupancy,
  type PublicHotel,
  type PublicRoomType,
  type PublicRatePlan,
  type BookingEngineConfig,
} from "../../lib/public-booking";
import { createGroupReservation } from "../../db";

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

  const [cart, setCart] = useState<Array<{
    id: string;
    room: PublicRoomType;
    plan: PublicRatePlan;
    adults: number;
    children: number;
    infants: number;
    roomPreference: string;
  }>>([]);
  const [isGroupCheckout, setIsGroupCheckout] = useState(false);
  const [addedFeedback, setAddedFeedback] = useState<string | null>(null);
  const [limitWarning, setLimitWarning] = useState<string | null>(null);

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

      if (!c || c.is_enabled === false) {
        setDisabled(true);
        setLoading(false);
        return;
      }
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
    try {
      const results = await checkAvailabilityBatch(hotel.id, checkIn, checkOut);
      setAvailability(results);
    } catch (err) {
      console.error(err);
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

  const handleAddToCart = (room: PublicRoomType, plan: PublicRatePlan) => {
    const maxAdults = room.max_adults || 2;
    const newItem = {
      id: `${room.room_type}-${plan.code}-${Date.now()}`,
      room,
      plan,
      adults: Math.min(2, maxAdults),
      children: 0,
      infants: 0,
      roomPreference: "",
    };
    setCart(prev => [...prev, newItem]);
    setAddedFeedback(`${room.room_type}-${plan.code}`);
    setTimeout(() => setAddedFeedback(null), 2000);
  };

  const handleRemoveFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const updateCartItemConfig = (id: string, field: 'adults' | 'children' | 'infants' | 'roomPreference', value: any) => {
    setCart(prev => prev.map(item => {
      if (item.id !== id) return item;
      if (field === 'roomPreference') return { ...item, roomPreference: value };

      const newValue = Math.max(0, value);
      const maxAdults = item.room.max_adults || 2;
      const maxChildren = item.room.max_children || 0;
      const maxInfants = item.room.max_infants || 0;

      if (field === 'adults' && newValue > maxAdults) {
        setLimitWarning(`Max ${maxAdults} adults allowed`);
        setTimeout(() => setLimitWarning(null), 3000);
        return item;
      }
      if (field === 'children' && newValue > maxChildren) {
        setLimitWarning(`Max ${maxChildren} children allowed`);
        setTimeout(() => setLimitWarning(null), 3000);
        return item;
      }
      if (field === 'infants' && newValue > maxInfants) {
        setLimitWarning(`Max ${maxInfants} infants allowed`);
        setTimeout(() => setLimitWarning(null), 3000);
        return item;
      }
      return { ...item, [field]: newValue };
    }));
  };

  const clearCart = () => {
    setCart([]);
    setIsGroupCheckout(false);
  };

  const totals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    cart.forEach(item => {
      const pricePerNight = getPriceForOccupancy(item.plan, item.adults, item.children);
      const roomSubtotal = pricePerNight * nights;
      subtotal += roomSubtotal;
      tax += computeTax(roomSubtotal);
    });
    return { subtotal, tax, grandTotal: subtotal + tax };
  }, [cart, nights]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center animate-pulse">
            <span className="text-2xl">🏨</span>
          </div>
          <p className="text-xs text-slate-400 font-medium tracking-widest uppercase">Loading</p>
        </div>
      </div>
    );
  }

  if (notFound || disabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center max-w-md">
          <p className="text-6xl mb-4">🏨</p>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            {notFound ? "Hotel Not Found" : "Booking Unavailable"}
          </h1>
          <p className="text-sm text-slate-500">Please check the URL or contact the hotel directly.</p>
        </div>
      </div>
    );
  }

  const themeColor = config?.theme_color || "#0f172a";

  return (
    <div className="min-h-screen bg-slate-50 font-sans antialiased">
      {/* ═══════════════════════════════════════════ */}
      {/* HEADER */}
      {/* ═══════════════════════════════════════════ */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {config?.logo_url ? (
              <img src={config.logo_url} alt={hotel?.name} className="h-10 object-contain" />
            ) : (
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-serif text-lg"
                style={{ background: themeColor }}
              >
                {hotel?.name?.charAt(0) || "H"}
              </div>
            )}
            <div>
              <h1 className="text-base font-serif font-bold text-slate-900">{hotel?.name}</h1>
              {hotel?.city && (
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                  {hotel.city}{hotel.state ? `, ${hotel.state}` : ""}
                </p>
              )}
            </div>
          </div>
          {config?.contact_phone && (
            <a
              href={`tel:${config.contact_phone}`}
              className="hidden md:flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
            >
              <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">📞</span>
              {config.contact_phone}
            </a>
          )}
        </div>
      </header>

      {/* ═══════════════════════════════════════════ */}
      {/* HERO */}
      {/* ═══════════════════════════════════════════ */}
      <section className="relative h-[380px] overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center scale-105"
          style={{
            backgroundImage: config?.hero_banner_url
              ? `url(${config.hero_banner_url})`
              : "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-900/40 to-slate-900/80" />
        <div className="relative h-full flex flex-col items-center justify-center text-center px-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] tracking-[0.2em] uppercase text-white/90 font-medium">
              Now Accepting Bookings
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-serif font-semibold text-white mb-3 leading-tight">
            {config?.hero_title || hotel?.name}
          </h1>
          <div className="w-20 h-[2px] bg-gradient-to-r from-transparent via-white/60 to-transparent mb-4" />
          <p className="text-base md:text-lg text-white/85 max-w-2xl">
            {config?.hero_subtitle || "An unforgettable stay awaits you"}
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════ */}
      {/* SEARCH BAR */}
      {/* ═══════════════════════════════════════════ */}
      <section className="relative px-4 -mt-12 z-20">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-2xl shadow-[0_20px_50px_-15px_rgba(0,0,0,0.15)] border border-slate-100 p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                  Check-in
                </label>
                <input
                  type="date"
                  value={checkIn}
                  min={todayISO()}
                  onChange={(e) => {
                    setCheckIn(e.target.value);
                    if (e.target.value >= checkOut) setCheckOut(addDays(e.target.value, 1));
                  }}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                  Check-out
                </label>
                <input
                  type="date"
                  value={checkOut}
                  min={addDays(checkIn, 1)}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                  Adults
                </label>
                <select
                  value={adults}
                  onChange={(e) => setAdults(Number(e.target.value))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-teal-500"
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>{n} Adult{n > 1 ? "s" : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                  Children
                </label>
                <select
                  value={children}
                  onChange={(e) => setChildren(Number(e.target.value))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-teal-500"
                >
                  {[0, 1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>{n} Child{n !== 1 ? "ren" : ""}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-center gap-3 text-xs text-slate-600 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span>🗓️</span>
                <span className="font-medium">{prettyDate(checkIn)} — {prettyDate(checkOut)}</span>
              </span>
              <span className="text-slate-300">|</span>
              <span className="font-semibold">{nights} night{nights > 1 ? "s" : ""}</span>
              <span className="text-slate-300">|</span>
              <span className="font-semibold text-emerald-600">
                👥 {adults} Adult{adults > 1 ? "s" : ""}{children > 0 ? `, ${children} Child${children > 1 ? "ren" : ""}` : ""}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════ */}
      {/* MAIN CONTENT */}
      {/* ═══════════════════════════════════════════ */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-12 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT: ROOMS */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-2xl md:text-3xl font-serif font-semibold text-slate-900">
                Available Rooms
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Choose your perfect stay from {roomTypes.length} room type{roomTypes.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {roomTypes.length === 0 && (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
              <p className="text-5xl mb-4">🔍</p>
              <p className="font-semibold text-slate-700 text-lg">No rooms available</p>
              <p className="text-sm text-slate-500 mt-1">Please try different dates</p>
            </div>
          )}

          {roomTypes.map((room) => {
            const avail = availability[room.room_type];
            const isAvailable = avail === undefined ? true : avail > 0;
            const photos = Array.isArray(room.photos) ? room.photos : [];
            const amenities = Array.isArray(room.amenities) ? room.amenities : [];

            return (
              <div
                key={room.room_type}
                className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300"
              >
                <div className="flex flex-col md:flex-row">
                  {/* Photo Section */}
                  <div className="md:w-[320px] bg-slate-100 shrink-0 relative">
                    <div className="h-64 md:h-full min-h-[240px] relative">
                      {photos.length > 0 ? (
                        <>
                          <img
                            src={photos[0]}
                            alt={room.room_type}
                            className="w-full h-full object-cover"
                          />
                          {photos.length > 1 && (
                            <>
                              <div className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-sm text-white px-3 py-1 rounded-full text-[10px] font-bold">
                                📷 {photos.length} Photos
                              </div>
                              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-slate-900/60 backdrop-blur-sm px-2 py-1.5 rounded-full">
                                {photos.slice(0, 5).map((_: string, i: number) => (
                                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/60" />
                                ))}
                              </div>
                            </>
                          )}
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-5xl text-slate-300">
                          🛏️
                        </div>
                      )}
                      {/* Available badge */}
                      <div className="absolute top-3 left-3">
                        {isAvailable && avail !== undefined && (
                          <span className="px-3 py-1 bg-emerald-500 text-white rounded-full text-[10px] font-bold shadow-lg">
                            ✓ {avail} Available
                          </span>
                        )}
                        {!isAvailable && (
                          <span className="px-3 py-1 bg-rose-500 text-white rounded-full text-[10px] font-bold shadow-lg">
                            Sold Out
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Details Section */}
                  <div className="flex-1 p-6">
                    <div className="mb-4">
                      <h3 className="text-2xl font-serif font-semibold text-slate-900 mb-2">
                        {room.room_type}
                      </h3>
                      {room.description && (
                        <p className="text-sm text-slate-500 leading-relaxed line-clamp-2">
                          {room.description}
                        </p>
                      )}
                    </div>

                    {/* Feature Chips */}
                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                      {room.bed_type && (
                        <span className="text-[11px] px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                          🛏️ {room.bed_type}
                          {room.bed_count && room.bed_count > 1 ? ` × ${room.bed_count}` : ""}
                        </span>
                      )}
                      {room.room_size && (
                        <span className="text-[11px] px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                          📐 {room.room_size}
                        </span>
                      )}
                      {room.view_type && (
                        <span className="text-[11px] px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                          👁️ {room.view_type}
                        </span>
                      )}
                      {room.floor_type && (
                        <span className="text-[11px] px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                          🏢 {room.floor_type}
                        </span>
                      )}
                    </div>

                    {/* Amenities */}
                    {amenities.length > 0 && (
                      <div className="flex items-center gap-2 mb-4 flex-wrap">
                        {amenities.slice(0, 6).map((a: string, i: number) => (
                          <span
                            key={i}
                            className="text-[11px] px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 font-semibold"
                          >
                            ✓ {a}
                          </span>
                        ))}
                        {amenities.length > 6 && (
                          <span className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 font-semibold">
                            +{amenities.length - 6} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* Capacity */}
                    <div className="flex items-center gap-4 text-xs font-medium text-slate-500 mb-4 pb-4 border-b border-slate-100">
                      <span className="flex items-center gap-1.5">
                        <span className="text-slate-400">👤</span> Max {room.max_adults} Adults
                      </span>
                      {room.max_children > 0 && (
                        <span className="flex items-center gap-1.5">
                          <span className="text-slate-400">🧒</span> Max {room.max_children} Children
                        </span>
                      )}
                    </div>

                    {/* Rate Plans */}
                    <div className="space-y-3">
                      {room.rate_plans.map((plan, idx) => {
                        const perNight = getPriceForOccupancy(plan, adults, children);
                        const total = perNight * nights;
                        const tax = computeTax(total);
                        const isJustAdded = addedFeedback === `${room.room_type}-${plan.code}`;
                        const isFirst = idx === 0;

                        return (
                          <div
                            key={plan.code}
                            className={`flex items-center justify-between p-4 rounded-xl border-2 transition ${
                              isFirst
                                ? "border-teal-500/30 bg-gradient-to-r from-teal-50/50 to-emerald-50/30"
                                : "border-slate-100 hover:border-slate-200 bg-white"
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span
                                  className="text-[10px] font-bold px-2 py-0.5 rounded text-white uppercase"
                                  style={{ background: isFirst ? themeColor : "#64748b" }}
                                >
                                  {plan.code}
                                </span>
                                <p className="text-sm font-bold text-slate-800">{plan.name}</p>
                                {isFirst && (
                                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 uppercase">
                                    Best Value
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500">{plan.description}</p>
                            </div>
                            <div className="text-right ml-4 shrink-0">
                              <p className="text-xl font-serif font-bold text-slate-900">
                                ₹{total.toLocaleString("en-IN")}
                              </p>
                              <p className="text-[10px] text-slate-500">
                                + ₹{tax.toLocaleString("en-IN")} tax
                              </p>
                              <p className="text-[10px] text-slate-400">
                                ₹{perNight.toLocaleString("en-IN")} × {nights} night{nights > 1 ? "s" : ""}
                              </p>
                              <button
                                onClick={() => handleAddToCart(room, plan)}
                                disabled={!isAvailable}
                                className={`mt-2 px-5 py-2 rounded-lg text-[11px] font-bold text-white uppercase tracking-wider transition shadow-md ${
                                  isJustAdded
                                    ? "bg-emerald-600"
                                    : "hover:opacity-90"
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                                style={{ background: isJustAdded ? "#059669" : isFirst ? themeColor : "#0f172a" }}
                              >
                                {isJustAdded ? "✓ Added" : "+ Add to Booking"}
                              </button>
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

        {/* RIGHT: SIDEBAR */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 sticky top-24">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-serif font-bold text-slate-900">Your Selection</h3>
              {cart.length > 0 && (
                <span className="bg-teal-100 text-teal-700 text-xs font-bold px-2.5 py-1 rounded-full">
                  {cart.length} room{cart.length > 1 ? "s" : ""}
                </span>
              )}
            </div>

            <div className="space-y-3 mb-4 max-h-[400px] overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-4xl mb-2">🛒</p>
                  <p className="text-xs text-slate-400">No rooms selected yet</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Add rooms to proceed
                  </p>
                </div>
              ) : (
                cart.map((item) => {
                  const maxAdults = item.room.max_adults || 2;
                  const maxChildren = item.room.max_children || 0;
                  const maxInfants = item.room.max_infants || 0;
                  const photos = Array.isArray(item.room.photos) ? item.room.photos : [];

                  return (
                    <div
                      key={item.id}
                      className="border border-slate-200 rounded-xl p-3 bg-slate-50/50"
                    >
                      <div className="flex gap-3 mb-3">
                        <div className="w-12 h-12 rounded-lg bg-slate-200 overflow-hidden shrink-0">
                          {photos[0] ? (
                            <img src={photos[0]} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-lg">🛏️</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {item.room.room_type}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate">
                            {item.plan.code} - {item.plan.name}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemoveFromCart(item.id)}
                          className="text-slate-400 hover:text-rose-500 text-lg font-bold shrink-0"
                        >
                          ×
                        </button>
                      </div>

                      <input
                        type="text"
                        value={item.roomPreference}
                        onChange={(e) => updateCartItemConfig(item.id, "roomPreference", e.target.value)}
                        placeholder="Room preference (optional)"
                        className="w-full text-[10px] border border-slate-200 rounded-lg px-2 py-1.5 mb-2 outline-none focus:border-teal-500"
                      />

                      <div className="grid grid-cols-3 gap-1.5">
                        <div className="bg-white rounded-lg p-1.5">
                          <p className="text-[8px] font-semibold text-slate-400 uppercase text-center mb-1">
                            Adults
                          </p>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => updateCartItemConfig(item.id, "adults", item.adults - 1)}
                              disabled={item.adults <= 1}
                              className="w-5 h-5 rounded border border-slate-200 text-xs disabled:opacity-30 font-bold"
                            >
                              −
                            </button>
                            <span className="text-xs font-bold w-4 text-center">{item.adults}</span>
                            <button
                              onClick={() => updateCartItemConfig(item.id, "adults", item.adults + 1)}
                              disabled={item.adults >= maxAdults}
                              className="w-5 h-5 rounded border border-slate-200 text-xs disabled:opacity-30 font-bold"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-1.5">
                          <p className="text-[8px] font-semibold text-slate-400 uppercase text-center mb-1">
                            Child
                          </p>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => updateCartItemConfig(item.id, "children", item.children - 1)}
                              disabled={item.children <= 0}
                              className="w-5 h-5 rounded border border-slate-200 text-xs disabled:opacity-30 font-bold"
                            >
                              −
                            </button>
                            <span className="text-xs font-bold w-4 text-center">{item.children}</span>
                            <button
                              onClick={() => updateCartItemConfig(item.id, "children", item.children + 1)}
                              disabled={item.children >= maxChildren}
                              className="w-5 h-5 rounded border border-slate-200 text-xs disabled:opacity-30 font-bold"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-1.5">
                          <p className="text-[8px] font-semibold text-slate-400 uppercase text-center mb-1">
                            Infant
                          </p>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => updateCartItemConfig(item.id, "infants", item.infants - 1)}
                              disabled={item.infants <= 0}
                              className="w-5 h-5 rounded border border-slate-200 text-xs disabled:opacity-30 font-bold"
                            >
                              −
                            </button>
                            <span className="text-xs font-bold w-4 text-center">{item.infants}</span>
                            <button
                              onClick={() => updateCartItemConfig(item.id, "infants", item.infants + 1)}
                              disabled={item.infants >= maxInfants}
                              className="w-5 h-5 rounded border border-slate-200 text-xs disabled:opacity-30 font-bold"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>

                      <p className="text-right text-sm font-bold text-slate-900 mt-3">
                        ₹{(getPriceForOccupancy(item.plan, item.adults, item.children) * nights).toLocaleString("en-IN")}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-slate-200 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-semibold">₹{totals.subtotal.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Taxes (12% GST)</span>
                <span className="font-semibold">₹{totals.tax.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                <span className="text-sm font-bold text-slate-900">Total</span>
                <span className="text-2xl font-serif font-bold" style={{ color: themeColor }}>
                  ₹{totals.grandTotal.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsGroupCheckout(true)}
              disabled={cart.length === 0}
              className="w-full mt-5 py-4 rounded-xl text-xs font-bold text-white uppercase tracking-[0.15em] transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              style={{ background: themeColor }}
            >
              Continue to Booking →
            </button>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="bg-slate-900 text-white mt-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-16 py-12">
          <div className="text-center">
            <h3 className="text-2xl font-serif font-semibold mb-2">{hotel?.name}</h3>
            {config?.contact_address && (
              <p className="text-sm text-slate-400 mb-4">{config.contact_address}</p>
            )}
            <div className="flex items-center justify-center gap-4 text-sm text-slate-400">
              {config?.contact_phone && <span>📞 {config.contact_phone}</span>}
              {config?.contact_email && <span>✉️ {config.contact_email}</span>}
            </div>
            <div className="mt-6 pt-6 border-t border-white/10">
              <p className="text-xs text-slate-500">
                © {new Date().getFullYear()} {hotel?.name}. All rights reserved.
              </p>
              <p className="text-[11px] text-slate-600 mt-2">
                Powered by <span className="text-slate-400 font-medium">Staynexa PMS</span>
              </p>
            </div>
          </div>
        </div>
      </footer>

      {/* LIMIT WARNING */}
      {limitWarning && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[200] bg-rose-500 text-white px-6 py-3 rounded-full shadow-2xl text-sm font-bold animate-bounce">
          ⚠️ {limitWarning}
        </div>
      )}

      {/* BOOKING MODAL */}
      {isGroupCheckout && hotel && cart.length > 0 && (
        <GroupBookingModal
          hotel={hotel}
          cart={cart}
          checkIn={checkIn}
          checkOut={checkOut}
          nights={nights}
          accentColor={themeColor}
          config={config}
          onClose={clearCart}
          onSuccess={handleBookingCreated}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// GROUP BOOKING MODAL
// ═══════════════════════════════════════════════
function GroupBookingModal({
  hotel, cart, checkIn, checkOut, nights, accentColor, config, onClose, onSuccess,
}: {
  hotel: PublicHotel;
  cart: Array<{ id: string; room: PublicRoomType; plan: PublicRatePlan; adults: number; children: number; infants: number; roomPreference: string }>;
  checkIn: string;
  checkOut: string;
  nights: number;
  accentColor: string;
  config: BookingEngineConfig | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const grandSubtotal = cart.reduce((sum, item) => sum + (getPriceForOccupancy(item.plan, item.adults, item.children) * nights), 0);
  const grandTax = cart.reduce((sum, item) => sum + computeTax(getPriceForOccupancy(item.plan, item.adults, item.children) * nights), 0);
  const grandTotal = grandSubtotal + grandTax;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const name = `${firstName.trim()} ${lastName.trim()}`.trim();
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<any>(null);
  const [paymentOption, setPaymentOption] = useState<"full" | "partial" | "pay_at_property">("pay_at_property");

  const paymentEnabled = config?.payment_enabled === true && config?.payment_gateway !== "none";
  const amountPending = grandTotal;

  const handleSubmit = async () => {
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError("Please enter your full name");
      return;
    }
    if (phone.replace(/\D/g, "").length < 10) {
      setError("Please enter a valid phone number");
      return;
    }

    setSubmitting(true);
    try {
      const preferencesList = cart
        .map((item, idx) => item.roomPreference ? `Room ${idx + 1} (${item.room.room_type}): ${item.roomPreference}` : null)
        .filter(Boolean)
        .join(" | ");
      const combinedNotes = [notes.trim(), preferencesList].filter(Boolean).join(" | ");

      const result = await createGroupReservation({
        hotelId: hotel.id,
        checkIn,
        checkOut,
        source: "bookingengine",
        primaryGuest: {
          name,
          phone: phone.trim(),
          email: email.trim(),
          address: "",
          city: "",
          state: "",
          pincode: "",
        },
        notes: combinedNotes || `Group booking (${cart.length} rooms)`,
        rooms: cart.map(item => ({
          roomType: item.room.room_type,
          ratePlan: item.plan.code,
          adults: item.adults,
          children: item.children,
          infants: item.infants,
          amount: getPriceForOccupancy(item.plan, item.adults, item.children) * nights,
          tax: computeTax(getPriceForOccupancy(item.plan, item.adults, item.children) * nights),
        })),
      });

      setConfirmation({
        ref: result.mainBookingRef,
        name,
        roomCount: cart.length,
      });
    } catch (err: any) {
      setError(err?.message || "Booking failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmation) {
    return (
      <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-[100] p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
          <div className="p-8 text-center border-b border-slate-100">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500 flex items-center justify-center text-3xl text-white">✓</div>
            <h3 className="text-2xl font-serif font-bold text-slate-900 mb-2">Booking Confirmed!</h3>
            <p className="text-sm text-slate-500">A confirmation voucher has been sent.</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="text-center bg-slate-50 p-4 rounded-xl">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Reference</p>
              <p className="text-xl font-serif font-bold text-slate-900">{confirmation.ref}</p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Guest</span><span className="font-semibold">{confirmation.name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Rooms</span><span className="font-semibold">{confirmation.roomCount}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Total</span><span className="font-bold">₹{grandTotal.toLocaleString("en-IN")}</span></div>
            </div>
            <p className="text-xs text-center text-slate-500 bg-blue-50 p-3 rounded-lg">
              🛈 Room numbers will be assigned by the hotel
            </p>
          </div>
          <div className="px-6 py-4 border-t bg-slate-50">
            <button
              onClick={() => { onClose(); onSuccess(); }}
              className="w-full py-3 rounded-xl text-xs font-bold text-white uppercase"
              style={{ background: accentColor }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-serif font-bold text-slate-900">Complete Your Booking</h3>
            <p className="text-xs text-slate-500">{cart.length} room(s) selected</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white border text-slate-400">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="p-4 bg-slate-900 rounded-xl text-white space-y-2">
            <div className="flex justify-between text-sm"><span className="text-slate-400">Subtotal</span><span>₹{grandSubtotal.toLocaleString("en-IN")}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-400">Taxes (12% GST)</span><span>₹{grandTax.toLocaleString("en-IN")}</span></div>
            <div className="flex justify-between pt-2 border-t border-white/10"><span className="font-bold">Total</span><span className="font-serif font-bold text-xl">₹{grandTotal.toLocaleString("en-IN")}</span></div>
          </div>

          {paymentEnabled && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Payment Method</p>
              <label className={`flex justify-between p-3 rounded-xl border-2 cursor-pointer ${paymentOption === "full" ? "border-teal-500 bg-teal-50" : "border-slate-200"}`}>
                <div className="flex items-center gap-2">
                  <input type="radio" checked={paymentOption === "full"} onChange={() => setPaymentOption("full")} />
                  <span className="text-sm font-bold">Full Payment</span>
                </div>
                <span className="font-bold">₹{grandTotal.toLocaleString("en-IN")}</span>
              </label>
              <label className={`flex justify-between p-3 rounded-xl border-2 cursor-pointer ${paymentOption === "pay_at_property" ? "border-teal-500 bg-teal-50" : "border-slate-200"}`}>
                <div className="flex items-center gap-2">
                  <input type="radio" checked={paymentOption === "pay_at_property"} onChange={() => setPaymentOption("pay_at_property")} />
                  <span className="text-sm font-bold">Pay at Hotel</span>
                </div>
                <span className="font-bold text-slate-500">₹0 now</span>
              </label>
            </div>
          )}

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="First Name"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500"
              />
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Last Name"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500"
              />
            </div>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Phone Number"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500"
            />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email (Optional)"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500"
            />
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Special requests (Optional)"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500 resize-none"
            />
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t bg-slate-50 flex gap-2">
          <button onClick={onClose} className="px-5 py-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-600">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 py-3 rounded-xl text-xs font-bold text-white disabled:opacity-50"
            style={{ background: accentColor }}
          >
            {submitting ? "Booking..." : "Confirm Booking"}
          </button>
        </div>
      </div>
    </div>
  );
}
