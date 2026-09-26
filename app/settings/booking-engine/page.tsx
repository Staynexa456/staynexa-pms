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
    if (!hotelId) {
      setLoading(false);
      return;
    }
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
              <p className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">
                Your Live URL
              </p>
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
                    {uploadingBanner ? "Uploading..." : "📤 Upload Image"}
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

              {settings.hero_banner_url && (
                <button
                  onClick={() => update({ hero_banner_url: "" })}
                  className="text-xs text-rose-600 hover:text-rose-800 font-bold"
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
              ℹ️ Hero banner is turned off. Booking page will show a clean gradient hero.
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

      {/* Online Payments */}
      <SettingCard
        title="Online Payments"
        description="Accept bookings with online payment. Your guests pay directly to your account."
      >
        <SettingRow
          label="Enable Online Payment"
          description="Require guests to pay when booking"
        >
          <Toggle
            value={settings.payment_enabled || false}
            onChange={(v) => update({ payment_enabled: v })}
          />
        </SettingRow>

        {settings.payment_enabled && (
          <>
            <div className="pt-3 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                Choose Payment Gateway
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { id: "none", label: "None", icon: "🚫" },
                  { id: "razorpay", label: "Razorpay", icon: "💳" },
                  { id: "cashfree", label: "Cashfree", icon: "🏦" },
                  { id: "upi_qr", label: "UPI QR", icon: "📱" },
                ].map((gw) => (
                  <button
                    key={gw.id}
                    onClick={() => update({ payment_gateway: gw.id as any })}
                    className={`p-3 rounded-xl border-2 text-center transition ${
                      settings.payment_gateway === gw.id
                        ? "border-teal-500 bg-teal-50"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="text-2xl mb-1">{gw.icon}</div>
                    <div className="text-xs font-bold text-slate-700">{gw.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                Payment Amount
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "full", label: "Full Amount" },
                  { id: "advance", label: "Advance Only" },
                  { id: "partial", label: "Partial" },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => update({ payment_amount_type: t.id as any })}
                    className={`p-2.5 rounded-xl border-2 text-xs font-bold transition ${
                      settings.payment_amount_type === t.id
                        ? "border-teal-500 bg-teal-50 text-teal-700"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {settings.payment_amount_type === "advance" && (
                <div className="mt-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                    Advance Percentage: {settings.advance_percentage || 100}%
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={settings.advance_percentage || 100}
                    onChange={(e) => update({ advance_percentage: Number(e.target.value) })}
                    className="w-full accent-teal-600"
                  />
                </div>
              )}
            </div>

            {settings.payment_gateway === "razorpay" && (
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                    Razorpay Key ID
                  </label>
                  <input
                    type="text"
                    value={settings.razorpay_key_id || ""}
                    onChange={(e) => update({ razorpay_key_id: e.target.value })}
                    placeholder="rzp_live_xxxxxxxxxxxx"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                    Razorpay Key Secret
                  </label>
                  <input
                    type="password"
                    value={settings.razorpay_key_secret || ""}
                    onChange={(e) => update({ razorpay_key_secret: e.target.value })}
                    placeholder="••••••••••••••"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500 font-mono"
                  />
                </div>
              </div>
            )}

            {settings.payment_gateway === "cashfree" && (
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                    Cashfree App ID
                  </label>
                  <input
                    type="text"
                    value={settings.cashfree_app_id || ""}
                    onChange={(e) => update({ cashfree_app_id: e.target.value })}
                    placeholder="CF_xxxxxxxxxxxx"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                    Cashfree Secret Key
                  </label>
                  <input
                    type="password"
                    value={settings.cashfree_secret_key || ""}
                    onChange={(e) => update({ cashfree_secret_key: e.target.value })}
                    placeholder="••••••••••••••"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500 font-mono"
                  />
                </div>
              </div>
            )}

            {settings.payment_gateway === "upi_qr" && (
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
                  <p className="text-[11px] text-purple-800 font-medium">
                    💡 Guests will scan your UPI QR code. You'll verify payment manually.
                  </p>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                    UPI ID (VPA)
                  </label>
                  <input
                    type="text"
                    value={settings.upi_id || ""}
                    onChange={(e) => update({ upi_id: e.target.value })}
                    placeholder="yourhotel@okhdfcbank"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                    UPI QR Code Image URL (Optional)
                  </label>
                  <input
                    type="text"
                    value={settings.upi_qr_url || ""}
                    onChange={(e) => update({ upi_qr_url: e.target.value })}
                    placeholder="https://... your-qr.png"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500"
                  />
                </div>
              </div>
            )}
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
