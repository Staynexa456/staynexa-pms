"use client";

import React, { useState } from "react";
import Link from "next/link";
import { signUp, createHotelForUser } from "../db";
import { supabase } from "../supabase";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [sent, setSent] = useState(false);

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

    if (!fullName.trim()) return setError("Please enter your name");
    if (!email.trim()) return setError("Please enter your email");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    if (password !== confirmPassword) return setError("Passwords do not match");
    if (!agreeTerms) return setError("Please agree to the Terms and Privacy Policy");

    setLoading(true);

    try {
      const result = await signUp(email.trim(), password, fullName.trim());

      const { data: sessionData } = await supabase.auth.getSession();
      const hasSession = !!sessionData?.session;

      const userId =
        sessionData?.session?.user?.id ||
        (result as { user?: { id?: string } })?.user?.id;

      if (userId) {
        try {
          await createHotelForUser(userId, `${fullName.trim()}'s Hotel`);
        } catch (onboardErr) {
          console.error("Onboarding error:", onboardErr);
        }
      }

      if (hasSession) {
        window.location.href = "/";
      } else {
        setSent(true);
        setLoading(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Signup failed";
      if (msg.toLowerCase().includes("already")) {
        setError("An account with this email already exists");
      } else if (msg.toLowerCase().includes("password")) {
        setError("Password is too weak. Use at least 6 characters.");
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-cream">
      {/* LEFT — Brand panel */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-gradient-to-br from-navy via-navy to-navy-light text-cream">
        <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full bg-gold/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-gold/5 blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between p-14 w-full">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-gold-light to-gold flex items-center justify-center font-serif text-navy text-2xl font-bold shadow-lg shadow-gold/30">
              S
            </div>
            <div>
              <h1 className="font-serif text-xl tracking-wide">Staynexa</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-gold/80">
                Hotel PMS
              </p>
            </div>
          </div>

          <div className="space-y-6 max-w-md">
            <p className="text-[10px] uppercase tracking-[0.2em] text-gold/80 font-semibold">
              Get started in 60 seconds
            </p>
            <h2 className="font-serif text-5xl leading-tight">
              Run your hotel like a pro
            </h2>
            <p className="text-cream/70 text-lg leading-relaxed">
              Join hundreds of modern hoteliers using Staynexa to manage
              reservations, guests, and revenue from one dashboard.
            </p>

            <div className="pt-6 grid grid-cols-2 gap-4">
              {[
                { num: "3 min", label: "Setup time" },
                { num: "100%", label: "Free to start" },
                { num: "24/7", label: "Cloud hosted" },
                { num: "∞", label: "Rooms & bookings" },
              ].map((stat, i) => (
                <div key={i} className="rounded-xl bg-white/5 border border-white/10 p-4">
                  <p className="font-serif text-2xl text-gold">{stat.num}</p>
                  <p className="text-xs text-cream/60 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-cream/40">
            © {new Date().getFullYear()} Staynexa · Vishara Elite Hotel
          </p>
        </div>
      </div>

      {/* RIGHT — Form or Success screen */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-10 overflow-y-auto">
        <div className="w-full max-w-md py-6">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-gold-light to-gold flex items-center justify-center font-serif text-navy text-2xl font-bold shadow-lg shadow-gold/30">
              S
            </div>
            <div>
              <h1 className="font-serif text-xl tracking-wide text-navy">Staynexa</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-gold-dark">
                Hotel PMS
              </p>
            </div>
          </div>

          {sent ? (
            /* ═══ SUCCESS SCREEN — Check your email ═══ */
            <div className="text-center">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-gold-light to-gold flex items-center justify-center text-4xl shadow-lg shadow-gold/30 mb-6">
                ✉️
              </div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-gold-dark font-semibold mb-2">
                Almost there!
              </p>
              <h1 className="font-serif text-4xl text-navy leading-tight mb-3">
                Check your email
              </h1>
              <p className="text-muted text-sm mb-2">
                We&apos;ve sent a confirmation link to
              </p>
              <p className="text-navy font-semibold text-base mb-6 break-words">
                {email}
              </p>

              <div className="bg-white border border-navy/10 rounded-2xl p-5 text-left mb-6">
                <p className="text-xs uppercase tracking-wider text-navy/60 font-semibold mb-3">
                  Next steps
                </p>
                <ol className="space-y-2 text-sm text-navy/80">
                  <li className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center text-gold text-xs flex-shrink-0 font-semibold">1</span>
                    <span>Open your email inbox</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center text-gold text-xs flex-shrink-0 font-semibold">2</span>
                    <span>Click the confirmation link</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center text-gold text-xs flex-shrink-0 font-semibold">3</span>
                    <span>Return here and sign in</span>
                  </li>
                </ol>
              </div>

              <p className="text-xs text-muted mb-6">
                Didn&apos;t receive it? Check your <strong>spam folder</strong>. The email is from{" "}
                <span className="text-navy font-medium">noreply@staynexa.in</span>.
              </p>

              <Link
                href="/login"
                className="inline-block w-full py-3.5 rounded-xl bg-gradient-to-b from-navy to-navy-light text-cream font-medium text-sm hover:-translate-y-0.5 transition-all"
              >
                Go to sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <p className="text-[10px] uppercase tracking-[0.2em] text-gold-dark font-semibold mb-2">
                  Create account
                </p>
                <h1 className="font-serif text-4xl text-navy leading-tight">
                  Start managing your hotel
                </h1>
                <p className="text-muted mt-2 text-sm">
                  Free forever. No credit card required.
                </p>
              </div>

              {error && (
                <div className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
                  <span className="text-rose-500 text-lg">⚠</span>
                  <p className="text-sm text-rose-700 font-medium">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-navy/70 uppercase tracking-wider mb-2">
                    Full name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                    required
                    disabled={loading}
                    className="w-full px-4 py-3.5 rounded-xl border-2 border-navy/10 bg-white text-navy text-sm outline-none focus:border-gold focus:ring-4 focus:ring-gold/10 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-navy/70 uppercase tracking-wider mb-2">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@hotel.com"
                    autoComplete="email"
                    required
                    disabled={loading}
                    className="w-full px-4 py-3.5 rounded-xl border-2 border-navy/10 bg-white text-navy text-sm outline-none focus:border-gold focus:ring-4 focus:ring-gold/10 disabled:opacity-50"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-baseline mb-2">
                    <label className="block text-xs font-semibold text-navy/70 uppercase tracking-wider">
                      Password
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
                    autoComplete="new-password"
                    required
                    disabled={loading}
                    className="w-full px-4 py-3.5 rounded-xl border-2 border-navy/10 bg-white text-navy text-sm outline-none focus:border-gold focus:ring-4 focus:ring-gold/10 disabled:opacity-50"
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
                    autoComplete="new-password"
                    required
                    disabled={loading}
                    className="w-full px-4 py-3.5 rounded-xl border-2 border-navy/10 bg-white text-navy text-sm outline-none focus:border-gold focus:ring-4 focus:ring-gold/10 disabled:opacity-50"
                  />
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-rose-500 mt-1.5">Passwords do not match</p>
                  )}
                </div>

                <label className="flex items-start gap-3 cursor-pointer py-2">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-gold cursor-pointer"
                  />
                  <span className="text-xs text-navy/70 leading-relaxed">
                    I agree to the{" "}
                    <a href="#" className="text-navy underline hover:text-gold-dark">Terms of Service</a>{" "}
                    and{" "}
                    <a href="#" className="text-navy underline hover:text-gold-dark">Privacy Policy</a>
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 rounded-xl bg-gradient-to-b from-navy to-navy-light text-cream font-semibold text-sm tracking-wide shadow-lg shadow-navy/20 hover:-translate-y-0.5 transition-all disabled:opacity-50"
                >
                  {loading ? "Creating account…" : "Create account →"}
                </button>
              </form>

              <div className="flex items-center gap-3 my-7">
                <div className="flex-1 h-px bg-navy/10" />
                <span className="text-xs text-muted uppercase tracking-widest">
                  Already have an account?
                </span>
                <div className="flex-1 h-px bg-navy/10" />
              </div>

              <Link
                href="/login"
                className="block w-full text-center py-3.5 rounded-xl border-2 border-navy/10 text-navy font-medium text-sm hover:bg-navy hover:text-cream hover:border-navy transition-all"
              >
                Sign in instead
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
