// app/lib/booking-engine.ts
import { supabase } from "../supabase";

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════
export type BookingEngineSettings = {
  id?: string;
  hotel_id: string;
  is_enabled: boolean;

  // Branding
  theme_color?: string;
  logo_url?: string;

  // Hero
  show_hero_banner?: boolean;
  hero_banner_url?: string;
  hero_title?: string;
  hero_subtitle?: string;
  hero_overlay_opacity?: number;

  // Contact
  contact_phone?: string;
  contact_email?: string;
  contact_address?: string;
  facebook_url?: string;
  instagram_url?: string;
  whatsapp_number?: string;
  check_in_time?: string;
  check_out_time?: string;
  footer_text?: string;

  // About
  show_about_section?: boolean;
  about_title?: string;
  about_description?: string;
  about_image_url?: string;

  // Amenities
  show_amenities_section?: boolean;
  amenities?: string[];

  // Gallery
  show_gallery_section?: boolean;
  gallery_title?: string;
  gallery_images?: string[];

  // Testimonials
  show_testimonials?: boolean;
  testimonials?: Array<{ name: string; review: string; rating: number }>;

  // Map
  show_map?: boolean;
  map_embed_url?: string;

  // FAQ
  show_faq?: boolean;
  faqs?: Array<{ question: string; answer: string }>;

  // Rooms
  show_rooms?: boolean;

  // Booking Rules
  show_full_payment?: boolean;
  show_partial_payment?: boolean;
  partial_payment_pct?: number;
  partial_payment_label?: string;
  show_pay_at_property?: boolean;
  min_advance_days?: number;
  max_advance_days?: number;

  // Payment Gateway
  payment_enabled?: boolean;
  payment_gateway?: "none" | "razorpay" | "cashfree" | "upi_qr";
  razorpay_key_id?: string;
  razorpay_key_secret?: string;
  cashfree_app_id?: string;
  cashfree_secret_key?: string;
  upi_id?: string;
  upi_qr_url?: string;

  // Legal
  terms_url?: string;
  privacy_url?: string;

  // ═══════════════════════════════════════════════
  // 🆕 TAX
  // ═══════════════════════════════════════════════
  tax_enabled?: boolean;
  tax_rate?: number;
  tax_label?: string;
  tax_cgst?: number;
  tax_sgst?: number;
  tax_show_split?: boolean;

  [key: string]: any;
};

export type HotelSlugData = {
  slug: string | null;
  custom_domain: string | null;
};

// ═══════════════════════════════════════════════
// DEFAULT SETTINGS
// ═══════════════════════════════════════════════
export function getDefaultSettings(hotelId: string): BookingEngineSettings {
  return {
    hotel_id: hotelId,
    is_enabled: true,
    theme_color: "#0f172a",

    show_hero_banner: true,
    hero_title: "",
    hero_subtitle: "An unforgettable stay awaits you",
    hero_overlay_opacity: 0.6,

    show_about_section: true,
    show_amenities_section: true,
    show_gallery_section: true,
    show_testimonials: true,
    show_map: false,
    show_faq: false,

    show_rooms: true,

    // Payment defaults
    show_full_payment: true,
    show_partial_payment: true,
    partial_payment_pct: 50,
    partial_payment_label: "Pay Advance",
    show_pay_at_property: true,
    min_advance_days: 0,
    max_advance_days: 365,

    payment_enabled: false,
    payment_gateway: "none",

    check_in_time: "12:00 PM",
    check_out_time: "11:00 AM",

    // Tax defaults
    tax_enabled: true,
    tax_rate: 12,
    tax_label: "GST",
    tax_cgst: 6,
    tax_sgst: 6,
    tax_show_split: true,
  };
}

// ═══════════════════════════════════════════════
// FETCH SETTINGS
// ═══════════════════════════════════════════════
export async function fetchBookingEngineSettings(
  hotelId: string
): Promise<BookingEngineSettings | null> {
  if (!hotelId) return null;

  const { data, error } = await supabase
    .from("booking_engine_config")
    .select("*")
    .eq("hotel_id", hotelId)
    .maybeSingle();

  if (error) {
    console.error("[fetchBookingEngineSettings]", error);
    return null;
  }

  if (!data) return null;

  return {
    ...getDefaultSettings(hotelId),
    ...data,
  };
}

// ═══════════════════════════════════════════════
// UPSERT SETTINGS
// ═══════════════════════════════════════════════
export async function upsertBookingEngineSettings(
  hotelId: string,
  settings: BookingEngineSettings
): Promise<void> {
  if (!hotelId) throw new Error("hotelId required");

  const payload = {
    ...settings,
    hotel_id: hotelId,
    updated_at: new Date().toISOString(),
  };

  // Check if exists
  const { data: existing } = await supabase
    .from("booking_engine_config")
    .select("id")
    .eq("hotel_id", hotelId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("booking_engine_config")
      .update(payload)
      .eq("hotel_id", hotelId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("booking_engine_config")
      .insert(payload);
    if (error) throw error;
  }
}

// ═══════════════════════════════════════════════
// FETCH HOTEL SLUG
// ═══════════════════════════════════════════════
export async function fetchHotelSlug(hotelId: string): Promise<HotelSlugData> {
  if (!hotelId) return { slug: null, custom_domain: null };

  const { data, error } = await supabase
    .from("hotels")
    .select("slug, custom_domain")
    .eq("id", hotelId)
    .maybeSingle();

  if (error || !data) {
    return { slug: null, custom_domain: null };
  }

  return {
    slug: data.slug || null,
    custom_domain: data.custom_domain || null,
  };
}

// ═══════════════════════════════════════════════
// UPDATE HOTEL SLUG
// ═══════════════════════════════════════════════
export async function updateHotelSlug(
  hotelId: string,
  slug: string,
  customDomain: string | null = null
): Promise<void> {
  if (!hotelId || !slug) throw new Error("hotelId and slug required");

  const cleanSlug = slug
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const { error } = await supabase
    .from("hotels")
    .update({
      slug: cleanSlug,
      custom_domain: customDomain || null,
    })
    .eq("id", hotelId);

  if (error) throw error;
}

// ═══════════════════════════════════════════════
// GET PUBLIC BOOKING URL
// ═══════════════════════════════════════════════
export function getPublicBookingUrl(slug: string): string {
  if (!slug) return "";
  return `https://book.staynexa.in/${slug}`;
}

// ═══════════════════════════════════════════════
// GET EMBED CODE
// ═══════════════════════════════════════════════
export function getEmbedCode(slug: string): string {
  if (!slug) return "";
  const url = getPublicBookingUrl(slug);
  return `<iframe src="${url}" width="100%" height="800" frameborder="0" style="border:0;border-radius:12px;overflow:hidden;" allowfullscreen></iframe>`;
}

// ═══════════════════════════════════════════════
// UPLOAD HERO BANNER / IMAGE
// ═══════════════════════════════════════════════
export async function uploadHeroBanner(
  file: File,
  hotelId: string
): Promise<string> {
  if (!file || !hotelId) throw new Error("file and hotelId required");

  const fileExt = file.name.split(".").pop();
  const fileName = `${hotelId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${fileExt}`;

  // Try multiple buckets
  const buckets = ["hotel-images", "room-photos", "hotel-assets"];
  let lastError: any = null;

  for (const bucket of buckets) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (!error && data) {
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);
      return urlData.publicUrl;
    }

    lastError = error;
  }

  throw new Error(
    lastError?.message || "Upload failed. Please create a storage bucket named 'hotel-images'."
  );
}

// ═══════════════════════════════════════════════
// OPTIONAL: DELETE IMAGE FROM STORAGE
// ═══════════════════════════════════════════════
export async function deleteStorageImage(url: string): Promise<void> {
  if (!url) return;

  try {
    // Extract path from URL
    const paths = ["hotel-images/", "room-photos/", "hotel-assets/"];
    let filePath: string | null = null;

    for (const p of paths) {
      const idx = url.indexOf(p);
      if (idx !== -1) {
        filePath = url.substring(idx + p.length);
        break;
      }
    }

    if (!filePath) return;

    // Try each bucket
    for (const bucket of ["hotel-images", "room-photos", "hotel-assets"]) {
      const { error } = await supabase.storage.from(bucket).remove([filePath]);
      if (!error) return;
    }
  } catch (err) {
    console.error("[deleteStorageImage]", err);
  }
}
