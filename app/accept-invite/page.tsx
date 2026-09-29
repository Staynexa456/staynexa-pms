// app/accept-invite/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "../supabase";

export default function AcceptInvitePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "valid" | "invalid" | "success">("loading");
  const [invite, setInvite] = useState<any>(null);
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkToken() {
      if (!token) {
        setStatus("invalid");
        return;
      }

      const { data, error } = await supabase
        .from("hotel_users")
        .select("*, hotel:hotels(id, name)")
        .eq("invite_token", token)
        .eq("status", "pending")
        .maybeSingle();

      if (error || !data) {
        setStatus("invalid");
        return;
      }

      if (data.invite_expires_at && new Date(data.invite_expires_at) < new Date()) {
        setStatus("invalid");
        return;
      }

      setInvite(data);
      setFullName(data.name || "");
      setStatus("valid");
    }
    checkToken();
  }, [token]);

  const handleAccept = async () => {
    if (!invite) return;
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // Check if user exists
      const { data: existingUser } = await supabase.auth.signInWithPassword({
        email: invite.email,
        password,
      });

      let userId: string;

      if (existingUser?.user) {
        userId = existingUser.user.id;
      } else {
        // Sign up new user
        const { data: authData, error: signupErr } = await supabase.auth.signUp({
          email: invite.email,
          password,
          options: { data: { full_name: fullName } },
        });

        if (signupErr) throw signupErr;
        if (!authData.user) throw new Error("Signup failed");
        userId = authData.user.id;
      }

      // Update hotel_users
      await supabase
        .from("hotel_users")
        .update({
          user_id: userId,
          name: fullName,
          status: "active",
          invite_token: null,
          invite_expires_at: null,
          last_login_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", invite.id);

      // Save hotel selection
      if (typeof window !== "undefined") {
        localStorage.setItem("selected_hotel_id", invite.hotel_id);
        localStorage.setItem("selected_hotel_name", invite.hotel?.name || "");
      }

      setStatus("success");
      setTimeout(() => router.push("/dashboard"), 2000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to accept invite");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">
        {status === "loading" && (
          <div className="text-center">
            <div className="w-12 h-12 mx-auto rounded-full border-4 border-teal-500 border-t-transparent animate-spin" />
            <p className="text-sm text-slate-500 mt-4">Verifying invitation...</p>
          </div>
        )}

        {status === "invalid" && (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-rose-100 flex items-center justify-center text-3xl">⚠️</div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Invalid Invitation</h1>
            <p className="text-sm text-slate-500">
              This invitation link is invalid or has expired. Please ask your team admin to send a new one.
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center text-3xl">✓</div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Welcome Aboard!</h1>
            <p className="text-sm text-slate-500">
              You've joined {invite?.hotel?.name}. Redirecting...
            </p>
          </div>
        )}

        {status === "valid" && invite && (
          <>
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center text-3xl">🎉</div>
              <h1 className="text-2xl font-serif font-bold text-slate-900">You're Invited!</h1>
              <p className="text-sm text-slate-500 mt-2">
                Join <strong>{invite.hotel?.name}</strong> as <strong>{invite.role}</strong>
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase block mb-2">Email</label>
                <input
                  type="email"
                  value={invite.email}
                  disabled
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase block mb-2">Your Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase block mb-2">Set Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500"
                />
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                  {error}
                </div>
              )}

              <button
                onClick={handleAccept}
                disabled={processing || !password}
                className="w-full py-4 bg-teal-600 text-white rounded-xl text-sm font-bold uppercase tracking-wider hover:bg-teal-700 disabled:opacity-50 transition"
              >
                {processing ? "Setting up..." : "Accept & Join Team"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
