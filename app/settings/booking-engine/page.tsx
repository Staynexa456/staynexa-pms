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
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const bannerFileRef = useRef<HTMLInputElement>(null);

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
    if (!cleanSlug) {
      showToast("⚠ Slug cannot be empty");
      return;
    }
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

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !hotelId) return;

    setUploadingBanner(true);
    try {
      const publicUrl = await uploadHeroBanner(file, hotelId);
      update({ hero_banner_url: publicUrl });
      showToast("✅ Banner uploaded successfully");
    } catch (err: any) {
      showToast(`⚠ ${err?.message || "Upload failed"}`);
    } finally {
      setUploadingBanner(false);
      if (bannerFileRef.current) bannerFileRef.current.value = "";
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
      {/* Status Banner */}
      <div
        className={`mb-5 p-5 rounded-2xl border-2 flex items-start gap-4 ${
          settings.is_enabled
            ? "bg-emerald-50 border-emerald-200"
            : "bg-amber-50 border-amber-200"
        }`}
      >
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${
            settings.is_enabled
              ? "bg-emerald-100 text-emerald-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {settings.is_enabled ? "✓" : "⏸"}
        </div>
        <div className="flex-1">
          <p className={`text-sm font-bold ${settings.is_enabled ? "text-emerald-800" : "text-amber-800"}`}>
            {settings.is_enabled ? "Booking Engine is LIVE" : "Booking Engine is paused"}
          </p>
          <p className={`text-xs mt-0.5 ${settings.is_enabled ? "text-emerald-700" : "text-amber-700"}`}>
            {settings.is_enabled
              ? "Guests can book directly through your public page"
              : "Enable below to accept online bookings"}
          </p>
        </div>
        <Toggle value={settings.is_enabled} onChange={(v) => update({ is_enabled: v })} />
      </div>

      {/* Public URL */}
      <SettingCard title="Public Booking URL" description="The web address where guests can book your hotel">
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
            Hotel Slug
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden focus-within:border-teal-500">
              <span className="px-3 py-3 text-xs text-slate-400 font-mono bg-slate-100 border-r border-slate-200">
                book.staynexa.in/
              </span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                placeholder="vishara-elite"
                className="flex-1 px-3 py-3 bg-transparent text-sm outline-none font-mono"
              />
            </div>
            <button
              onClick={handleSaveSlug}
              disabled={savingSlug || slug === savedSlug}
              className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold disabled:opacity-40 transition shrink-0"
            >
              {savingSlug ? "Saving..." : "Save URL"}
            </button>
          </div>
        </div>

        {savedSlug && (
          <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl">
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">Your Live URL</p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => copyToClipboard(publicUrl, "URL")}
                  className="px-3 py-1.5 bg-white hover:bg-teal-100 border border-teal-200 rounded-lg text-[10px] font-bold text-teal-700 transition"
                >
                  {copied === "URL" ? "✓ Copied" : "📋 Copy"}
                </button>
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[10px] font-bold transition"
                >
                  🔗 Open
                </a>
              </div>
            </div>
            <p className="text-sm font-mono text-teal-800 break-all">{publicUrl}</p>
          </div>
        )}

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
            Custom Domain (Optional)
          </label>
          <input
            type="text"
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
            placeholder="book.yourhotel.com"
            className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500 font-mono"
          />
        </div>
      </SettingCard>

      {/* Hero Banner */}
      <SettingCard title="Hero Banner" description="Show a full-width banner image at the top of your booking page">
        <SettingRow label="Show Hero Banner" description="Display a banner image on the booking page">
          <Toggle value={heroBannerEnabled} onChange={(v) => update({ show_hero_banner: v })} />
        </SettingRow>

        {heroBannerEnabled && (
          <>
            <div className="pt-3 border-t border-slate-100 space-y-4">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Banner Image
              </label>

              <div className="flex flex-col md:flex-row gap-3 md:items-center">
                <div>
                  <input
                    ref={bannerFileRef}
                    type="file"
                    accept="image/*"
                    onChange={handleBannerUpload}
                    className="hidden"
                    id="banner-upload"
                  />
                  <label
                    htmlFor="banner-upload"
                    className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                      uploadingBanner
                        ? "bg-slate-200 text-slate-400 cursor-wait"
                        : "bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
                    }`}
                  >
                    {uploadingBanner ? (
                      <>
                        <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>📤 Upload Image</>
                    )}
                  </label>
                </div>

                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
                  — or —
                </span>

                <div className="flex-1">
                  <input
                    type="text"
                    value={settings.hero_banner_url || ""}
                    onChange={(e) => update({ hero_banner_url: e.target.value })}
                    placeholder="Paste image URL here..."
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <p className="text-[10px] text-slate-400">
                Upload a file (max 5MB) or paste a direct image URL.
              </p>

              {settings.hero_banner_url && (
                <button
                  onClick={() => update({ hero_banner_url: "" })}
                  className="text-xs text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1"
                >
                  🗑 Remove current banner
                </button>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Overlay Darkness: {Math.round((settings.hero_overlay_opacity || 0.6) * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.hero_overlay_opacity || 0.6}
                onChange={(e) => update({ hero_overlay_opacity: Number(e.target.value) })}
                className="w-full accent-slate-900"
              />
            </div>

            {settings.hero_banner_url && (
              <div className="pt-3 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Banner Preview
                </p>
                <div className="rounded-xl overflow-hidden border border-slate-200">
                  <div className="relative h-40 bg-slate-100">
                    <img
                      src={settings.hero_banner_url}
                      alt="Banner preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    <div
                      className="absolute inset-0"
                      style={{
                        background: `rgba(15,23,42,${settings.hero_overlay_opacity || 0.6})`,
                      }}
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                      <p className="text-[9px] tracking-[0.3em] uppercase text-white/70 mb-1">
                        Welcome to
                      </p>
                      <p className="text-white text-lg font-serif font-semibold">
                        {settings.hero_title || "Your Hotel"}
                      </p>
                      <p className="text-white/70 text-[10px] italic mt-1">
                        {settings.hero_subtitle || "An unforgettable stay"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {!heroBannerEnabled && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl mt-3">
            <p className="text-[11px] text-slate-600">
              ℹ️ Hero banner is turned off. Booking page will show a clean gradient hero instead.
            </p>
          </div>
        )}
      </SettingCard>

      {/* Branding */}
      <SettingCard title="Branding" description="Customize look and feel of your booking page">
        <SettingRow label="Theme Color" description="Primary color for buttons and highlights">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={settings.theme_color}
              onChange={(e) => update({ theme_color: e.target.value })}
              className="w-12 h-10 rounded-xl border border-slate-200 cursor-pointer"
            />
            <span className="text-xs font-mono text-slate-500">{settings.theme_color}</span>
          </div>
        </SettingRow>

        <SettingRow label="Logo URL" description="Your hotel logo (max 200×60px)">
          <Input
            value={settings.logo_url || ""}
            onChange={(v) => update({ logo_url: v })}
            placeholder="https://..."
          />
        </SettingRow>

        <div className="pt-2 border-t border-slate-100">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
            Hero Title
          </label>
          <input
            type="text"
            value={settings.hero_title || ""}
            onChange={(e) => update({ hero_title: e.target.value })}
            placeholder="Welcome to Our Hotel"
            className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
            Hero Subtitle
          </label>
          <input
            type="text"
            value={settings.hero_subtitle || ""}
            onChange={(e) => update({ hero_subtitle: e.target.value })}
            placeholder="Experience comfort and hospitality"
            className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500"
          />
        </div>
      </SettingCard>

      {/* Contact Info */}
      <SettingCard title="Contact Information" description="Displayed on the booking page footer">
        <SettingRow label="Phone">
          <Input value={settings.contact_phone || ""} onChange={(v) => update({ contact_phone: v })} placeholder="+91 98765 43210" />
        </SettingRow>
        <SettingRow label="Email">
          <Input value={settings.contact_email || ""} onChange={(v) => update({ contact_email: v })} placeholder="bookings@hotel.com" />
        </SettingRow>
        <div className="pt-2 border-t border-slate-100">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
            Address
          </label>
          <TextArea
            value={settings.contact_address || ""}
            onChange={(v) => update({ contact_address: v })}
            placeholder="Hotel street, city, state, PIN"
            rows={2}
          />
        </div>
      </SettingCard>

      {/* Booking Rules */}
      <SettingCard title="Booking Rules" description="Control how guests can book">
        <SettingRow label="Show Room Details" description="Display room photos, descriptions, and amenities">
          <Toggle value={settings.show_rooms} onChange={(v) => update({ show_rooms: v })} />
        </SettingRow>
        <SettingRow label="Allow Partial Payment" description="Guest pays advance, rest at check-in">
          <Toggle value={settings.allow_partial_payment} onChange={(v) => update({ allow_partial_payment: v })} />
        </SettingRow>
        {settings.allow_partial_payment && (
          <SettingRow label="Partial Payment %" description="Advance percentage">
            <Input
              type="number"
              value={settings.partial_payment_pct}
              onChange={(v) => update({ partial_payment_pct: Number(v) || 0 })}
              suffix="%"
            />
          </SettingRow>
        )}
        <SettingRow label="Min Advance Days" description="How far in advance can book">
          <Input
            type="number"
            value={settings.min_advance_days}
            onChange={(v) => update({ min_advance_days: Number(v) || 0 })}
            suffix="days"
          />
        </SettingRow>
        <SettingRow label="Max Advance Days" description="Booking window limit">
          <Input
            type="number"
            value={settings.max_advance_days}
            onChange={(v) => update({ max_advance_days: Number(v) || 365 })}
            suffix="days"
          />
        </SettingRow>
      </SettingCard>

      {/* Payment Gateway */}
      <SettingCard title="Payment Gateway" description="Accept online payments via Razorpay">
        <SettingRow label="Require Online Payment" description="Guest must pay to confirm">
          <Toggle value={settings.require_payment} onChange={(v) => update({ require_payment: v })} />
        </SettingRow>
        {settings.require_payment && (
          <>
            <SettingRow label="Razorpay Key ID" description="Public key from Razorpay dashboard">
              <Input
                value={settings.razorpay_key_id || ""}
                onChange={(v) => update({ razorpay_key_id: v })}
                placeholder="rzp_live_..."
              />
            </SettingRow>
            <SettingRow label="Razorpay Key Secret" description="Secret key (keep safe)">
              <Input
                type="password"
                value={settings.razorpay_key_secret || ""}
                onChange={(v) => update({ razorpay_key_secret: v })}
                placeholder="••••••••"
              />
            </SettingRow>
          </>
        )}
      </SettingCard>

      {/* Embed Code */}
      {savedSlug && (
        <SettingCard title="Embed on Your Website" description="Copy this code and paste into your website HTML">
          <div className="relative">
            <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono overflow-x-auto whitespace-pre-wrap break-all">
              {embedCode}
            </pre>
            <button
              onClick={() => copyToClipboard(embedCode, "Embed code")}
              className="absolute top-3 right-3 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10px] font-bold backdrop-blur transition"
            >
              {copied === "Embed code" ? "✓ Copied" : "📋 Copy"}
            </button>
          </div>
        </SettingCard>
      )}

      {/* Legal */}
      <SettingCard title="Legal Pages" description="Links shown on booking footer">
        <SettingRow label="Terms URL">
          <Input value={settings.terms_url || ""} onChange={(v) => update({ terms_url: v })} placeholder="https://yoursite.com/terms" />
        </SettingRow>
        <SettingRow label="Privacy URL">
          <Input value={settings.privacy_url || ""} onChange={(v) => update({ privacy_url: v })} placeholder="https://yoursite.com/privacy" />
        </SettingRow>
      </SettingCard>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl text-sm font-semibold z-[100] shadow-2xl">
          {toast}
        </div>
      )}
    </SettingsLayout>
  );
}
