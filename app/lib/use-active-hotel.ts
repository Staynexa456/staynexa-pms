// app/lib/use-active-hotel.ts
"use client";

import { useState, useEffect } from "react";
import {
  getActiveHotelId,
  ensureActiveHotel,
  subscribeToHotelChanges,
} from "../active-hotel";

type UseActiveHotelReturn = {
  hotelId: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useActiveHotel(): UseActiveHotelReturn {
  const [hotelId, setHotelId] = useState<string | null>(() =>
    typeof window !== "undefined" ? getActiveHotelId() : null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        setLoading(true);
        setError(null);

        // If we already have a hotelId in state, we're good
        const existing = getActiveHotelId();
        if (existing && mounted) {
          setHotelId(existing);
          setLoading(false);
          return;
        }

        // Otherwise, bootstrap
        const id = await ensureActiveHotel();
        if (mounted) {
          setHotelId(id);
          if (!id) {
            setError("No hotel available");
          }
        }
      } catch (err: any) {
        console.error("[useActiveHotel]", err);
        if (mounted) setError(err?.message || "Failed to load hotel");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    // Subscribe to hotel changes
    const unsubscribe = subscribeToHotelChanges((newHotelId) => {
      if (mounted) {
        setHotelId(newHotelId);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    const id = await ensureActiveHotel();
    setHotelId(id);
    if (!id) setError("No hotel available");
    setLoading(false);
  };

  return { hotelId, loading, error, refresh };
}