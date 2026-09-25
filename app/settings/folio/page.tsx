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

  // Dummy booking data for preview
  const mockBooking = {
    id: "preview",
    booking_ref: "PREVIEW-0001",
    primaryGuest: { name: "John Doe", phone: "+91 98765 43210", email: "john@example.com" },
    roomNumber: "102",
    roomType: "Executive Suite",
    checkIn: "2026-09-27",
    checkOut: "2026-09-28",
    amount: 3226,
    tax: 387, // 12% of 3226
    paid: 0,
    notes: "",
  };

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

  // ═══════════════════════════════════════════════
  // EXACT SAME HTML GENERATOR AS CALENDAR PAGE
  // ═══════════════════════════════════════════════
  const generatePreviewHtml = (booking: any, hotelData: any) => {
    const guest = booking.primaryGuest || {};
    const amount = Number(booking.amount) || 0;
    const tax = Number(booking.tax) || 0;
    const paid = Number(booking.paid) || 0;
    const totalAmount = amount + tax;
    const balance = totalAmount - paid;

    const hotelName = hotelData?.name || "Hotel Name";
    const hotelLogo = hotelData?.logo_url || "";
    const hotelGst = hotelData?.gst_number || "";
    const hotelAddress = hotelData?.address || "";
    const hotelPhone = hotelData?.contact_phone || "";
    const hotelTerms = hotelData?.terms_conditions || "";
    const invoicePrefix = hotelData?.invoice_prefix || "INV-";
    const invoiceNo = `${invoicePrefix}${(booking.booking_ref || booking.id || "").slice(-8).toUpperCase()}`;
    const accentColor = "#0d9488";

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Tax Invoice Preview</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Helvetica Neue',Arial,sans-serif;padding:25px;color:#1e293b;background:#fff;}
  .invoice{max-width:820px;margin:0 auto;border:1px solid #cbd5e1;border-radius:12px;padding:36px;box-shadow:0 4px 24px rgba(0,0,0,0.04);}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${accentColor};padding-bottom:22px;margin-bottom:26px;}
  .brand{display:flex;gap:16px;align-items:flex-start;}
  .brand img{height:60px;object-fit:contain;}
  .brand h1{color:${accentColor};font-size:26px;font-weight:800;margin-bottom:4px;}
  .brand p{font-size:12px;color:#64748b;line-height:1.5;}
  .brand .gst{font-weight:700;color:#0f172a;font-size:12px;margin-top:4px;}
  .inv-meta{text-align:right;}
  .inv-meta .title{font-size:22px;font-weight:800;color:${accentColor};text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;}
  .inv-meta .meta-row{font-size:12px;color:#475569;margin-bottom:3px;}
  .inv-meta .meta-row strong{color:#0f172a;}
  .billto-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:26px;}
  .info-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;}
  .info-box h3{font-size:10px;text-transform:uppercase;color:${accentColor};margin-bottom:8px;font-weight:800;letter-spacing:1.5px;}
  .info-box .name{font-size:16px;font-weight:800;color:#0f172a;margin-bottom:4px;}
  .info-box .line{font-size:12px;color:#475569;line-height:1.6;}
  .info-box .line strong{color:#0f172a;}
  table.items{width:100%;border-collapse:collapse;margin-bottom:20px;}
  table.items th{padding:12px 16px;text-align:left;font-size:11px;background:${accentColor};color:#fff;font-weight:700;text-transform:uppercase;letter-spacing:1px;}
  table.items td{padding:12px 16px;font-size:13px;border-bottom:1px solid #e2e8f0;color:#334155;}
  table.items th:last-child,table.items td:last-child{text-align:right;}
  .totals-wrap{display:flex;justify-content:flex-end;margin-bottom:26px;}
  .totals{width:340px;border-collapse:collapse;}
  .totals td{padding:10px 16px;font-size:13px;border-bottom:1px solid #f1f5f9;text-align:right;color:#475569;}
  .totals td:first-child{text-align:left;}
  .totals tr.grand td{font-weight:800;background:#f0fdfa;color:${accentColor};font-size:15px;border-bottom:none;}
  .totals tr.paid td{font-weight:600;color:#059669;}
  .totals tr.balance td{font-weight:800;background:#fef2f2;color:#b91c1c;font-size:14px;}
  .terms{margin-top:30px;border-top:1px solid #e2e8f0;padding-top:16px;}
  .terms h4{font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;font-weight:800;margin-bottom:8px;}
  .terms p{font-size:11px;color:#64748b;line-height:1.7;white-space:pre-wrap;}
  .footer{text-align:center;margin-top:30px;padding-top:16px;border-top:1px solid #f1f5f9;}
  .footer p{font-size:11px;color:#94a3b8;}
</style>
</head>
<body>
<div class="invoice">
  <div class="header">
    <div class="brand">
      ${hotelLogo ? `<img src="${hotelLogo}" alt="Logo" />` : ""}
      <div>
        <h1>${hotelName}</h1>
        ${hotelAddress ? `<p>${hotelAddress}</p>` : ""}
        ${hotelPhone ? `<p>📞 ${hotelPhone}</p>` : ""}
        ${hotelGst ? `<p class="gst">GSTIN: ${hotelGst}</p>` : ""}
      </div>
    </div>
    <div class="inv-meta">
      <div class="title">Tax Invoice</div>
      <div class="meta-row"><strong>No:</strong> ${invoiceNo}</div>
      <div class="meta-row"><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
    </div>
  </div>
  <div class="billto-grid">
    <div class="info-box">
      <h3>Bill To</h3>
      <div class="name">${guest.name || "Guest"}</div>
      ${guest.phone ? `<div class="line">📞 ${guest.phone}</div>` : ""}
      ${guest.email ? `<div class="line">✉ ${guest.email}</div>` : ""}
    </div>
    <div class="info-box">
      <h3>Stay Details</h3>
      <div class="line"><strong>Room:</strong> ${booking.roomNumber || "—"} (${booking.roomType || "—"})</div>
      <div class="line"><strong>Check-in:</strong> ${booking.checkIn || "—"}</div>
      <div class="line"><strong>Check-out:</strong> ${booking.checkOut || "—"}</div>
    </div>
  </div>
  <table class="items">
    <thead>
      <tr>
        <th style="width:60%;">Description</th>
        <th style="width:10%;text-align:center;">Qty</th>
        <th style="width:30%;">Amount (Rs.)</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>Room Charges — ${booking.roomType || "Room"}</td><td style="text-align:center;">1</td><td style="text-align:right;">${amount.toFixed(2)}</td></tr>
    </tbody>
  </table>
  <div class="totals-wrap">
    <table class="totals">
      <tr><td>Sub Total</td><td>₹${amount.toFixed(2)}</td></tr>
      ${tax > 0 ? `<tr><td>CGST</td><td>₹${(tax / 2).toFixed(2)}</td></tr><tr><td>SGST</td><td>₹${(tax / 2).toFixed(2)}</td></tr>` : ""}
      <tr class="grand"><td>Grand Total</td><td>₹${totalAmount.toFixed(2)}</td></tr>
      <tr class="paid"><td>Payment Made</td><td>₹${paid.toFixed(2)}</td></tr>
      <tr class="balance"><td>Balance Due</td><td>₹${balance.toFixed(2)}</td></tr>
    </table>
  </div>
  ${hotelTerms ? `<div class="terms"><h4>Terms & Conditions</h4><p>${hotelTerms}</p></div>` : ""}
  <div class="footer"><p>Thank you for staying with us! · Generated by Staynexa PMS</p></div>
</div>
</body>
</html>`;
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
                placeholder="29ABCDE1234F1Z5"
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
                placeholder="INV-"
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
                placeholder="Vishara Elite Complex, MG Road"
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

          {/* The Real Invoice Preview using iframe */}
          <div className="bg-white rounded-xl shadow-xl overflow-hidden border border-slate-200 w-full max-w-md aspect-[1/1.35]">
            <iframe
              srcDoc={generatePreviewHtml(mockBooking, {
                name: hotelName,
                logo_url: formData.logo_url,
                gst_number: formData.gst_number,
                address: formData.address,
                contact_phone: formData.contact_phone,
                invoice_prefix: formData.invoice_prefix,
                terms_conditions: formData.terms_conditions,
              })}
              className="w-full h-full border-0"
              title="Invoice Preview"
            />
          </div>
        </div>

      </div>
    </div>
  );
}
