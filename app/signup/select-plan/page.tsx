"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../supabase";

export default function SelectPlanPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [step, setStep] = useState<"plans" | "details" | "payment">("plans");
  const [hotelData, setHotelData] = useState({
    name: "", city: "", state: "", address: "", phone: "", email: "", gst_number: "",
  });
  const [paySettings, setPaySettings] = useState<any>(null);
  const [utrNumber, setUtrNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [createdHotelId, setCreatedHotelId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push("/login");
    });

    Promise.all([
      supabase.from("subscription_plans").select("*").eq("is_active", true).order("display_order"),
      supabase.from("platform_payment_settings").select("*").maybeSingle(),
    ]).then(([plansRes, payRes]) => {
      setPlans(plansRes.data || []);
      setPaySettings(payRes.data || { active_gateway: "upi", upi_id: "", upi_name: "" });
      setLoading(false);
    });
  }, [router]);

  const handleSelectPlan = (plan: any) => {
    setSelectedPlan(plan);
    setStep("details");
  };

  // ✅ ধাপ ২ → ধাপ ৩: হোটেল তৈরি (inactive) + Payment Step
  const handleCreateHotelAndPay = async () => {
    if (!hotelData.name) {
      alert("Please enter your hotel name");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");
// ✅ ৫টি ডিফল্ট রুম তৈরি করা
const defaultRooms = [
  { room_number: "101", room_type: "Standard Room", base_price: 2000, hotel_id: newHotel.id },
  { room_number: "102", room_type: "Standard Room", base_price: 2000, hotel_id: newHotel.id },
  { room_number: "201", room_type: "Deluxe Room", base_price: 3000, hotel_id: newHotel.id },
  { room_number: "202", room_type: "Deluxe Room", base_price: 3000, hotel_id: newHotel.id },
  { room_number: "301", room_type: "Executive Suite", base_price: 5000, hotel_id: newHotel.id },
];

const { error: roomsErr } = await supabase.from("rooms").insert(defaultRooms);
if (roomsErr) console.warn("Default rooms insert warning:", roomsErr);
      // ১. হোটেল তৈরি — is_active = FALSE (পেমেন্টের পর অ্যাডমিন চালু করবে)
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
          is_active: false, // ✅ পেমেন্ট পেন্ডিং
        })
        .select()
        .single();
      if (hotelErr) throw hotelErr;

      // ২. সাবস্ক্রিপশন তৈরি — status = 'pending_payment'
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
            status: "pending_payment",
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            amount: selectedPlan.price_monthly || 0,
          });
        } catch (e) { console.warn("Subscription insert warning:", e); }
      }

      // ৩. hotel_users লিংক
      try {
        await supabase.from("hotel_users").insert({
          user_id: user.id,
          hotel_id: newHotel.id,
          email: user.email || "",
          role: "owner",
        });
      } catch (e) { console.warn("hotel_users link warning:", e); }

      setCreatedHotelId(newHotel.id);
      setStep("payment");
    } catch (err: any) {
      alert("Failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ✅ UPI Payment Submit — UTR সেভ করে Admin approval-এর অপেক্ষা
  const handleSubmitPayment = async () => {
    if (!utrNumber || utrNumber.length < 8) {
      alert("Please enter a valid 12-digit UTR number");
      return;
    }
    if (!createdHotelId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("feature_requests").insert({
        hotel_id: createdHotelId,
        feature_code: "subscription",
        status: "pending",
        payment_status: "pending_verification",
        payment_id: utrNumber,
        amount_paid: selectedPlan?.price_monthly || 0,
        notes: `New hotel subscription payment. Plan: ${selectedPlan?.name}. UTR: ${utrNumber}`,
      });
      if (error) throw error;

      alert("✅ Payment submitted! Please wait for admin approval. You'll be notified soon.");
      router.push("/login");
    } catch (err: any) {
      alert("Failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const generateUpiLink = () => {
    if (!selectedPlan || !paySettings?.upi_id) return "#";
    const amount = selectedPlan.price_monthly;
    const name = encodeURIComponent(paySettings.upi_name || "Staynexa");
    const note = encodeURIComponent(`Hotel Subscription - ${selectedPlan.name}`);
    return `upi://pay?pa=${paySettings.upi_id}&pn=${name}&am=${amount}&cu=INR&tn=${note}`;
  };

  const generateQrUrl = () => {
    const upiLink = generateUpiLink();
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiLink)}`;
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
            <span className="text-xs font-bold text-teal-700 uppercase tracking-wider">
              {step === "payment" ? "Complete Payment" : "Welcome to Staynexa"}
            </span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-2">
            {step === "plans" && "Choose Your Plan"}
            {step === "details" && "Tell Us About Your Hotel"}
            {step === "payment" && "Complete Your Payment"}
          </h1>
          <p className="text-sm text-slate-500 max-w-xl mx-auto">
            {step === "plans" && "Select a subscription plan for your new property. You can change anytime."}
            {step === "details" && "Just a few details and we'll set up your hotel dashboard."}
            {step === "payment" && "Pay via UPI. After payment, admin will verify and activate your account."}
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
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                      : "bg-teal-600 text-white hover:bg-teal-700"
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
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center text-white text-2xl">💎</div>
                <div>
                  <p className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">Selected Plan</p>
                  <p className="text-lg font-bold text-slate-800">{selectedPlan?.name}</p>
                  <p className="text-xs text-slate-600">₹{selectedPlan?.price_monthly}/month</p>
                </div>
              </div>
              <button onClick={() => setStep("plans")} className="text-xs font-bold text-teal-700 px-3 py-2 rounded-lg hover:bg-teal-50">
                Change
              </button>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Hotel Name *</label>
                <input type="text" value={hotelData.name} onChange={(e) => setHotelData({ ...hotelData, name: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none" placeholder="e.g. The Grand Palace Hotel" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">City</label>
                  <input type="text" value={hotelData.city} onChange={(e) => setHotelData({ ...hotelData, city: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">State</label>
                  <input type="text" value={hotelData.state} onChange={(e) => setHotelData({ ...hotelData, state: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Address</label>
                <input type="text" value={hotelData.address} onChange={(e) => setHotelData({ ...hotelData, address: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Phone</label>
                  <input type="text" value={hotelData.phone} onChange={(e) => setHotelData({ ...hotelData, phone: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Email</label>
                  <input type="email" value={hotelData.email} onChange={(e) => setHotelData({ ...hotelData, email: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">GST Number (Optional)</label>
                <input type="text" value={hotelData.gst_number} onChange={(e) => setHotelData({ ...hotelData, gst_number: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none" />
              </div>

              <button
                onClick={handleCreateHotelAndPay}
                disabled={saving || !hotelData.name}
                className="w-full mt-4 py-4 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-2xl font-bold text-sm disabled:opacity-50 transition shadow-lg shadow-teal-500/30"
              >
                {saving ? "Processing..." : "Continue to Payment →"}
              </button>
            </div>
          </div>
        )}

        {step === "payment" && selectedPlan && (
          <div className="max-w-lg mx-auto">
            <div className="bg-white rounded-3xl border-2 border-amber-200 shadow-xl p-8 text-center">
              <div className="mb-6 pb-6 border-b border-slate-100">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full mb-3">
                  <span className="text-amber-500 text-xs">⚠</span>
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Payment Pending</span>
                </div>
                <h2 className="text-lg font-bold text-slate-800 mb-1">{selectedPlan.name} Plan</h2>
                <p className="text-3xl font-bold text-teal-600 mt-2">₹{selectedPlan.price_monthly}</p>
                <p className="text-xs text-slate-500 mt-1">Pay securely via UPI</p>
              </div>

              {paySettings?.upi_id && paySettings.upi_id !== "yourupi@upi" ? (
                <>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-4 inline-block">
                    <img src={generateQrUrl()} alt="UPI QR" className="w-52 h-52 mx-auto" />
                    <p className="text-[10px] text-slate-400 mt-2 font-mono">Scan with any UPI App</p>
                  </div>

                  <div className="flex items-center justify-center gap-2 bg-slate-100 px-4 py-2 rounded-xl mb-4">
                    <span className="text-xs text-slate-500">UPI ID:</span>
                    <span className="text-sm font-bold font-mono text-slate-800">{paySettings.upi_id}</span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(paySettings.upi_id); alert("Copied!"); }}
                      className="text-[10px] text-teal-600 font-bold ml-2"
                    >
                      Copy
                    </button>
                  </div>

                  <a
                    href={generateUpiLink()}
                    className="w-full py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl font-bold text-sm shadow-lg mb-6 block"
                  >
                    📱 Pay via GPay / PhonePe / Paytm
                  </a>
                </>
              ) : (
                <div className="bg-amber-50 text-amber-700 text-xs p-4 rounded-xl mb-4">
                  ⚠️ UPI not configured. Please contact support.
                </div>
              )}

              <div className="text-left">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                  Enter 12-digit UTR / Transaction ID
                </label>
                <input
                  type="text"
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value.replace(/\D/g, "").slice(0, 12))}
                  placeholder="e.g. 123456789012"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none text-center font-mono tracking-widest text-lg"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  After paying, copy the UTR from your UPI app and paste it here.
                </p>
              </div>

              <button
                onClick={handleSubmitPayment}
                disabled={saving || utrNumber.length < 8}
                className="w-full mt-6 py-4 bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-2xl font-bold text-sm disabled:opacity-50 transition shadow-lg"
              >
                {saving ? "Submitting..." : "✓ Submit Payment for Approval"}
              </button>

              <p className="text-[10px] text-slate-400 mt-3">
                After admin verifies your payment, your hotel will be activated. This usually takes a few hours.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
