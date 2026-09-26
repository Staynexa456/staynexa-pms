"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useActiveHotel } from "../../lib/use-active-hotel";
import {
  fetchBookingEngineSettings,
  upsertBookingEngineSettings,
  fetchHotelSlug,
  updateHotelSlug,
  getPublicBookingUrl,
  getEmbedCode,
  getDefaultSettings,
  slugify,
  uploadHeroBanner,
  type BookingEngineSettings,
} from "../../lib/booking-engine";
import SettingsLayout, {
  SettingCard,
  SettingRow,
  Toggle,
  Input,
  TextArea,
} from "../../components/settings/SettingsLayout";

export default function BookingEnginePage() {
  const { hotelId, loading: hotelLoading } = useActiveHotel();
  const [settings, setSettings] = useState<BookingEngineSettings | null>(null);
  const [slug, setSlug] = useState<string>("");
  const [customDomain, setCustomDomain] = useState<string>("");
  const [savedSlug, setSavedSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSlug, setSavingSlug] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingAbout, setUploadingAbout] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [newAmenity, setNewAmenity] = useState("");
  const [newGalleryUrl, setNewGalleryUrl] = useState("");
  const [newTestimonial, setNewTestimonial] = useState({ name: "", review: "", rating: 5 });
  const [newFaq, setNewFaq] = useState({ question: "", answer: "" });

  const bannerFileRef = useRef<HTMLInputElement>(null);
  const aboutFileRef = useRef<HTMLInputElement>(null);
  const galleryFileRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  const load = useCallback(async () => {
    if (!hotelId) { setLoading(false); return; }
    try {
      setLoading(true);
      const [s, slugInfo] = await Promise.all([
        fetchBookingEngineSettings(hotelId),
        fetchHotelSlug(hotelId),
      ]);
      setSettings(s || getDefaultSettings(hotelId));
      setSavedSlug(slugInfo.slug);
      setSlug(slugInfo.slug || "");
      setCustomDomain(slugInfo.custom_domain || "");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [hotelId]);

  useEffect(() => {
    if (hotelLoading) return;
    load();
  }, [load, hotelLoading]);

  const update = (patch: Partial<BookingEngineSettings>) => {
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const handleSaveSettings = async () => {
    if (!hotelId || !settings) return;
    setSaving(true);
    try {
      await upsertBookingEngineSettings(hotelId, settings);
      showToast("✅ Booking engine settings saved");
    } catch (err: any) {
      showToast(`⚠ ${err?.message || "Failed to save"}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSlug = async () => {
    if (!hotelId) return;
    const cleanSlug = slugify(slug);
    if (!cleanSlug) { showToast("⚠ Slug cannot be empty"); return; }
    setSavingSlug(true);
    try {
      await updateHotelSlug(hotelId, cleanSlug, customDomain || null);
      setSlug(cleanSlug);
      setSavedSlug(cleanSlug);
      showToast("✅ Public URL saved");
    } catch (err: any) {
      showToast(`⚠ ${err?.message || "Failed to save slug"}`);
    } finally {
      setSavingSlug(false);
    }
  };

  const uploadImage = async (
    file: File,
    setUploading: (v: boolean) => void,
    onSuccess: (url: string) => void,
    successMsg: string
  ) => {
    if (!hotelId) return;
    setUploading(true);
    try {
      const publicUrl = await uploadHeroBanner(file, hotelId);
      onSuccess(publicUrl);
      showToast(`✅ ${successMsg}`);
    } catch (err: any) {
      showToast(`⚠ ${err?.message || "Upload failed"}`);
    } finally {
      setUploading(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      showToast(`📋 ${label} copied`);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      showToast("⚠ Copy failed");
    }
  };

  // Amenities
  const addAmenity = () => {
    if (!newAmenity.trim() || !settings) return;
    const current = settings.amenities || [];
    update({ amenities: [...current, newAmenity.trim()] });
    setNewAmenity("");
  };
  const removeAmenity = (idx: number) => {
    if (!settings) return;
    const current = settings.amenities || [];
    update({ amenities: current.filter((_, i) => i !== idx) });
  };

  // Gallery
  const addGalleryUrl = () => {
    if (!newGalleryUrl.trim() || !settings) return;
    const current = settings.gallery_images || [];
    update({ gallery_images: [...current, newGalleryUrl.trim()] });
    setNewGalleryUrl("");
  };
  const removeGallery = (idx: number) => {
    if (!settings) return;
    const current = settings.gallery_images || [];
    update({ gallery_images: current.filter((_, i) => i !== idx) });
  };

  // Testimonials
  const addTestimonial = () => {
    if (!newTestimonial.name.trim() || !newTestimonial.review.trim() || !settings) return;
    const current = settings.testimonials || [];
    update({ testimonials: [...current, newTestimonial] });
    setNewTestimonial({ name: "", review: "", rating: 5 });
  };
  const removeTestimonial = (idx: number) => {
    if (!settings) return;
    const current = settings.testimonials || [];
    update({ testimonials: current.filter((_, i) => i !== idx) });
  };

  // FAQ
  const addFaq = () => {
    if (!newFaq.question.trim() || !newFaq.answer.trim() || !settings) return;
    const current = settings.faqs || [];
    update({ faqs: [...current, newFaq] });
    setNewFaq({ question: "", answer: "" });
  };
  const removeFaq = (idx: number) => {
    if (!settings) return;
    const current = settings.faqs || [];
    update({ faqs: current.filter((_, i) => i !== idx) });
  };

  if (hotelLoading || loading || !settings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-14 h-14 rounded-full border-4 border-slate-200 border-t-teal-600 animate-spin" />
      </div>
    );
  }

  const publicUrl = getPublicBookingUrl(savedSlug);
  const embedCode = getEmbedCode(savedSlug, settings.theme_color);
  const heroBannerEnabled = settings.show_hero_banner !== false;

  return (
    <SettingsLayout
      title="Booking Engine"
      subtitle="Configure your direct booking website"
      icon="🌐"
      onSave={handleSaveSettings}
      saving={saving}
      showSave
    >
      {/* ═══ Status Banner ═══ */}
      <div className={`mb-5 p-5 rounded-2xl border-2 flex items-start gap-4 ${settings.is_enabled ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${settings.is_enabled ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
          {settings.is_enabled ? "✓" : "⏸"}
        </div>
        <div className="flex-1">
          <p className={`text-sm font-bold ${settings.is_enabled ? "text-emerald-800" : "text-amber-800"}`}>
            {settings.is_enabled ? "Booking Engine is LIVE" : "Booking Engine is paused"}
          </p>
          <p className={`text-xs mt-0.5 ${settings.is_enabled ? "text-emerald-700" : "text-amber-700"}`}>
            {settings.is_enabled ? "Guests can book directly through your public page" : "Enable below to accept online bookings"}
          </p>
        </div>
        <Toggle value={settings.is_enabled} onChange={(v) => update({ is_enabled: v })} />
      </div>

      {/* ═══ Public URL ═══ */}
      <SettingCard title="Public Booking URL" description="The web address where guests can book your hotel">
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Hotel Slug</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden focus-within:border-teal-500">
              <span className="px-3 py-3 text-xs text-slate-400 font-mono bg-slate-100 border-r border-slate-200">book.staynexa.in/</span>
              <input type="text" value={slug} onChange={(e) => setSlug(slugify(e.target.value))} placeholder="vishara-elite" className="flex-1 px-3 py-3 bg-transparent text-sm outline-none font-mono" />
            </div>
            <button onClick={handleSaveSlug} disabled={savingSlug || slug === savedSlug} className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold disabled:opacity-40 transition shrink-0">
              {savingSlug ? "Saving..." : "Save URL"}
            </button>
          </div>
        </div>

        {savedSlug && (
          <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl">
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">Your Live URL</p>
              <div className="flex items-center gap-1">
                <button onClick={() => copyToClipboard(publicUrl, "URL")} className="px-3 py-1.5 bg-white hover:bg-teal-100 border border-teal-200 rounded-lg text-[10px] font-bold text-teal-700 transition">
                  {copied === "URL" ? "✓ Copied" : "📋 Copy"}
                </button>
                <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[10px] font-bold transition">🔗 Open</a>
              </div>
            </div>
            <p className="text-sm font-mono text-teal-800 break-all">{publicUrl}</p>
          </div>
        )}

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Custom Domain (Optional)</label>
          <input type="text" value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} placeholder="book.yourhotel.com" className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500 font-mono" />
        </div>
      </SettingCard>

      {/* ═══ Hero Banner ═══ */}
      <SettingCard title="Hero Banner" description="Show a full-width banner image at the top of your booking page">
        <SettingRow label="Show Hero Banner" description="Display a banner image on the booking page">
          <Toggle value={heroBannerEnabled} onChange={(v) => update({ show_hero_banner: v })} />
        </SettingRow>

        {heroBannerEnabled && (
          <>
            <div className="pt-3 border-t border-slate-100 space-y-4">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Banner Image</label>
              <div className="flex flex-col md:flex-row gap-3 md:items-center">
                <div>
                  <input ref={bannerFileRef} type="file" accept="image/*" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadImage(file, setUploadingBanner, (url) => update({ hero_banner_url: url }), "Banner uploaded");
                    if (bannerFileRef.current) bannerFileRef.current.value = "";
                  }} className="hidden" id="banner-upload" />
                  <label htmlFor="banner-upload" className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${uploadingBanner ? "bg-slate-200 text-slate-400 cursor-wait" : "bg-teal-600 hover:bg-teal-700 text-white shadow-sm"}`}>
                    {uploadingBanner ? "Uploading..." : "📤 Upload Image"}
                  </label>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">— or —</span>
                <div className="flex-1">
                  <input type="text" value={settings.hero_banner_url || ""} onChange={(e) => update({ hero_banner_url: e.target.value })} placeholder="Paste image URL here..." className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500" />
                </div>
              </div>
              {settings.hero_banner_url && (
                <button onClick={() => update({ hero_banner_url: "" })} className="text-xs text-rose-600 hover:text-rose-800 font-bold">🗑 Remove current banner</button>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Overlay Darkness: {Math.round((settings.hero_overlay_opacity || 0.6) * 100)}%
              </label>
              <input type="range" min="0" max="1" step="0.05" value={settings.hero_overlay_opacity || 0.6} onChange={(e) => update({ hero_overlay_opacity: Number(e.target.value) })} className="w-full accent-slate-900" />
            </div>

            {settings.hero_banner_url && (
              <div className="pt-3 border-t border-slate-100">
                <div className="rounded-xl overflow-hidden border border-slate-200">
                  <div className="relative h-40 bg-slate-100">
                    <img src={settings.hero_banner_url} alt="Banner preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    <div className="absolute inset-0" style={{ background: `rgba(15,23,42,${settings.hero_overlay_opacity || 0.6})` }} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                      <p className="text-[9px] tracking-[0.3em] uppercase text-white/70 mb-1">Welcome to</p>
                      <p className="text-white text-lg font-serif font-semibold">{settings.hero_title || "Your Hotel"}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </SettingCard>

      {/* ═══ Branding ═══ */}
      <SettingCard title="Branding" description="Customize the look and feel of your booking page">
        <SettingRow label="Theme Color" description="Primary color for buttons and highlights">
          <div className="flex items-center gap-2">
            <input type="color" value={settings.theme_color} onChange={(e) => update({ theme_color: e.target.value })} className="w-12 h-10 rounded-xl border border-slate-200 cursor-pointer" />
            <span className="text-xs font-mono text-slate-500">{settings.theme_color}</span>
          </div>
        </SettingRow>

        <SettingRow label="Logo URL" description="Your hotel logo (max 200×60px)">
          <Input value={settings.logo_url || ""} onChange={(v) => update({ logo_url: v })} placeholder="https://..." />
        </SettingRow>

        <div className="pt-2 border-t border-slate-100">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Hero Title</label>
          <input type="text" value={settings.hero_title || ""} onChange={(e) => update({ hero_title: e.target.value })} placeholder="Welcome to Our Hotel" className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500" />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Hero Subtitle</label>
          <input type="text" value={settings.hero_subtitle || ""} onChange={(e) => update({ hero_subtitle: e.target.value })} placeholder="Experience comfort and hospitality" className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500" />
        </div>
      </SettingCard>

      {/* ═══ About Section ═══ */}
      <SettingCard title="About Section" description="Tell guests about your hotel">
        <SettingRow label="Show About Section" description="Display about section on booking page">
          <Toggle value={settings.show_about_section !== false} onChange={(v) => update({ show_about_section: v })} />
        </SettingRow>

        {settings.show_about_section !== false && (
          <>
            <div className="pt-3 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Section Title</label>
              <input type="text" value={settings.about_title || ""} onChange={(e) => update({ about_title: e.target.value })} placeholder="About Us" className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500" />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Description</label>
              <TextArea value={settings.about_description || ""} onChange={(v) => update({ about_description: v })} placeholder="Tell your guests about your hotel..." rows={5} />
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">About Image</label>
              <div className="flex flex-col md:flex-row gap-3 md:items-center">
                <div>
                  <input ref={aboutFileRef} type="file" accept="image/*" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadImage(file, setUploadingAbout, (url) => update({ about_image_url: url }), "About image uploaded");
                    if (aboutFileRef.current) aboutFileRef.current.value = "";
                  }} className="hidden" id="about-upload" />
                  <label htmlFor="about-upload" className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${uploadingAbout ? "bg-slate-200 text-slate-400 cursor-wait" : "bg-teal-600 hover:bg-teal-700 text-white shadow-sm"}`}>
                    {uploadingAbout ? "Uploading..." : "📤 Upload Image"}
                  </label>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">— or —</span>
                <div className="flex-1">
                  <input type="text" value={settings.about_image_url || ""} onChange={(e) => update({ about_image_url: e.target.value })} placeholder="Paste image URL here..." className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500" />
                </div>
              </div>
            </div>
          </>
        )}
      </SettingCard>

      {/* ═══ Amenities Section ═══ */}
      <SettingCard title="Amenities" description="List your hotel's amenities and facilities">
        <SettingRow label="Show Amenities Section" description="Display amenities on booking page">
          <Toggle value={settings.show_amenities_section !== false} onChange={(v) => update({ show_amenities_section: v })} />
        </SettingRow>

        {settings.show_amenities_section !== false && (
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div className="flex gap-2">
              <input type="text" value={newAmenity} onChange={(e) => setNewAmenity(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addAmenity()} placeholder="e.g., Free WiFi, Pool, Spa" className="flex-1 px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500" />
              <button onClick={addAmenity} disabled={!newAmenity.trim()} className="px-5 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold disabled:opacity-40 transition shrink-0">+ Add</button>
            </div>

            {(settings.amenities || []).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {(settings.amenities || []).map((a, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-full text-sm">
                    <span>{a}</span>
                    <button onClick={() => removeAmenity(idx)} className="text-rose-500 hover:text-rose-700 font-bold text-xs">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </SettingCard>

      {/* ═══ Gallery Section ═══ */}
      <SettingCard title="Photo Gallery" description="Showcase your hotel with a beautiful photo gallery">
        <SettingRow label="Show Gallery Section" description="Display photo gallery on booking page">
          <Toggle value={settings.show_gallery_section !== false} onChange={(v) => update({ show_gallery_section: v })} />
        </SettingRow>

        {settings.show_gallery_section !== false && (
          <>
            <div className="pt-3 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Gallery Title</label>
              <input type="text" value={settings.gallery_title || ""} onChange={(e) => update({ gallery_title: e.target.value })} placeholder="Photo Gallery" className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500" />
            </div>

            <div className="space-y-3">
              <div className="flex flex-col md:flex-row gap-3 md:items-center">
                <div>
                  <input ref={galleryFileRef} type="file" accept="image/*" multiple onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length === 0) return;
                    setUploadingGallery(true);
                    try {
                      const urls: string[] = [];
                      for (const file of files) {
                        const url = await uploadHeroBanner(file, hotelId!);
                        urls.push(url);
                      }
                      update({ gallery_images: [...(settings.gallery_images || []), ...urls] });
                      showToast(`✅ ${urls.length} images uploaded`);
                    } catch (err: any) {
                      showToast(`⚠ ${err?.message || "Upload failed"}`);
                    } finally {
                      setUploadingGallery(false);
                      if (galleryFileRef.current) galleryFileRef.current.value = "";
                    }
                  }} className="hidden" id="gallery-upload" />
                  <label htmlFor="gallery-upload" className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${uploadingGallery ? "bg-slate-200 text-slate-400 cursor-wait" : "bg-teal-600 hover:bg-teal-700 text-white shadow-sm"}`}>
                    {uploadingGallery ? "Uploading..." : "📤 Upload Images"}
                  </label>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">— or —</span>
                <div className="flex-1 flex gap-2">
                  <input type="text" value={newGalleryUrl} onChange={(e) => setNewGalleryUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addGalleryUrl()} placeholder="Paste image URL..." className="flex-1 px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500" />
                  <button onClick={addGalleryUrl} disabled={!newGalleryUrl.trim()} className="px-5 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold disabled:opacity-40 transition shrink-0">+ Add</button>
                </div>
              </div>

              {(settings.gallery_images || []).length > 0 && (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3 pt-3">
                  {(settings.gallery_images || []).map((url, idx) => (
                    <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-square">
                      <img src={url} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover" />
                      <button onClick={() => removeGallery(idx)} className="absolute top-2 right-2 w-7 h-7 bg-rose-500 hover:bg-rose-600 text-white rounded-full text-xs font-bold opacity-0 group-hover:opacity-100 transition">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </SettingCard>

      {/* ═══ Testimonials ═══ */}
      <SettingCard title="Guest Testimonials" description="Show reviews from happy guests">
        <SettingRow label="Show Testimonials" description="Display testimonials on booking page">
          <Toggle value={settings.show_testimonials !== false} onChange={(v) => update({ show_testimonials: v })} />
        </SettingRow>

        {settings.show_testimonials !== false && (
          <div className="pt-3 border-t border-slate-100 space-y-4">
            <div className="p-4 bg-slate-50 rounded-xl space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input type="text" value={newTestimonial.name} onChange={(e) => setNewTestimonial({ ...newTestimonial, name: e.target.value })} placeholder="Guest name" className="px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500" />
                <select value={newTestimonial.rating} onChange={(e) => setNewTestimonial({ ...newTestimonial, rating: Number(e.target.value) })} className="px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500 bg-white">
                  {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)} ({n} star)</option>)}
                </select>
              </div>
              <textarea value={newTestimonial.review} onChange={(e) => setNewTestimonial({ ...newTestimonial, review: e.target.value })} placeholder="Write the testimonial..." rows={2} className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500 resize-none" />
              <button onClick={addTestimonial} disabled={!newTestimonial.name.trim() || !newTestimonial.review.trim()} className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold disabled:opacity-40 transition">+ Add Testimonial</button>
            </div>

            {(settings.testimonials || []).length > 0 && (
              <div className="space-y-3">
                {(settings.testimonials || []).map((t: any, idx) => (
                  <div key={idx} className="p-4 bg-white border border-slate-200 rounded-xl flex justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-bold text-slate-800">{t.name}</p>
                        <p className="text-amber-500 text-xs">{"★".repeat(t.rating || 5)}</p>
                      </div>
                      <p className="text-xs text-slate-600 italic">"{t.review}"</p>
                    </div>
                    <button onClick={() => removeTestimonial(idx)} className="text-rose-500 hover:text-rose-700 font-bold text-xl shrink-0">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </SettingCard>

      {/* ═══ Map ═══ */}
      <SettingCard title="Location Map" description="Show your hotel's location on a map">
        <SettingRow label="Show Map" description="Display Google Maps on booking page">
          <Toggle value={settings.show_map !== false} onChange={(v) => update({ show_map: v })} />
        </SettingRow>

        {settings.show_map !== false && (
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-[11px] text-blue-800">
                💡 <strong>How to get embed URL:</strong> Go to Google Maps → search your hotel → Share → Embed a map → copy the <code className="bg-blue-100 px-1 rounded">src</code> URL inside the iframe.
              </p>
            </div>
            <input type="text" value={settings.map_embed_url || ""} onChange={(e) => update({ map_embed_url: e.target.value })} placeholder="https://www.google.com/maps/embed?pb=..." className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500 font-mono text-xs" />
          </div>
        )}
      </SettingCard>

      {/* ═══ FAQ ═══ */}
      <SettingCard title="FAQ" description="Add frequently asked questions">
        <SettingRow label="Show FAQ Section" description="Display FAQ on booking page">
          <Toggle value={settings.show_faq === true} onChange={(v) => update({ show_faq: v })} />
        </SettingRow>

        {settings.show_faq === true && (
          <div className="pt-3 border-t border-slate-100 space-y-4">
            <div className="p-4 bg-slate-50 rounded-xl space-y-3">
              <input type="text" value={newFaq.question} onChange={(e) => setNewFaq({ ...newFaq, question: e.target.value })} placeholder="Question (e.g., What is the check-in time?)" className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500" />
              <textarea value={newFaq.answer} onChange={(e) => setNewFaq({ ...newFaq, answer: e.target.value })} placeholder="Answer..." rows={2} className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500 resize-none" />
              <button onClick={addFaq} disabled={!newFaq.question.trim() || !newFaq.answer.trim()} className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold disabled:opacity-40 transition">+ Add FAQ</button>
            </div>

            {(settings.faqs || []).length > 0 && (
              <div className="space-y-3">
                {(settings.faqs || []).map((f: any, idx) => (
                  <div key={idx} className="p-4 bg-white border border-slate-200 rounded-xl flex justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-800 mb-1">{f.question}</p>
                      <p className="text-xs text-slate-600">{f.answer}</p>
                    </div>
                    <button onClick={() => removeFaq(idx)} className="text-rose-500 hover:text-rose-700 font-bold text-xl shrink-0">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </SettingCard>

      {/* ═══ Contact Info ═══ */}
      <SettingCard title="Contact Information" description="Displayed on the booking page footer">
        <SettingRow label="Phone">
          <Input value={settings.contact_phone || ""} onChange={(v) => update({ contact_phone: v })} placeholder="+91 98765 43210" />
        </SettingRow>
        <SettingRow label="Email">
          <Input value={settings.contact_email || ""} onChange={(v) => update({ contact_email: v })} placeholder="bookings@hotel.com" />
        </SettingRow>
        <div className="pt-2 border-t border-slate-100">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Address</label>
          <TextArea value={settings.contact_address || ""} onChange={(v) => update({ contact_address: v })} placeholder="Hotel street, city, state, PIN" rows={2} />
        </div>
      </SettingCard>

      {/* ═══ Social Links ═══ */}
      <SettingCard title="Social Media" description="Connect with your guests on social platforms">
        <SettingRow label="Facebook URL">
          <Input value={settings.facebook_url || ""} onChange={(v) => update({ facebook_url: v })} placeholder="https://facebook.com/yourhotel" />
        </SettingRow>
        <SettingRow label="Instagram URL">
          <Input value={settings.instagram_url || ""} onChange={(v) => update({ instagram_url: v })} placeholder="https://instagram.com/yourhotel" />
        </SettingRow>
        <SettingRow label="WhatsApp Number" description="With country code, no + sign">
          <Input value={settings.whatsapp_number || ""} onChange={(v) => update({ whatsapp_number: v })} placeholder="919876543210" />
        </SettingRow>
      </SettingCard>

      {/* ═══ Check-in/out times & Footer ═══ */}
      <SettingCard title="Check-in/out & Footer" description="Set policies and footer text">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Check-in Time</label>
            <input type="text" value={settings.check_in_time || ""} onChange={(e) => update({ check_in_time: e.target.value })} placeholder="12:00 PM" className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Check-out Time</label>
            <input type="text" value={settings.check_out_time || ""} onChange={(e) => update({ check_out_time: e.target.value })} placeholder="11:00 AM" className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500" />
          </div>
        </div>
        <div className="pt-3 border-t border-slate-100">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Footer Text (Optional)</label>
          <input type="text" value={settings.footer_text || ""} onChange={(e) => update({ footer_text: e.target.value })} placeholder="© 2026 Your Hotel. All rights reserved." className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500" />
        </div>
      </SettingCard>

      {/* ═══ Booking Rules ═══ */}
      <SettingCard title="Booking Rules" description="Control how guests can book">
        <SettingRow label="Show Room Details" description="Display room photos, descriptions, and amenities">
          <Toggle value={settings.show_rooms} onChange={(v) => update({ show_rooms: v })} />
        </SettingRow>
        <SettingRow label="Allow Partial Payment" description="Guest pays advance, rest at check-in">
          <Toggle value={settings.allow_partial_payment} onChange={(v) => update({ allow_partial_payment: v })} />
        </SettingRow>
        {settings.allow_partial_payment && (
          <SettingRow label="Partial Payment %" description="Advance percentage">
            <Input type="number" value={settings.partial_payment_pct} onChange={(v) => update({ partial_payment_pct: Number(v) || 0 })} suffix="%" />
          </SettingRow>
        )}
        <SettingRow label="Min Advance Days">
          <Input type="number" value={settings.min_advance_days} onChange={(v) => update({ min_advance_days: Number(v) || 0 })} suffix="days" />
        </SettingRow>
        <SettingRow label="Max Advance Days">
          <Input type="number" value={settings.max_advance_days} onChange={(v) => update({ max_advance_days: Number(v) || 365 })} suffix="days" />
        </SettingRow>
      </SettingCard>

      {/* ═══ Online Payments ═══ */}
      <SettingCard title="Online Payments" description="Accept bookings with online payment. Your guests pay directly to your account.">
        <SettingRow label="Enable Online Payment" description="Require guests to pay when booking">
          <Toggle value={settings.payment_enabled || false} onChange={(v) => update({ payment_enabled: v })} />
        </SettingRow>

        {settings.payment_enabled && (
          <>
            <div className="pt-3 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Choose Payment Gateway</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { id: "none", label: "None", icon: "🚫" },
                  { id: "razorpay", label: "Razorpay", icon: "💳" },
                  { id: "cashfree", label: "Cashfree", icon: "🏦" },
                  { id: "upi_qr", label: "UPI QR", icon: "📱" },
                ].map((gw) => (
                  <button key={gw.id} onClick={() => update({ payment_gateway: gw.id as any })} className={`p-3 rounded-xl border-2 text-center transition ${settings.payment_gateway === gw.id ? "border-teal-500 bg-teal-50" : "border-slate-200 hover:border-slate-300 bg-white"}`}>
                    <div className="text-2xl mb-1">{gw.icon}</div>
                    <div className="text-xs font-bold text-slate-700">{gw.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Payment Amount</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "full", label: "Full Amount" },
                  { id: "advance", label: "Advance Only" },
                  { id: "partial", label: "Partial" },
                ].map((t) => (
                  <button key={t.id} onClick={() => update({ payment_amount_type: t.id as any })} className={`p-2.5 rounded-xl border-2 text-xs font-bold transition ${settings.payment_amount_type === t.id ? "border-teal-500 bg-teal-50 text-teal-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
              {settings.payment_amount_type === "advance" && (
                <div className="mt-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                    Advance Percentage: {settings.advance_percentage || 100}%
                  </label>
                  <input type="range" min="10" max="100" step="5" value={settings.advance_percentage || 100} onChange={(e) => update({ advance_percentage: Number(e.target.value) })} className="w-full accent-teal-600" />
                </div>
              )}
            </div>

            {settings.payment_gateway === "razorpay" && (
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Razorpay Key ID</label>
                  <input type="text" value={settings.razorpay_key_id || ""} onChange={(e) => update({ razorpay_key_id: e.target.value })} placeholder="rzp_live_xxxxxxxxxxxx" className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500 font-mono" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Razorpay Key Secret</label>
                  <input type="password" value={settings.razorpay_key_secret || ""} onChange={(e) => update({ razorpay_key_secret: e.target.value })} placeholder="••••••••" className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500 font-mono" />
                </div>
              </div>
            )}

            {settings.payment_gateway === "cashfree" && (
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Cashfree App ID</label>
                  <input type="text" value={settings.cashfree_app_id || ""} onChange={(e) => update({ cashfree_app_id: e.target.value })} placeholder="CF_xxxxxxxxxxxx" className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500 font-mono" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Cashfree Secret Key</label>
                  <input type="password" value={settings.cashfree_secret_key || ""} onChange={(e) => update({ cashfree_secret_key: e.target.value })} placeholder="••••••••" className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500 font-mono" />
                </div>
              </div>
            )}

            {settings.payment_gateway === "upi_qr" && (
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
                  <p className="text-[11px] text-purple-800 font-medium">💡 Guests will scan your UPI QR code. You'll verify payment manually.</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">UPI ID (VPA)</label>
                  <input type="text" value={settings.upi_id || ""} onChange={(e) => update({ upi_id: e.target.value })} placeholder="yourhotel@okhdfcbank" className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500 font-mono" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">UPI QR Code Image URL (Optional)</label>
                  <input type="text" value={settings.upi_qr_url || ""} onChange={(e) => update({ upi_qr_url: e.target.value })} placeholder="https://... your-qr.png" className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500" />
                </div>
              </div>
            )}
          </>
        )}
      </SettingCard>

      {/* ═══ Embed Code ═══ */}
      {savedSlug && (
        <SettingCard title="Embed on Your Website" description="Copy this code and paste into your website HTML">
          <div className="relative">
            <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono overflow-x-auto whitespace-pre-wrap break-all">{embedCode}</pre>
            <button onClick={() => copyToClipboard(embedCode, "Embed code")} className="absolute top-3 right-3 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10px] font-bold backdrop-blur transition">
              {copied === "Embed code" ? "✓ Copied" : "📋 Copy"}
            </button>
          </div>
        </SettingCard>
      )}

      {/* ═══ Legal ═══ */}
      <SettingCard title="Legal Pages" description="Links shown on booking footer">
        <SettingRow label="Terms URL">
          <Input value={settings.terms_url || ""} onChange={(v) => update({ terms_url: v })} placeholder="https://yoursite.com/terms" />
        </SettingRow>
        <SettingRow label="Privacy URL">
          <Input value={settings.privacy_url || ""} onChange={(v) => update({ privacy_url: v })} placeholder="https://yoursite.com/privacy" />
        </SettingRow>
      </SettingCard>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl text-sm font-semibold z-[100] shadow-2xl">{toast}</div>
      )}
    </SettingsLayout>
  );
}
