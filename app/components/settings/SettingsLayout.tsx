"use client";

import React from "react";
import Link from "next/link";

export default function SettingsLayout({
  title,
  subtitle,
  icon,
  children,
  onSave,
  saving,
  showSave,
}: {
  title: string;
  subtitle: string;
  icon: string;
  children: React.ReactNode;
  onSave?: () => void;
  saving?: boolean;
  showSave?: boolean;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 pb-24">
      <div className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition"
              title="Back to settings"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-xl shadow-md">
              {icon}
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">{title}</h1>
              <p className="text-[11px] text-slate-500">{subtitle}</p>
            </div>
          </div>
          {showSave && onSave && (
            <button
              onClick={onSave}
              disabled={saving}
              className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-teal-500/30 disabled:opacity-50 transition flex items-center gap-2"
            >
              {saving ? (
                <>
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Save Changes
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 lg:px-8 py-6">
        {children}
      </div>

      {showSave && onSave && (
        <div className="fixed bottom-6 right-6 z-40 md:hidden">
          <button
            onClick={onSave}
            disabled={saving}
            className="w-14 h-14 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-2xl flex items-center justify-center disabled:opacity-50"
          >
            ✓
          </button>
        </div>
      )}
    </div>
  );
}

export function SettingCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-4">
      <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        {description && (
          <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>
        )}
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

export function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        {description && (
          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function Toggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        value ? "bg-slate-900" : "bg-slate-300"
      }`}
      type="button"
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
          value ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  suffix,
}: {
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-48 px-3.5 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition bg-white"
      />
      {suffix && <span className="text-xs text-slate-400 font-medium">{suffix}</span>}
    </div>
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition resize-none bg-white"
    />
  );
}

export function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-48 px-3.5 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition bg-white font-medium"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}