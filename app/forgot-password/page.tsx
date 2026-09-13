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
    if (!email.trim()) {
      setError("Please enter your email");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await sendPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      console.error("Reset password error:", err);
      const msg = err instanceof Error ? err.message : "Failed to send reset email";
      if (msg.toLowerCase().includes("rate")) {
        setError("Too many requests. Please wait a few minutes and try again.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-gold-light to-gold flex items-center justify-center font-serif text-navy text-2xl font-bold shadow-lg shadow-gold/30 mb-5">
            S
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-gold-dark font-semibold mb-2">
            Staynexa · Account Recovery
          </p>
          <h1 className="font-serif text-4xl text-navy leading-tight">
            Reset your password
          </h1>
          <p className="text-muted mt-3 text-sm">
            We&apos;ll email you a secure reset link
          </p>
        </div>

        {sent ? (
          /* ═══ Success screen ═══ */
          <div>
            <div className="bg-white border border-navy/10 rounded-2xl p-6 text-center mb-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-gold-light to-gold flex items-center justify-center text-3xl shadow-lg shadow-gold/30 mb-4">
                ✉️
              </div>
              <h2 className="font-serif text-2xl text-navy mb-3">
                Check your email
              </h2>
              <p className="text-sm text-navy/70 mb-2">
                If an account exists for
              </p>
              <p className="font-semibold text-navy mb-4 break-words">
                {email}
              </p>
              <p className="text-sm text-navy/70 mb-4">
                you&apos;ll receive a password reset link within 1-2 minutes.
              </p>

              <div className="bg-cream/60 border border-navy/10 rounded-lg p-4 text-left text-xs text-navy/70 space-y-1.5">
                <p className="font-semibold text-navy mb-1">💡 Tips:</p>
                <p>• Check your <strong>spam folder</strong></p>
                <p>• Sender is <strong>noreply@staynexa.in</strong></p>
                <p>• Link expires in 1 hour</p>
              </div>
            </div>

            <Link
              href="/login"
              className="block w-full text-center py-3.5 rounded-xl bg-gradient-to-b from-navy to-navy-light text-cream font-medium text-sm hover:-translate-y-0.5 transition-all"
            >
              Back to sign in
            </Link>

            <button
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
              className="w-full text-center mt-4 text-xs text-navy/60 hover:text-navy underline"
            >
              Use a different email
            </button>
          </div>
        ) : (
          /* ═══ Form ═══ */
          <>
            {error && (
              <div className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
                <span className="text-rose-500 text-lg flex-shrink-0">⚠</span>
                <p className="text-sm text-rose-700 font-medium">{error}</p>
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
                  disabled={loading}
                  autoComplete="email"
                  className="w-full px-4 py-3.5 rounded-xl border-2 border-navy/10 bg-white text-navy text-sm outline-none focus:border-gold focus:ring-4 focus:ring-gold/10 disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-xl bg-gradient-to-b from-navy to-navy-light text-cream font-semibold text-sm tracking-wide shadow-lg shadow-navy/20 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:transform-none"
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <div className="text-center mt-8">
              <Link
                href="/login"
                className="text-sm text-navy underline decoration-dotted underline-offset-4 hover:text-gold-dark"
              >
                ← Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
