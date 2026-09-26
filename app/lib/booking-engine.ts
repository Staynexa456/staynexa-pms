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
  gtm_header_script?: string;
  gtm_body_script?: string;
  terms_url?: string;
  privacy_url?: string;
  hero_banner_url?: string;
  show_hero_banner?: boolean;
  hero_overlay_opacity?: number;
  payment_gateway?: "none" | "razorpay" | "cashfree" | "upi_qr";
  payment_enabled?: boolean;
  payment_amount_type?: "full" | "partial" | "advance";
  advance_percentage?: number;
  razorpay_key_id?: string;
  razorpay_key_secret?: string;
  cashfree_app_id?: string;
  cashfree_secret_key?: string;
  upi_id?: string;
  upi_qr_url?: string;
  payment_notes?: string;
};

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
    gtm_header_script: settings.gtm_header_script || null,
    gtm_body_script: settings.gtm_body_script || null,
    terms_url: settings.terms_url || null,
    privacy_url: settings.privacy_url || null,
    hero_banner_url: settings.hero_banner_url || null,
    show_hero_banner: settings.show_hero_banner ?? true,
    hero_overlay_opacity: settings.hero_overlay_opacity ?? 0.6,
    payment_gateway: settings.payment_gateway || "none",
    payment_enabled: settings.payment_enabled ?? false,
    payment_amount_type: settings.payment_amount_type || "full",
    advance_percentage: settings.advance_percentage ?? 100,
    razorpay_key_id: settings.razorpay_key_id || null,
    razorpay_key_secret: settings.razorpay_key_secret || null,
    cashfree_app_id: settings.cashfree_app_id || null,
    cashfree_secret_key: settings.cashfree_secret_key || null,
    upi_id: settings.upi_id || null,
    upi_qr_url: settings.upi_qr_url || null,
    payment_notes: settings.payment_notes || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("booking_engine_settings")
    .upsert(payload, { onConflict: "hotel_id" });

  if (error) throw error;
}

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
    gtm_header_script: "",
    gtm_body_script: "",
    terms_url: "",
    privacy_url: "",
    hero_banner_url: "",
    show_hero_banner: true,
    hero_overlay_opacity: 0.6,
    payment_gateway: "none",
    payment_enabled: false,
    payment_amount_type: "full",
    advance_percentage: 100,
    razorpay_key_id: "",
    razorpay_key_secret: "",
    cashfree_app_id: "",
    cashfree_secret_key: "",
    upi_id: "",
    upi_qr_url: "",
    payment_notes: "",
  };
}

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

export function getPublicBookingUrl(slug: string | null): string {
  if (!slug) return "";
  return `https://book.staynexa.in/${slug}`;
}

export function getEmbedCode(slug: string | null, themeColor?: string): string {
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

export async function uploadHeroBanner(
  file: File,
  hotelId: string
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files are allowed");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("File size must be less than 5MB");
  }

  const ext = file.name.split(".").pop() || "jpg";
  const filename = `hero-banners/${hotelId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  const { data, error } = await supabase.storage
    .from("hotel-assets")
    .upload(filename, file, { cacheControl: "3600", upsert: true });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from("hotel-assets")
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}
