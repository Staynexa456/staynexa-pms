"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../supabase";

export default function SelectPlanPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [step, setStep] = useState<"plans" | "details">("plans");
  const [hotelData, setHotelData] = useState({
    name: "", city: "", state: "", address: "", phone: "", email: "", gst_number: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // ✅ চেক করুন ইউজার লগইন আছে কি না
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push("/login");
        return;
      }
      // ✅ আগের মতো অটো রিডাইরেক্ট করা হচ্ছে না
      // ইউজার এই পেজে এসেছে মানে সে নতুন হোটেল বানাতে চায়
    });

    // প্ল্যান লোড
    supabase
      .from("subscription_plans")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .then(({ data }) => {
        setPlans(data || []);
        setLoading(false);
      });
  }, [router]);

  const handleSelectPlan = (plan: any) => {
    setSelectedPlan(plan);
    setStep("details");
  };

  const handleCreateHotel = async () => {
    if (!hotelData.name) {
      alert("Please enter your hotel name");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      // ১. হোটেল তৈরি
      const { data: newHotel, error: hotelErr } = await supabase
        .from("hotels")
        .insert({
          name: hotelData.name,
          city: hotelData.city || null,
          state: hotelData.state || null,
          address: hotelData.address || null,
          phone: hotelData.phone || null,
          email: hotelData.email || null,
          gst_number: hotelData.gst_number || null,
          owner_id: user.id,
          is_active: true,
        })
        .select()
        .single();
      if (hotelErr) throw hotelErr;

      // ২. সাবস্ক্রিপশন সেভ
      if (selectedPlan) {
        const startDate = new Date();
        const endDate = new Date();
        if (selectedPlan.price_yearly > 0) endDate.setFullYear(endDate.getFullYear() + 1);
        else endDate.setMonth(endDate.getMonth() + 1);

        try {
          await supabase.from("subscription_history").insert({
            hotel_id: newHotel.id,
            plan: selectedPlan.code || selectedPlan.name,
            plan_name: selectedPlan.name,
            status: "active",
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            amount: selectedPlan.price_monthly || 0,
          });
        } catch (e) { console.warn("Subscription insert warning:", e); }
      }

      // ৩. ওনার লিংক
      try {
        await supabase.from("hotel_users").insert({
          user_id: user.id,
          hotel_id: newHotel.id,
          email: user.email || "",
          role: "owner",
        });
      } catch (e) { console.warn("hotel_users link warning:", e); }

      // ৪. অ্যাক্টিভ হোটেল সেট
      localStorage.setItem("activeHotelId", newHotel.id);

      // ৫. ড্যাশবোর্ডে রিডাইরেক্ট
      window.location.href = "/";
    } catch (err: any) {
      alert("Failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-teal-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto py-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-teal-50 border border-teal-200 rounded-full mb-4">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
            <span className="text-xs font-bold text-teal-700 uppercase tracking-wider">Welcome to Staynexa</span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-2">
            {step === "plans" ? "Choose Your Plan" : "Tell Us About Your Hotel"}
          </h1>
          <p className="text-sm text-slate-500 max-w-xl mx-auto">
            {step === "plans"
              ? "Select a subscription plan that fits your hotel's needs. You can change anytime."
              : "Just a few details and we'll set up your hotel dashboard instantly."}
          </p>
        </div>

        {step === "plans" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative p-6 border-2 rounded-3xl flex flex-col justify-between transition-all hover:shadow-xl ${
                  plan.is_popular ? "border-purple-500 shadow-lg shadow-purple-500/20 bg-white" : "border-slate-200 bg-white"
                }`}
              >
                {plan.is_popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    Most Popular
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-bold text-slate-800 mb-1">{plan.name}</h3>
                  <p className="text-xs text-slate-500 mb-4">{plan.description}</p>
                  <div className="mb-5">
                    <span className="text-3xl font-bold text-slate-900">₹{plan.price_monthly}</span>
                    <span className="text-sm text-slate-500">/mo</span>
                    {plan.price_yearly > 0 && (
                      <p className="text-[11px] text-slate-400 mt-1">or ₹{plan.price_yearly}/year</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-4 flex-wrap">
                    <span>🛏️ {plan.max_rooms} rooms</span>
                    <span>📅 {plan.max_bookings} bookings</span>
                    <span>👤 {plan.max_users} users</span>
                  </div>
                  <div className="space-y-2 mb-6">
                    {(plan.features || []).map((feature: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                        <span className="text-emerald-500 shrink-0 mt-0.5">✓</span>
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => handleSelectPlan(plan)}
                  className={`w-full py-3 rounded-xl text-sm font-bold transition ${
                    plan.is_popular
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:opacity-90 shadow-lg shadow-purple-600/20"
                      : "bg-teal-600 text-white hover:bg-teal-700 shadow-lg shadow-teal-600/20"
                  }`}
                >
                  Select {plan.name}
                </button>
              </div>
            ))}
          </div>
        )}

        {step === "details" && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl border-2 border-teal-200 p-5 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center text-white text-2xl shadow-lg">
                  💎
                </div>
                <div>
                  <p className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">Selected Plan</p>
                  <p className="text-lg font-bold text-slate-800">{selectedPlan?.name}</p>
                  <p className="text-xs text-slate-600">
                    ₹{selectedPlan?.price_monthly}/month · {selectedPlan?.max_rooms} rooms · {selectedPlan?.max_users} users
                  </p>
                </div>
              </div>
              <button
                onClick={() => setStep("plans")}
                className="text-xs font-bold text-teal-700 hover:text-teal-900 px-3 py-2 rounded-lg hover:bg-teal-50 transition"
              >
                Change Plan
              </button>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Hotel Name *</label>
                  <input type="text" value={hotelData.name} onChange={(e) => setHotelData({ ...hotelData, name: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none" placeholder="e.g. The Grand Palace Hotel" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">City</label>
                    <input type="text" value={hotelData.city} onChange={(e) => setHotelData({ ...hotelData, city: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none" placeholder="Bengaluru" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">State</label>
                    <input type="text" value={hotelData.state} onChange={(e) => setHotelData({ ...hotelData, state: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none" placeholder="Karnataka" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Full Address</label>
                  <input type="text" value={hotelData.address} onChange={(e) => setHotelData({ ...hotelData, address: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none" placeholder="123 Main Street, Area" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Phone</label>
                    <input type="text" value={hotelData.phone} onChange={(e) => setHotelData({ ...hotelData, phone: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none" placeholder="+91 98765 43210" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Email</label>
                    <input type="email" value={hotelData.email} onChange={(e) => setHotelData({ ...hotelData, email: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none" placeholder="hello@hotel.com" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">GST Number (Optional)</label>
                  <input type="text" value={hotelData.gst_number} onChange={(e) => setHotelData({ ...hotelData, gst_number: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none" placeholder="29ABCDE1234F1Z5" />
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
                  <span className="text-amber-500">💡</span>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    We'll auto-create 5 default rooms (101, 102, 201, 202, 301) so you can start taking bookings immediately.
                  </p>
                </div>
              </div>
              <button
                onClick={handleCreateHotel}
                disabled={saving || !hotelData.name}
                className="w-full mt-6 py-4 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-2xl font-bold text-sm hover:opacity-90 disabled:opacity-50 transition shadow-lg shadow-teal-500/30"
              >
                {saving ? "Creating Your Hotel..." : "🚀 Create Hotel & Open Dashboard"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
