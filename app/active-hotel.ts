// app/active-hotel.ts
import { supabase } from "./supabase";

const HOTEL_KEY = "activeHotelId";
const HOTEL_LOADED_KEY = "activeHotelLoaded";

// ═══════════════════════════════════════════════
// CORE STORAGE HELPERS
// ═══════════════════════════════════════════════

export function getActiveHotelId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(HOTEL_KEY);
  } catch {
    return null;
  }
}

export function setActiveHotelId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HOTEL_KEY, id);
    localStorage.setItem(HOTEL_LOADED_KEY, "1");
  } catch (err) {
    console.error("[active-hotel] Failed to save hotelId:", err);
  }
}

export function clearActiveHotelId(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(HOTEL_KEY);
    localStorage.removeItem(HOTEL_LOADED_KEY);
  } catch {}
}

export function isHotelLoaded(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(HOTEL_LOADED_KEY) === "1";
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════
// BOOTSTRAP: Ensures a hotel ID exists in localStorage
// Call this ONCE on app start (from layout)
// ═══════════════════════════════════════════════

let bootstrapPromise: Promise<string | null> | null = null;

export async function ensureActiveHotel(): Promise<string | null> {
  // If already has a value, return it
  const existing = getActiveHotelId();
  if (existing) return existing;

  // Prevent multiple concurrent bootstraps
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    try {
      // Check session
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user) {
        return null;
      }

      // Fetch user's hotels
      const { data: hotels, error } = await supabase
        .from("hotels")
        .select("id, name")
        .order("name");

      if (error) {
        console.error("[ensureActiveHotel] Failed to fetch hotels:", error);
        return null;
      }

      if (!hotels || hotels.length === 0) {
        console.warn("[ensureActiveHotel] No hotels found for user");
        return null;
      }

      // Set first hotel as active
      const firstHotelId = hotels[0].id;
      setActiveHotelId(firstHotelId);

      // Notify all listeners
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("hotel-changed", { detail: firstHotelId })
        );
      }

      return firstHotelId;
    } catch (err) {
      console.error("[ensureActiveHotel] Error:", err);
      return null;
    } finally {
      // Reset promise after completion so it can retry if needed
      setTimeout(() => {
        bootstrapPromise = null;
      }, 100);
    }
  })();

  return bootstrapPromise;
}

// ═══════════════════════════════════════════════
// Subscribers (for hot-swapping without reload)
// ═══════════════════════════════════════════════

type HotelChangeListener = (hotelId: string | null) => void;
const listeners = new Set<HotelChangeListener>();

export function subscribeToHotelChanges(
  listener: HotelChangeListener
): () => void {
  listeners.add(listener);

  if (typeof window !== "undefined") {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      listener(customEvent.detail || null);
    };
    window.addEventListener("hotel-changed", handler);

    return () => {
      listeners.delete(listener);
      window.removeEventListener("hotel-changed", handler);
    };
  }

  return () => {
    listeners.delete(listener);
  };
}

// ═══════════════════════════════════════════════
// Setup: Listen for auth changes to auto-bootstrap
// ═══════════════════════════════════════════════

export function setupAuthListener(): () => void {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session?.user) {
      // New login — ensure hotel is set
      ensureActiveHotel();
    } else if (event === "SIGNED_OUT") {
      clearActiveHotelId();
    }
  });

  return () => {
    data.subscription.unsubscribe();
  };
}