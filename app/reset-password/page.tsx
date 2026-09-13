"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../supabase";
import { updatePassword } from "../db";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Supabase handles the reset token in the URL fragment via auth callback
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        setReady(true);
        return;
      }
      // Wait a moment for Supabase to process the URL token
      setTimeout(async () => {
        const { data: retry } = await supabase.auth.getSession();
        if (retry?.session) {
          setReady(true);
        } else {
          setError(
            "This reset link is invalid or has expired. Please request a new one."
          );
        }
      }, 1500);
    };
    checkSession();
  }, []);

  const getStrength = () => {
    if (!password) return { level: 0, label: "", color: "" };
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (score <= 1) return { level: 1, label: "Weak", color: "bg-rose-500" };
    if (score === 2) return { level: 2, label: "Fair", color: "bg-amber-500" };
    if (score === 3) return { level: 3, label: "Good", color: "bg-emerald-500" };
    return { level: 4, label: "Strong", color: "bg-emerald-600" };
  };
  const strength = getStrength();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      await updatePassword(password);
      setSuccess(true);

      // Sign out to force re-login with new password
      await supabase.auth.signOut();

      // Redirect to login after 2.5s
      setTimeout(() => {
        window.location.href = "/login";
      }, 2500);
    } catch (err) {
      console.error("Update password error:", err);
      const msg = err instanceof Error ? err.message : "Failed to update password";
      setError(msg);
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
            Set new password
          </h1>
          <p className="text-muted mt-3 text-sm">
            Choose a strong password you&apos;ll remember
          </p>
        </div>

        {success ? (
          /* ═══ Success screen ═══ */
          <div className="bg-white border border-navy/10 rounded-2xl p-6 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-3xl mb-4">
              ✅
            </div>
            <h2 className="font-serif text-2xl text-navy mb-3">
              Password updated!
            </h2>
            <p className="text-sm text-navy/70 mb-4">
              Your password has been changed successfully.
            </p>
            <p className="text-xs text-muted mb-4">
              Redirecting to sign in…
            </p>
            <div className="w-6 h-6 mx-auto rounded-full border-2 border-gold border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
                <span className="text-rose-500 text-lg flex-shrink-0">⚠</span>
                <div>
                  <p className="text-sm text-rose-700 font-medium">{error}</p>
                  {error.includes("expired") && (
                    <Link
                      href="/forgot-password"
                      className="text-xs text-navy underline mt-2 inline-block"
                    >
                      Request a new reset link →
                    </Link>
                  )}
                </div>
              </div>
            )}

            {ready && (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <div className="flex justify-between items-baseline mb-2">
                    <label className="block text-xs font-semibold text-navy/70 uppercase tracking-wider">
                      New password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-xs text-gold-dark font-medium hover:underline"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    autoComplete="new-password"
                    className="w-full px-4 py-3.5 rounded-xl border-2 border-navy/10 bg-white text-navy text-sm outline-none focus:border-gold focus:ring-4 focus:ring-gold/10"
                  />
                  {password && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-navy/10 overflow-hidden">
                        <div
                          className={`h-full ${strength.color} transition-all`}
                          style={{ width: `${(strength.level / 4) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-navy/60">
                        {strength.label}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-navy/70 uppercase tracking-wider mb-2">
                    Confirm password
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    required
                    autoComplete="new-password"
                    className="w-full px-4 py-3.5 rounded-xl border-2 border-navy/10 bg-white text-navy text-sm outline-none focus:border-gold focus:ring-4 focus:ring-gold/10"
                  />
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-rose-500 mt-1.5">
                      Passwords do not match
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 rounded-xl bg-gradient-to-b from-navy to-navy-light text-cream font-semibold text-sm tracking-wide shadow-lg shadow-navy/20 hover:-translate-y-0.5 transition-all disabled:opacity-50"
                >
                  {loading ? "Updating…" : "Update password"}
                </button>
              </form>
            )}

            {!ready && !error && (
              <div className="text-center">
                <div className="w-10 h-10 mx-auto rounded-full border-4 border-gold border-t-transparent animate-spin" />
                <p className="text-muted text-sm mt-4">
                  Verifying reset link…
                </p>
              </div>
            )}

            {!ready && error && (
              <div className="text-center mt-6">
                <Link
                  href="/forgot-password"
                  className="text-sm text-navy underline decoration-dotted underline-offset-4 hover:text-gold-dark"
                >
                  ← Request a new reset link
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
