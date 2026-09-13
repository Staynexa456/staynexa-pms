"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "../db";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please enter email and password");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await signIn(email.trim(), password);
      router.push("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid credentials";
      if (msg.toLowerCase().includes("invalid")) {
        setError("Incorrect email or password");
      } else if (msg.toLowerCase().includes("email")) {
        setError("Please check your email address");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-cream">
      {/* LEFT SIDE — Brand panel */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-gradient-to-br from-navy via-navy to-navy-light text-cream">
        {/* Decorative circles */}
        <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full bg-gold/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-gold/5 blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between p-14 w-full">
          {/* Logo */}
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

          {/* Headline */}
          <div className="space-y-6 max-w-md">
            <h2 className="font-serif text-5xl leading-tight">
              The modern way to run your hotel
            </h2>
            <p className="text-cream/70 text-lg leading-relaxed">
              Manage reservations, check-ins, payments, and rates from one
              beautiful dashboard. Built for modern hoteliers.
            </p>

            <div className="space-y-3 pt-6">
              {[
                "Real-time reservations across all channels",
                "One-click check-in and check-out",
                "Instant pricing updates to OTAs",
                "Complete guest and payment history",
              ].map((line, i) => (
                <div key={i} className="flex items-center gap-3 text-cream/80 text-sm">
                  <div className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-gold text-xs">✓</span>
                  </div>
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p className="text-xs text-cream/40">
            © {new Date().getFullYear()} Staynexa · Vishara Elite Hotel
          </p>
        </div>
      </div>

      {/* RIGHT SIDE — Login form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
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

          {/* Heading */}
          <div className="mb-8">
            <p className="text-[10px] uppercase tracking-[0.2em] text-gold-dark font-semibold mb-2">
              Welcome back
            </p>
            <h1 className="font-serif text-4xl text-navy leading-tight">
              Sign in to your property
            </h1>
            <p className="text-muted mt-2 text-sm">
              Enter your credentials to access the dashboard
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
              <span className="text-rose-500 text-lg">⚠</span>
              <p className="text-sm text-rose-700 font-medium">{error}</p>
            </div>
          )}

          {/* Form */}
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
                autoComplete="email"
                required
                className="w-full px-4 py-3.5 rounded-xl border-2 border-navy/10 bg-white text-navy text-sm outline-none transition-all focus:border-gold focus:ring-4 focus:ring-gold/10"
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
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="w-full px-4 py-3.5 rounded-xl border-2 border-navy/10 bg-white text-navy text-sm outline-none transition-all focus:border-gold focus:ring-4 focus:ring-gold/10"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl bg-gradient-to-b from-navy to-navy-light text-cream font-semibold text-sm tracking-wide shadow-lg shadow-navy/20 hover:-translate-y-0.5 hover:shadow-xl transition-all disabled:opacity-50 disabled:transform-none"
            >
              {loading ? "Signing in…" : "Sign in →"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-7">
            <div className="flex-1 h-px bg-navy/10" />
            <span className="text-xs text-muted uppercase tracking-widest">
              New to Staynexa?
            </span>
            <div className="flex-1 h-px bg-navy/10" />
          </div>

          {/* Sign up link */}
          <Link
            href="/signup"
            className="block w-full text-center py-3.5 rounded-xl border-2 border-navy/10 text-navy font-medium text-sm hover:bg-navy hover:text-cream hover:border-navy transition-all"
          >
            Create a new account
          </Link>

          {/* Footer */}
          <p className="text-center text-xs text-muted mt-8">
            By continuing, you agree to our{" "}
            <a href="#" className="text-navy underline hover:text-gold-dark">
              Terms
            </a>{" "}
            and{" "}
            <a href="#" className="text-navy underline hover:text-gold-dark">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
