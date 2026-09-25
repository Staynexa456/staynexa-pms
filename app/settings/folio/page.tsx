"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../supabase";
import { getActiveHotelId } from "../../active-hotel";

export default function FolioSetupPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [hotelName, setHotelName] = useState("Your Hotel Name");

  const [formData, setFormData] = useState({
    logo_url: "",
    gst_number: "",
    address: "",
    contact_phone: "",
    invoice_prefix: "INV-",
    terms_conditions: "Check-in: 12:00 PM, Check-out: 11:00 AM. No refunds after check-out.",
  });

  // ১. ডাটাবেস থেকে তথ্য লোড করা
  useEffect(() => {
    const loadFolioSettings = async () => {
      const hotelId = getActiveHotelId();
      if (!hotelId) return;

      const { data, error } = await supabase
        .from("hotels")
        .select("name, logo_url, gst_number, address, contact_phone, invoice_prefix, terms_conditions")
        .eq("id", hotelId)
        .maybeSingle();

      if (data) {
        setHotelName(data.name || "Your Hotel Name");
        setFormData({
          logo_url: data.logo_url || "",
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
        logo_url: formData.logo_url,
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

  if (loading) return <div className="p-10 text-center text-slate-500">Loading settings...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Folio & Invoice Setup</h1>
        <p className="text-sm text-slate-500">Configure your hotel invoice details. This information will appear on guest invoices.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        
        {/* ================= LEFT COLUMN: SETTINGS FORM ================= */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3">Invoice Configuration</h2>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Hotel Logo URL (Optional)
            </label>
            <input
              type="text"
              value={formData.logo_url}
              onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
              placeholder="https://your-hotel-logo.png"
              className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-slate-900"
            />
            <p className="text-[10px] text-slate-400 mt-1">Paste a direct link to your hotel's logo image.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
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

          <div className="grid grid-cols-2 gap-4">
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
                placeholder="123, MG Road, Bengaluru"
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Terms & Conditions (Appears on Invoice)
            </label>
            <textarea
              value={formData.terms_conditions}
              onChange={(e) => setFormData({ ...formData, terms_conditions: e.target.value })}
              rows={4}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-slate-900 resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <p className="text-sm">
              {message && <span className={message.includes("✅") ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>{message}</span>}
            </p>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 disabled:opacity-50 transition shadow-md"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>

        {/* ================= RIGHT COLUMN: LIVE INVOICE PREVIEW ================= */}
        <div className="bg-slate-100 rounded-2xl border border-slate-200 p-6 flex flex-col items-center justify-start overflow-hidden">
          <div className="w-full flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Live Invoice Preview</h3>
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-bold">Auto-updating</span>
          </div>

          {/* The Invoice Paper */}
          <div className="bg-white w-full max-w-md shadow-xl rounded-lg p-8 border border-slate-200 text-sm">
            
            {/* Invoice Header */}
            <div className="flex justify-between items-start border-b border-slate-200 pb-6 mb-6">
              <div>
                {formData.logo_url ? (
                  <img src={formData.logo_url} alt="Logo" className="h-12 mb-2 object-contain" />
                ) : (
                  <div className="w-12 h-12 bg-slate-200 rounded-lg mb-2 flex items-center justify-center text-slate-400">🏨</div>
                )}
                <h2 className="text-lg font-bold text-slate-900">{hotelName}</h2>
                <p className="text-xs text-slate-500">{formData.address || "Hotel Address Here"}</p>
                <p className="text-xs text-slate-500">{formData.contact_phone || "+91 XXXXX XXXXX"}</p>
                {formData.gst_number && <p className="text-xs text-slate-500 mt-1"><strong>GSTIN:</strong> {formData.gst_number}</p>}
              </div>
              <div className="text-right">
                <h1 className="text-2xl font-black text-slate-300 uppercase tracking-widest">INVOICE</h1>
                <p className="text-xs text-slate-500 mt-1"><strong>No:</strong> {formData.invoice_prefix || "INV-"}0001</p>
                <p className="text-xs text-slate-500"><strong>Date:</strong> 26 Sep 2026</p>
              </div>
            </div>

            {/* Guest Details (Dummy) */}
            <div className="mb-6">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Billed To</p>
              <p className="font-semibold text-slate-800">John Doe</p>
              <p className="text-xs text-slate-500">+91 98765 43210</p>
              <p className="text-xs text-slate-500">john@example.com</p>
            </div>

            {/* Line Items (Dummy) */}
            <table className="w-full text-left mb-6">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="pb-2">Description</th>
                  <th className="pb-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                <tr className="border-b border-slate-100">
                  <td className="py-2">Room Rent (Deluxe) - 2 Nights</td>
                  <td className="py-2 text-right">₹10,000</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-2">Extra Services / Addons</td>
                  <td className="py-2 text-right">₹1,500</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-2">GST (18%)</td>
                  <td className="py-2 text-right">₹2,070</td>
                </tr>
              </tbody>
            </table>

            {/* Total */}
            <div className="flex justify-end border-t-2 border-slate-800 pt-3 mb-8">
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Amount</p>
                <p className="text-xl font-black text-slate-900">₹13,570</p>
              </div>
            </div>

            {/* Terms & Conditions */}
            <div className="border-t border-slate-200 pt-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Terms & Conditions</p>
              <p className="text-[10px] text-slate-500 leading-relaxed whitespace-pre-wrap">
                {formData.terms_conditions || "No terms and conditions specified."}
              </p>
            </div>

            <div className="mt-8 text-center">
              <p className="text-[10px] text-slate-400 font-medium">Thank you for staying with us!</p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
