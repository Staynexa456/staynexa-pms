// app/book/[slug]/page.tsx
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

  const themeColor = config?.theme_color || "#F49108";
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

  useEffect(() => { load(); }, [load]);

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
    if (hotel && roomTypes.length > 0) checkAllAvailability();
  }, [hotel, roomTypes, checkIn, checkOut, checkAllAvailability]);

  const handleBookingCreated = () => {
    setBookingRoom(null);
    checkAllAvailability();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><p>Loading...</p></div>;
  if (notFound) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><p>Hotel Not Found</p></div>;
  if (disabled) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><p>Booking Temporarily Unavailable</p></div>;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* HEADER, HERO, SEARCH BAR, ROOM LIST, FOOTER, BOOKING MODAL */}
      {/* আপনার আগের কোডটি এখানে বসান, তবে নিশ্চিত করুন যে এখানে কোনো লগইন রিডাইরেক্ট নেই */}
      <div className="p-10 text-center">
        <h1 className="text-2xl font-bold">Booking Page for {hotel?.name}</h1>
        <p>Select dates and book your stay.</p>
      </div>
      {/* আপনার সম্পূর্ণ UI কোডটি এখানে থাকবে */}
    </div>
  );
}
