// app/lib/use-hotel-stats.ts
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchHotelStats, type HotelStats } from "./hotel-stats";
import { getActiveHotelId } from "../active-hotel";

type UseHotelStatsReturn = {
  stats: HotelStats | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useHotelStats(): UseHotelStatsReturn {
  const [stats, setStats] = useState<HotelStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const load = useCallback(async () => {
    const hotelId = getActiveHotelId();
    if (!hotelId) {
      setError("No active hotel selected");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await fetchHotelStats(hotelId);
      if (isMountedRef.current) {
        setStats(data);
      }
    } catch (err: any) {
      console.error("[useHotelStats]", err);
      if (isMountedRef.current) {
        setError(err?.message || "Failed to load hotel stats");
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    load();

    const handleHotelChange = () => {
      load();
    };

    window.addEventListener("hotel-changed", handleHotelChange);
    window.addEventListener("booking-updated", handleHotelChange);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener("hotel-changed", handleHotelChange);
      window.removeEventListener("booking-updated", handleHotelChange);
    };
  }, [load]);

  return {
    stats,
    loading,
    error,
    refresh: load,
  };
}

// ═══════════════════════════════════════════════
// UTILITY: Notify other components of data change
// ═══════════════════════════════════════════════
export function notifyBookingUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("booking-updated"));
  }
}