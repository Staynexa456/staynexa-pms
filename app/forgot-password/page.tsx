// app/forgot-password/page.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { supabase } from "../supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }

    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (resetError) {
        throw resetError;
      }

      setSuccess(true);
    } catch (err: any) {
      // ✅ FIX: Safely extract error message - never display "0" or object
      let msg = "Failed to send reset link. Please try again.";
      if (err?.message && typeof err.message === "string") {
        msg = err.message;
      } else if (typeof err === "string") {
        msg = err;
      } else if (err?.error_description && typeof err.error_description === "string") {
        msg = err.error_description;
      }
      setError(msg);
      console.error("[Forgot Password] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fbfaf7] p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center font-serif text-slate-900 text-2xl font-bold shadow-lg mb-5">
            S
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-2" style={{ color: "#c9a227" }}>
            Staynexa · Account Recovery
          </p>
          <h1 className="font-serif text-4xl text-slate-900 leading-tight">
            Reset your password
          </h1>
          <p className="text-slate-500 mt-3 text-sm">
            We'll email you a secure reset link
          </p>
        </div>

        {success ? (
          /* Success screen */
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-3xl mb-4">
              ✅
            </div>
            <h2 className="font-serif text-2xl text-slate-900 mb-3">
              Check your email
            </h2>
            <p className="text-sm text-slate-600 mb-4">
              We've sent a password reset link to <strong>{email}</strong>.
              Click the link in the email to reset your password.
            </p>
            <p className="text-xs text-slate-400 mb-6">
              Didn't receive the email? Check your spam folder.
            </p>
            <Link
              href="/login"
              className="inline-block w-full py-3 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 transition"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
                <span className="text-rose-500 text-lg flex-shrink-0">⚠</span>
                <p className="text-sm text-rose-700 font-medium break-words">
                  {error}
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@hotel.com"
                  autoComplete="email"
                  required
                  disabled={loading}
                  className="w-full px-4 py-3.5 rounded-xl border-2 border-slate-200 bg-white text-slate-900 text-sm outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100 disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-xl bg-gradient-to-b from-slate-800 to-slate-900 text-white font-semibold text-sm tracking-wide shadow-lg shadow-slate-900/20 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:transform-none"
              >
                {loading ? "Sending..." : "Send reset link"}
              </button>
            </form>

            <div className="text-center mt-6">
              <Link
                href="/login"
                className="text-sm text-slate-600 hover:text-slate-900 underline decoration-dotted underline-offset-4"
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
