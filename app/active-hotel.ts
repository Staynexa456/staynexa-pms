// app/active-hotel.ts
import { supabase } from "./supabase";

const HOTEL_KEY = "activeHotelId";

// ✅ localStorage থেকে active hotel ID পড়া
export function getActiveHotelId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(HOTEL_KEY);
  } catch {
    return null;
  }
}

// ✅ localStorage-এ active hotel ID সেভ করা
export function setActiveHotelId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HOTEL_KEY, id);
  } catch (err) {
    console.error("[active-hotel] Failed to save hotelId:", err);
  }
}

// ✅ active hotel মুছে ফেলা
export function clearActiveHotelId(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(HOTEL_KEY);
  } catch {}
}

// ═══════════════════════════════════════════════
// Bootstrap: Ensure active hotel exists
// ═══════════════════════════════════════════════
let bootstrapPromise: Promise<string | null> | null = null;

export async function ensureActiveHotel(): Promise<string | null> {
  // ✅ Already has value → return
  const existing = getActiveHotelId();
  if (existing) return existing;

  // Prevent duplicate bootstraps
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user) return null;

      const userId = sessionData.session.user.id;

      // ✅ Check if user is platform admin
      const { data: adminCheck } = await supabase
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

      const isAdmin = !!adminCheck;

      // ✅ Get user's hotels
      let hotels: { id: string }[] = [];

      if (isAdmin) {
        // Admin — get all hotels
        const { data } = await supabase
          .from("hotels")
          .select("id")
          .order("name")
          .limit(1);
        hotels = data || [];
      } else {
        // Regular user — get own hotels via hotel_users
        const { data: links } = await supabase
          .from("hotel_users")
          .select("hotel_id")
          .eq("user_id", userId)
          .limit(1);

        if (links && links.length > 0) {
          hotels = links.map((l: any) => ({ id: l.hotel_id }));
        } else {
          // Fallback: check owner_id
          const { data: owned } = await supabase
            .from("hotels")
            .select("id")
            .eq("owner_id", userId)
            .limit(1);
          hotels = owned || [];
        }
      }

      if (hotels.length === 0) return null;

      const firstHotelId = hotels[0].id;
      setActiveHotelId(firstHotelId);

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
      setTimeout(() => { bootstrapPromise = null; }, 100);
    }
  })();

  return bootstrapPromise;
}

// ═══════════════════════════════════════════════
// Subscribers (listeners)
// ═══════════════════════════════════════════════
type HotelChangeListener = (hotelId: string | null) => void;
const listeners = new Set<HotelChangeListener>();

export function subscribeToHotelChanges(listener: HotelChangeListener): () => void {
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

  return () => { listeners.delete(listener); };
}

// ═══════════════════════════════════════════════
// Auth listener
// ═══════════════════════════════════════════════
export function setupAuthListener(): () => void {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session?.user) {
      ensureActiveHotel();
    } else if (event === "SIGNED_OUT") {
      clearActiveHotelId();
    }
  });

  return () => { data.subscription.unsubscribe(); };
}
