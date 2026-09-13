"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { updatePassword } from "../db";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        setReady(true);
      } else {
        setTimeout(async () => {
          const { data: retry } = await supabase.auth.getSession();
          if (retry?.session) {
            setReady(true);
          } else {
            setError("Invalid or expired reset link. Please request a new one.");
          }
        }, 1500);
      }
    };
    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return setError("Password must be at least 6 characters");
    if (password !== confirmPassword) return setError("Passwords do not match");

    setLoading(true);
    setError(null);

    try {
      await updatePassword(password);
      setSuccess(true);
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update password";
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
          <h1 className="font-serif text-3xl text-navy">Set new password</h1>
          <p className="text-muted mt-2 text-sm">Choose a strong password you&apos;ll remember</p>
        </div>

        {error && (
          <div className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
            ⚠ {error}
          </div>
        )}

        {success && (
          <div className="mb-5 p-6 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
            <div className="text-4xl mb-3">✅</div>
            <h2 className="font-serif text-xl text-emerald-800 mb-2">Password updated!</h2>
            <p className="text-sm text-emerald-700">Redirecting to dashboard…</p>
          </div>
        )}

        {ready && !success && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-navy/70 uppercase tracking-wider mb-2">
                New password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
                className="w-full px-4 py-3.5 rounded-xl border-2 border-navy/10 bg-white text-navy text-sm outline-none focus:border-gold focus:ring-4 focus:ring-gold/10"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy/70 uppercase tracking-wider mb-2">
                Confirm password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                required
                className="w-full px-4 py-3.5 rounded-xl border-2 border-navy/10 bg-white text-navy text-sm outline-none focus:border-gold focus:ring-4 focus:ring-gold/10"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl bg-gradient-to-b from-navy to-navy-light text-cream font-semibold text-sm shadow-lg shadow-navy/20 hover:-translate-y-0.5 transition-all disabled:opacity-50"
            >
              {loading ? "Updating…" : "Update password"}
            </button>
          </form>
        )}

        {!ready && !error && !success && (
          <div className="text-center">
            <div className="w-10 h-10 mx-auto rounded-full border-4 border-gold border-t-transparent animate-spin" />
            <p className="text-muted text-sm mt-4">Verifying reset link…</p>
          </div>
        )}
      </div>
    </div>
  );
}
