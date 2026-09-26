// app/lib/booking-engine.ts
import { supabase } from "../supabase";

export type BookingEngineSettings = {
  id?: string;
  hotel_id: string;
  is_enabled: boolean;
  theme_color: string;
  hero_title?: string;
  hero_subtitle?: string;
  logo_url?: string;
  contact_phone?: string;
  contact_email?: string;
  contact_address?: string;
  show_rooms: boolean;
  allow_partial_payment: boolean;
  partial_payment_pct: number;
  min_advance_days: number;
  max_advance_days: number;
  require_payment: boolean;
  razorpay_key_id?: string;
  razorpay_key_secret?: string;
  gtm_header_script?: string;
  gtm_body_script?: string;
  terms_url?: string;
  privacy_url?: string;
  // 🆕 Hero Banner Fields
  hero_banner_url?: string;
  show_hero_banner?: boolean;
  hero_overlay_opacity?: number;
};

// ═══════════════════════════════════════════════
// FETCH SETTINGS
// ═══════════════════════════════════════════════
export async function fetchBookingEngineSettings(
  hotelId: string
): Promise<BookingEngineSettings | null> {
  const { data, error } = await supabase
    .from("booking_engine_settings")
    .select("*")
    .eq("hotel_id", hotelId)
    .maybeSingle();

  if (error) {
    console.error("[fetchBookingEngineSettings]", error);
    return null;
  }
  return data as BookingEngineSettings | null;
}

// ═══════════════════════════════════════════════
// UPSERT SETTINGS
// ═══════════════════════════════════════════════
export async function upsertBookingEngineSettings(
  hotelId: string,
  settings: BookingEngineSettings
): Promise<void> {
  const payload: any = {
    hotel_id: hotelId,
    is_enabled: settings.is_enabled,
    theme_color: settings.theme_color,
    hero_title: settings.hero_title || null,
    hero_subtitle: settings.hero_subtitle || null,
    logo_url: settings.logo_url || null,
    contact_phone: settings.contact_phone || null,
    contact_email: settings.contact_email || null,
    contact_address: settings.contact_address || null,
    show_rooms: settings.show_rooms,
    allow_partial_payment: settings.allow_partial_payment,
    partial_payment_pct: settings.partial_payment_pct,
    min_advance_days: settings.min_advance_days,
    max_advance_days: settings.max_advance_days,
    require_payment: settings.require_payment,
    razorpay_key_id: settings.razorpay_key_id || null,
    razorpay_key_secret: settings.razorpay_key_secret || null,
    gtm_header_script: settings.gtm_header_script || null,
    gtm_body_script: settings.gtm_body_script || null,
    terms_url: settings.terms_url || null,
    privacy_url: settings.privacy_url || null,
    // 🆕 Hero Banner Fields
    hero_banner_url: settings.hero_banner_url || null,
    show_hero_banner: settings.show_hero_banner ?? true,
    hero_overlay_opacity: settings.hero_overlay_opacity ?? 0.6,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("booking_engine_settings")
    .upsert(payload, { onConflict: "hotel_id" });

  if (error) throw error;
}

// ═══════════════════════════════════════════════
// DEFAULT SETTINGS
// ═══════════════════════════════════════════════
export function getDefaultSettings(hotelId: string): BookingEngineSettings {
  return {
    hotel_id: hotelId,
    is_enabled: true,
    theme_color: "#0f172a",
    hero_title: "Welcome to Our Hotel",
    hero_subtitle: "Experience comfort and hospitality at its finest",
    logo_url: "",
    contact_phone: "",
    contact_email: "",
    contact_address: "",
    show_rooms: true,
    allow_partial_payment: false,
    partial_payment_pct: 30,
    min_advance_days: 0,
    max_advance_days: 365,
    require_payment: false,
    razorpay_key_id: "",
    razorpay_key_secret: "",
    gtm_header_script: "",
    gtm_body_script: "",
    terms_url: "",
    privacy_url: "",
    // 🆕 Hero Banner Defaults
    hero_banner_url: "",
    show_hero_banner: true,
    hero_overlay_opacity: 0.6,
  };
}

// ═══════════════════════════════════════════════
// HOTEL SLUG
// ═══════════════════════════════════════════════
export async function fetchHotelSlug(
  hotelId: string
): Promise<{ slug: string; custom_domain: string | null }> {
  const { data, error } = await supabase
    .from("hotels")
    .select("slug, custom_domain")
    .eq("id", hotelId)
    .maybeSingle();

  if (error) {
    console.error("[fetchHotelSlug]", error);
    return { slug: "", custom_domain: null };
  }
  return {
    slug: data?.slug || "",
    custom_domain: data?.custom_domain || null,
  };
}

export async function updateHotelSlug(
  hotelId: string,
  slug: string,
  customDomain: string | null
): Promise<void> {
  const { error } = await supabase
    .from("hotels")
    .update({ slug, custom_domain: customDomain })
    .eq("id", hotelId);

  if (error) throw error;
}

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════
export function getPublicBookingUrl(slug: string | null): string {
  if (!slug) return "";
  return `https://book.staynexa.in/${slug}`;
}

export function getEmbedCode(slug: string | null, themeColor: string = "#0f172a"): string {
  if (!slug) return "";
  const url = `https://book.staynexa.in/${slug}`;
  return `<iframe src="${url}" style="width:100%;height:800px;border:0;border-radius:12px;" title="Book your stay"></iframe>`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
