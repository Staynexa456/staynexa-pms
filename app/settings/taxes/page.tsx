// app/settings/taxes/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../supabase";

export default function TaxesSettingsPage() {
  const [hotelId, setHotelId] = useState<string>("");
  const [hotelName, setHotelName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Tax state
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [taxRate, setTaxRate] = useState(12);
  const [taxLabel, setTaxLabel] = useState("GST");
  const [taxCgst, setTaxCgst] = useState(6);
  const [taxSgst, setTaxSgst] = useState(6);
  const [taxShowSplit, setTaxShowSplit] = useState(true);

  // ═══════════════════════════════════════════════
  // LOAD HOTEL + TAX CONFIG
  // ═══════════════════════════════════════════════
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        let hId = "";
        let hName = "";

        // Priority 1: User's own hotel
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: hotels } = await supabase
            .from("hotels")
            .select("id, name")
            .eq("owner_id", user.id)
            .order("created_at", { ascending: true })
            .limit(1);
          if (hotels && hotels.length > 0) {
            hId = hotels[0].id;
            hName = hotels[0].name;
          }
        }

        // Priority 2: localStorage
        if (!hId && typeof window !== "undefined") {
          hId = localStorage.getItem("selected_hotel_id") || "";
          hName = localStorage.getItem("selected_hotel_name") || "";
        }

        if (!hId) {
          setLoading(false);
          return;
        }

        // Save to localStorage
        if (typeof window !== "undefined") {
          localStorage.setItem("selected_hotel_id", hId);
          localStorage.setItem("selected_hotel_name", hName);
        }

        setHotelId(hId);
        setHotelName(hName);

        // Load config
        const { data: config, error } = await supabase
          .from("booking_engine_config")
          .select("*")
          .eq("hotel_id", hId)
          .maybeSingle();

        if (error) {
          console.error("Config load error:", error);
        }

        if (config) {
          setTaxEnabled(config.tax_enabled !== false);
          setTaxRate(Number(config.tax_rate ?? 12));
          setTaxLabel(config.tax_label || "GST");
          setTaxCgst(Number(config.tax_cgst ?? 6));
          setTaxSgst(Number(config.tax_sgst ?? 6));
          setTaxShowSplit(config.tax_show_split !== false);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ═══════════════════════════════════════════════
  // SAVE
  // ═══════════════════════════════════════════════
  const handleSave = async () => {
    if (!hotelId) return;
    setSaving(true);
    setMessage(null);

    try {
      const payload = {
        hotel_id: hotelId,
        tax_enabled: taxEnabled,
        tax_rate: taxRate,
        tax_label: taxLabel,
        tax_cgst: taxCgst,
        tax_sgst: taxSgst,
        tax_show_split: taxShowSplit,
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
          .insert({ ...payload, is_enabled: true });
        if (error) throw error;
      }

      setMessage("✓ Tax settings saved successfully!");
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      console.error(err);
      setMessage(`⚠️ Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const autoSetSplit = (rate: number) => {
    setTaxRate(rate);
    setTaxCgst(rate / 2);
    setTaxSgst(rate / 2);
  };

  // ═══════════════════════════════════════════════
  // LOADING
  // ═══════════════════════════════════════════════
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-teal-500 border-t-transparent animate-spin" />
          <p className="text-slate-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-3xl mx-auto">
        {/* HEADER */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Tax Settings</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure tax rates applied to all bookings
          </p>
          {hotelName && (
            <div className="mt-3 inline-flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-full px-4 py-1.5">
              <span className="text-teal-600">🏨</span>
              <span className="text-xs font-bold text-teal-800">{hotelName}</span>
            </div>
          )}
        </div>

        {message && (
          <div
            className={`p-4 rounded-xl mb-6 text-sm font-bold ${
              message.startsWith("✓")
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-rose-50 text-rose-700 border border-rose-200"
            }`}
          >
            {message}
          </div>
        )}

        <div className="space-y-6">
          {/* ═══ ENABLE TOGGLE ═══ */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Enable Tax</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Show and apply tax on all bookings
                </p>
              </div>
              <button
                onClick={() => setTaxEnabled(!taxEnabled)}
                className={`relative w-14 h-8 rounded-full transition ${
                  taxEnabled ? "bg-teal-500" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${
                    taxEnabled ? "left-7" : "left-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {taxEnabled && (
            <>
              {/* ═══ QUICK PRESETS ═══ */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="text-base font-bold text-slate-900 mb-1">
                  Quick Presets
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Common Indian GST slabs for hotel rooms
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button
                    onClick={() => { autoSetSplit(12); setTaxShowSplit(true); setTaxLabel("GST"); }}
                    className={`p-4 rounded-xl border-2 transition text-left ${
                      taxRate === 12 && taxShowSplit
                        ? "border-teal-500 bg-teal-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <p className="text-lg font-bold text-slate-900">12%</p>
                    <p className="text-[10px] text-slate-500 mt-1">6% + 6%</p>
                    <p className="text-[10px] text-slate-500">Rooms ≤ ₹7,500</p>
                  </button>
                  <button
                    onClick={() => { autoSetSplit(18); setTaxShowSplit(true); setTaxLabel("GST"); }}
                    className={`p-4 rounded-xl border-2 transition text-left ${
                      taxRate === 18 && taxShowSplit
                        ? "border-teal-500 bg-teal-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <p className="text-lg font-bold text-slate-900">18%</p>
                    <p className="text-[10px] text-slate-500 mt-1">9% + 9%</p>
                    <p className="text-[10px] text-slate-500">Rooms &gt; ₹7,500</p>
                  </button>
                  <button
                    onClick={() => { autoSetSplit(5); setTaxShowSplit(true); setTaxLabel("GST"); }}
                    className={`p-4 rounded-xl border-2 transition text-left ${
                      taxRate === 5 && taxShowSplit
                        ? "border-teal-500 bg-teal-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <p className="text-lg font-bold text-slate-900">5%</p>
                    <p className="text-[10px] text-slate-500 mt-1">2.5% + 2.5%</p>
                    <p className="text-[10px] text-slate-500">Budget rooms</p>
                  </button>
                  <button
                    onClick={() => { setTaxRate(0); setTaxCgst(0); setTaxSgst(0); setTaxShowSplit(false); }}
                    className={`p-4 rounded-xl border-2 transition text-left ${
                      taxRate === 0
                        ? "border-teal-500 bg-teal-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <p className="text-lg font-bold text-slate-900">0%</p>
                    <p className="text-[10px] text-slate-500 mt-1">No tax</p>
                  </button>
                </div>
              </div>

              {/* ═══ CUSTOM CONFIG ═══ */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
                <h3 className="text-base font-bold text-slate-900">
                  Custom Configuration
                </h3>

                {/* Total Rate */}
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase block mb-2">
                    Total Tax Rate (%)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={taxRate}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value) || 0;
                        setTaxRate(v);
                        if (taxShowSplit) {
                          setTaxCgst(v / 2);
                          setTaxSgst(v / 2);
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

                {/* Label */}
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase block mb-2">
                    Tax Label
                  </label>
                  <input
                    type="text"
                    value={taxLabel}
                    onChange={(e) => setTaxLabel(e.target.value)}
                    placeholder="GST"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    e.g., GST, VAT, Service Tax
                  </p>
                </div>

                {/* Split Toggle */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      Show CGST / SGST Split
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Show tax as two components in booking engine
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setTaxShowSplit(!taxShowSplit);
                      if (!taxShowSplit) {
                        setTaxCgst(taxRate / 2);
                        setTaxSgst(taxRate / 2);
                      }
                    }}
                    className={`relative w-12 h-7 rounded-full transition ${
                      taxShowSplit ? "bg-teal-500" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${
                        taxShowSplit ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>

                {/* Split Inputs */}
                {taxShowSplit && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                        CGST (%)
                      </label>
                      <input
                        type="number"
                        value={taxCgst}
                        onChange={(e) => setTaxCgst(parseFloat(e.target.value) || 0)}
                        min={0}
                        max={15}
                        step={0.5}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-teal-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                        SGST (%)
                      </label>
                      <input
                        type="number"
                        value={taxSgst}
                        onChange={(e) => setTaxSgst(parseFloat(e.target.value) || 0)}
                        min={0}
                        max={15}
                        step={0.5}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ═══ LIVE PREVIEW ═══ */}
              <div className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-2xl border-2 border-teal-200 p-6">
                <h3 className="text-sm font-bold text-slate-900 mb-3">
                  📊 Preview (Sample ₹1,000 Booking)
                </h3>
                <div className="bg-white rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Room Subtotal</span>
                    <span className="font-semibold">₹1,000.00</span>
                  </div>
                  {taxShowSplit ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">
                          CGST ({taxCgst}%)
                        </span>
                        <span className="font-semibold">
                          ₹{((1000 * taxCgst) / 100).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">
                          SGST ({taxSgst}%)
                        </span>
                        <span className="font-semibold">
                          ₹{((1000 * taxSgst) / 100).toFixed(2)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">
                        {taxLabel} ({taxRate}%)
                      </span>
                      <span className="font-semibold">
                        ₹{((1000 * taxRate) / 100).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-base pt-2 border-t border-slate-200">
                    <span className="font-bold">Total</span>
                    <span className="font-bold text-teal-700">
                      ₹{(1000 + (1000 * taxRate) / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ═══ SAVE BUTTON ═══ */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-4 bg-teal-600 text-white rounded-xl text-sm font-bold uppercase tracking-wider hover:bg-teal-700 disabled:opacity-50 transition"
          >
            {saving ? "Saving..." : "Save Tax Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
