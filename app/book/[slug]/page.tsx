"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  fetchHotelBySlug,
  fetchPublicConfig,
  fetchPublicRoomTypes,
  fetchPublicRatePlans,
  checkAvailability,
  computeTax,
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
  const da = new Date(ay, am - 1, ad).getTime();
  const db = new Date(by, bm - 1, bd).getTime();
  return Math.max(1, Math.round((db - da) / 86400000));
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
  const [ratePlans, setRatePlans] = useState<PublicRatePlan[]>([]);
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

  const nights = nightsBetween(checkIn, checkOut);

  const load = useCallback(async () => {
    if (!slug) return;
    try {
      setLoading(true);
      const h = await fetchHotelBySlug(slug);
      if (!h) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setHotel(h);

      const [c, rt, rp] = await Promise.all([
        fetchPublicConfig(h.id),
        fetchPublicRoomTypes(h.id),
        fetchPublicRatePlans(h.id),
      ]);

      if (!c || !c.is_enabled) {
        setDisabled(true);
        setLoading(false);
        return;
      }

      setConfig(c);
      setRoomTypes(rt);
      setRatePlans(rp);
    } catch (err) {
      console.error(err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const checkAllAvailability = useCallback(async () => {
    if (!hotel || roomTypes.length === 0) return;
    setCheckingAvail(true);
    try {
      const results: Record<string, number> = {};
      for (const rt of roomTypes) {
        const count = await checkAvailability(hotel.id, rt.room_type, checkIn, checkOut);
        results[rt.room_type] = count;
      }
      setAvailability(results);
    } catch (err) {
      console.error(err);
    } finally {
      setCheckingAvail(false);
    }
  }, [hotel, roomTypes, checkIn, checkOut]);

  useEffect(() => {
    if (hotel && roomTypes.length > 0) {
      checkAllAvailability();
    }
  }, [hotel, roomTypes, checkIn, checkOut, checkAllAvailability]);

  const handleBookingCreated = () => {
    setBookingRoom(null);
    checkAllAvailability();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-2 border-slate-200 border-t-slate-900 animate-spin" />
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

  return (
    <div className="min-h-screen bg-white">
      {/* HEADER */}
      <header className="absolute top-0 left-0 right-0 z-40 px-6 lg:px-16 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {config?.logo_url ? (
            <img src={config.logo_url} alt={hotel?.name} className="h-11" />
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
        {config?.contact_phone && (
          <a
            href={`tel:${config.contact_phone}`}
            className="hidden md:flex items-center gap-2 text-xs font-medium text-white/80 hover:text-white transition tracking-wide"
          >
            <span className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
              📞
            </span>
            {config.contact_phone}
          </a>
        )}
      </header>

      {/* HERO SECTION */}
      {config?.show_hero_banner !== false ? (
        <section className="relative h-[560px] overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: config?.hero_banner_url
                ? `url(${config.hero_banner_url})`
                : roomTypes[0]?.photo_url
                ? `url(${roomTypes[0].photo_url})`
                : "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(to bottom, rgba(15,23,42,${config?.hero_overlay_opacity || 0.6}) 0%, rgba(15,23,42,${(config?.hero_overlay_opacity || 0.6) * 0.7}) 50%, rgba(15,23,42,${config?.hero_overlay_opacity || 0.6}) 100%)`,
            }}
          />
          <div className="relative h-full flex flex-col items-center justify-center text-center px-6">
            <p className="text-[11px] tracking-[0.4em] uppercase text-white/70 mb-4 font-medium">
              Welcome to
            </p>
            <h1 className="text-4xl md:text-6xl font-serif font-semibold text-white mb-4 max-w-3xl leading-tight">
              {config?.hero_title || hotel?.name}
            </h1>
            <div className="w-16 h-[1px] bg-white/40 mx-auto mb-4" />
            <p className="text-base md:text-lg text-white/80 max-w-2xl font-light italic">
              {config?.hero_subtitle || "An unforgettable stay awaits you"}
            </p>
          </div>
        </section>
      ) : (
        <section className="relative pt-32 pb-20 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
          <div className="relative text-center px-6">
            <p className="text-[11px] tracking-[0.4em] uppercase text-white/60 mb-4 font-medium">
              Welcome to
            </p>
            <h1 className="text-4xl md:text-6xl font-serif font-semibold text-white mb-4 max-w-3xl mx-auto leading-tight">
              {config?.hero_title || hotel?.name}
            </h1>
            <div className="w-16 h-[1px] bg-white/30 mx-auto mb-4" />
            <p className="text-base md:text-lg text-white/70 max-w-2xl mx-auto font-light italic">
              {config?.hero_subtitle || "An unforgettable stay awaits you"}
            </p>
          </div>
        </section>
      )}

      {/* SEARCH BAR */}
      <section className="relative px-4 -mt-16 z-20">
        <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.25)] border border-slate-100 p-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2 block">
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
                className="w-full px-3 py-3 border-b border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-slate-900 bg-transparent"
              />
              <p className="text-[10px] text-slate-400 mt-1">{weekdayShort(checkIn)}</p>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2 block">
                Check-out
              </label>
              <input
                type="date"
                value={checkOut}
                min={addDays(checkIn, 1)}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full px-3 py-3 border-b border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-slate-900 bg-transparent"
              />
              <p className="text-[10px] text-slate-400 mt-1">{weekdayShort(checkOut)}</p>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2 block">
                Adults
              </label>
              <select
                value={adults}
                onChange={(e) => setAdults(Number(e.target.value))}
                className="w-full px-3 py-3 border-b border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-slate-900 bg-transparent"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n} Adult{n > 1 ? "s" : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2 block">
                Children
              </label>
              <select
                value={children}
                onChange={(e) => setChildren(Number(e.target.value))}
                className="w-full px-3 py-3 border-b border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-slate-900 bg-transparent"
              >
                {[0, 1, 2, 3].map((n) => (
                  <option key={n} value={n}>{n} Child{n !== 1 ? "ren" : ""}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={checkAllAvailability}
                disabled={checkingAvail}
                className="w-full py-3.5 rounded-xl text-[11px] font-bold text-white transition hover:opacity-90 disabled:opacity-50 uppercase tracking-[0.2em] bg-slate-900"
              >
                {checkingAvail ? "Searching..." : "Check Availability"}
              </button>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-500">
            <span>🗓️</span>
            <span>{prettyDate(checkIn)} — {prettyDate(checkOut)}</span>
            <span className="text-slate-300">|</span>
            <span className="font-semibold text-slate-700">{nights} {nights > 1 ? "nights" : "night"}</span>
          </div>
        </div>
      </section>

      {/* ROOMS SECTION */}
      <section className="px-6 lg:px-16 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-[11px] tracking-[0.4em] uppercase text-slate-400 mb-3 font-medium">
            Rooms & Suites
          </p>
          <h2 className="text-3xl md:text-4xl font-serif font-semibold text-slate-900">
            Choose Your Perfect Stay
          </h2>
          <div className="w-16 h-[1px] bg-slate-300 mx-auto mt-5" />
        </div>

        {roomTypes.length === 0 && (
          <div className="bg-slate-50 rounded-2xl border border-slate-100 p-16 text-center">
            <p className="text-4xl mb-3">🏨</p>
            <p className="font-medium text-slate-700">No rooms available</p>
            <p className="text-xs text-slate-400 mt-1">Please try different dates</p>
          </div>
        )}

        <div className="space-y-8">
          {roomTypes.map((room) => {
            const avail = availability[room.room_type];
            const isAvailable = avail === undefined ? true : avail > 0;
            const minPrice = room.base_price || 0;

            return (
              <div
                key={room.room_type}
                className={`group bg-white rounded-2xl border overflow-hidden transition-all duration-300 ${
                  isAvailable
                    ? "border-slate-200 hover:border-slate-300 hover:shadow-[0_20px_50px_-20px_rgba(0,0,0,0.15)]"
                    : "border-slate-100 opacity-60"
                }`}
              >
                <div className="flex flex-col lg:flex-row">
                  <div className="lg:w-[380px] h-64 lg:h-auto bg-slate-100 shrink-0 relative overflow-hidden">
                    {room.photo_url ? (
                      <img
                        src={room.photo_url}
                        alt={room.room_type}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl text-slate-300">
                        🛏️
                      </div>
                    )}
                    {!isAvailable && (
                      <div className="absolute inset-0 bg-slate-900/70 flex items-center justify-center">
                        <span className="px-5 py-2.5 bg-white text-slate-900 rounded-full text-[10px] font-bold uppercase tracking-[0.2em]">
                          Sold Out
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 p-6 lg:p-8">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <h3 className="text-xl lg:text-2xl font-serif font-semibold text-slate-900">
                          {room.room_type}
                        </h3>
                        <div className="flex items-center gap-4 mt-2 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                          <span className="flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-slate-400" />
                            Max {room.max_adults} Adults
                          </span>
                          {room.max_children > 0 && (
                            <span className="flex items-center gap-1.5">
                              <span className="w-1 h-1 rounded-full bg-slate-400" />
                              Max {room.max_children} Children
                            </span>
                          )}
                        </div>
                      </div>
                      {isAvailable && avail !== undefined && (
                        <span className="text-[10px] font-bold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 uppercase tracking-wider border border-emerald-100 shrink-0">
                          {avail} Left
                        </span>
                      )}
                    </div>

                    {room.description && (
                      <p className="text-sm text-slate-500 mb-6 line-clamp-2 leading-relaxed">
                        {room.description}
                      </p>
                    )}

                    <div className="space-y-2">
                      {ratePlans.length === 0 && (
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">Standard Rate</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">
                              Room only
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-serif font-semibold text-slate-900">
                              ₹{minPrice.toLocaleString("en-IN")}
                            </p>
                            <p className="text-[10px] text-slate-500 mb-2">per night</p>
                            <button
                              disabled={!isAvailable}
                              onClick={() =>
                                setBookingRoom({
                                  room,
                                  plan: { code: "STD", name: "Standard Rate", rate_difference: 0, min_length_of_stay: 1 },
                                })
                              }
                              className="px-6 py-2 rounded-lg text-[10px] font-bold text-white uppercase tracking-[0.15em] disabled:opacity-50 transition bg-slate-900 hover:bg-slate-800"
                            >
                              Book Now
                            </button>
                          </div>
                        </div>
                      )}

                      {ratePlans.map((plan) => {
                        const totalPerNight = minPrice + (plan.rate_difference || 0);
                        const total = totalPerNight * nights;
                        return (
                          <div
                            key={plan.code}
                            className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 rounded-xl transition border border-transparent hover:border-slate-200"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-slate-900 text-white uppercase tracking-wider">
                                  {plan.code}
                                </span>
                                <p className="text-sm font-semibold text-slate-800 truncate">
                                  {plan.name}
                                </p>
                              </div>
                              {plan.description && (
                                <p className="text-[11px] text-slate-500 mt-1 truncate">
                                  {plan.description}
                                </p>
                              )}
                            </div>
                            <div className="text-right ml-4 shrink-0">
                              <p className="text-xl font-serif font-semibold text-slate-900">
                                ₹{total.toLocaleString("en-IN")}
                              </p>
                              <p className="text-[10px] text-slate-500 mb-2">
                                ₹{totalPerNight.toLocaleString("en-IN")} × {nights} night{nights > 1 ? "s" : ""}
                              </p>
                              <button
                                disabled={!isAvailable}
                                onClick={() => setBookingRoom({ room, plan })}
                                className="px-6 py-2 rounded-lg text-[10px] font-bold text-white uppercase tracking-[0.15em] disabled:opacity-50 transition bg-slate-900 hover:bg-slate-800"
                              >
                                Book Now
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
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-900 text-white mt-20">
        <div className="max-w-6xl mx-auto px-6 lg:px-16 py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div>
              <h3 className="text-xl font-serif font-semibold mb-3">{hotel?.name}</h3>
              <div className="w-10 h-[1px] bg-white/30 mb-4" />
              {config?.contact_address && (
                <p className="text-sm text-slate-400 leading-relaxed">{config.contact_address}</p>
              )}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500 mb-4">
                Contact
              </p>
              {config?.contact_phone && (
                <p className="text-sm text-slate-300 mb-2">📞 {config.contact_phone}</p>
              )}
              {config?.contact_email && (
                <p className="text-sm text-slate-300">✉️ {config.contact_email}</p>
              )}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500 mb-4">
                Legal
              </p>
              <div className="flex flex-col gap-2">
                {config?.terms_url && (
                  <a href={config.terms_url} className="text-sm text-slate-300 hover:text-white transition">
                    Terms & Conditions
                  </a>
                )}
                {config?.privacy_url && (
                  <a href={config.privacy_url} className="text-sm text-slate-300 hover:text-white transition">
                    Privacy Policy
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-white/10 text-center">
            <p className="text-[11px] text-slate-500 tracking-wider">
              Powered by <span className="text-slate-300 font-medium">Staynexa PMS</span>
            </p>
          </div>
        </div>
      </footer>

      {/* BOOKING MODAL */}
      {bookingRoom && hotel && (
        <BookingModal
          hotel={hotel}
          room={bookingRoom.room}
          plan={bookingRoom.plan}
          checkIn={checkIn}
          checkOut={checkOut}
          adults={adults}
          children={children}
          accentColor="#0f172a"
          config={config}
          onClose={() => setBookingRoom(null)}
          onSuccess={handleBookingCreated}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// BOOKING MODAL
// ═══════════════════════════════════════════════
function BookingModal({
  hotel,
  room,
  plan,
  checkIn,
  checkOut,
  adults,
  children,
  accentColor,
  config,
  onClose,
  onSuccess,
}: {
  hotel: PublicHotel;
  room: PublicRoomType;
  plan: PublicRatePlan;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  accentColor: string;
  config: BookingEngineConfig | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const nights = nightsBetween(checkIn, checkOut);
  const pricePerNight = (room.base_price || 0) + (plan.rate_difference || 0);
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
  const [confirmation, setConfirmation] = useState<{ ref: string; name: string; paid?: boolean } | null>(null);

  const paymentEnabled = config?.payment_enabled === true;

  // ═══ MAIN SUBMIT ═══
  const handleSubmit = async () => {
    setError(null);

    if (!name.trim()) { setError("Please enter your full name"); return; }
    if (!phone.trim()) { setError("Please enter your phone number"); return; }
    if (phone.replace(/\D/g, "").length < 10) {
      setError("Please enter a valid phone number");
      return;
    }

    setSubmitting(true);
    try {
      const { supabase } = await import("../../supabase");

      const { data: roomsData } = await supabase
        .from("rooms")
        .select("id, room_number")
        .eq("hotel_id", hotel.id)
        .eq("room_type", room.room_type);

      if (!roomsData || roomsData.length === 0) throw new Error("No rooms of this type found");

      const { data: bookingsData } = await supabase
        .from("bookings")
        .select("room_id")
        .eq("hotel_id", hotel.id)
        .in("status", ["CONFIRMED", "CHECKED-IN", "PENDING DEPARTURE", "BLOCKED"])
        .lt("check_in", checkOut)
        .gt("check_out", checkIn);

      const bookedRoomIds = new Set((bookingsData || []).map((b: any) => b.room_id).filter(Boolean));
      const freeRoom = roomsData.find((r: any) => !bookedRoomIds.has(r.id));

      if (!freeRoom) throw new Error("No rooms available for these dates. Please select different dates.");

      const ref = `SNB-${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth() + 1).padStart(2, "0")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

      const booking = await createReservation({
        roomNumber: freeRoom.room_number,
        checkIn,
        checkOut,
        ratePlan: plan.code,
        source: "bookingengine",
        primaryGuest: {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          address: "",
          city: "",
          state: "",
          pincode: "",
        },
        adults,
        children,
        infants: 0,
        amount: subtotal,
        tax,
        notes: notes.trim() || `Online booking · ${plan.name}`,
        hotelId: hotel.id,
      });

      const bookingId = (booking as any)?.id;
      const bookingRef = (booking as any)?.booking_ref || ref;

      // Payment enabled কিনা চেক করুন
      if (paymentEnabled && config?.payment_gateway && config.payment_gateway !== "none") {
        await handlePaymentFlow(bookingId, bookingRef, freeRoom.room_number);
        return;
      }

      // Payment ছাড়াই confirm
      await triggerNotifications(bookingId, bookingRef, freeRoom.room_number);
      setConfirmation({ ref: bookingRef, name: name.trim(), paid: false });
      setSubmitting(false);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Booking failed. Please try again.");
      setSubmitting(false);
    }
  };

  // ═══ PAYMENT FLOW ═══
  const handlePaymentFlow = async (
    bookingId: string,
    bookingRef: string,
    roomNumber: string
  ) => {
    setPaymentProcessing(true);
    try {
      const res = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotelId: hotel.id,
          amount: total,
          bookingRef,
          customerName: name.trim(),
          customerPhone: phone.trim(),
          customerEmail: email.trim(),
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Payment initialization failed");
      }

      // Razorpay
      if (data.gateway === "razorpay") {
        await loadRazorpayScript();

        const options = {
          key: data.publicKey,
          amount: data.amount,
          currency: "INR",
          name: hotel.name,
          description: `Booking ${bookingRef}`,
          order_id: data.orderId,
          prefill: {
            name: name.trim(),
            contact: phone.trim(),
            email: email.trim(),
          },
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
              roomNumber,
            });
          },
          modal: {
            ondismiss: () => {
              setPaymentProcessing(false);
              setSubmitting(false);
              setError("Payment cancelled. Please try again or contact the hotel.");
            },
          },
        };

        const razorpay = new (window as any).Razorpay(options);
        razorpay.open();
      }
      // Cashfree
      else if (data.gateway === "cashfree") {
        await loadCashfreeScript();

        const cashfree = (window as any).Cashfree({
          mode: data.mode || "production",
        });

        cashfree.checkout({
          paymentSessionId: data.paymentLink,
          redirectTarget: "_modal",
        });
      }
      // UPI QR — just confirm
      else {
        await verifyPayment({
          hotelId: hotel.id,
          gateway: "upi_qr",
          orderId: `upi_${bookingRef}`,
          bookingId,
          bookingRef,
          roomNumber,
        });
      }
    } catch (err: any) {
      console.error("[Payment Flow]", err);
      setError(err.message || "Payment failed");
      setPaymentProcessing(false);
      setSubmitting(false);
    }
  };

  // ═══ VERIFY PAYMENT ═══
  const verifyPayment = async (params: any) => {
    try {
      const res = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      const data = await res.json();

      if (data.success) {
        await triggerNotifications(params.bookingId, params.bookingRef, params.roomNumber);
        setConfirmation({ ref: params.bookingRef, name: name.trim(), paid: true });
      } else {
        setError(data.error || "Payment verification failed");
      }
    } catch (err: any) {
      console.error("[Verify]", err);
      setError("Payment confirmation error. Please contact the hotel.");
    } finally {
      setPaymentProcessing(false);
      setSubmitting(false);
    }
  };

  // ═══ TRIGGER NOTIFICATIONS ═══
  const triggerNotifications = async (
    bookingId: string,
    bookingRef: string,
    roomNumber: string
  ) => {
    try {
      const { triggerBookingNotifications } = await import("../../lib/notifications");
      await triggerBookingNotifications({
        hotelId: hotel.id,
        bookingId,
        bookingRef,
        guestName: name.trim(),
        guestPhone: phone.trim(),
        guestEmail: email.trim(),
        roomType: room.room_type,
        roomNumber: roomNumber || "",
        checkIn,
        checkOut,
        nights,
        total,
        hotelName: hotel.name,
        hotelPhone: config?.contact_phone,
      });
    } catch (notifErr) {
      console.error("[Notification trigger failed]", notifErr);
    }
  };

  // ═══ SUCCESS ═══
  if (confirmation) {
    return (
      <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-[100] p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
          <div className="p-10 text-center border-b border-slate-100">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-slate-900 flex items-center justify-center text-4xl text-white">
              ✓
            </div>
            <p className="text-[11px] tracking-[0.3em] uppercase text-slate-400 mb-2">Confirmed</p>
            <h3 className="text-3xl font-serif font-semibold text-slate-900 mb-2">
              Your Stay Awaits
            </h3>
            <p className="text-sm text-slate-500">
              {confirmation.paid
                ? "Your payment is confirmed. A confirmation has been sent."
                : "A confirmation has been sent to your email and phone."}
            </p>
          </div>
          <div className="p-8 space-y-5">
            <div className="text-center">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.3em] mb-2">
                Booking Reference
              </p>
              <p className="text-2xl font-serif font-bold text-slate-900 tracking-wider">
                {confirmation.ref}
              </p>
            </div>
            <div className="p-5 bg-slate-50 rounded-2xl space-y-3 text-sm border border-slate-100">
              <div className="flex justify-between">
                <span className="text-slate-500">Guest</span>
                <span className="font-semibold text-slate-800">{confirmation.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Room</span>
                <span className="font-semibold text-slate-800">{room.room_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Check-in</span>
                <span className="font-semibold text-slate-800">{prettyDate(checkIn)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Check-out</span>
                <span className="font-semibold text-slate-800">{prettyDate(checkOut)}</span>
              </div>
              <div className="flex justify-between pt-3 border-t border-slate-200">
                <span className="text-slate-500">Total</span>
                <span className="font-serif font-bold text-lg text-slate-900">
                  ₹{total.toLocaleString("en-IN")}
                </span>
              </div>
              {confirmation.paid && (
                <div className="flex justify-between text-emerald-600">
                  <span className="font-medium">Payment</span>
                  <span className="font-bold">✅ Paid</span>
                </div>
              )}
            </div>
          </div>
          <div className="px-8 py-5 border-t border-slate-100 bg-slate-50">
            <button
              onClick={() => { onClose(); onSuccess(); }}
              className="w-full py-3.5 rounded-xl text-xs font-bold text-white uppercase tracking-[0.2em] bg-slate-900 hover:bg-slate-800 transition"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══ FORM ═══
  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] tracking-[0.3em] uppercase text-slate-400 font-semibold">
              Reserve Your Stay
            </p>
            <button
              onClick={onClose}
              disabled={paymentProcessing}
              className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition border border-slate-200 disabled:opacity-50"
            >
              ×
            </button>
          </div>
          <h3 className="text-2xl font-serif font-semibold text-slate-900">{room.room_type}</h3>
          <p className="text-xs text-slate-500 mt-1">{plan.name}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Check-in</span>
              <span className="font-semibold text-slate-800">{prettyDate(checkIn)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Check-out</span>
              <span className="font-semibold text-slate-800">{prettyDate(checkOut)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Guests</span>
              <span className="font-semibold text-slate-800">
                {adults} Adult{adults > 1 ? "s" : ""}{children > 0 ? `, ${children} Child${children > 1 ? "ren" : ""}` : ""}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Nights</span>
              <span className="font-semibold text-slate-800">{nights}</span>
            </div>
          </div>

          <div className="p-5 bg-slate-900 rounded-2xl space-y-3 text-sm text-white">
            <div className="flex justify-between">
              <span className="text-slate-400">₹{pricePerNight.toLocaleString("en-IN")} × {nights} night{nights > 1 ? "s" : ""}</span>
              <span>₹{subtotal.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Taxes (GST)</span>
              <span>₹{tax.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between pt-3 border-t border-white/10">
              <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Total</span>
              <span className="font-serif font-bold text-xl">₹{total.toLocaleString("en-IN")}</span>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2 block">
                Full Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full px-4 py-3 border-b border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-slate-900 bg-transparent transition"
                autoFocus
                disabled={paymentProcessing}
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2 block">
                Phone Number *
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-4 py-3 border-b border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-slate-900 bg-transparent transition"
                disabled={paymentProcessing}
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2 block">
                Email (Optional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                className="w-full px-4 py-3 border-b border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-slate-900 bg-transparent transition"
                disabled={paymentProcessing}
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2 block">
                Special Requests (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Any special requests..."
                className="w-full px-4 py-3 border-b border-slate-200 text-sm font-medium text-slate-800 resize-none outline-none focus:border-slate-900 bg-transparent transition"
                disabled={paymentProcessing}
              />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl">
              <p className="text-xs text-rose-700 font-medium">⚠ {error}</p>
            </div>
          )}
        </div>

        <div className="px-8 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            disabled={submitting || paymentProcessing}
            className="px-6 py-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-white transition uppercase tracking-[0.15em] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || paymentProcessing}
            className="px-6 py-3 rounded-xl text-xs font-bold text-white disabled:opacity-50 transition flex-1 uppercase tracking-[0.15em] bg-slate-900 hover:bg-slate-800"
          >
            {paymentProcessing
              ? "Processing payment..."
              : submitting
              ? "Creating booking..."
              : paymentEnabled
              ? `Pay ₹${total.toLocaleString("en-IN")}`
              : `Confirm · ₹${total.toLocaleString("en-IN")}`}
          </button>
        </div>
      </div>
    </div>
  );
}
