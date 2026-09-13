"use client";

import React, { useState } from "react";
import Link from "next/link";
import { sendPasswordReset } from "../db";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return setError("Please enter your email");
    setLoading(true);
    setError(null);
    try {
      await sendPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send reset email";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-11 h-11 mx-auto rounded-full bg-gradient-to-br from-gold-light to-gold flex items-center justify-center font-serif text-navy text-2xl font-bold shadow-lg shadow-gold/30 mb-4">
            S
          </div>
          <h1 className="font-serif text-3xl text-navy">Reset your password</h1>
          <p className="text-muted mt-2 text-sm">
            We&apos;ll send a secure reset link to your email
          </p>
        </div>

        {sent ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
            <div className="text-4xl mb-3">✉️</div>
            <h2 className="font-serif text-xl text-emerald-800 mb-2">Check your email</h2>
            <p className="text-sm text-emerald-700 mb-4">
              If an account exists for <strong>{email}</strong>, you&apos;ll receive a password reset link within 1-2 minutes.
            </p>
            <p className="text-xs text-emerald-600 mb-4">Don&apos;t see it? Check your spam folder.</p>
            <Link
              href="/login"
              className="inline-block px-6 py-2.5 bg-navy text-cream rounded-lg font-medium text-sm"
            >
              Back to login
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
                ⚠ {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-navy/70 uppercase tracking-wider mb-2">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@hotel.com"
                  required
                  className="w-full px-4 py-3.5 rounded-xl border-2 border-navy/10 bg-white text-navy text-sm outline-none focus:border-gold focus:ring-4 focus:ring-gold/10"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-xl bg-gradient-to-b from-navy to-navy-light text-cream font-semibold text-sm shadow-lg shadow-navy/20 hover:-translate-y-0.5 transition-all disabled:opacity-50"
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <div className="text-center mt-6">
              <Link href="/login" className="text-sm text-navy underline hover:text-gold-dark">
                ← Back to login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
