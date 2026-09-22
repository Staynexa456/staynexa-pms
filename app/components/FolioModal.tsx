"use client";

import React, { useState } from "react";
import GuestInfoPanel from "./GuestInfoPanel"; // 👈 ১. নতুন ইমপোর্ট
import { updateGuest } from "../db"; // 👈 ২. db.ts থেকে updateGuest ইমপোর্ট (পাথ আপনার প্রজেক্ট অনুযায়ী চেক করে নিন)

// Parse addons from notes JSON
function parseAddons(notes: string): { id: string; name: string; price: number; tax: number; date: string }[] {
  const match = notes.match(/ADDONS_JSON:(\[[^\]]*\])/);
  if (!match) return [];
  try {
    return JSON.parse(match[1]);
  } catch {
    return [];
  }
}

export default function FolioModal({ 
  booking, 
  onClose, 
  refreshKey, 
  onOpenPaymentManager, 
  onSettleDues, 
  onCheckInOrOut, 
  onPaymentMade, 
  onBookingUpdate,
  onAction,
  onDeleteAddon
}: { 
  booking: any; 
  onClose: () => void; 
  refreshKey?: number;
  onOpenPaymentManager?: () => void;
  onSettleDues: () => void; 
  onCheckInOrOut: () => void;
  onPaymentMade?: () => void;
  onBookingUpdate?: () => void;
  onAction?: (action: string) => void;
  onDeleteAddon?: (addonId: string) => void;
}) {
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [checkedAddons, setCheckedAddons] = useState<string[]>([]);
  const [showGuestEdit, setShowGuestEdit] = useState(false); // 👈 ৩. নতুন স্টেট

  const guest = booking.primaryGuest || booking.guest || {};
  const notes = booking.notes || "";

  // ── কোম্পানির তথ্য নোটস এবং গেস্ট প্রোফাইল থেকে বের করা ──
  const companyMatch = notes.match(/Company:\s*([^·]+)/);
  const companyInfo = companyMatch ? companyMatch[1].split(",") : [];
  const companyName = guest.companyName || companyInfo[0]?.trim() || "";
  const companyGst = guest.companyGst || companyInfo[1]?.trim() || "";

  const amount = Number(booking.amount) || 0;
  const tax = Number(booking.tax) || 0;
  const paid = Number(booking.paid) || 0;

  // Parse addons from notes
  const addons = parseAddons(notes);
  const addonsSubtotal = addons.reduce((sum, a) => sum + (Number(a.price) || 0), 0);
  const addonsTax = addons.reduce((sum, a) => sum + ((Number(a.price) || 0) * (Number(a.tax) || 0)) / 100, 0);
  const addonsTotal = addonsSubtotal + addonsTax;

  const totalWithTaxes = amount + tax + addonsTotal;
  const balanceDue = totalWithTaxes - paid;

  // Build ledger items
  const ledgerItems: any[] = [
    { 
      id: "booking",
      date: booking.checkIn || "—", 
      description: "Booking Price", 
      type: "DEBIT", 
      subTotal: amount, 
      taxPercent: 5, 
      tax: tax, 
      total: amount + tax,
      isAddon: false,
    },
    ...addons.map((a) => ({
      id: a.id,
      date: a.date || booking.checkIn || "—",
      description: `Addon: ${a.name}`,
      type: "DEBIT",
      subTotal: Number(a.price) || 0,
      taxPercent: Number(a.tax) || 0,
      tax: ((Number(a.price) || 0) * (Number(a.tax) || 0)) / 100,
      total: (Number(a.price) || 0) * (1 + (Number(a.tax) || 0) / 100),
      isAddon: true,
    })),
  ];

  const isBalanceDue = balanceDue > 0;

  const toggleAddonCheck = (id: string) => {
    setCheckedAddons((prev) => 
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = () => {
    if (checkedAddons.length === 0) return;
    if (!onDeleteAddon) return;
    checkedAddons.forEach((id) => onDeleteAddon(id));
    setCheckedAddons([]);
  };

  // Check if company details exist in notes
  const hasCompany = /Company:\s*[^·]+/.test(notes);

  const actionGroups = [
    {
      title: "Print & Documents",
      items: hasCompany ? [
        { label: "Print Normal Bill", icon: "🧾" },
        { label: "Print Company Bill", icon: "🏢" },
        { label: "Print Registration Card", icon: "🖨️" },
        { label: "Print C Form", icon: "📄" },
        { label: "Download Booking Voucher", icon: "📥" },
        { label: "Email Folio Details", icon: "✉️" },
        { label: "Folio Log", icon: "📋" },
      ] : [
        { label: "Print Bill", icon: "🧾" },
        { label: "Print Registration Card", icon: "🖨️" },
        { label: "Print C Form", icon: "📄" },
        { label: "Download Booking Voucher", icon: "📥" },
        { label: "Email Folio Details", icon: "✉️" },
        { label: "Folio Log", icon: "📋" },
      ]
    },
    {
      title: "Financial Adjustments",
      items: [
        { label: "Edit Rate Plan", icon: "✏️" },
        { label: "Apply Coupon / Discount", icon: "🏷️" },
        { label: "Add Company Details", icon: "🏢" },
        { label: "Tax Exempt Status", icon: "⚖️" },
        { label: "Add Hotel Addons", icon: "➕" },
      ]
    },
    {
      title: "Room & Booking Management",
      items: [
        { label: "Assign Room", icon: "🔑" },
        { label: "Unassign Room", icon: "🚪" },
        { label: "Move Room", icon: "🔄" },
        { label: "Modify Checkout", icon: "📅" },
        { label: "Add to Group Booking", icon: "👥" },
        { label: "Lock Booking", icon: "🔒" },
        { label: "Unlock Booking", icon: "🔓" },
        { label: "Scanty Baggage", icon: "🧳" },
      ]
    }
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 lg:p-6">
      <div className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-7xl h-[95vh] flex flex-col overflow-hidden border border-slate-200 relative">
        
        {/* HEADER */}
        <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-teal-600 rounded-full flex items-center justify-center text-white font-bold text-xl">V</div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Vishara Elite</h2>
              <p className="text-xs text-slate-500">Summary Invoice</p>
            </div>
            <div className="h-8 w-px bg-slate-200 mx-2"></div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tax Invoice #</p>
              <p className="text-sm font-bold text-teal-700">{booking.booking_ref || booking.id}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => onAction?.("Print Normal Bill")} className="p-2 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition" title="Print">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
            </button>
            <button onClick={onBookingUpdate} className="p-2 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition" title="Refresh">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
            </button>
            
            <div className="relative">
              <button 
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition"
              >
                More Actions
                <svg className={`w-4 h-4 transition-transform ${isMoreMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </button>

              {isMoreMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsMoreMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-[650px] bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-5 grid grid-cols-3 gap-6">
                    {actionGroups.map((group, idx) => (
                      <div key={idx}>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-100 pb-2">{group.title}</h3>
                        <div className="space-y-1">
                          {group.items.map((item, i) => (
                            <button 
                              key={i} 
                              onClick={() => { setIsMoreMenuOpen(false); onAction?.(item.label); }}
                              className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg flex items-center gap-2 transition"
                            >
                              <span className="text-base opacity-70">{item.icon}</span>
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="w-px h-6 bg-slate-200 mx-1"></div>

            <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
        </div>

        {/* MAIN BODY */}
        <div className="flex-1 flex overflow-hidden">
          
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  {companyName ? (
                    <div className="flex flex-col">
                      <h1 className="text-2xl font-bold text-slate-800">{companyName}</h1>
                      {companyGst && <p className="text-sm text-slate-500 mt-0.5">GSTIN: {companyGst}</p>}
                      <p className="text-xs text-slate-400 mt-1">Guest: {guest.name || "—"}</p>
                    </div>
                  ) : (
                    <h1 className="text-2xl font-bold text-slate-800">Bill to : {guest.name || "Guest"}</h1>
                  )}
                  <span className="px-2.5 py-1 bg-teal-100 text-teal-800 text-xs font-bold rounded-full uppercase tracking-wide">{booking.status}</span>
                </div>
                {/* 👈 ৪. Edit Details বাটনে onClick যোগ করা হলো */}
                <button 
                  onClick={() => setShowGuestEdit(true)} 
                  className="text-sm text-teal-600 hover:text-teal-800 font-medium flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                  Edit Details
                </button>
              </div>

              <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-slate-500 font-medium col-span-1">Address</span>
                    <span className="text-slate-800 col-span-2">{guest.address || "—"}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-slate-500 font-medium col-span-1">Email</span>
                    <span className="text-slate-800 col-span-2">{guest.email || "—"}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-slate-500 font-medium col-span-1">Phone</span>
                    <span className="text-slate-800 col-span-2 font-medium">{guest.phone || "—"}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-slate-500 font-medium col-span-1">GST Number</span>
                    <span className="text-slate-800 col-span-2 text-teal-600 hover:underline cursor-pointer">{guest.gst || "Edit GST number"}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-slate-500 font-medium col-span-1">Check-in</span>
                    <span className="text-slate-800 col-span-2 font-medium">{booking.checkIn || "—"}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-slate-500 font-medium col-span-1">Checkout</span>
                    <span className="text-slate-800 col-span-2 font-medium">{booking.checkOut || "—"}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-slate-500 font-medium col-span-1">Room ID</span>
                    <span className="text-slate-800 col-span-2 font-medium">{booking.roomNumber || "—"} ({booking.roomType || "—"})</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-slate-500 font-medium col-span-1">Nights</span>
                    <span className="text-slate-800 col-span-2 font-medium">1</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-slate-500 font-medium col-span-1">Pax</span>
                    <span className="text-slate-800 col-span-2 font-medium">{booking.adults || 1} Adults / {booking.children || 0} Children / {booking.infants || 0} Infants</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-slate-500 font-medium col-span-1">Rate Plan</span>
                    <span className="text-slate-800 col-span-2 font-medium">{booking.ratePlan || "EP"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* LEDGER TABLE */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              {/* Delete Bar */}
              {checkedAddons.length > 0 && (
                <div className="bg-rose-50 border-b border-rose-200 px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-rose-700">
                    {checkedAddons.length} addon{checkedAddons.length > 1 ? "s" : ""} selected
                  </span>
                  <button 
                    onClick={handleDeleteSelected}
                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    DELETE SELECTED
                  </button>
                </div>
              )}

              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 w-12">✓</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3 text-right">Sub-total (Rs.)</th>
                    <th className="px-4 py-3 text-right">Tax %</th>
                    <th className="px-4 py-3 text-right">Tax (Rs.)</th>
                    <th className="px-4 py-3 text-right">Total (Rs.)</th>
                    <th className="px-4 py-3 text-center w-16">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledgerItems.map((item: any, idx: number) => {
                    const isChecked = checkedAddons.includes(item.id);
                    return (
                      <tr key={idx} className={`hover:bg-slate-50 transition-colors ${isChecked ? "bg-rose-50/50" : ""}`}>
                        <td className="px-4 py-3">
                          {item.isAddon ? (
                            <input 
                              type="checkbox" 
                              checked={isChecked}
                              onChange={() => toggleAddonCheck(item.id)}
                              className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer" 
                            />
                          ) : (
                            <input type="checkbox" disabled className="rounded border-slate-200 w-4 h-4 opacity-30" />
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{item.date}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {item.isAddon && (
                            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-2"></span>
                          )}
                          {item.description}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${item.type === 'DEBIT' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>{item.type}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">{Number(item.subTotal || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{Number(item.taxPercent || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{Number(item.tax || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-800">{Number(item.total || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          {item.isAddon && onDeleteAddon && (
                            <button 
                              onClick={() => onDeleteAddon(item.id)}
                              className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md p-1.5 transition"
                              title="Delete addon"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-800">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-right">Grand Total</td>
                    <td className="px-4 py-3 text-right">{(amount + addonsSubtotal).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">-</td>
                    <td className="px-4 py-3 text-right">{(tax + addonsTax).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-teal-700">{totalWithTaxes.toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="w-[380px] bg-white border-l border-slate-200 flex flex-col shrink-0">
            <div className="bg-teal-600 px-6 py-4">
              <h3 className="text-white font-bold text-lg tracking-wide">Folio Summary</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-100 pb-2">Booking Amount Breakdown</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-slate-600"><span>Room charge</span><span>{amount.toFixed(2)}</span></div>
                  <div className="flex justify-between text-slate-600"><span>Tax</span><span>{tax.toFixed(2)}</span></div>
                  {addonsTotal > 0 && (
                    <div className="flex justify-between text-amber-600 font-medium pt-2 border-t border-slate-100">
                      <span>Addons ({addons.length})</span><span>{addonsTotal.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-slate-800 pt-2 border-t border-slate-100"><span>Total with taxes</span><span>{totalWithTaxes.toFixed(2)}</span></div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-100 pb-2">Room Taxes Breakdown</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-slate-600"><span>GST</span><span>{tax.toFixed(2)}</span></div>
                  <div className="flex justify-between text-slate-600"><span>CGST</span><span>{(tax / 2).toFixed(2)}</span></div>
                  <div className="flex justify-between text-slate-600"><span>SGST</span><span>{(tax / 2).toFixed(2)}</span></div>
                  <div className="flex justify-between text-slate-600"><span>Service taxes</span><span>0.00</span></div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-100 pb-2">Payment Breakdown</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-slate-600"><span>Cash / Online Payment</span><span>{paid.toFixed(2)}</span></div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border-t border-slate-200 p-6 space-y-4 shrink-0">
              <div className="flex justify-between items-center text-sm">
                <span className="font-bold text-slate-600">Payment made</span>
                <span className="font-bold text-slate-800">{paid.toFixed(2)}</span>
              </div>
              
              <div className={`flex justify-between items-center p-3 rounded-lg ${isBalanceDue ? 'bg-rose-50 border border-rose-100' : 'bg-emerald-50 border border-emerald-100'}`}>
                <span className={`font-bold text-sm ${isBalanceDue ? 'text-rose-700' : 'text-emerald-700'}`}>Balance due</span>
                <span className={`font-bold text-lg ${isBalanceDue ? 'text-rose-700' : 'text-emerald-700'}`}>Rs. {balanceDue.toFixed(2)}</span>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={onSettleDues} className="flex-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold py-2.5 rounded-lg text-sm transition">Settle dues</button>
                <button onClick={onCheckInOrOut} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2.5 rounded-lg text-sm transition shadow-sm">{booking.status === "CHECKED-IN" ? "Check-out" : "Check-in"}</button>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ ৫. Guest Edit Modal রেন্ডার করা ═══ */}
        {showGuestEdit && (
          <GuestInfoPanel
            booking={booking}
            onClose={() => setShowGuestEdit(false)}
            onSave={async (updatedGuest) => {
              try {
                const guestId = guest?.id;
                if (!guestId) {
                  alert("Guest ID is missing, cannot update.");
                  return;
                }
                
                // ডেটাবেসে আপডেট পাঠান
                await updateGuest(guestId, updatedGuest);
                
                setShowGuestEdit(false);
                
                // প্যারেন্ট কম্পোনেন্টকে ডেটা রিফ্রেশ করার জন্য জানান
                if (onBookingUpdate) {
                  onBookingUpdate(); 
                }
              } catch (error) {
                console.error("Failed to update guest details:", error);
                alert("⚠ Failed to update guest details. Please try again.");
              }
            }}
          />
        )}

      </div>
    </div>
  );
}