// app/lib/use-rate-grid.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchRateGrid, type RateGrid } from "./rate-plans";

export function useRateGrid(
  hotelId: string | null,
  startDate: string,
  endDate: string
) {
  const [grid, setGrid] = useState<RateGrid | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!hotelId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await fetchRateGrid(hotelId, startDate, endDate);
      setGrid(data);
    } catch (err: any) {
      console.error("[useRateGrid]", err);
      setError(err?.message || "Failed to load rates");
    } finally {
      setLoading(false);
    }
  }, [hotelId, startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  return { grid, loading, error, refresh: load, setGrid };
}