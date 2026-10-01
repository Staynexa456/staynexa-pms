// app/lib/use-hotel-stats.ts
"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabase";
import { useActiveHotel } from "./use-active-hotel";

export type HotelStats = {
  totalBookings: number;
  totalRooms: number;
  totalRevenue: number;
  totalCollected: number;
  totalPending: number;
  occupancyRate: number;
  occupiedRooms: number;
  availableRooms: number;
  adr: number;
  revpar: number;
  monthRoomNights: number;
  sources: Array<{ name: string; count: number; percentage: number }>;
  statusCounts: Record<string, number>;
  paymentMethods: Array<{ method: string; amount: number; count: number }>;
  // Legacy fields used by Dashboard
  todayCollection?: number;
  weekCollection?: number;
  monthCollection?: number;
  monthRevenue?: number;
  monthBookings?: number;
  arrivalCount?: number;
  departureCount?: number;
  inHouseCount?: number;
  cleanRooms?: number;
  dirtyRooms?: number;
  inspectedRooms?: number;
  maintenanceRooms?: number;
  cleanlinessPercent?: number;
  arrivalsToday?: any[];
  departuresToday?: any[];
  inHouseGuests?: any[];
  pendingCheckins?: any[];
  pendingCheckouts?: any[];
};

const EMPTY_STATS: HotelStats = {
  totalBookings: 0,
  totalRooms: 0,
  totalRevenue: 0,
  totalCollected: 0,
  totalPending: 0,
  occupancyRate: 0,
  occupiedRooms: 0,
  availableRooms: 0,
  adr: 0,
  revpar: 0,
  monthRoomNights: 0,
  sources: [],
  statusCounts: {},
  paymentMethods: [],
  todayCollection: 0,
  weekCollection: 0,
  monthCollection: 0,
  monthRevenue: 0,
  monthBookings: 0,
  arrivalCount: 0,
  departureCount: 0,
  inHouseCount: 0,
  cleanRooms: 0,
  dirtyRooms: 0,
  inspectedRooms: 0,
  maintenanceRooms: 0,
  cleanlinessPercent: 100,
  arrivalsToday: [],
  departuresToday: [],
  inHouseGuests: [],
  pendingCheckins: [],
  pendingCheckouts: [],
};

export function useHotelStats() {
  const { hotelId, loading: hotelLoading } = useActiveHotel();
  const [stats, setStats] = useState<HotelStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    // ✅ CRITICAL: যদি hotelId না থাকে, কোনো ডেটা লোড করবো না
    if (!hotelId) {
      setStats(EMPTY_STATS);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // ─── Fetch ALL data with hotel_id filter ───
      const [bookingsRes, roomsRes, paymentsRes] = await Promise.all([
        supabase.from("bookings").select("*").eq("hotel_id", hotelId),
        supabase.from("rooms").select("*").eq("hotel_id", hotelId),
        supabase.from("payments").select("*"),
      ]);

      const bookings = bookingsRes.data || [];
      const rooms = roomsRes.data || [];
      const allPayments = paymentsRes.data || [];

      // ✅ payments-কে booking_id দিয়ে ফিল্টার করা (শুধু এই হোটেলের)
      const hotelBookingIds = new Set(bookings.map((b: any) => b.id));
      const payments = allPayments.filter((p: any) => hotelBookingIds.has(p.booking_id));

      // ─── Basic calculations ───
      const totalBookings = bookings.filter((b: any) => b.status !== "BLOCKED").length;
      const totalRooms = rooms.length;

      const totalRevenue = bookings.reduce((s: number, b: any) => s + (Number(b.amount) || 0) + (Number(b.tax) || 0), 0);
      const totalCollected = payments.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
      const totalPending = Math.max(0, totalRevenue - totalCollected);

      // ─── Occupancy ───
      const todayISO = new Date().toISOString().slice(0, 10);
      const occupiedBookingRoomIds = new Set(
        bookings
          .filter((b: any) => b.status === "CHECKED-IN" && b.check_in <= todayISO && b.check_out > todayISO)
          .map((b: any) => b.room_id)
          .filter(Boolean)
      );
      const occupiedRooms = occupiedBookingRoomIds.size;
      const availableRooms = Math.max(0, totalRooms - occupiedRooms);
      const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

      // ─── Room-Nights ───
      const monthRoomNights = bookings
        .filter((b: any) => b.status !== "BLOCKED" && b.status !== "CANCELLED")
        .reduce((sum: number, b: any) => {
          const ci = new Date(b.check_in).getTime();
          const co = new Date(b.check_out).getTime();
          return sum + Math.max(1, Math.round((co - ci) / 86400000));
        }, 0);

      const adr = monthRoomNights > 0 ? totalRevenue / monthRoomNights : 0;
      const revpar = totalRooms > 0 ? totalRevenue / totalRooms : 0;

      // ─── Sources ───
      const sourceMap: Record<string, number> = {};
      bookings.forEach((b: any) => {
        const src = b.source || "direct";
        sourceMap[src] = (sourceMap[src] || 0) + 1;
      });
      const sources = Object.entries(sourceMap).map(([name, count]) => ({
        name,
        count,
        percentage: totalBookings > 0 ? (count / totalBookings) * 100 : 0,
      })).sort((a, b) => b.count - a.count);

      // ─── Status Counts ───
      const statusCounts: Record<string, number> = {};
      bookings.forEach((b: any) => {
        const st = b.status || "CONFIRMED";
        statusCounts[st] = (statusCounts[st] || 0) + 1;
      });

      // ─── Payment Methods ───
      const pmMap: Record<string, { amount: number; count: number }> = {};
      payments.forEach((p: any) => {
        const m = p.method || "Other";
        if (!pmMap[m]) pmMap[m] = { amount: 0, count: 0 };
        pmMap[m].amount += Number(p.amount) || 0;
        pmMap[m].count += 1;
      });
      const paymentMethods = Object.entries(pmMap).map(([method, v]) => ({
        method,
        amount: v.amount,
        count: v.count,
      }));

      // ─── Collections (Today / Week / Month) ───
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      let todayCollection = 0, weekCollection = 0, monthCollection = 0;
      payments.forEach((p: any) => {
        const paidAt = new Date(p.created_at || p.paid_at || Date.now());
        const amt = Number(p.amount) || 0;
        if (paidAt >= today && paidAt <= todayEnd) todayCollection += amt;
        if (paidAt >= startOfWeek) weekCollection += amt;
        if (paidAt >= startOfMonth) monthCollection += amt;
      });

      // ─── Arrivals / Departures / In-House ───
      const arrivalsToday = bookings.filter((b: any) => b.check_in === todayISO && b.status !== "CANCELLED");
      const departuresToday = bookings.filter((b: any) => b.check_out === todayISO && b.status !== "CANCELLED");
      const inHouseGuests = bookings
        .filter((b: any) => b.status === "CHECKED-IN")
        .map((b: any) => ({
          id: b.id,
          guestName: b.primary_guest_id ? `Guest` : "Guest",
          roomNumber: null,
          checkIn: b.check_in,
          checkOut: b.check_out,
          balance: Math.max(0, (Number(b.amount) || 0) + (Number(b.tax) || 0) - (Number(b.paid) || 0)),
        }));
      const pendingCheckins = arrivalsToday.filter((b: any) => b.status === "CONFIRMED");
      const pendingCheckouts = departuresToday.filter((b: any) => b.status === "CHECKED-IN");

      // ─── Housekeeping ───
      const cleanRooms = rooms.filter((r: any) => (r.housekeeping_status || "CLEAN") === "CLEAN").length;
      const dirtyRooms = rooms.filter((r: any) => r.housekeeping_status === "DIRTY").length;
      const inspectedRooms = rooms.filter((r: any) => r.housekeeping_status === "INSPECTED").length;
      const maintenanceRooms = rooms.filter((r: any) => r.housekeeping_status === "MAINTENANCE").length;
      const cleanlinessPercent = totalRooms > 0
        ? ((cleanRooms + inspectedRooms) / totalRooms) * 100
        : 100;

      const newStats: HotelStats = {
        totalBookings,
        totalRooms,
        totalRevenue,
        totalCollected,
        totalPending,
        occupancyRate,
        occupiedRooms,
        availableRooms,
        adr,
        revpar,
        monthRoomNights,
        sources,
        statusCounts,
        paymentMethods,
        todayCollection,
        weekCollection,
        monthCollection,
        monthRevenue: totalRevenue,
        monthBookings: totalBookings,
        arrivalCount: arrivalsToday.length,
        departureCount: departuresToday.length,
        inHouseCount: inHouseGuests.length,
        cleanRooms,
        dirtyRooms,
        inspectedRooms,
        maintenanceRooms,
        cleanlinessPercent,
        arrivalsToday,
        departuresToday,
        inHouseGuests,
        pendingCheckins,
        pendingCheckouts,
      };

      setStats(newStats);
    } catch (err: any) {
      console.error("[useHotelStats]", err);
      setError(err.message || "Failed to load stats");
      setStats(EMPTY_STATS);
    } finally {
      setLoading(false);
    }
  }, [hotelId]);

  // Initial fetch when hotelId is available
  useEffect(() => {
    if (hotelLoading) return;
    fetchStats();
  }, [fetchStats, hotelLoading]);

  // Auto-refresh on booking/payment/hotel changes
  useEffect(() => {
    const handler = () => fetchStats();
    window.addEventListener("booking-updated", handler);
    window.addEventListener("payment-added", handler);
    window.addEventListener("hotel-changed", handler);
    return () => {
      window.removeEventListener("booking-updated", handler);
      window.removeEventListener("payment-added", handler);
      window.removeEventListener("hotel-changed", handler);
    };
  }, [fetchStats]);

  return {
    stats,
    loading: loading || hotelLoading,
    error,
    refresh: fetchStats,
  };
}
