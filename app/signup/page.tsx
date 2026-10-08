// app/signup/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUp } from "../db";
import { supabase } from "../supabase";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    async function clearSession() {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          await supabase.auth.signOut();
          if (typeof window !== "undefined") {
            localStorage.removeItem("activeHotelId");
          }
        }
      } catch (err) {
        console.warn("[signup] Session cleanup failed:", err);
      }
    }
    clearSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) return setError("Please enter your full name");
    if (!email.trim()) return setError("Please enter your email");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    if (password !== confirmPassword) return setError("Passwords do not match");

    setLoading(true);
    try {
      // ✅ FIX: metadata as object (not string)
      const result = await signUp(email.trim(), password, {
        full_name: fullName.trim(),
      });

      if (!result?.user) throw new Error("Signup failed. Please try again.");
      router.push("/signup/select-plan");
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* LEFT SIDE — BRANDING */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-12 flex-col justify-between overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-teal-500/10 to-cyan-500/5 rounded-full blur-3xl -mr-40 -mt-40" />

        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center font-serif text-white text-2xl font-bold shadow-lg shadow-teal-500/30">
              S
            </div>
            <div>
              <h1 className="font-serif text-xl font-semibold text-white tracking-wide">Staynexa</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: "#c9a227" }}>
                Hotel PMS
              </p>
            </div>
          </Link>
        </div>

        <div className="relative z-10 max-w-lg">
          <h2 className="font-serif text-5xl font-semibold text-white leading-tight mb-6">
            Start running<br />
            your hotel<br />
            <span style={{ color: "#c9a227" }}>smarter</span>
          </h2>

          <p className="text-sm text-slate-300 leading-relaxed mb-8">
            Join hundreds of modern hoteliers who trust Staynexa to manage their
            reservations, guests, and revenue — all from one beautiful dashboard.
          </p>

          <div className="space-y-3">
            {[
              "Free 14-day trial · No credit card required",
              "Auto-setup with 5 default rooms",
              "Direct booking engine included",
              "Real-time revenue & occupancy analytics",
              "Multi-property support from day one",
            ].map((feature, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-teal-500/20 border border-teal-500/40 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-teal-400 text-[10px] font-bold">✓</span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{feature}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-[11px] text-slate-500">
          © {new Date().getFullYear()} Staynexa · Built for modern hoteliers
        </div>
      </div>

      {/* RIGHT SIDE — FORM */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 bg-[#fbfaf7]">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center font-bold text-white text-2xl shadow-lg shadow-teal-500/30">
                S
              </div>
              <div className="text-left">
                <h1 className="text-xl font-bold text-slate-800">Staynexa</h1>
                <p className="text-[10px] uppercase tracking-widest text-teal-600 font-bold">Hotel PMS</p>
              </div>
            </Link>
          </div>

          <div className="mb-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: "#c9a227" }}>
              Get Started
            </p>
            <h2 className="font-serif text-4xl font-semibold text-slate-900 mb-2">
              Create your account
            </h2>
            <p className="text-sm text-slate-500">
              Start managing your property in under 2 minutes.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2">
              <span className="text-rose-500 text-sm">⚠</span>
              <p className="text-xs font-medium text-rose-700 flex-1">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none transition text-sm bg-white"
                placeholder="e.g. Rahul Sharma"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none transition text-sm bg-white"
                placeholder="you@hotel.com"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none transition text-sm bg-white pr-14"
                  placeholder="Minimum 6 characters"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-teal-600 hover:text-teal-700"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                Confirm Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none transition text-sm bg-white"
                placeholder="Re-enter password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-900 hover:to-black text-white rounded-lg font-bold text-sm transition shadow-lg shadow-slate-800/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  Creating account...
                </>
              ) : (
                <>Create Account →</>
              )}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-[0.2em] font-bold">
              <span className="px-3 bg-[#fbfaf7] text-slate-400">
                Already have an account?
              </span>
            </div>
          </div>

          <Link
            href="/login"
            className="block w-full py-3 border border-slate-200 rounded-lg text-center font-bold text-sm text-slate-700 hover:bg-slate-50 transition bg-white"
          >
            Sign in to your property
          </Link>

          <p className="text-center text-[11px] text-slate-400 mt-6">
            By continuing, you agree to our{" "}
            <a href="#" className="underline hover:text-slate-600">Terms</a> and{" "}
            <a href="#" className="underline hover:text-slate-600">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}
