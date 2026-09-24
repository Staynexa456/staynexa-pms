"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  fetchHotelBySlug,
  fetchPublicConfig,
  fetchPublicRoomTypes,
  fetchPublicRatePlans,
  checkAvailability,
  computePriceForPlan,
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

  // Search
  const [checkIn, setCheckIn] = useState(todayISO());
  const [checkOut, setCheckOut] = useState(addDays(todayISO(), 1));
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);

  // Availability
  const [availability, setAvailability] = useState<Record<string, number>>({});
  const [checkingAvail, setCheckingAvail] = useState(false);

  // Booking modal
  const [bookingRoom, setBookingRoom] = useState<{ room: PublicRoomType; plan: PublicRatePlan } | null>(null);

  const themeColor = config?.theme_color || "#F49108";
  const nights = nightsBetween(checkIn, checkOut);

  // ═══ Load ═══
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

  // ═══ Check availability ═══
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

  // ═══ Handle booking confirm ═══
  const handleBookingCreated = () => {
    setBookingRoom(null);
    checkAllAvailability();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div
            className="w-14 h-14 mx-auto mb-4 rounded-full border-4 border-slate-200 animate-spin"
            style={{ borderTopColor: themeColor }}
          />
          <p className="text-sm text-slate-500 font-semibold">Loading...</p>
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
          <p className="text-sm text-slate-500">
            The booking link <strong>"{slug}"</strong> doesn't match any hotel.
          </p>
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
          <p className="text-sm text-slate-500">
            Online booking is currently disabled. Please contact the hotel directly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ═══ HEADER ═══ */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {config?.logo_url ? (
              <img src={config.logo_url} alt={hotel?.name} className="h-10" />
            ) : (
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                style={{ background: themeColor }}
              >
                {hotel?.name?.charAt(0) || "H"}
              </div>
            )}
            <div>
              <h1 className="text-base font-bold text-slate-900">{hotel?.name}</h1>
              {hotel?.city && (
                <p className="text-[10px] text-slate-500">
                  {hotel.city}{hotel.state ? `, ${hotel.state}` : ""}
                </p>
              )}
            </div>
          </div>
          {config?.contact_phone && (
            <a
              href={`tel:${config.contact_phone}`}
              className="hidden md:flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
            >
              📞 {config.contact_phone}
            </a>
          )}
        </div>
      </header>

      {/* ═══ HERO ═══ */}
      <section
        className="relative py-16 px-4 text-white overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}dd 100%)`,
        }}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-white blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-3">
            {config?.hero_title || `Welcome to ${hotel?.name}`}
          </h2>
          <p className="text-base md:text-lg opacity-90">
            {config?.hero_subtitle || "Experience comfort and hospitality"}
          </p>
        </div>
      </section>

      {/* ═══ SEARCH BAR ═══ */}
      <section className="px-4 -mt-10 relative z-10">
        <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                Check-In
              </label>
              <input
                type="date"
                value={checkIn}
                min={todayISO()}
                onChange={(e) => {
                  setCheckIn(e.target.value);
                  if (e.target.value >= checkOut) {
                    setCheckOut(addDays(e.target.value, 1));
                  }
                }}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-slate-900"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                Check-Out
              </label>
              <input
                type="date"
                value={checkOut}
                min={addDays(checkIn, 1)}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-slate-900"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                Adults
              </label>
              <select
                value={adults}
                onChange={(e) => setAdults(Number(e.target.value))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-slate-900 bg-white"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n} Adult{n > 1 ? "s" : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                Children
              </label>
              <select
                value={children}
                onChange={(e) => setChildren(Number(e.target.value))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-slate-900 bg-white"
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
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                style={{ background: themeColor }}
              >
                {checkingAvail ? "Checking..." : "🔍 Search"}
              </button>
            </div>
          </div>
          <div className="mt-3 text-center text-xs text-slate-500">
            📅 {prettyDate(checkIn)} → {prettyDate(checkOut)} · <strong>{nights} night{nights > 1 ? "s" : ""}</strong>
          </div>
        </div>
      </section>

      {/* ═══ ROOM LIST ═══ */}
      <section className="px-4 py-12">
        <div className="max-w-5xl mx-auto">
          <h3 className="text-xl font-bold text-slate-900 mb-6">
            Available Rooms ({roomTypes.length})
          </h3>

          {roomTypes.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
              <p className="text-4xl mb-3">🏨</p>
              <p className="font-bold text-slate-700">No rooms available</p>
            </div>
          )}

          <div className="space-y-5">
            {roomTypes.map((room) => {
              const avail = availability[room.room_type];
              const isAvailable = avail === undefined ? true : avail > 0;
              const minPrice = room.base_price || 0;

              return (
                <div
                  key={room.room_type}
                  className={`bg-white rounded-2xl border-2 overflow-hidden transition ${
                    isAvailable ? "border-slate-200 hover:border-slate-400" : "border-slate-200 opacity-60"
                  }`}
                >
                  <div className="flex flex-col md:flex-row">
                    {/* Photo */}
                    <div className="md:w-72 h-48 md:h-auto bg-slate-100 shrink-0 relative">
                      {room.photo_url ? (
                        <img
                          src={room.photo_url}
                          alt={room.room_type}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-5xl text-slate-300">
                          🛏️
                        </div>
                      )}
                      {!isAvailable && (
                        <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
                          <span className="px-4 py-2 bg-rose-600 text-white rounded-full text-xs font-bold uppercase tracking-wider">
                            Sold Out
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 p-5">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div>
                          <h4 className="text-lg font-bold text-slate-900">{room.room_type}</h4>
                          <div className="flex items-center gap-3 mt-1 text-[11px] font-bold text-slate-500">
                            <span>👤 Max {room.max_adults} adults</span>
                            {room.max_children > 0 && <span>👶 Max {room.max_children} children</span>}
                          </div>
                        </div>
                        {isAvailable && (
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 uppercase">
                            {avail} available
                          </span>
                        )}
                      </div>

                      {room.description && (
                        <p className="text-xs text-slate-500 mb-4 line-clamp-2">
                          {room.description}
                        </p>
                      )}

                      {/* Rate Plans */}
                      <div className="space-y-2">
                        {ratePlans.length === 0 && (
                          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                            <div>
                              <p className="text-sm font-bold text-slate-800">Standard Rate</p>
                              <p className="text-[10px] text-slate-500">Room only</p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-slate-900">
                                ₹{minPrice.toLocaleString("en-IN")}
                              </p>
                              <p className="text-[10px] text-slate-500">per night</p>
                              <button
                                disabled={!isAvailable}
                                onClick={() => setBookingRoom({ room, plan: { code: "STD", name: "Standard Rate", rate_difference: 0, min_length_of_stay: 1 } })}
                                className="mt-1.5 px-4 py-1.5 rounded-lg text-[11px] font-bold text-white disabled:opacity-50 transition"
                                style={{ background: themeColor }}
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
                              className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white"
                                    style={{ background: themeColor }}
                                  >
                                    {plan.code}
                                  </span>
                                  <p className="text-sm font-bold text-slate-800 truncate">{plan.name}</p>
                                </div>
                                {plan.description && (
                                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">{plan.description}</p>
                                )}
                              </div>
                              <div className="text-right ml-4 shrink-0">
                                <p className="text-lg font-bold text-slate-900">
                                  ₹{total.toLocaleString("en-IN")}
                                </p>
                                <p className="text-[10px] text-slate-500">
                                  ₹{totalPerNight.toLocaleString("en-IN")}/night × {nights}
                                </p>
                                <button
                                  disabled={!isAvailable}
                                  onClick={() => setBookingRoom({ room, plan })}
                                  className="mt-1.5 px-4 py-1.5 rounded-lg text-[11px] font-bold text-white disabled:opacity-50 transition hover:opacity-90"
                                  style={{ background: themeColor }}
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
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="bg-slate-900 text-white py-10 px-4 mt-10">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <div>
            <p className="font-bold text-base mb-2">{hotel?.name}</p>
            {config?.contact_address && (
              <p className="text-slate-400 text-xs">{config.contact_address}</p>
            )}
          </div>
          <div>
            <p className="font-bold mb-2">Contact</p>
            {config?.contact_phone && <p className="text-slate-400 text-xs">📞 {config.contact_phone}</p>}
            {config?.contact_email && <p className="text-slate-400 text-xs">✉️ {config.contact_email}</p>}
          </div>
          <div>
            <p className="font-bold mb-2">Legal</p>
            <div className="flex flex-col gap-1">
              {config?.terms_url && (
                <a href={config.terms_url} className="text-slate-400 hover:text-white text-xs transition">
                  Terms & Conditions
                </a>
              )}
              {config?.privacy_url && (
                <a href={config.privacy_url} className="text-slate-400 hover:text-white text-xs transition">
                  Privacy Policy
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="max-w-5xl mx-auto mt-8 pt-6 border-t border-white/10 text-center">
          <p className="text-[10px] text-slate-500">
            Powered by <strong className="text-slate-300">Staynexa</strong>
          </p>
        </div>
      </footer>

      {/* ═══ BOOKING MODAL ═══ */}
      {bookingRoom && hotel && (
        <BookingModal
          hotel={hotel}
          room={bookingRoom.room}
          plan={bookingRoom.plan}
          checkIn={checkIn}
          checkOut={checkOut}
          adults={adults}
          children={children}
          themeColor={themeColor}
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
  themeColor,
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
  themeColor: string;
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
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ ref: string; name: string } | null>(null);

  const handleSubmit = async () => {
    setError(null);

    if (!name.trim()) { setError("Please enter your full name"); return; }
    if (!phone.trim()) { setError("Please enter your phone number"); return; }
    if (phone.replace(/\D/g, "").length < 10) { setError("Please enter a valid phone number"); return; }

    setSubmitting(true);
    try {
      // Find an available room number for this room type
      const { checkAvailability } = await import("../../lib/public-booking");
      const availCount = await checkAvailability(hotel.id, room.room_type, checkIn, checkOut);
      if (availCount === 0) {
        throw new Error("This room type just sold out. Please select another.");
      }

      // Find a specific room number
      const { supabase } = await import("../../supabase");
           const { data: roomsData } = await supabase
        .from("rooms")
        .select("room_number")
        .eq("hotel_id", hotel.id)
        .eq("room_type", room.room_type);

      const { data: bookingsData } = await supabase
        .from("bookings")
        .select("room_number")
        .eq("hotel_id", hotel.id)
        .in("status", ["CONFIRMED", "CHECKED-IN", "PENDING DEPARTURE", "BLOCKED"])
        .lt("check_in", checkOut)
        .gt("check_out", checkIn);

      const bookedSet = new Set((bookingsData || []).map((b: any) => b.room_number));
      const freeRoom = (roomsData || []).find((r: any) => !bookedSet.has(r.room_number));

      if (!freeRoom) throw new Error("No rooms available for these dates");

      // Create booking
      const ref = `BK${Date.now().toString().slice(-8)}`;
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
        notes: notes.trim() || `Online booking via booking engine · ${plan.name}`,
        hotelId: hotel.id,
      });

      setConfirmation({
        ref: (booking as any)?.booking_ref || ref,
        name: name.trim(),
      });
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Booking failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ═══ Success state ═══
  if (confirmation) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          <div className="p-8 text-center" style={{ background: themeColor }}>
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/30 flex items-center justify-center text-5xl">
              ✓
            </div>
            <h3 className="text-2xl font-bold text-white">Booking Confirmed!</h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="text-center">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Booking Reference
              </p>
              <p className="text-2xl font-bold text-slate-900 font-mono">
                {confirmation.ref}
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl space-y-2 text-sm">
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
              <div className="flex justify-between pt-2 border-t border-slate-200">
                <span className="text-slate-500">Total</span>
                <span className="font-bold text-slate-900">₹{total.toLocaleString("en-IN")}</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 text-center">
              📧 A confirmation has been sent to{" "}
              {email ? email : "your phone"} if valid.
            </p>
          </div>
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50">
            <button
              onClick={() => {
                onClose();
                onSuccess();
              }}
              className="w-full py-3 rounded-xl text-sm font-bold text-white"
              style={{ background: themeColor }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══ Form state ═══
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100" style={{ background: themeColor }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-white/80 uppercase tracking-wider">
                Booking Request
              </p>
              <h3 className="text-lg font-bold text-white mt-0.5">
                {room.room_type}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white text-xl flex items-center justify-center transition"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Booking summary */}
          <div className="p-4 bg-slate-50 rounded-xl space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Stay</span>
              <span className="font-semibold text-slate-800">
                {nights} night{nights > 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Dates</span>
              <span className="font-semibold text-slate-800 text-xs text-right">
                {prettyDate(checkIn)} → {prettyDate(checkOut)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Guests</span>
              <span className="font-semibold text-slate-800">
                {adults} adult{adults > 1 ? "s" : ""}{children > 0 ? `, ${children} child${children > 1 ? "ren" : ""}` : ""}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Rate Plan</span>
              <span className="font-semibold text-slate-800">{plan.name}</span>
            </div>
          </div>

          {/* Price breakdown */}
          <div className="p-4 bg-slate-900 rounded-xl space-y-2 text-sm text-white">
            <div className="flex justify-between">
              <span className="text-slate-400">
                ₹{pricePerNight.toLocaleString("en-IN")} × {nights} nights
              </span>
              <span>₹{subtotal.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Taxes (GST)</span>
              <span>₹{tax.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-white/10">
              <span className="font-bold">Total</span>
              <span className="font-bold text-lg">₹{total.toLocaleString("en-IN")}</span>
            </div>
          </div>

          {/* Guest form */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Full Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-slate-900"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Phone Number *
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-slate-900"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Email (optional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-slate-900"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Special Requests (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Any special requests..."
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm resize-none outline-none focus:border-slate-900"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
              <p className="text-xs text-rose-700 font-semibold">⚠ {error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-600 hover:bg-white transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition flex-1"
            style={{ background: themeColor }}
          >
            {submitting ? "Creating Booking..." : `Confirm · ₹${total.toLocaleString("en-IN")}`}
          </button>
        </div>
      </div>
    </div>
  );
}