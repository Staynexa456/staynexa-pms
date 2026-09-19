"use client";

import React, { useState } from "react";

export type CompanyDetails = {
  companyName: string;
  companyGst: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
};

export default function CompanyDetailsModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: Partial<CompanyDetails>;
  onClose: () => void;
  onSave: (details: CompanyDetails) => Promise<void>;
}) {
  const [companyName, setCompanyName] = useState(initial?.companyName || "");
  const [companyGst, setCompanyGst] = useState(initial?.companyGst || "");
  const [companyEmail, setCompanyEmail] = useState(initial?.companyEmail || "");
  const [companyPhone, setCompanyPhone] = useState(initial?.companyPhone || "");
  const [companyAddress, setCompanyAddress] = useState(initial?.companyAddress || "");
  const [saving, setSaving] = useState(false);
  const [gstSearching, setGstSearching] = useState(false);

  // Search company by GST (placeholder — can integrate with real API)
  const handleGstSearch = async () => {
    if (!companyGst.trim() || companyGst.length < 15) {
      return;
    }
    setGstSearching(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (err) {
      console.error("GST lookup failed", err);
    } finally {
      setGstSearching(false);
    }
  };

  const handleSave = async () => {
    if (!companyName.trim()) {
      alert("Please enter company name");
      return;
    }
    if (!companyGst.trim()) {
      alert("Please enter GST/Tax ID");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        companyName: companyName.trim(),
        companyGst: companyGst.trim().toUpperCase(),
        companyEmail: companyEmail.trim(),
        companyPhone: companyPhone.trim(),
        companyAddress: companyAddress.trim(),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[95] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-800">Company details</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-5">
          
          {/* GST Search */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">
              Tax ID / GST number
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                value={companyGst}
                onChange={(e) => setCompanyGst(e.target.value.toUpperCase())}
                onBlur={handleGstSearch}
                placeholder="Search by GST or enter new"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-sm outline-none focus:border-slate-800 focus:ring-2 focus:ring-slate-100 transition"
              />
              {gstSearching && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-500">
                  Searching...
                </span>
              )}
            </div>
          </div>

          {/* Company Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">
              Company name
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Company name"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm outline-none focus:border-slate-800 focus:ring-2 focus:ring-slate-100 transition"
            />
          </div>

          {/* Email + Phone */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">
                Email
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </span>
                <input
                  type="email"
                  value={companyEmail}
                  onChange={(e) => setCompanyEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-sm outline-none focus:border-slate-800 focus:ring-2 focus:ring-slate-100 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">
                Phone
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </span>
                <input
                  type="tel"
                  value={companyPhone}
                  onChange={(e) => setCompanyPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-sm outline-none focus:border-slate-800 focus:ring-2 focus:ring-slate-100 transition"
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">
              Address
            </label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </span>
              <textarea
                value={companyAddress}
                onChange={(e) => setCompanyAddress(e.target.value)}
                placeholder="Enter company address"
                rows={4}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-sm outline-none focus:border-slate-800 focus:ring-2 focus:ring-slate-100 transition resize-none"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3 bg-white">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-3 border-2 border-slate-800 rounded-full text-sm font-bold text-slate-800 hover:bg-slate-50 transition uppercase tracking-wide disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !companyName.trim() || !companyGst.trim()}
            className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-sm font-bold flex items-center justify-center gap-2 transition uppercase tracking-wide disabled:opacity-50"
          >
            <span className="text-lg leading-none">+</span>
            {saving ? "Saving..." : "Create & Add"}
          </button>
        </div>
      </div>
    </div>
  );
}