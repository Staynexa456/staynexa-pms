// app/components/AdvancedBookingSettings.tsx
"use client";

import React from "react";

type Settings = {
  terms_and_conditions?: string | null;
  show_terms_checkbox?: boolean;
  show_coupon_code?: boolean;
  show_price_breakdown?: boolean;
  ssl_badge_text?: string | null;
  pci_badge_text?: string | null;
  discount_badge_enabled?: boolean;
  [key: string]: any;
};

interface Props {
  settings: Settings;
  setSettings: (s: Settings) => void;
}

function ToggleRow({
  icon, label, desc, value, onChange,
}: {
  icon: string; label: string; desc: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-slate-100 last:border-b-0">
      <div className="flex items-start gap-3 flex-1">
        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-base shrink-0">{icon}</div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${value ? "bg-teal-500" : "bg-slate-300"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${value ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

export default function AdvancedBookingSettings({ settings, setSettings }: Props) {
  const update = (key: string, value: any) => setSettings({ ...settings, [key]: value });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xl shadow-md">⚙️</div>
        <div>
          <h3 className="text-base font-bold text-slate-800">Advanced Booking Options</h3>
          <p className="text-xs text-slate-500">Terms, coupons, badges, and checkout experience</p>
        </div>
      </div>

      {/* Toggles */}
      <div>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Checkout Features</p>
        <div className="bg-slate-50/50 rounded-xl px-4">
          <ToggleRow icon="📜" label="Terms & Conditions Checkbox" desc="Guest must accept your hotel's terms before booking" value={settings.show_terms_checkbox !== false} onChange={(v) => update("show_terms_checkbox", v)} />
          <ToggleRow icon="🎟️" label="Coupon Code Field" desc="Allow guests to apply promo codes at checkout" value={settings.show_coupon_code !== false} onChange={(v) => update("show_coupon_code", v)} />
          <ToggleRow icon="💰" label="Price Breakdown Display" desc="Show detailed price breakdown to guest" value={settings.show_price_breakdown !== false} onChange={(v) => update("show_price_breakdown", v)} />
          <ToggleRow icon="🏷️" label="Discount Badge" desc='Show "30% off" style badge when discounts apply' value={settings.discount_badge_enabled !== false} onChange={(v) => update("discount_badge_enabled", v)} />
        </div>
      </div>

      {/* Terms Text */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Terms & Conditions Text</label>
          <span className="text-[10px] text-slate-400">{(settings.terms_and_conditions || "").length} chars</span>
        </div>
        <textarea
          value={settings.terms_and_conditions || ""}
          onChange={(e) => update("terms_and_conditions", e.target.value)}
          rows={6}
          placeholder="Enter your hotel's terms and conditions..."
          className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-slate-800 resize-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none transition leading-relaxed"
        />
        <p className="text-[11px] text-slate-400 mt-2">💡 Include check-in/out times, cancellation, smoking rules, and damage charges.</p>
      </div>

      {/* Trust Badges */}
      <div>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Trust Badges (shown at checkout)</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-600 mb-1.5 block">🔒 SSL Badge Text</label>
            <input type="text" value={settings.ssl_badge_text || ""} onChange={(e) => update("ssl_badge_text", e.target.value)} placeholder="SECURE SSL ENCRYPTION" maxLength={40} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:border-teal-500 outline-none uppercase tracking-wider" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-600 mb-1.5 block">🛡️ PCI Badge Text</label>
            <input type="text" value={settings.pci_badge_text || ""} onChange={(e) => update("pci_badge_text", e.target.value)} placeholder="PCI DSS COMPLIANT" maxLength={40} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:border-teal-500 outline-none uppercase tracking-wider" />
          </div>
        </div>
      </div>

      {/* Live Preview */}
      <div className="pt-2">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Live Preview</p>
        <div className="bg-slate-900 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] uppercase tracking-wider text-slate-400">Price Breakdown</span>
            {settings.discount_badge_enabled !== false && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white uppercase">30% off</span>
            )}
          </div>
          <div className="flex justify-between text-sm py-1">
            <span className="text-slate-400">Rooms (1 night)</span>
            <span>₹2,000</span>
          </div>
          {settings.discount_badge_enabled !== false && (
            <div className="flex justify-between text-sm text-emerald-400 py-1">
              <span>🎉 Promotional Offer</span>
              <span>-₹600</span>
            </div>
          )}
          <div className="flex justify-between text-sm py-1">
            <span className="text-slate-400">Taxes & Fees</span>
            <span>₹73.50</span>
          </div>
          <div className="flex justify-between pt-3 mt-2 border-t border-white/10">
            <span className="text-[11px] uppercase tracking-wider text-slate-300 font-bold">Total Amount</span>
            <span className="font-bold text-xl">₹1,473.50</span>
          </div>
          <div className="pt-3 mt-2 border-t border-white/10 flex items-center justify-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-400 uppercase tracking-wider">🔒 {settings.ssl_badge_text || "SECURE SSL ENCRYPTION"}</span>
            <span className="text-white/20">·</span>
            <span className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-400 uppercase tracking-wider">🛡️ {settings.pci_badge_text || "PCI DSS COMPLIANT"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
