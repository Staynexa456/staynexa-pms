// app/onboarding/hotel-setup/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../supabase";

export default function HotelSetupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkAuth() {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        router.push("/login");
        return;
      }
      setEmail(session.session.user.email || "");
    }
    checkAuth();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) return setError("Hotel name is required");
    if (!phone.trim() || phone.replace(/\D/g, "").length < 10) return setError("Please enter a valid phone number");
    if (!city.trim()) return setError("City is required");

    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) throw new Error("Please login again");

      const userId = session.session.user.id;

      // Generate slug
      const slug = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      // Create hotel
      const { data: hotel, error: hotelError } = await supabase
        .from("hotels")
        .insert({
          name: name.trim(),
          slug,
          phone: phone.trim(),
          email: email.trim() || null,
          address: address.trim() || null,
          city: city.trim(),
          state: state.trim() || null,
          pincode: pincode.trim() || null,
          gst_number: gstNumber.trim() || null,
          owner_id: userId,
          status: "active",
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (hotelError) throw hotelError;

      // Create 5 default rooms
      const defaultRooms = Array.from({ length: 5 }, (_, i) => ({
        hotel_id: hotel.id,
        room_number: String(101 + i),
        room_type: "Standard",
        base_price: 1500,
        max_adults: 2,
        max_children: 0,
        max_infants: 0,
        housekeeping_status: "CLEAN",
        is_active: true,
      }));

      await supabase.from("rooms").insert(defaultRooms);

      // Save active hotel
      localStorage.setItem("activeHotelId", hotel.id);

      // Redirect to dashboard
      router.push("/dashboard");
    } catch (err: any) {
      console.error("[Hotel Setup] Error:", err);
      setError(err?.message || "Failed to create hotel. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <div className="border-b border-white/10 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white font-bold">S</div>
            <span className="text-lg font-bold">Staynexa</span>
          </Link>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-emerald-400 font-semibold">✓ Plan Selected</span>
            <span className="text-white/40">→</span>
            <span className="text-emerald-400 font-semibold">✓ Payment</span>
            <span className="text-white/40">→</span>
            <span className="text-white font-bold">3. Hotel Setup</span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="text-center mb-10">
          <p className="text-xs font-bold tracking-widest text-amber-400 uppercase mb-3">Step 3 of 3</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-3">Set Up Your Hotel</h1>
          <p className="text-slate-400 text-sm">
            Tell us about your property to complete onboarding
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
            <span className="text-rose-400 text-lg">⚠</span>
            <p className="text-sm text-rose-200">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-3xl p-8">
          <div className="space-y-5">
            {/* Hotel Name */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Hotel / Property Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Hotel Sonar Tori"
                required
                className="w-full px-4 py-3 bg-white/5 border-2 border-white/10 rounded-xl text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/20 text-white placeholder:text-slate-500"
              />
            </div>

            {/* Phone + Email */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Phone *
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  required
                  className="w-full px-4 py-3 bg-white/5 border-2 border-white/10 rounded-xl text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/20 text-white placeholder:text-slate-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="hotel@example.com"
                  className="w-full px-4 py-3 bg-white/5 border-2 border-white/10 rounded-xl text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/20 text-white placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Full Address
              </label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, area, landmark..."
                rows={2}
                className="w-full px-4 py-3 bg-white/5 border-2 border-white/10 rounded-xl text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/20 text-white placeholder:text-slate-500 resize-none"
              />
            </div>

            {/* City, State, Pincode */}
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  City *
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Agartala"
                  required
                  className="w-full px-4 py-3 bg-white/5 border-2 border-white/10 rounded-xl text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/20 text-white placeholder:text-slate-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  State
                </label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="e.g. Tripura"
                  className="w-full px-4 py-3 bg-white/5 border-2 border-white/10 rounded-xl text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/20 text-white placeholder:text-slate-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Pincode
                </label>
                <input
                  type="text"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="e.g. 799001"
                  className="w-full px-4 py-3 bg-white/5 border-2 border-white/10 rounded-xl text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/20 text-white placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* GST */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                GST Number (Optional)
              </label>
              <input
                type="text"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value)}
                placeholder="e.g. 16AAAAA0000A1Z5"
                className="w-full px-4 py-3 bg-white/5 border-2 border-white/10 rounded-xl text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/20 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex gap-3">
              <span className="text-emerald-400 shrink-0">✓</span>
              <p className="text-xs text-emerald-200 leading-relaxed">
                We'll auto-create 5 default rooms (101-105). You can edit them from Settings later.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-teal-500/20 disabled:opacity-50 transition"
            >
              {loading ? "Creating your hotel..." : "Complete Setup →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
