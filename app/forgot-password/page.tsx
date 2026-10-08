"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!email.trim()) {
      setMessage({ type: "error", text: "Please enter your email" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setMessage({ type: "error", text: String(error.message || "Failed to send reset link") });
      } else {
        setMessage({
          type: "success",
          text: `Reset link sent to ${email}. Check your inbox.`,
        });
      }
    } catch (err: any) {
      setMessage({
        type: "error",
        text: typeof err?.message === "string" ? err.message : "Something went wrong",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fbfaf7] p-6">
      <div className="w-full max-w-md">
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

        {message && (
          <div
            className={`mb-5 p-4 rounded-xl border flex items-start gap-3 ${
              message.type === "error"
                ? "bg-rose-50 border-rose-200 text-rose-700"
                : "bg-emerald-50 border-emerald-200 text-emerald-700"
            }`}
          >
            <span className="text-lg flex-shrink-0">
              {message.type === "error" ? "⚠" : "✅"}
            </span>
            <p className="text-sm font-medium break-words">{message.text}</p>
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
            className="w-full py-4 rounded-xl bg-gradient-to-b from-slate-800 to-slate-900 text-white font-semibold text-sm tracking-wide shadow-lg shadow-slate-900/20 hover:-translate-y-0.5 transition-all disabled:opacity-50"
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
      </div>
    </div>
  );
}
