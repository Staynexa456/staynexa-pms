"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../supabase";
import { getActiveHotelId } from "../../active-hotel";

export default function FolioSetupPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [formData, setFormData] = useState({
    gst_number: "",
    address: "",
    contact_phone: "",
    invoice_prefix: "INV-",
    terms_conditions: "",
  });

  // ১. ডাটাবেস থেকে তথ্য লোড করা
  useEffect(() => {
    const loadFolioSettings = async () => {
      const hotelId = getActiveHotelId();
      if (!hotelId) return;

      const { data, error } = await supabase
        .from("hotels")
        .select("gst_number, address, contact_phone, invoice_prefix, terms_conditions")
        .eq("id", hotelId)
        .maybeSingle();

      if (data) {
        setFormData({
          gst_number: data.gst_number || "",
          address: data.address || "",
          contact_phone: data.contact_phone || "",
          invoice_prefix: data.invoice_prefix || "INV-",
          terms_conditions: data.terms_conditions || "",
        });
      }
      setLoading(false);
    };
    loadFolioSettings();
  }, []);

  // ২. তথ্য সেভ করা
  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    const hotelId = getActiveHotelId();
    
    const { error } = await supabase
      .from("hotels")
      .update({
        gst_number: formData.gst_number,
        address: formData.address,
        contact_phone: formData.contact_phone,
        invoice_prefix: formData.invoice_prefix,
        terms_conditions: formData.terms_conditions,
      })
      .eq("id", hotelId);

    if (error) {
      setMessage("❌ Error saving: " + error.message);
    } else {
      setMessage("✅ Folio settings saved successfully!");
    }
    setSaving(false);
  };

  if (loading) return <div className="p-10 text-center">Loading...</div>;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Folio & Invoice Setup</h1>
        <p className="text-sm text-slate-500">Configure your hotel invoice details, GST, and terms for guest folios.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        {/* Hotel Info Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
              GST Number
            </label>
            <input
              type="text"
              value={formData.gst_number}
              onChange={(e) => setFormData({ ...formData, gst_number: e.target.value })}
              placeholder="22AAAAA0000A1Z5"
              className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-slate-900"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Invoice Prefix
            </label>
            <input
              type="text"
              value={formData.invoice_prefix}
              onChange={(e) => setFormData({ ...formData, invoice_prefix: e.target.value })}
              placeholder="INV-2026-"
              className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-slate-900"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Hotel Contact Phone
            </label>
            <input
              type="text"
              value={formData.contact_phone}
              onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
              placeholder="+91 98765 43210"
              className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-slate-900"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Hotel Address
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="123, Main Road, Bengaluru"
              className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-slate-900"
            />
          </div>
        </div>

        {/* Terms and Conditions */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
            Terms & Conditions (Appears on Invoice)
          </label>
          <textarea
            value={formData.terms_conditions}
            onChange={(e) => setFormData({ ...formData, terms_conditions: e.target.value })}
            rows={4}
            placeholder="Enter your hotel's terms and conditions here..."
            className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-slate-900 resize-none"
          />
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <p className="text-sm text-slate-500">
            {message && <span className={message.includes("✅") ? "text-emerald-600" : "text-rose-600"}>{message}</span>}
          </p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 disabled:opacity-50 transition"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
