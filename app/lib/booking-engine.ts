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
  // 🆕 নতুন ৩টি ফিল্ড
  hero_banner_url?: string;
  show_hero_banner?: boolean;
  hero_overlay_opacity?: number;
};

export type HotelSlugInfo = {
  slug: string | null;
  custom_domain: string | null;
};

// ═══════════════════════════════════════════════
// SLUG
// ═══════════════════════════════════════════════

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function fetchHotelSlug(hotelId: string): Promise<HotelSlugInfo> {
  const { data, error } = await supabase
    .from("hotels")
    .select("slug, custom_domain")
    .eq("id", hotelId)
    .maybeSingle();

  if (error) {
    console.error("[fetchHotelSlug]", error);
    return { slug: null, custom_domain: null };
  }
  return {
    slug: data?.slug || null,
    custom_domain: data?.custom_domain || null,
  };
}

export async function updateHotelSlug(
  hotelId: string,
  slug: string,
  customDomain?: string | null
): Promise<void> {
  // Check uniqueness
  const { data: existing } = await supabase
    .from("hotels")
    .select("id")
    .eq("slug", slug)
    .neq("id", hotelId)
    .maybeSingle();

  if (existing) {
    throw new Error(`Slug "${slug}" is already taken`);
  }

  const payload: any = { slug };
  if (customDomain !== undefined) payload.custom_domain = customDomain;

  const { error } = await supabase
    .from("hotels")
    .update(payload)
    .eq("id", hotelId);

  if (error) throw error;
}

// ═══════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════

export async function fetchBookingEngineSettings(
  hotelId: string
): Promise<BookingEngineSettings | null> {
  if (!hotelId) return null;
  const { data, error } = await supabase
    .from("booking_engine_settings")
    .select("*")
    .eq("hotel_id", hotelId)
    .maybeSingle();

  if (error) {
    console.error("[fetchBookingEngineSettings]", error);
    return null;
  }
  return data as BookingEngineSettings;
}

export async function upsertBookingEngineSettings(
  hotelId: string,
  updates: Partial<BookingEngineSettings>
): Promise<void> {
  const existing = await fetchBookingEngineSettings(hotelId);
  const payload = {
    ...updates,
    hotel_id: hotelId,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { error } = await supabase
      .from("booking_engine_settings")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("booking_engine_settings")
      .insert(payload);
    if (error) throw error;
  }
}

// ═══════════════════════════════════════════════
// PUBLIC URLS
// ═══════════════════════════════════════════════

export function getPublicBookingUrl(slug: string | null): string {
  if (!slug) return "";
  return `https://book.staynexa.in/${slug}`;
}

export function getEmbedCode(slug: string | null, themeColor: string): string {
  if (!slug) return "";
  return `<!-- Staynexa Booking Widget -->
<div id="staynexa-booking"></div>
<script>
  (function() {
    var iframe = document.createElement('iframe');
    iframe.src = 'https://book.staynexa.in/${slug}?embed=1&color=${encodeURIComponent(themeColor)}';
    iframe.style.width = '100%';
    iframe.style.height = '800px';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '12px';
    document.getElementById('staynexa-booking').appendChild(iframe);
  })();
</script>`;
}

export function getDefaultSettings(hotelId: string, hotelName?: string): BookingEngineSettings {
  return {
    hotel_id: hotelId,
    is_enabled: false,
    theme_color: "#F49108",
    hero_title: hotelName ? `Welcome to ${hotelName}` : "Book Your Stay",
    hero_subtitle: "Experience comfort and hospitality at its finest",
    require_payment: false,
    show_rooms: true,
    allow_partial_payment: false,
    partial_payment_pct: 50,
    min_advance_days: 0,
    max_advance_days: 365,
  };
}
