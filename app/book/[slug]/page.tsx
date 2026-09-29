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
    setAddedFeedback(`${room.room_type} - ${plan.code}`);
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
        setLimitWarning(`Maximum ${maxAdults} adults allowed in ${item.room.room_type}`);
        setTimeout(() => setLimitWarning(null), 3000);
        return item;
      }
      if (field === 'children' && newValue > maxChildren) {
        setLimitWarning(`Maximum ${maxChildren} children allowed in ${item.room.room_type}`);
        setTimeout(() => setLimitWarning(null), 3000);
        return item;
      }
      if (field === 'infants' && newValue > maxInfants) {
        setLimitWarning(`Maximum ${maxInfants} infants allowed in ${item.room.room_type}`);
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
    return { subtotal, tax, grandTotal: subtotal + tax, totalRooms: cart.length };
  }, [cart, nights]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-teal-500 border-t-transparent animate-spin" />
          <p className="text-slate-500 text-sm">Loading...</p>
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
          <p className="text-sm text-slate-500">Booking link may be incorrect.</p>
        </div>
      </div>
    );
  }

  if (disabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center max-w-md">
          <p className="text-6xl mb-4">⏸</p>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Booking Unavailable</h1>
          <p className="text-sm text-slate-500">Please contact the hotel directly.</p>
        </div>
      </div>
    );
  }

  const themeColor = config?.theme_color || "#0f172a";

  return (
    <div className="min-h-screen bg-white font-sans antialiased">
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
      </header>

      <section className="relative h-[300px] overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: config?.hero_banner_url
              ? `url(${config.hero_banner_url})`
              : "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-900/30 to-slate-900/70" />
        <div className="relative h-full flex flex-col items-center justify-center text-center px-6">
          <h1 className="text-3xl md:text-5xl font-serif font-semibold text-white mb-3">
            {config?.hero_title || hotel?.name}
          </h1>
          <p className="text-base md:text-lg text-white/80">
            {config?.hero_subtitle || "An unforgettable stay awaits you"}
          </p>
        </div>
      </section>

      {limitWarning && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[200] bg-rose-500 text-white px-6 py-3 rounded-full shadow-2xl text-sm font-bold">
          ⚠️ {limitWarning}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Check-in</label>
                <input
                  type="date"
                  value={checkIn}
                  min={todayISO()}
                  onChange={(e) => {
                    setCheckIn(e.target.value);
                    if (e.target.value >= checkOut) setCheckOut(addDays(e.target.value, 1));
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Check-out</label>
                <input
                  type="date"
                  value={checkOut}
                  min={addDays(checkIn, 1)}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Adults</label>
                <select
                  value={adults}
                  onChange={(e) => setAdults(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Children</label>
                <select
                  value={children}
                  onChange={(e) => setChildren(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  {[0, 1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 flex-wrap">
              <span>🗓️ {prettyDate(checkIn)} → {prettyDate(checkOut)}</span>
              <span>•</span>
              <span className="font-semibold">{nights} night{nights > 1 ? "s" : ""}</span>
            </div>
          </div>

          <h2 className="text-2xl font-serif font-semibold text-slate-900">Available Rooms</h2>

          {roomTypes.length === 0 && (
            <div className="bg-slate-50 rounded-2xl p-12 text-center">
              <p className="text-4xl mb-3">🔍</p>
              <p className="font-semibold text-slate-700">No rooms available</p>
            </div>
          )}

          {roomTypes.map((room) => {
            const avail = availability[room.room_type];
            const isAvailable = avail === undefined ? true : avail > 0;

            return (
              <div
                key={room.room_type}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
              >
                <div className="flex flex-col md:flex-row">
                  <div className="md:w-[240px] h-48 md:h-auto bg-slate-100 shrink-0">
                    {room.photos?.[0] ? (
                      <img src={room.photos[0]} alt={room.room_type} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl text-slate-300">🛏️</div>
                    )}
                  </div>

                  <div className="flex-1 p-5 space-y-3">
                    <div>
                      <h3 className="text-xl font-serif font-semibold text-slate-900">{room.room_type}</h3>
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1">{room.description}</p>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-600 flex-wrap">
                      <span>👤 Max {room.max_adults || 2}</span>
                      {(room.max_children || 0) > 0 && <span>🧒 Max {room.max_children}</span>}
                      {isAvailable && avail !== undefined && (
                        <span className="text-emerald-600">✓ {avail} available</span>
                      )}
                    </div>

                    <div className="space-y-2">
                      {room.rate_plans.map((plan) => {
                        const perNight = getPriceForOccupancy(plan, adults, children);
                        const total = perNight * nights;
                        const isJustAdded = addedFeedback === `${room.room_type} - ${plan.code}`;
                        return (
                          <div
                            key={plan.code}
                            className="flex items-center justify-between border border-slate-100 rounded-xl p-3 hover:border-slate-300 transition"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-white">
                                  {plan.code}
                                </span>
                                <p className="text-sm font-bold text-slate-800">{plan.name}</p>
                              </div>
                              <p className="text-[10px] text-slate-500 mt-0.5">{plan.description}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-slate-900">
                                ₹{total.toLocaleString("en-IN")}
                              </p>
                              <p className="text-[10px] text-slate-500">
                                + ₹{computeTax(total).toLocaleString("en-IN")} tax
                              </p>
                              <button
                                onClick={() => handleAddToCart(room, plan)}
                                disabled={!isAvailable}
                                className={`mt-1 px-3 py-1.5 rounded-lg text-[10px] font-bold text-white uppercase transition ${
                                  isJustAdded ? "bg-emerald-600" : "bg-slate-900 hover:bg-slate-800"
                                } disabled:opacity-50`}
                              >
                                {isJustAdded ? "✓ Added" : "+ Add"}
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

        <div className="lg:col-span-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-5 sticky top-4">
            <h3 className="text-base font-serif font-bold text-slate-900 mb-4">Your Selection</h3>

            <div className="space-y-3 mb-4 max-h-[400px] overflow-y-auto">
              {cart.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">No rooms selected</p>
              ) : (
                cart.map((item) => {
                  const maxAdults = item.room.max_adults || 2;
                  const maxChildren = item.room.max_children || 0;
                  const maxInfants = item.room.max_infants || 0;
                  return (
                    <div key={item.id} className="border border-slate-200 rounded-xl p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-xs font-bold text-slate-800">{item.room.room_type}</p>
                          <p className="text-[10px] text-slate-500">{item.plan.code} - {item.plan.name}</p>
                        </div>
                        <button
                          onClick={() => handleRemoveFromCart(item.id)}
                          className="text-[10px] font-bold text-rose-500"
                        >
                          ✕
                        </button>
                      </div>

                      <input
                        type="text"
                        value={item.roomPreference}
                        onChange={(e) => updateCartItemConfig(item.id, "roomPreference", e.target.value)}
                        placeholder="Room preference (optional)"
                        className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1 mb-2 outline-none focus:border-teal-500"
                      />

                      <div className="grid grid-cols-3 gap-1 bg-slate-50 p-1.5 rounded-lg">
                        <div className="text-center">
                          <p className="text-[9px] font-semibold text-slate-400 mb-1">Adults ({maxAdults})</p>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => updateCartItemConfig(item.id, "adults", item.adults - 1)}
                              disabled={item.adults <= 1}
                              className="w-5 h-5 rounded border border-slate-200 text-xs disabled:opacity-30"
                            >−</button>
                            <span className="text-xs font-bold w-4 text-center">{item.adults}</span>
                            <button
                              onClick={() => updateCartItemConfig(item.id, "adults", item.adults + 1)}
                              disabled={item.adults >= maxAdults}
                              className="w-5 h-5 rounded border border-slate-200 text-xs disabled:opacity-30"
                            >+</button>
                          </div>
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] font-semibold text-slate-400 mb-1">Child ({maxChildren})</p>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => updateCartItemConfig(item.id, "children", item.children - 1)}
                              disabled={item.children <= 0}
                              className="w-5 h-5 rounded border border-slate-200 text-xs disabled:opacity-30"
                            >−</button>
                            <span className="text-xs font-bold w-4 text-center">{item.children}</span>
                            <button
                              onClick={() => updateCartItemConfig(item.id, "children", item.children + 1)}
                              disabled={item.children >= maxChildren}
                              className="w-5 h-5 rounded border border-slate-200 text-xs disabled:opacity-30"
                            >+</button>
                          </div>
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] font-semibold text-slate-400 mb-1">Infant ({maxInfants})</p>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => updateCartItemConfig(item.id, "infants", item.infants - 1)}
                              disabled={item.infants <= 0}
                              className="w-5 h-5 rounded border border-slate-200 text-xs disabled:opacity-30"
                            >−</button>
                            <span className="text-xs font-bold w-4 text-center">{item.infants}</span>
                            <button
                              onClick={() => updateCartItemConfig(item.id, "infants", item.infants + 1)}
                              disabled={item.infants >= maxInfants}
                              className="w-5 h-5 rounded border border-slate-200 text-xs disabled:opacity-30"
                            >+</button>
                          </div>
                        </div>
                      </div>

                      <p className="text-right text-xs font-bold text-slate-900 mt-2">
                        ₹{(getPriceForOccupancy(item.plan, item.adults, item.children) * nights).toLocaleString("en-IN")}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-slate-200 pt-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-semibold">₹{totals.subtotal.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Tax</span>
                <span className="font-semibold">₹{totals.tax.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <span className="text-sm font-bold">Total</span>
                <span className="text-xl font-serif font-bold">₹{totals.grandTotal.toLocaleString("en-IN")}</span>
              </div>
            </div>

            <button
              onClick={() => setIsGroupCheckout(true)}
              disabled={cart.length === 0}
              className="w-full mt-4 py-3 rounded-xl text-xs font-bold text-white uppercase tracking-wider transition hover:opacity-90 disabled:opacity-50"
              style={{ background: themeColor }}
            >
              Continue
            </button>
          </div>
        </div>
      </div>

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
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<any>(null);
  const [paymentOption, setPaymentOption] = useState<"full" | "partial" | "pay_at_property">("pay_at_property");
  const [termsAccepted, setTermsAccepted] = useState(false);

  const paymentEnabled = config?.payment_enabled === true && config?.payment_gateway !== "none";
  const partialPct = config?.partial_payment_pct || 50;
  const amountToPayNow = paymentOption === "full" ? grandTotal : paymentOption === "partial" ? Math.round(grandTotal * (partialPct / 100)) : 0;
  const amountPending = grandTotal - amountToPayNow;

  const handleSubmit = async () => {
    setError(null);
    if (!firstName.trim() || !lastName.trim()) { setError("Please enter your full name"); return; }
    if (phone.replace(/\D/g, "").length < 10) { setError("Please enter a valid phone number"); return; }

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
        primaryGuest: { name, phone: phone.trim(), email: email.trim(), address: "", city: "", state: "", pincode: "" },
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

      const bookingId = result.bookings[0]?.id;
      const bookingRef = result.mainBookingRef;

      if (paymentOption === "pay_at_property" || !paymentEnabled) {
        setConfirmation({
          ref: bookingRef,
          name,
          paymentType: paymentOption,
          amountPaid: 0,
          amountPending,
          roomCount: cart.length,
        });
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

      if (data.gateway === "razorpay") {
        await loadRazorpayScript();
        const options = {
          key: data.publicKey,
          amount: data.amount,
          currency: "INR",
          name: hotel.name,
          description: `Booking ${bookingRef}`,
          order_id: data.orderId,
          prefill: { name, contact: phone.trim(), email: email.trim() },
          theme: { color: accentColor },
          handler: async (response: any) => {
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
        new (window as any).Razorpay(options).open();
      } else if (data.gateway === "cashfree") {
        await loadCashfreeScript();
        (window as any).Cashfree({ mode: data.mode || "production" }).checkout({
          paymentSessionId: data.paymentLink,
          redirectTarget: "_modal",
        });
      }
    } catch (err: any) {
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
        setConfirmation({
          ref: params.bookingRef,
          name,
          paymentType: paymentOption,
          amountPaid: params.amountPaid,
          amountPending,
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

  if (confirmation) {
    return (
      <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-[100] p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
          <div className="p-8 text-center border-b border-slate-100">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500 flex items-center justify-center text-3xl text-white">✓</div>
            <h3 className="text-2xl font-serif font-bold text-slate-900 mb-2">Booking Confirmed</h3>
            <p className="text-sm text-slate-500">A voucher has been sent.</p>
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
              {confirmation.amountPaid > 0 && (
                <div className="flex justify-between"><span className="text-emerald-600">Paid</span><span className="font-bold text-emerald-600">₹{confirmation.amountPaid.toLocaleString("en-IN")}</span></div>
              )}
              {confirmation.amountPending > 0 && (
                <div className="flex justify-between"><span className="text-amber-600">Pending</span><span className="font-bold text-amber-600">₹{confirmation.amountPending.toLocaleString("en-IN")}</span></div>
              )}
            </div>
            <p className="text-xs text-center text-slate-500 bg-blue-50 p-3 rounded-lg">
              🛈 Room numbers will be assigned by the hotel
            </p>
          </div>
          <div className="px-6 py-4 border-t bg-slate-50">
            <button
              onClick={() => { onClose(); onSuccess(); }}
              className="w-full py-3 rounded-xl text-xs font-bold text-white uppercase bg-slate-900"
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
            <h3 className="text-lg font-serif font-bold text-slate-900">Complete Booking</h3>
            <p className="text-xs text-slate-500">{cart.length} room(s) selected</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white border text-slate-400">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="p-4 bg-slate-900 rounded-xl text-white space-y-2">
            <div className="flex justify-between text-sm"><span className="text-slate-400">Subtotal</span><span>₹{grandSubtotal.toLocaleString("en-IN")}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-400">Tax</span><span>₹{grandTax.toLocaleString("en-IN")}</span></div>
            <div className="flex justify-between pt-2 border-t border-white/10"><span className="font-bold">Total</span><span className="font-serif font-bold text-xl">₹{grandTotal.toLocaleString("en-IN")}</span></div>
          </div>

          {paymentEnabled && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Payment Method</p>
              {config?.show_full_payment !== false && (
                <label className={`flex justify-between p-3 rounded-xl border-2 cursor-pointer ${paymentOption === "full" ? "border-teal-500 bg-teal-50" : "border-slate-200"}`}>
                  <div className="flex items-center gap-2">
                    <input type="radio" checked={paymentOption === "full"} onChange={() => setPaymentOption("full")} />
                    <span className="text-sm font-bold">Full Payment</span>
                  </div>
                  <span className="font-bold">₹{grandTotal.toLocaleString("en-IN")}</span>
                </label>
              )}
              {config?.allow_partial_payment && (
                <label className={`flex justify-between p-3 rounded-xl border-2 cursor-pointer ${paymentOption === "partial" ? "border-teal-500 bg-teal-50" : "border-slate-200"}`}>
                  <div className="flex items-center gap-2">
                    <input type="radio" checked={paymentOption === "partial"} onChange={() => setPaymentOption("partial")} />
                    <span className="text-sm font-bold">Advance ({partialPct}%)</span>
                  </div>
                  <span className="font-bold text-emerald-600">₹{Math.round(grandTotal * partialPct / 100).toLocaleString("en-IN")}</span>
                </label>
              )}
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
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First Name" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500" />
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last Name" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500" />
            </div>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone Number" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500" />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (Optional)" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500" />
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Special requests (Optional)" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500 resize-none" />
          </div>

          {error && <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">{error}</div>}
        </div>

        <div className="px-6 py-4 border-t bg-slate-50 flex gap-2">
          <button onClick={onClose} className="px-5 py-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-600">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={submitting || paymentProcessing}
            className="flex-1 py-3 rounded-xl text-xs font-bold text-white disabled:opacity-50"
            style={{ background: accentColor }}
          >
            {paymentProcessing ? "Processing..." : submitting ? "Booking..." : paymentOption === "pay_at_property" ? "Confirm Booking" : `Pay ₹${amountToPayNow.toLocaleString("en-IN")}`}
          </button>
        </div>
      </div>
    </div>
  );
}
