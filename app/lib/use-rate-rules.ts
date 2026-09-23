// app/lib/use-rate-rules.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchRules, type RateRule } from "./rate-rules";

export function useRateRules(hotelId: string | null) {
  const [rules, setRules] = useState<RateRule[]>([]);
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
      const data = await fetchRules(hotelId);
      setRules(data);
    } catch (err: any) {
      console.error("[useRateRules]", err);
      setError(err?.message || "Failed to load rules");
    } finally {
      setLoading(false);
    }
  }, [hotelId]);

  useEffect(() => {
    load();
  }, [load]);

  return { rules, loading, error, refresh: load, setRules };
}