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
// TYPES
// ═══════════════════════════════════════════════
type RoomConfig = { adults: number; children: number; infants: number };
type SelectionMap = Record<string, { room: PublicRoomType; plan: PublicRatePlan; rooms: RoomConfig[] }>;

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
  const [checkInTime, setCheckInTime] = useState("12:00 PM");
  const [checkOutTime, setCheckOutTime] = useState("11:00 AM");
  const [availability, setAvailability] = useState<Record<string, number>>({});
  const [checkingAvail, setCheckingAvail] = useState(false);

  const [selection, setSelection] = useState<SelectionMap>({});
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [expandedDesc, setExpandedDesc] = useState<Record<string, boolean>>({});

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
    setSelection({});
    setIsCheckoutModalOpen(false);
    checkAllAvailability();
  };

  const scrollToRooms = () => { document.getElementById("rooms-section")?.scrollIntoView({ behavior: "smooth" }); };

  // ═══════════════════════════════════════════════
  // SELECTION LOGIC (Inline Configuration)
  // ═══════════════════════════════════════════════
  const getPlanKey = (room: PublicRoomType, plan: PublicRatePlan) => `${room.room_type}||${plan.code}`;

  const addRoomToPlan = (room: PublicRoomType, plan: PublicRatePlan) => {
    const key = getPlanKey(room, plan);
    setSelection(prev => {
      const existing = prev[key]?.rooms || [];
      return {
        ...prev,
        [key]: {
          room,
          plan,
          rooms: [...existing, { adults: 2, children: 0, infants: 0 }]
        }
      };
    });
  };

  const removeRoomFromPlan = (key: string, index: number) => {
    setSelection(prev => {
      const current = prev[key];
      if (!current) return prev;
      const newRooms = current.rooms.filter((_, i) => i !== index);
      if (newRooms.length === 0) {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      }
      return { ...prev, [key]: { ...current, rooms: newRooms } };
    });
  };

  const updateRoomConfig = (key: string, index: number, field: keyof RoomConfig, value: number) => {
    setSelection(prev => {
      const current = prev[key];
      if (!current) return prev;
      const newRooms = [...current.rooms];
      newRooms[index] = { ...newRooms[index], [field]: Math.max(0, value) };
      return { ...prev, [key]: { ...current, rooms: newRooms } };
    });
  };

  // ═══════════════════════════════════════════════
  // PRICE CALCULATIONS
  // ═══════════════════════════════════════════════
  const totals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    let totalRooms = 0;

    Object.values(selection).forEach(({ room, plan, rooms }) => {
      rooms.forEach(cfg => {
        const pricePerNight = getPriceForOccupancy(plan, cfg.adults, cfg.children);
        const roomSubtotal = pricePerNight * nights;
        subtotal += roomSubtotal;
        tax += computeTax(roomSubtotal);
        totalRooms++;
      });
    });

    return { subtotal, tax, grandTotal: subtotal + tax, totalRooms };
  }, [selection, nights]);

  // Flatten selection for API
  const flattenedRooms = useMemo(() => {
    const list: Array<{ roomType: string; ratePlan: string; adults: number; children: number; infants: number; amount: number; tax: number }> = [];
    Object.values(selection).forEach(({ room, plan, rooms }) => {
      rooms.forEach(cfg => {
        const pricePerNight = getPriceForOccupancy(plan, cfg.adults, cfg.children);
        const roomSubtotal = pricePerNight * nights;
        list.push({
          roomType: room.room_type,
          ratePlan: plan.code,
          adults: cfg.adults,
          children: cfg.children,
          infants: cfg.infants,
          amount: roomSubtotal,
          tax: computeTax(roomSubtotal),
        });
      });
    });
    return list;
  }, [selection, nights]);

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
          </div>
        </div>
        <nav className="hidden lg:flex items-center gap-8 text-sm text-white/80">
          <a href="#rooms-section" className="hover:text-white transition">Rooms</a>
          {config?.show_about_section !== false && config?.about_description && (<a href="#about-section" className="hover:text-white transition">About</a>)}
          {config?.show_amenities_section !== false && config?.amenities && config.amenities.length > 0 && (<a href="#amenities-section" className="hover:text-white transition">Amenities</a>)}
        </nav>
        {config?.contact_phone && (
          <a href={`tel:${config.contact_phone}`} className="hidden md:flex items-center gap-2 text-xs font-medium text-white/80 hover:text-white transition tracking-wide">
            <span className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">📞</span>
            {config.contact_phone}
          </a>
        )}
      </header>

      {/* HERO */}
      <section className="relative h-[400px] overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: config?.hero_banner_url ? `url(${config.hero_banner_url})` : "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)" }} />
        <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, rgba(15,23,42,0.6) 0%, rgba(15,23,42,0.3) 50%, rgba(15,23,42,0.7) 100%)` }} />
        <div className="relative h-full flex flex-col items-center justify-center text-center px-6">
          <h1 className="text-4xl md:text-6xl font-serif font-semibold text-white mb-4">{config?.hero_title || hotel?.name}</h1>
          <p className="text-lg text-white/80">{config?.hero_subtitle || "An unforgettable stay awaits you"}</p>
        </div>
      </section>

      {/* MAIN LAYOUT */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-12 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT: ROOMS LIST (8 cols) */}
        <div className="lg:col-span-8 space-y-8">
          <div id="rooms-section">
            <h2 className="text-3xl font-serif font-semibold text-slate-900 mb-6">Choose Your Perfect Stay</h2>
          </div>

          {roomTypes.map((room) => {
            const avail = availability[room.room_type];
            const isAvailable = avail === undefined ? true : avail > 0;

            return (
              <div key={room.room_type} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="flex flex-col lg:flex-row">
                  {/* Room Image & Info */}
                  <div className="lg:w-[320px] bg-slate-100 shrink-0 relative">
                    <RoomPhotoGallery photos={room.photos && room.photos.length > 0 ? room.photos : room.photo_url ? [room.photo_url] : []} roomType={room.room_type} />
                    <div className="p-5">
                      <h3 className="text-xl font-serif font-semibold text-slate-900 mb-2">{room.room_type}</h3>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {room.bed_type && <span className="text-[10px] px-2 py-1 rounded bg-slate-100 font-semibold">🛏️ {room.bed_type}</span>}
                        {room.room_size && <span className="text-[10px] px-2 py-1 rounded bg-slate-100 font-semibold">📐 {room.room_size}</span>}
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-3">{room.description}</p>
                      <button className="text-xs font-bold text-teal-600 underline mt-2">More Details</button>
                    </div>
                  </div>

                  {/* Rate Plans & Inline Configuration */}
                  <div className="flex-1 p-5 lg:p-6 space-y-5">
                    {room.rate_plans.map((plan) => {
                      const key = getPlanKey(room, plan);
                      const currentSelection = selection[key];
                      const roomCount = currentSelection?.rooms.length || 0;
                      const pricePerNight = getPriceForOccupancy(plan, 2, 0); // Base price for display

                      return (
                        <div key={plan.code} className="border border-slate-200 rounded-2xl overflow-hidden">
                          {/* Rate Plan Header */}
                          <div className="bg-slate-50 p-4 flex items-center justify-between border-b border-slate-200">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-white uppercase">{plan.code}</span>
                                <p className="text-sm font-bold text-slate-800">{plan.name}</p>
                              </div>
                              <p className="text-[10px] text-slate-500 mt-1">{plan.description || "Room + Meals"}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-slate-900">₹{pricePerNight.toLocaleString("en-IN")}</p>
                              <p className="text-[10px] text-slate-500">+ ₹{computeTax(pricePerNight).toLocaleString("en-IN")} Taxes & Fees / Night</p>
                            </div>
                          </div>

                          {/* Inline Room Configurator */}
                          <div className="p-4 space-y-4">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold text-slate-600">Rooms</p>
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => roomCount > 0 && removeRoomFromPlan(key, roomCount - 1)}
                                  className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                                  disabled={roomCount === 0}
                                >−</button>
                                <span className="text-sm font-bold text-slate-900 w-6 text-center">{roomCount}</span>
                                <button
                                  onClick={() => addRoomToPlan(room, plan)}
                                  className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-100"
                                >+</button>
                              </div>
                            </div>

                            {/* Individual Room Cards */}
                            {currentSelection?.rooms.map((cfg, idx) => (
                              <div key={idx} className="bg-white border border-slate-100 rounded-xl p-4 relative">
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-xs font-bold text-slate-800">Room {idx + 1}</p>
                                  <button
                                    onClick={() => removeRoomFromPlan(key, idx)}
                                    className="text-[10px] font-bold text-rose-500 hover:text-rose-700"
                                  >Remove</button>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                  {/* Adults */}
                                  <div>
                                    <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Adults</label>
                                    <div className="flex items-center gap-2">
                                      <button onClick={() => updateRoomConfig(key, idx, 'adults', cfg.adults - 1)} className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-xs">−</button>
                                      <span className="text-sm font-bold w-4 text-center">{cfg.adults}</span>
                                      <button onClick={() => updateRoomConfig(key, idx, 'adults', cfg.adults + 1)} className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-xs">+</button>
                                    </div>
                                  </div>
                                  {/* Children */}
                                  <div>
                                    <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Children</label>
                                    <div className="flex items-center gap-2">
                                      <button onClick={() => updateRoomConfig(key, idx, 'children', cfg.children - 1)} className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-xs">−</button>
                                      <span className="text-sm font-bold w-4 text-center">{cfg.children}</span>
                                      <button onClick={() => updateRoomConfig(key, idx, 'children', cfg.children + 1)} className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-xs">+</button>
                                    </div>
                                  </div>
                                  {/* Infants */}
                                  <div>
                                    <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Infants</label>
                                    <div className="flex items-center gap-2">
                                      <button onClick={() => updateRoomConfig(key, idx, 'infants', cfg.infants - 1)} className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-xs">−</button>
                                      <span className="text-sm font-bold w-4 text-center">{cfg.infants}</span>
                                      <button onClick={() => updateRoomConfig(key, idx, 'infants', cfg.infants + 1)} className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-xs">+</button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* RIGHT: SIDEBAR (4 cols) */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-lg p-6 sticky top-6">
            <h3 className="text-lg font-serif font-bold text-slate-900 mb-6">Your stay</h3>

            {/* Dates & Times */}
            <div className="space-y-4 mb-6 pb-6 border-b border-slate-100">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Check-in</p>
                  <p className="text-sm font-bold text-slate-900">{prettyDate(checkIn)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Check-out</p>
                  <p className="text-sm font-bold text-slate-900">{prettyDate(checkOut)}</p>
                </div>
                <button className="text-[10px] font-bold text-teal-600 underline">Modify</button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Check-in time</label>
                  <select value={checkInTime} onChange={e => setCheckInTime(e.target.value)} className="w-full text-xs font-medium border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-teal-500">
                    {["11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM"].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Check-out time</label>
                  <select value={checkOutTime} onChange={e => setCheckOutTime(e.target.value)} className="w-full text-xs font-medium border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-teal-500">
                    {["10:00 AM", "11:00 AM", "12:00 PM"].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Selection Summary */}
            <div className="space-y-4 mb-6 max-h-[300px] overflow-y-auto pr-2">
              {Object.keys(selection).length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No rooms selected yet.</p>
              ) : (
                Object.entries(selection).map(([key, { room, plan, rooms }]) => (
                  <div key={key} className="border-b border-slate-100 pb-3 last:border-0">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <p className="text-xs font-bold text-slate-800">{rooms.length} x {room.room_type}</p>
                        <p className="text-[10px] text-slate-500">{plan.code}</p>
                      </div>
                      <p className="text-xs font-bold text-slate-900">
                        ₹{rooms.reduce((sum, cfg) => sum + getPriceForOccupancy(plan, cfg.adults, cfg.children) * nights, 0).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] text-slate-400">
                        {rooms[0]?.adults || 0} Adult(s), {rooms[0]?.children || 0} Child(ren)
                      </p>
                      <button onClick={() => removeRoomFromPlan(key, 0)} className="text-[10px] font-bold text-rose-500">Remove</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Price Breakdown */}
            <div className="border-t border-slate-200 pt-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Price</span>
                <span className="font-semibold text-slate-900">₹{totals.subtotal.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Taxes and Fees</span>
                <span className="font-semibold text-slate-900">₹{totals.tax.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                <span className="text-sm font-bold text-slate-900">Total Amount</span>
                <span className="text-xl font-serif font-bold text-slate-900">₹{totals.grandTotal.toLocaleString("en-IN")}</span>
              </div>
            </div>

            {/* Continue Button */}
            <button
              onClick={() => setIsCheckoutModalOpen(true)}
              disabled={totals.totalRooms === 0}
              className="w-full mt-6 py-4 rounded-2xl text-xs font-bold text-white uppercase tracking-[0.2em] transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              style={{ background: themeColor }}
            >
              Continue
            </button>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="bg-slate-900 text-white mt-20">
        <div className="max-w-6xl mx-auto px-6 lg:px-16 py-20">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="md:col-span-2">
              <h3 className="text-3xl font-serif font-semibold mb-4">{hotel?.name}</h3>
              <div className="w-14 h-[2px] bg-gradient-to-r from-white/50 to-transparent mb-5" />
              {config?.contact_address && (<p className="text-sm text-slate-400 leading-relaxed mb-5">{config.contact_address}</p>)}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500 mb-5">Contact</p>
              {config?.contact_phone && (<p className="text-sm text-slate-300 mb-2">📞 {config.contact_phone}</p>)}
              {config?.contact_email && (<p className="text-sm text-slate-300">✉️ {config.contact_email}</p>)}
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
          </div>
        </div>
      </footer>

      {/* CHECKOUT MODAL */}
      {isCheckoutModalOpen && hotel && flattenedRooms.length > 0 && (
        <GroupBookingModal
          hotel={hotel}
          rooms={flattenedRooms}
          checkIn={checkIn}
          checkOut={checkOut}
          checkInTime={checkInTime}
          checkOutTime={checkOutTime}
          nights={nights}
          accentColor={themeColor}
          config={config}
          onClose={() => setIsCheckoutModalOpen(false)}
          onSuccess={handleBookingCreated}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// ROOM PHOTO GALLERY (Same as before)
// ═══════════════════════════════════════════════
function RoomPhotoGallery({ photos, roomType }: { photos: string[]; roomType: string }) {
  const [activeIdx, setActiveIdx] = useState(0);
  if (!photos || photos.length === 0) return <div className="w-full h-full flex items-center justify-center text-6xl text-slate-300 bg-slate-100">🛏️</div>;
  return (
    <div className="w-full h-full relative group">
      <img src={photos[activeIdx]} alt={roomType} className="w-full h-full object-cover" />
      {photos.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 bg-slate-900/60 px-2 py-1 rounded-full">
          {photos.slice(0, 5).map((_, idx) => (
            <button key={idx} onClick={() => setActiveIdx(idx)} className={`w-1.5 h-1.5 rounded-full ${activeIdx === idx ? 'bg-white' : 'bg-white/40'}`} />
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// GROUP BOOKING MODAL (Updated for Flattened Rooms)
// ═══════════════════════════════════════════════
function GroupBookingModal({
  hotel, rooms, checkIn, checkOut, checkInTime, checkOutTime, nights, accentColor, config, onClose, onSuccess,
}: {
  hotel: PublicHotel;
  rooms: Array<{ roomType: string; ratePlan: string; adults: number; children: number; infants: number; amount: number; tax: number }>;
  checkIn: string;
  checkOut: string;
  checkInTime: string;
  checkOutTime: string;
  nights: number;
  accentColor: string;
  config: BookingEngineConfig | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const grandSubtotal = rooms.reduce((sum, r) => sum + r.amount, 0);
  const grandTax = rooms.reduce((sum, r) => sum + r.tax, 0);
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
  const [confirmation, setConfirmation] = useState<any>(null);

  const [paymentOption, setPaymentOption] = useState<"full" | "partial" | "pay_at_property">("full");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [cancellationModalOpen, setCancellationModalOpen] = useState(false);

  const paymentEnabled = config?.payment_enabled === true;
  const partialPct = config?.partial_payment_pct || 50;

  const amountToPayNow = paymentOption === "full" ? grandTotal : paymentOption === "partial" ? Math.round(grandTotal * (partialPct / 100)) : 0;
  const amountPending = grandTotal - amountToPayNow;

  const handleSubmit = async () => {
    setError(null);
    if (config?.show_terms_checkbox !== false && !termsAccepted) { setError("Please accept the Terms & Conditions to continue"); return; }
    if (!firstName.trim() || !lastName.trim()) { setError("Please enter your full name"); return; }
    if (phone.replace(/\D/g, "").length < 10) { setError("Please enter a valid phone number"); return; }

    setSubmitting(true);
    try {
      const result = await createGroupReservation({
        hotelId: hotel.id,
        checkIn,
        checkOut,
        source: "bookingengine",
        primaryGuest: { name, phone: phone.trim(), email: email.trim(), address: "", city: "", state: "", pincode: "" },
        notes: notes.trim() || `Group booking (${rooms.length} rooms)`,
        rooms: rooms.map(r => ({
          roomType: r.roomType,
          ratePlan: r.ratePlan,
          adults: r.adults,
          children: r.children,
          infants: r.infants,
          amount: r.amount,
          tax: r.tax,
        })),
      });

      const bookingId = result.bookings[0]?.id;
      const bookingRef = result.mainBookingRef;

      if (paymentOption === "pay_at_property" || !paymentEnabled || config?.payment_gateway === "none") {
        await triggerNotifications(bookingId, bookingRef, paymentOption, 0, amountPending);
        setConfirmation({ ref: bookingRef, name, paymentStatus: "none", paymentType: paymentOption, amountPaid: 0, amountPending, roomCount: rooms.length });
        setSubmitting(false);
        return;
      }
      await handlePaymentFlow(bookingId, bookingRef, amountToPayNow);
    } catch (err: any) {
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
        body: JSON.stringify({ hotelId: hotel.id, amount: amountToCharge, bookingRef, bookingId, customerName: name, customerPhone: phone.trim(), customerEmail: email.trim() }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Payment init failed");

      if (data.gateway === "razorpay") {
        await loadRazorpayScript();
        const options = {
          key: data.publicKey, amount: data.amount, currency: "INR", name: hotel.name, description: `Group Booking ${bookingRef}`,
          order_id: data.orderId, prefill: { name, contact: phone.trim(), email: email.trim() }, theme: { color: accentColor },
          handler: async (response: any) => await verifyPayment({ hotelId: hotel.id, gateway: "razorpay", orderId: response.razorpay_order_id, paymentId: response.razorpay_payment_id, signature: response.razorpay_signature, bookingId, bookingRef, amountPaid: amountToCharge }),
          modal: { ondismiss: () => { setPaymentProcessing(false); setSubmitting(false); setError("Payment cancelled."); } },
        };
        new (window as any).Razorpay(options).open();
      } else if (data.gateway === "cashfree") {
        await loadCashfreeScript();
        (window as any).Cashfree({ mode: data.mode || "production" }).checkout({ paymentSessionId: data.paymentLink, redirectTarget: "_modal" });
      }
    } catch (err: any) {
      setError(err.message || "Payment failed"); setPaymentProcessing(false); setSubmitting(false);
    }
  };

  const verifyPayment = async (params: any) => {
    try {
      const res = await fetch("/api/payments/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params) });
      const data = await res.json();
      if (data.success) {
        const { supabase } = await import("../../supabase");
        const groupId = (await supabase.from('bookings').select('group_id').eq('id', params.bookingId).single()).data?.group_id;
        if (groupId) {
          await supabase.from("bookings").update({ advance_paid: params.amountPaid, paid: params.amountPaid }).eq("group_id", groupId);
        }
        await triggerNotifications(params.bookingId, params.bookingRef, paymentOption, params.amountPaid, amountPending);
        setConfirmation({ ref: params.bookingRef, name, paymentStatus: "paid", paymentType: paymentOption, amountPaid: params.amountPaid, amountPending, roomCount: rooms.length });
      } else { setError(data.error || "Payment verification failed"); }
    } catch (err) { setError("Payment error."); } finally { setPaymentProcessing(false); setSubmitting(false); }
  };

  const triggerNotifications = async (bookingId: string, bookingRef: string, payType: string, paidAmount: number, pendingAmount: number) => {
    try {
      const { triggerBookingNotifications } = await import("../../lib/notifications");
      const roomsSummary = rooms.map((item, idx) => `Room ${idx + 1}: ${item.roomType} (${item.adults} Adult(s), ${item.children} Child(ren)) - ₹${item.amount.toLocaleString("en-IN")}`).join('\n');
      await triggerBookingNotifications({
        hotelId: hotel.id, bookingId, bookingRef, guestName: name, guestPhone: phone.trim(), guestEmail: email.trim(),
        roomType: rooms[0]?.roomType || "Multiple Rooms", roomNumber: "Multiple", roomsSummary, roomsCount: rooms.length,
        checkIn, checkOut, nights, total: grandTotal, hotelName: hotel.name, hotelPhone: config?.contact_phone ?? undefined,
        adults: rooms.reduce((s, r) => s + r.adults, 0), children: rooms.reduce((s, r) => s + r.children, 0),
        paymentType: payType as any, amountPaid: paidAmount, amountPending: pendingAmount, partialPct: partialPct,
      });
    } catch (err) { console.error(err); }
  };

  if (confirmation) {
    return (
      <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-[100] p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
          <div className="p-10 text-center border-b border-slate-100">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-slate-900 flex items-center justify-center text-4xl text-white">✓</div>
            <h3 className="text-3xl font-serif font-semibold text-slate-900 mb-2">Booking Confirmed</h3>
            <p className="text-sm text-slate-500">A voucher has been sent to you.</p>
          </div>
          <div className="p-8 space-y-5">
            <div className="text-center">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.3em] mb-2">Booking Reference</p>
              <p className="text-2xl font-serif font-bold text-slate-900">{confirmation.ref}</p>
            </div>
            <div className="p-5 bg-slate-50 rounded-2xl space-y-3 text-sm border border-slate-100">
              <div className="flex justify-between"><span className="text-slate-500">Rooms Booked</span><span className="font-semibold">{confirmation.roomCount} Rooms</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Total</span><span className="font-bold">₹{grandTotal.toLocaleString("en-IN")}</span></div>
            </div>
          </div>
          <div className="px-8 py-5 border-t border-slate-100 bg-slate-50">
            <button onClick={() => { onClose(); onSuccess(); }} className="w-full py-3.5 rounded-xl text-xs font-bold text-white uppercase bg-slate-900">Done</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <div>
            <h3 className="text-2xl font-serif font-semibold text-slate-900">Complete Your Booking</h3>
            <p className="text-xs text-slate-500 mt-1">{rooms.length} Room(s) selected</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          <div className="p-5 bg-slate-900 rounded-2xl text-white space-y-3">
            <div className="flex justify-between text-sm"><span className="text-slate-400">Subtotal ({nights} nights)</span><span>₹{grandSubtotal.toLocaleString("en-IN")}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-400">Taxes & Fees</span><span>₹{grandTax.toLocaleString("en-IN")}</span></div>
            <div className="flex justify-between pt-3 border-t border-white/10"><span className="font-bold">Total</span><span className="font-serif font-bold text-2xl">₹{grandTotal.toLocaleString("en-IN")}</span></div>
          </div>

          {paymentEnabled && config?.payment_gateway !== "none" && (
            <div className="space-y-3">
              <p className="text-[10px] font-semibold text-slate-400 uppercase">💳 Payment Options</p>
              <label className={`flex justify-between p-4 rounded-2xl border-2 cursor-pointer ${paymentOption === "full" ? "border-teal-500 bg-teal-50/50" : "border-slate-200"}`}>
                <div className="flex items-center gap-3">
                  <input type="radio" checked={paymentOption === "full"} onChange={() => setPaymentOption("full")} className="w-4 h-4 text-teal-600" />
                  <span className="text-sm font-bold">Full Payment</span>
                </div>
                <span className="font-bold">₹{grandTotal.toLocaleString("en-IN")}</span>
              </label>
              {config?.allow_partial_payment && (
                <label className={`flex justify-between p-4 rounded-2xl border-2 cursor-pointer ${paymentOption === "partial" ? "border-teal-500 bg-teal-50/50" : "border-slate-200"}`}>
                  <div className="flex items-center gap-3">
                    <input type="radio" checked={paymentOption === "partial"} onChange={() => setPaymentOption("partial")} className="w-4 h-4 text-teal-600" />
                    <span className="text-sm font-bold">Advance ({partialPct}%)</span>
                  </div>
                  <span className="font-bold text-emerald-600">₹{Math.round(grandTotal * partialPct / 100).toLocaleString("en-IN")}</span>
                </label>
              )}
              {config?.show_pay_at_property !== false && (
                <label className={`flex justify-between p-4 rounded-2xl border-2 cursor-pointer ${paymentOption === "pay_at_property" ? "border-teal-500 bg-teal-50/50" : "border-slate-200"}`}>
                  <div className="flex items-center gap-3">
                    <input type="radio" checked={paymentOption === "pay_at_property"} onChange={() => setPaymentOption("pay_at_property")} className="w-4 h-4 text-teal-600" />
                    <span className="text-sm font-bold">Pay at Hotel</span>
                  </div>
                  <span className="font-bold text-slate-500">₹0 now</span>
                </label>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First Name" className="w-full px-4 py-3 border-b border-slate-200 outline-none focus:border-teal-500" />
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last Name" className="w-full px-4 py-3 border-b border-slate-200 outline-none focus:border-teal-500" />
            </div>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone Number" className="w-full px-4 py-3 border-b border-slate-200 outline-none focus:border-teal-500" />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (Optional)" className="w-full px-4 py-3 border-b border-slate-200 outline-none focus:border-teal-500" />
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Special Requests" className="w-full px-4 py-3 border-b border-slate-200 resize-none outline-none focus:border-teal-500" />
          </div>

          {config?.show_terms_checkbox !== false && (
            <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
              <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="w-5 h-5 text-teal-600 mt-0.5" />
              <label className="text-xs text-slate-700">I agree to the <button onClick={() => setTermsModalOpen(true)} className="text-teal-600 underline">Terms & Conditions</button></label>
            </div>
          )}

          {error && <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">{error}</div>}
        </div>

        <div className="px-8 py-5 border-t border-slate-100 bg-slate-50 flex gap-3">
          <button onClick={onClose} className="px-6 py-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-600">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting || paymentProcessing} className="flex-1 py-3 rounded-xl text-xs font-bold text-white" style={{ background: accentColor }}>
            {paymentProcessing ? "Processing..." : submitting ? "Booking..." : `Pay ₹${amountToPayNow.toLocaleString("en-IN")}`}
          </button>
        </div>
      </div>
    </div>
  );
}
