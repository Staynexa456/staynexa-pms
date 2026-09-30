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

  // ✅ সাইনআপ পেজে ঢুকলেই পুরনো সেশন সাইন-আউট হয়ে যাবে
  useEffect(() => {
    async function clearSession() {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          await supabase.auth.signOut();
          if (typeof window !== "undefined") {
            localStorage.removeItem("activeHotelId");
            localStorage.removeItem("theme");
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

    // Basic validation
    if (!fullName.trim()) return setError("Please enter your full name");
    if (!email.trim()) return setError("Please enter your email");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    if (password !== confirmPassword) return setError("Passwords do not match");

    setLoading(true);
    try {
      const result = await signUp(email.trim(), password, fullName.trim());

      if (!result?.user) {
        throw new Error("Signup failed. Please try again.");
      }

      // ✅ সাইনআপ সফল — এখন প্ল্যান সিলেকশন পেজে যাবে
      router.push("/signup/select-plan");
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4">
      <div className="w-full max-w-md">
        {/* LOGO */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 group">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center font-bold text-white text-2xl shadow-lg shadow-teal-500/30 group-hover:scale-105 transition">
              S
            </div>
            <div className="text-left">
              <h1 className="text-xl font-bold text-slate-800 tracking-tight">Staynexa</h1>
              <p className="text-[10px] uppercase tracking-widest text-teal-600 font-bold">Hotel PMS</p>
            </div>
          </Link>
        </div>

        {/* CARD */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-1">Create Your Account</h2>
            <p className="text-sm text-slate-500">
              Start managing your hotel in less than 2 minutes.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2">
              <span className="text-rose-500 text-sm">⚠</span>
              <p className="text-xs font-medium text-rose-700 flex-1">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none transition text-sm"
                placeholder="e.g. Rahul Sharma"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none transition text-sm"
                placeholder="you@hotel.com"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none transition text-sm"
                placeholder="Minimum 6 characters"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none transition text-sm"
                placeholder="Re-enter password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-50 transition shadow-lg shadow-teal-500/30 flex items-center justify-center gap-2"
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

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Already have an account?{" "}
              <Link href="/login" className="font-bold text-teal-600 hover:text-teal-700">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* FOOTER NOTE */}
        <p className="text-center text-[11px] text-slate-400 mt-6">
          By signing up, you agree to our Terms & Privacy Policy.
        </p>
      </div>
    </div>
  );
}
