// app/settings/booking-engine/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useActiveHotel } from "../../lib/use-active-hotel";
import { supabase } from "../../supabase";
import {
  fetchBookingEngineSettings,
  upsertBookingEngineSettings,
  getDefaultSettings,
  fetchHotelSlug,
  updateHotelSlug,
  getPublicBookingUrl,
  getEmbedCode,
  uploadHeroBanner,
  type BookingEngineSettings,
} from "../../lib/booking-engine";
import AdvancedBookingSettings from "../../components/AdvancedBookingSettings";
import ToggleRow from "../../components/ToggleRow";

type TabKey =
  | "branding"
  | "hero"
  | "about"
  | "amenities"
  | "gallery"
  | "testimonials"
  | "map"
  | "faq"
  | "contact"
  | "rules"
  | "payment"
  | "taxes"
  | "advanced"
  | "legal";

export default function BookingEngineSettingsPage() {
  const { hotelId, loading: hotelLoading } = useActiveHotel();
  const [settings, setSettings] = useState<BookingEngineSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("branding");

  const [slug, setSlug] = useState("");
  const [customDomain, setCustomDomain] = useState<string | null>(null);
  const [slugSaving, setSlugSaving] = useState(false);

  const [newAmenity, setNewAmenity] = useState("");
  const [newGalleryImage, setNewGalleryImage] = useState("");
  const [newFaqQ, setNewFaqQ] = useState("");
  const [newFaqA, setNewFaqA] = useState("");
  const [newTestimonial, setNewTestimonial] = useState({ name: "", review: "", rating: 5 });

  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadingAbout, setUploadingAbout] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  const load = useCallback(async () => {
    if (!hotelId) return;
    setLoading(true);
    try {
      const [data, slugData] = await Promise.all([
        fetchBookingEngineSettings(hotelId),
        fetchHotelSlug(hotelId),
      ]);
      setSettings(data || getDefaultSettings(hotelId));
      setSlug(slugData.slug || "");
      setCustomDomain(slugData.custom_domain || null);
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

  const update = (key: keyof BookingEngineSettings | string, value: any) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value } as BookingEngineSettings);
  };

  const handleSave = async () => {
    if (!hotelId || !settings) return;
    setSaving(true);
    try {
      await upsertBookingEngineSettings(hotelId, settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error(err);
      alert("Failed to save: " + (err as any).message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSlug = async () => {
    if (!hotelId || !slug.trim()) return;
    setSlugSaving(true);
    try {
      await updateHotelSlug(hotelId, slug.trim(), customDomain);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error(err);
      alert("Failed to save slug: " + (err as any).message);
    } finally {
      setSlugSaving(false);
    }
  };

  const handleHeroUpload = async (file: File) => {
    if (!hotelId || !settings) return;
    setUploadingHero(true);
    try {
      const url = await uploadHeroBanner(file, hotelId);
      update("hero_banner_url", url);
    } catch (err) {
      alert("Upload failed: " + (err as any).message);
    } finally {
      setUploadingHero(false);
    }
  };

  const handleAboutUpload = async (file: File) => {
    if (!hotelId || !settings) return;
    setUploadingAbout(true);
    try {
      const url = await uploadHeroBanner(file, hotelId);
      update("about_image_url", url);
    } catch (err) {
      alert("Upload failed: " + (err as any).message);
    } finally {
      setUploadingAbout(false);
    }
  };

  const handleGalleryUpload = async (files: FileList | null) => {
    if (!hotelId || !settings || !files || files.length === 0) return;
    setUploadingGallery(true);
    try {
      const uploads: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const url = await uploadHeroBanner(files[i], hotelId);
        uploads.push(url);
      }
      update("gallery_images", [...(settings.gallery_images || []), ...uploads]);
    } catch (err) {
      alert("Upload failed: " + (err as any).message);
    } finally {
      setUploadingGallery(false);
    }
  };

  if (hotelLoading || loading || !settings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full border-4 border-slate-200 border-t-teal-600 animate-spin" />
          <p className="text-sm font-semibold text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Helper getters for tax (fallback to defaults)
  const tax = {
    enabled: (settings as any).tax_enabled !== false,
    rate: Number((settings as any).tax_rate ?? 12),
    label: (settings as any).tax_label || "GST",
    cgst: Number((settings as any).tax_cgst ?? 6),
    sgst: Number((settings as any).tax_sgst ?? 6),
    showSplit: (settings as any).tax_show_split !== false,
  };

  const TABS: { key: TabKey; label: string; icon: string }[] = [
    { key: "branding", label: "Branding", icon: "🎨" },
    { key: "hero", label: "Hero & URL", icon: "🖼️" },
    { key: "contact", label: "Contact", icon: "📞" },
    { key: "about", label: "About", icon: "ℹ️" },
    { key: "amenities", label: "Amenities", icon: "✨" },
    { key: "gallery", label: "Gallery", icon: "📷" },
    { key: "testimonials", label: "Testimonials", icon: "⭐" },
    { key: "map", label: "Map", icon: "🗺️" },
    { key: "faq", label: "FAQ", icon: "❓" },
    { key: "rules", label: "Booking Rules", icon: "📋" },
    { key: "payment", label: "Payments", icon: "💳" },
    { key: "taxes", label: "Taxes", icon: "💰" },
    { key: "advanced", label: "Advanced", icon: "⚙️" },
    { key: "legal", label: "Legal", icon: "📜" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-6 mb-6 flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-2xl shadow-lg">🌐</div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Booking Engine</h1>
              <p className="text-sm text-slate-400 mt-0.5">Configure your direct booking website</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg hover:opacity-90 disabled:opacity-50 transition flex items-center gap-2"
          >
            {saving ? (
              <><span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> Saving...</>
            ) : (
              <>✓ Save Changes</>
            )}
          </button>
        </div>

        {/* Live Status */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${settings.is_enabled ? "bg-emerald-50" : "bg-slate-100"}`}>
              {settings.is_enabled ? "✓" : "⏸"}
            </div>
            <div>
              <p className="font-bold text-slate-800">{settings.is_enabled ? "Booking Engine is LIVE" : "Booking Engine is OFF"}</p>
              <p className="text-xs text-slate-500">{settings.is_enabled ? "Guests can book directly through your public page" : "Guests cannot book through the public page"}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => update("is_enabled", !settings.is_enabled)}
            className={`relative w-14 h-7 rounded-full transition-colors ${settings.is_enabled ? "bg-teal-500" : "bg-slate-300"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform ${settings.is_enabled ? "translate-x-7" : "translate-x-0"}`} />
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-slate-200 p-2 mb-6 flex gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-2 ${
                activeTab === tab.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="space-y-6">
          {/* BRANDING */}
          {activeTab === "branding" && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-800 mb-1">Branding</h3>
                <p className="text-xs text-slate-500">Customize the look and feel</p>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Theme Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={settings.theme_color || "#0f172a"}
                    onChange={(e) => update("theme_color", e.target.value)}
                    className="w-14 h-14 rounded-xl border-2 border-slate-200 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.theme_color || ""}
                    onChange={(e) => update("theme_color", e.target.value)}
                    className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm font-mono focus:border-teal-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Logo URL</label>
                <input type="url" value={settings.logo_url || ""} onChange={(e) => update("logo_url", e.target.value)} placeholder="https://..." className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none" />
              </div>
            </div>
          )}

          {/* HERO & URL */}
          {activeTab === "hero" && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800 mb-1">Public Booking URL</h3>
                  <p className="text-xs text-slate-500">The web address where guests book your hotel</p>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                    <span className="px-3 py-3 text-xs text-slate-400 font-mono bg-slate-100">book.staynexa.in/</span>
                    <input type="text" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} className="flex-1 px-4 py-3 text-sm font-medium outline-none bg-transparent" placeholder="my-hotel" />
                  </div>
                  <button onClick={handleSaveSlug} disabled={slugSaving} className="px-5 py-3 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 disabled:opacity-50">
                    {slugSaving ? "Saving..." : "Save URL"}
                  </button>
                </div>
                {slug && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1">Your Live URL</p>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <a href={getPublicBookingUrl(slug)} target="_blank" rel="noopener noreferrer" className="text-sm font-mono text-emerald-800 hover:underline break-all">
                        {getPublicBookingUrl(slug)}
                      </a>
                      <button onClick={() => { navigator.clipboard.writeText(getPublicBookingUrl(slug)); }} className="text-[10px] font-bold text-emerald-700 px-2 py-1 rounded bg-white border border-emerald-200">📋 Copy</button>
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Custom Domain (Optional)</label>
                  <input type="text" value={customDomain || ""} onChange={(e) => setCustomDomain(e.target.value)} placeholder="book.yourhotel.com" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none" />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                <h3 className="text-base font-bold text-slate-800">Hero Banner</h3>
                <ToggleRow label="Show Hero Banner" desc="Display a banner image at the top" value={settings.show_hero_banner !== false} onChange={(v) => update("show_hero_banner", v)} />
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Banner Image</label>
                  <div className="flex gap-2 mb-3">
                    <label className="px-4 py-3 bg-teal-600 text-white rounded-xl text-xs font-bold cursor-pointer hover:bg-teal-700 transition">
                      {uploadingHero ? "Uploading..." : "📤 Upload Image"}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleHeroUpload(e.target.files[0]); e.target.value = ""; }} />
                    </label>
                    <input type="url" value={settings.hero_banner_url || ""} onChange={(e) => update("hero_banner_url", e.target.value)} placeholder="or paste image URL..." className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none" />
                  </div>
                  {settings.hero_banner_url && (
                    <div className="relative h-40 rounded-xl overflow-hidden border border-slate-200">
                      <img src={settings.hero_banner_url} alt="Hero" className="w-full h-full object-cover" />
                      <button onClick={() => update("hero_banner_url", "")} className="absolute top-2 right-2 px-3 py-1.5 bg-rose-500 text-white rounded-lg text-[10px] font-bold">✕ Remove</button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Overlay Darkness: {Math.round((settings.hero_overlay_opacity || 0.6) * 100)}%</label>
                  <input type="range" min="0" max="100" value={Math.round((settings.hero_overlay_opacity || 0.6) * 100)} onChange={(e) => update("hero_overlay_opacity", Number(e.target.value) / 100)} className="w-full" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Hero Title</label>
                  <input type="text" value={settings.hero_title || ""} onChange={(e) => update("hero_title", e.target.value)} placeholder="Welcome to Our Hotel" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Hero Subtitle</label>
                  <input type="text" value={settings.hero_subtitle || ""} onChange={(e) => update("hero_subtitle", e.target.value)} placeholder="Experience comfort..." className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none" />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="text-base font-bold text-slate-800 mb-2">Embed on Your Website</h3>
                <p className="text-xs text-slate-500 mb-3">Copy this code and paste into your website HTML</p>
                <div className="flex gap-2">
                  <pre className="flex-1 p-4 bg-slate-900 text-slate-200 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">{getEmbedCode(slug)}</pre>
                  <button onClick={() => navigator.clipboard.writeText(getEmbedCode(slug))} className="px-4 py-3 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 shrink-0">📋 Copy</button>
                </div>
              </div>
            </div>
          )}

          {/* CONTACT */}
          {activeTab === "contact" && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-800">Contact Information</h3>
              <div><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Phone</label><input type="tel" value={settings.contact_phone || ""} onChange={(e) => update("contact_phone", e.target.value)} placeholder="+91 98765 43210" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none" /></div>
              <div><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Email</label><input type="email" value={settings.contact_email || ""} onChange={(e) => update("contact_email", e.target.value)} placeholder="stay@yourhotel.com" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none" /></div>
              <div><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Address</label><textarea value={settings.contact_address || ""} onChange={(e) => update("contact_address", e.target.value)} rows={3} placeholder="Hotel address..." className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm resize-none focus:border-teal-500 outline-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Facebook URL</label><input type="url" value={settings.facebook_url || ""} onChange={(e) => update("facebook_url", e.target.value)} placeholder="https://facebook.com/..." className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none" /></div>
                <div><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Instagram URL</label><input type="url" value={settings.instagram_url || ""} onChange={(e) => update("instagram_url", e.target.value)} placeholder="https://instagram.com/..." className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none" /></div>
              </div>
              <div><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">WhatsApp Number (with country code, no +)</label><input type="tel" value={settings.whatsapp_number || ""} onChange={(e) => update("whatsapp_number", e.target.value.replace(/\D/g, ""))} placeholder="919876543210" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Check-in Time</label><input type="text" value={settings.check_in_time || ""} onChange={(e) => update("check_in_time", e.target.value)} placeholder="12:00 PM" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none" /></div>
                <div><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Check-out Time</label><input type="text" value={settings.check_out_time || ""} onChange={(e) => update("check_out_time", e.target.value)} placeholder="11:00 AM" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none" /></div>
              </div>
              <div><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Footer Text</label><input type="text" value={settings.footer_text || ""} onChange={(e) => update("footer_text", e.target.value)} placeholder="© 2026 Your Hotel. All rights reserved." className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none" /></div>
            </div>
          )}

          {/* ABOUT */}
          {activeTab === "about" && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-800">About Section</h3>
              <ToggleRow label="Show About Section" desc="Display about section on booking page" value={settings.show_about_section !== false} onChange={(v) => update("show_about_section", v)} />
              <div><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Section Title</label><input type="text" value={settings.about_title || ""} onChange={(e) => update("about_title", e.target.value)} placeholder="About Us" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none" /></div>
              <div><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Description</label><textarea value={settings.about_description || ""} onChange={(e) => update("about_description", e.target.value)} rows={6} placeholder="Tell guests about your hotel..." className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm resize-none focus:border-teal-500 outline-none" /></div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">About Image</label>
                <div className="flex gap-2 mb-3">
                  <label className="px-4 py-3 bg-teal-600 text-white rounded-xl text-xs font-bold cursor-pointer hover:bg-teal-700">
                    {uploadingAbout ? "Uploading..." : "📤 Upload Image"}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleAboutUpload(e.target.files[0]); e.target.value = ""; }} />
                  </label>
                  <input type="url" value={settings.about_image_url || ""} onChange={(e) => update("about_image_url", e.target.value)} placeholder="or paste URL..." className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none" />
                </div>
                {settings.about_image_url && <img src={settings.about_image_url} alt="About" className="w-full h-40 object-cover rounded-xl border border-slate-200" />}
              </div>
            </div>
          )}

          {/* AMENITIES */}
          {activeTab === "amenities" && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-800">Amenities</h3>
              <ToggleRow label="Show Amenities Section" desc="Display amenities on booking page" value={settings.show_amenities_section !== false} onChange={(v) => update("show_amenities_section", v)} />
              <div className="flex gap-2">
                <input type="text" value={newAmenity} onChange={(e) => setNewAmenity(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newAmenity.trim()) { update("amenities", [...(settings.amenities || []), newAmenity.trim()]); setNewAmenity(""); } }} placeholder="e.g., Free WiFi, Pool, Spa" className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none" />
                <button onClick={() => { if (newAmenity.trim()) { update("amenities", [...(settings.amenities || []), newAmenity.trim()]); setNewAmenity(""); } }} className="px-5 py-3 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800">+ Add</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(settings.amenities || []).map((a, i) => (
                  <span key={i} className="inline-flex items-center gap-2 px-3 py-2 bg-teal-50 border border-teal-200 rounded-full text-xs font-bold text-teal-700">
                    {a}
                    <button onClick={() => update("amenities", settings.amenities!.filter((_, idx) => idx !== i))} className="w-4 h-4 rounded-full bg-teal-200 hover:bg-rose-200 text-teal-800 hover:text-rose-700 flex items-center justify-center text-xs">×</button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* GALLERY */}
          {activeTab === "gallery" && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-800">Photo Gallery</h3>
              <ToggleRow label="Show Gallery Section" desc="Display gallery on booking page" value={settings.show_gallery_section !== false} onChange={(v) => update("show_gallery_section", v)} />
              <div><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Gallery Title</label><input type="text" value={settings.gallery_title || ""} onChange={(e) => update("gallery_title", e.target.value)} placeholder="Photo Gallery" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none" /></div>
              <div className="flex gap-2">
                <label className="px-4 py-3 bg-teal-600 text-white rounded-xl text-xs font-bold cursor-pointer hover:bg-teal-700">
                  {uploadingGallery ? "Uploading..." : "📤 Upload Images"}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { handleGalleryUpload(e.target.files); e.target.value = ""; }} />
                </label>
                <input type="url" value={newGalleryImage} onChange={(e) => setNewGalleryImage(e.target.value)} placeholder="or paste image URL..." className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none" />
                <button onClick={() => { if (newGalleryImage.trim()) { update("gallery_images", [...(settings.gallery_images || []), newGalleryImage.trim()]); setNewGalleryImage(""); } }} className="px-5 py-3 bg-slate-900 text-white rounded-xl text-xs font-bold">+ Add</button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {(settings.gallery_images || []).map((url, i) => (
                  <div key={i} className="relative group rounded-xl overflow-hidden border border-slate-200">
                    <img src={url} alt="" className="w-full h-32 object-cover" />
                    <button onClick={() => update("gallery_images", settings.gallery_images!.filter((_, idx) => idx !== i))} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition">×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TESTIMONIALS */}
          {activeTab === "testimonials" && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-800">Guest Testimonials</h3>
              <ToggleRow label="Show Testimonials Section" desc="Display reviews on booking page" value={settings.show_testimonials !== false} onChange={(v) => update("show_testimonials", v)} />
              <div className="p-4 bg-slate-50 rounded-xl space-y-3">
                <input type="text" value={newTestimonial.name} onChange={(e) => setNewTestimonial({ ...newTestimonial, name: e.target.value })} placeholder="Guest Name" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none" />
                <select value={newTestimonial.rating} onChange={(e) => setNewTestimonial({ ...newTestimonial, rating: Number(e.target.value) })} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none">
                  {[5, 4, 3, 2, 1].map((r) => (<option key={r} value={r}>{"★".repeat(r)} ({r} star)</option>))}
                </select>
                <textarea value={newTestimonial.review} onChange={(e) => setNewTestimonial({ ...newTestimonial, review: e.target.value })} rows={3} placeholder="Guest review..." className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm resize-none focus:border-teal-500 outline-none" />
                <button onClick={() => { if (newTestimonial.name.trim() && newTestimonial.review.trim()) { update("testimonials", [...(settings.testimonials || []), newTestimonial]); setNewTestimonial({ name: "", review: "", rating: 5 }); } }} className="w-full py-2.5 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-700">+ Add Testimonial</button>
              </div>
              <div className="space-y-2">
                {(settings.testimonials || []).map((t: any, i: number) => (
                  <div key={i} className="p-4 bg-slate-50 rounded-xl flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{t.name} <span className="text-amber-500">{"★".repeat(t.rating || 5)}</span></p>
                      <p className="text-xs text-slate-600 mt-1 italic">"{t.review}"</p>
                    </div>
                    <button onClick={() => update("testimonials", settings.testimonials!.filter((_, idx) => idx !== i))} className="text-rose-500 hover:text-rose-700 text-lg">×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MAP */}
          {activeTab === "map" && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-800">Location Map</h3>
              <ToggleRow label="Show Map Section" desc="Display Google Map on booking page" value={settings.show_map !== false} onChange={(v) => update("show_map", v)} />
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 leading-relaxed">
                💡 Go to Google Maps → search your hotel → Share → Embed a map → copy the full &lt;iframe&gt; URL
              </div>
              <textarea value={settings.map_embed_url || ""} onChange={(e) => update("map_embed_url", e.target.value)} rows={3} placeholder='<iframe src="https://www.google.com/maps/embed?..." ></iframe>' className="w-full px-4 py-3 border border-slate-200 rounded-xl text-xs font-mono resize-none focus:border-teal-500 outline-none" />
            </div>
          )}

          {/* FAQ */}
          {activeTab === "faq" && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-800">FAQ</h3>
              <ToggleRow label="Show FAQ Section" desc="Display FAQ on booking page" value={settings.show_faq === true} onChange={(v) => update("show_faq", v)} />
              <div className="p-4 bg-slate-50 rounded-xl space-y-3">
                <input type="text" value={newFaqQ} onChange={(e) => setNewFaqQ(e.target.value)} placeholder="Question (e.g., What is the check-in time?)" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none" />
                <textarea value={newFaqA} onChange={(e) => setNewFaqA(e.target.value)} rows={2} placeholder="Answer..." className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm resize-none focus:border-teal-500 outline-none" />
                <button onClick={() => { if (newFaqQ.trim() && newFaqA.trim()) { update("faqs", [...(settings.faqs || []), { question: newFaqQ, answer: newFaqA }]); setNewFaqQ(""); setNewFaqA(""); } }} className="w-full py-2.5 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-700">+ Add FAQ</button>
              </div>
              <div className="space-y-2">
                {(settings.faqs || []).map((f: any, i: number) => (
                  <div key={i} className="p-4 bg-slate-50 rounded-xl flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{f.question}</p>
                      <p className="text-xs text-slate-600 mt-1">{f.answer}</p>
                    </div>
                    <button onClick={() => update("faqs", settings.faqs!.filter((_, idx) => idx !== i))} className="text-rose-500 hover:text-rose-700 text-lg">×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* BOOKING RULES */}
          {activeTab === "rules" && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800 mb-1">Room Display</h3>
                  <p className="text-xs text-slate-500">Control how rooms appear on the booking engine</p>
                </div>
                <ToggleRow
                  label="Show Room Details"
                  desc="Display room photos, descriptions, and amenities"
                  value={settings.show_rooms !== false}
                  onChange={(v) => update("show_rooms", v)}
                />
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800 mb-1">Payment Options</h3>
                  <p className="text-xs text-slate-500">
                    Enable/disable payment methods guests can choose at checkout
                  </p>
                </div>

                <div className="space-y-3">
                  <ToggleRow
                    label="💳 Full Payment"
                    desc="Guest pays entire amount online at booking"
                    value={settings.show_full_payment !== false}
                    onChange={(v) => update("show_full_payment", v)}
                  />

                  <ToggleRow
                    label="💰 Partial Payment (Advance)"
                    desc="Guest pays advance now, rest at check-in"
                    value={settings.show_partial_payment !== false}
                    onChange={(v) => update("show_partial_payment", v)}
                  />

                  {settings.show_partial_payment !== false && (
                    <div className="pl-12 pr-2 pb-2 space-y-3 border-l-2 border-teal-200 ml-4">
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                          Advance Percentage (%)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="99"
                          value={settings.partial_payment_pct}
                          onChange={(e) => update("partial_payment_pct", Number(e.target.value))}
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">
                          Guest pays {settings.partial_payment_pct}% now, {100 - settings.partial_payment_pct}% at check-in
                        </p>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                          Label (shown to guest)
                        </label>
                        <input
                          type="text"
                          value={settings.partial_payment_label || "Pay Advance"}
                          onChange={(e) => update("partial_payment_label", e.target.value)}
                          placeholder="Pay Advance"
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <ToggleRow
                    label="🏨 Pay at Property"
                    desc="Guest pays entire amount at check-in"
                    value={settings.show_pay_at_property !== false}
                    onChange={(v) => update("show_pay_at_property", v)}
                  />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800 mb-1">Booking Window</h3>
                  <p className="text-xs text-slate-500">How far in advance guests can book</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                      Min Advance Days
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={settings.min_advance_days}
                      onChange={(e) => update("min_advance_days", Number(e.target.value))}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                      Max Advance Days
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={settings.max_advance_days}
                      onChange={(e) => update("max_advance_days", Number(e.target.value))}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PAYMENT */}
          {activeTab === "payment" && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-800">Online Payments</h3>
              <ToggleRow label="Enable Online Payment" desc="Require guests to pay when booking" value={settings.payment_enabled === true} onChange={(v) => update("payment_enabled", v)} />
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Payment Gateway</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { k: "none", l: "None", i: "🚫" },
                    { k: "razorpay", l: "Razorpay", i: "💳" },
                    { k: "cashfree", l: "Cashfree", i: "💵" },
                    { k: "upi_qr", l: "UPI QR", i: "📱" },
                  ].map((g) => (
                    <button key={g.k} onClick={() => update("payment_gateway", g.k as any)} className={`p-3 rounded-xl border-2 text-center transition ${settings.payment_gateway === g.k ? "border-teal-500 bg-teal-50" : "border-slate-200 hover:border-slate-300"}`}>
                      <div className="text-xl mb-1">{g.i}</div>
                      <p className="text-[10px] font-bold text-slate-700">{g.l}</p>
                    </button>
                  ))}
                </div>
              </div>
              {settings.payment_gateway === "upi_qr" && (
                <>
                  <div><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">UPI ID (VPA)</label><input type="text" value={settings.upi_id || ""} onChange={(e) => update("upi_id", e.target.value)} placeholder="yourname@paytm" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none" /></div>
                  <div><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">UPI QR Image URL (Optional)</label><input type="url" value={settings.upi_qr_url || ""} onChange={(e) => update("upi_qr_url", e.target.value)} placeholder="https://... your qr.png" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none" /></div>
                </>
              )}
              {settings.payment_gateway === "razorpay" && (
                <>
                  <div><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Razorpay Key ID</label><input type="text" value={settings.razorpay_key_id || ""} onChange={(e) => update("razorpay_key_id", e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none" /></div>
                  <div><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Razorpay Key Secret</label><input type="password" value={settings.razorpay_key_secret || ""} onChange={(e) => update("razorpay_key_secret", e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none" /></div>
                </>
              )}
              {settings.payment_gateway === "cashfree" && (
                <>
                  <div><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Cashfree App ID</label><input type="text" value={settings.cashfree_app_id || ""} onChange={(e) => update("cashfree_app_id", e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none" /></div>
                  <div><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Cashfree Secret Key</label><input type="password" value={settings.cashfree_secret_key || ""} onChange={(e) => update("cashfree_secret_key", e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none" /></div>
                </>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════ */}
          {/* 🆕 TAXES TAB */}
          {/* ═══════════════════════════════════════════ */}
          {activeTab === "taxes" && (
            <div className="space-y-6">
              {/* Enable Toggle */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Enable Tax</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Show and apply tax on all bookings
                    </p>
                  </div>
                  <button
                    onClick={() => update("tax_enabled", !tax.enabled)}
                    className={`relative w-14 h-8 rounded-full transition ${tax.enabled ? "bg-teal-500" : "bg-slate-300"}`}
                  >
                    <span className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${tax.enabled ? "left-7" : "left-1"}`} />
                  </button>
                </div>
              </div>

              {tax.enabled && (
                <>
                  {/* Quick Presets */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-6">
                    <h3 className="text-base font-bold text-slate-800 mb-1">Quick Presets</h3>
                    <p className="text-xs text-slate-500 mb-4">Common Indian GST slabs for hotel rooms</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <button
                        onClick={() => {
                          update("tax_rate", 12);
                          update("tax_cgst", 6);
                          update("tax_sgst", 6);
                          update("tax_label", "GST");
                          update("tax_show_split", true);
                        }}
                        className={`p-4 rounded-xl border-2 transition text-left ${tax.rate === 12 && tax.showSplit ? "border-teal-500 bg-teal-50" : "border-slate-200 hover:border-slate-300"}`}
                      >
                        <p className="text-lg font-bold text-slate-900">12%</p>
                        <p className="text-[10px] text-slate-500 mt-1">6% + 6%</p>
                        <p className="text-[10px] text-slate-500">Rooms ≤ ₹7,500</p>
                      </button>
                      <button
                        onClick={() => {
                          update("tax_rate", 18);
                          update("tax_cgst", 9);
                          update("tax_sgst", 9);
                          update("tax_label", "GST");
                          update("tax_show_split", true);
                        }}
                        className={`p-4 rounded-xl border-2 transition text-left ${tax.rate === 18 && tax.showSplit ? "border-teal-500 bg-teal-50" : "border-slate-200 hover:border-slate-300"}`}
                      >
                        <p className="text-lg font-bold text-slate-900">18%</p>
                        <p className="text-[10px] text-slate-500 mt-1">9% + 9%</p>
                        <p className="text-[10px] text-slate-500">Rooms &gt; ₹7,500</p>
                      </button>
                      <button
                        onClick={() => {
                          update("tax_rate", 5);
                          update("tax_cgst", 2.5);
                          update("tax_sgst", 2.5);
                          update("tax_label", "GST");
                          update("tax_show_split", true);
                        }}
                        className={`p-4 rounded-xl border-2 transition text-left ${tax.rate === 5 && tax.showSplit ? "border-teal-500 bg-teal-50" : "border-slate-200 hover:border-slate-300"}`}
                      >
                        <p className="text-lg font-bold text-slate-900">5%</p>
                        <p className="text-[10px] text-slate-500 mt-1">2.5% + 2.5%</p>
                        <p className="text-[10px] text-slate-500">Budget rooms</p>
                      </button>
                      <button
                        onClick={() => {
                          update("tax_rate", 0);
                          update("tax_cgst", 0);
                          update("tax_sgst", 0);
                          update("tax_show_split", false);
                        }}
                        className={`p-4 rounded-xl border-2 transition text-left ${tax.rate === 0 ? "border-teal-500 bg-teal-50" : "border-slate-200 hover:border-slate-300"}`}
                      >
                        <p className="text-lg font-bold text-slate-900">0%</p>
                        <p className="text-[10px] text-slate-500 mt-1">No tax</p>
                      </button>
                    </div>
                  </div>

                  {/* Custom Config */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
                    <h3 className="text-base font-bold text-slate-800">Custom Configuration</h3>

                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                        Total Tax Rate (%)
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          value={tax.rate}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value) || 0;
                            update("tax_rate", v);
                            if (tax.showSplit) {
                              update("tax_cgst", v / 2);
                              update("tax_sgst", v / 2);
                            }
                          }}
                          min={0}
                          max={30}
                          step={0.5}
                          className="flex-1 px-4 py-3 border-2 border-slate-200 rounded-xl text-lg font-bold outline-none focus:border-teal-500"
                        />
                        <span className="text-2xl font-bold text-slate-400">%</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                        Tax Label
                      </label>
                      <input
                        type="text"
                        value={tax.label}
                        onChange={(e) => update("tax_label", e.target.value)}
                        placeholder="GST"
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500"
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                      <div>
                        <p className="text-sm font-bold text-slate-800">Show CGST / SGST Split</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Show tax as two components in booking engine
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          update("tax_show_split", !tax.showSplit);
                          if (!tax.showSplit) {
                            update("tax_cgst", tax.rate / 2);
                            update("tax_sgst", tax.rate / 2);
                          }
                        }}
                        className={`relative w-12 h-7 rounded-full transition ${tax.showSplit ? "bg-teal-500" : "bg-slate-300"}`}
                      >
                        <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${tax.showSplit ? "left-6" : "left-1"}`} />
                      </button>
                    </div>

                    {tax.showSplit && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">CGST (%)</label>
                          <input
                            type="number"
                            value={tax.cgst}
                            onChange={(e) => update("tax_cgst", parseFloat(e.target.value) || 0)}
                            min={0}
                            max={15}
                            step={0.5}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-teal-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">SGST (%)</label>
                          <input
                            type="number"
                            value={tax.sgst}
                            onChange={(e) => update("tax_sgst", parseFloat(e.target.value) || 0)}
                            min={0}
                            max={15}
                            step={0.5}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-teal-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Live Preview */}
                  <div className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-2xl border-2 border-teal-200 p-6">
                    <h3 className="text-sm font-bold text-slate-900 mb-3">
                      📊 Live Preview (Sample ₹1,000 Booking)
                    </h3>
                    <div className="bg-white rounded-xl p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Room Subtotal</span>
                        <span className="font-semibold">₹1,000.00</span>
                      </div>
                      {tax.showSplit ? (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500">CGST ({tax.cgst}%)</span>
                            <span className="font-semibold">₹{((1000 * tax.cgst) / 100).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500">SGST ({tax.sgst}%)</span>
                            <span className="font-semibold">₹{((1000 * tax.sgst) / 100).toFixed(2)}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">{tax.label} ({tax.rate}%)</span>
                          <span className="font-semibold">₹{((1000 * tax.rate) / 100).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-base pt-2 border-t border-slate-200">
                        <span className="font-bold">Total</span>
                        <span className="font-bold text-teal-700">
                          ₹{(1000 + (1000 * tax.rate) / 100).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ADVANCED */}
          {activeTab === "advanced" && (
            <AdvancedBookingSettings settings={settings} setSettings={setSettings as any} />
          )}

          {/* LEGAL */}
          {activeTab === "legal" && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-800">Legal Pages</h3>
              <div><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Terms URL</label><input type="url" value={settings.terms_url || ""} onChange={(e) => update("terms_url", e.target.value)} placeholder="https://yoursite.com/terms" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none" /></div>
              <div><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Privacy URL</label><input type="url" value={settings.privacy_url || ""} onChange={(e) => update("privacy_url", e.target.value)} placeholder="https://yoursite.com/privacy" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-teal-500 outline-none" /></div>
            </div>
          )}
        </div>

        {/* Save Button (bottom) */}
        <div className="sticky bottom-4 mt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-4 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-2xl text-sm font-bold shadow-xl hover:opacity-90 disabled:opacity-50 transition"
          >
            {saving ? "Saving..." : "✓ Save All Changes"}
          </button>
        </div>
      </div>

      {saved && (
        <div className="fixed bottom-6 right-6 bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-50">
          <span className="text-lg">✓</span>
          <span className="text-sm font-semibold">Saved successfully!</span>
        </div>
      )}
    </div>
  );
}
