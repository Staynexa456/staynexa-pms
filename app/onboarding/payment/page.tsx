// app/onboarding/payment/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../supabase";

type Plan = {
  name: string;
  price: number;
  features: string[];
};

const PLANS: Record<string, Plan> = {
  starter: {
    name: "Starter",
    price: 999,
    features: ["Up to 10 rooms", "Booking calendar", "Payment tracking", "Email support"],
  },
  professional: {
    name: "Professional",
    price: 2499,
    features: ["Up to 50 rooms", "Booking engine", "Housekeeping", "Reports & Analytics", "Priority support"],
  },
  business: {
    name: "Business",
    price: 4999,
    features: ["Unlimited rooms", "Multi-property", "Channel Manager", "Dedicated manager", "24/7 support"],
  },
};

export default function OnboardingPaymentPage() {
  const router = useRouter();
  const [planKey, setPlanKey] = useState<string>("professional");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "bank">("upi");
  const [utrNumber, setUtrNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    async function loadPlan() {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        router.push("/login");
        return;
      }
      setUserEmail(session.session.user.email || null);

      // Get plan from URL or localStorage
      const urlParams = new URLSearchParams(window.location.search);
      const planFromUrl = urlParams.get("plan");
      const storedPlan = localStorage.getItem("selectedPlan");
      const cycle = localStorage.getItem("billingCycle") as "monthly" | "yearly" | null;

      const plan = planFromUrl || storedPlan || "professional";
      setPlanKey(plan in PLANS ? plan : "professional");
      if (cycle) setBillingCycle(cycle);
    }
    loadPlan();
  }, [router]);

  const currentPlan = PLANS[planKey];
  const totalAmount = billingCycle === "yearly" ? Math.round(currentPlan.price * 12 * 0.8) : currentPlan.price;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!utrNumber.trim() || utrNumber.trim().length < 6) {
      setError("Please enter a valid UTR/Transaction Reference number (minimum 6 characters)");
      return;
    }

    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) throw new Error("Please login again");

      const userId = session.session.user.id;

      // Save payment transaction
      const { error: txnError } = await supabase
        .from("payment_transactions")
        .insert({
          hotel_id: null,
          booking_id: null,
          amount: totalAmount,
          gateway: paymentMethod === "upi" ? "UPI" : "Bank Transfer",
          gateway_order_id: utrNumber.trim(),
          gateway_payment_id: null,
          currency: "INR",
          status: "pending_verification",
          metadata: {
            user_id: userId,
            plan: planKey,
            plan_name: currentPlan.name,
            billing_cycle: billingCycle,
            email: userEmail,
            is_subscription: true,
          },
          created_at: new Date().toISOString(),
        });

      if (txnError) {
        console.error("[Payment] Save failed:", txnError);
        // Continue anyway - admin can find it by UTR
      }

      // Store plan info for next step
      localStorage.setItem("selectedPlan", planKey);
      localStorage.setItem("billingCycle", billingCycle);
      localStorage.setItem("paymentUTR", utrNumber.trim());

      // Redirect to hotel setup
      router.push("/onboarding/hotel-setup");
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
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
            <span className="text-white font-bold">2. Payment</span>
            <span className="text-white/40">→</span>
            <span className="text-white/50">3. Hotel Setup</span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="text-center mb-10">
          <p className="text-xs font-bold tracking-widest text-amber-400 uppercase mb-3">Step 2 of 3</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-3">Complete Your Payment</h1>
          <p className="text-slate-400 text-sm">
            Complete the payment to activate your {currentPlan.name} plan
          </p>
        </div>

        {error && (
          <div className="mb-6 max-w-2xl mx-auto p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
            <span className="text-rose-400 text-lg">⚠</span>
            <p className="text-sm text-rose-200">{error}</p>
          </div>
        )}

        <div className="grid lg:grid-cols-5 gap-6">
          {/* LEFT: Plan Summary */}
          <div className="lg:col-span-2">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
              <h2 className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-4">Order Summary</h2>

              <div className="mb-6">
                <p className="text-2xl font-bold mb-1">{currentPlan.name} Plan</p>
                <p className="text-sm text-slate-400">
                  {billingCycle === "monthly" ? "Monthly billing" : "Yearly billing (20% off)"}
                </p>
              </div>

              <div className="flex justify-between py-3 border-t border-white/10">
                <span className="text-sm text-slate-400">Plan price</span>
                <span className="text-sm font-semibold">
                  ₹{currentPlan.price.toLocaleString("en-IN")}/{billingCycle === "monthly" ? "mo" : "yr"}
                </span>
              </div>

              {billingCycle === "yearly" && (
                <div className="flex justify-between py-3 border-t border-white/10">
                  <span className="text-sm text-emerald-400">Yearly discount</span>
                  <span className="text-sm font-semibold text-emerald-400">
                    −₹{(currentPlan.price * 12 - totalAmount).toLocaleString("en-IN")}
                  </span>
                </div>
              )}

              <div className="flex justify-between py-4 mt-3 border-t-2 border-white/20">
                <span className="text-base font-bold">Total Due</span>
                <span className="text-3xl font-bold text-emerald-400">
                  ₹{totalAmount.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="mt-6 pt-6 border-t border-white/10 space-y-2">
                {currentPlan.features.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                    <span className="text-emerald-400 shrink-0">✓</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => router.push("/signup/select-plan")}
                className="w-full mt-6 py-3 rounded-xl border border-white/20 hover:bg-white/10 text-sm font-semibold transition"
              >
                ← Change Plan
              </button>
            </div>
          </div>

          {/* RIGHT: Payment Method */}
          <div className="lg:col-span-3">
            <div className="bg-white text-slate-900 rounded-3xl p-6 shadow-2xl">
              {/* Payment method toggle */}
              <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-6">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("upi")}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition ${
                    paymentMethod === "upi" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"
                  }`}
                >
                  📱 UPI
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("bank")}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition ${
                    paymentMethod === "bank" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"
                  }`}
                >
                  🏦 Bank Transfer
                </button>
              </div>

              {/* UPI Payment */}
              {paymentMethod === "upi" && (
                <div className="text-center">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">
                    Scan QR to Pay ₹{totalAmount.toLocaleString("en-IN")}
                  </p>

                  <div className="w-56 h-56 mx-auto bg-white border-4 border-slate-200 rounded-3xl p-4 mb-4 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-6xl mb-2">📱</div>
                      <p className="text-xs text-slate-400">UPI QR Code</p>
                      <p className="text-[10px] text-slate-300 mt-1">
                        Add your UPI QR here
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left">
                    <p className="text-xs text-slate-500 mb-2">Send payment to:</p>
                    <p className="text-sm font-bold text-slate-900">staynexa@upi</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      (Update with your actual UPI ID)
                    </p>
                  </div>
                </div>
              )}

              {/* Bank Transfer */}
              {paymentMethod === "bank" && (
                <div className="bg-slate-50 rounded-xl p-5 mb-6">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">
                    Bank Transfer Details
                  </p>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Account Name</span>
                      <span className="font-semibold">Staynexa</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Account Number</span>
                      <span className="font-mono font-semibold">XXXX XXXX XXXX</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">IFSC Code</span>
                      <span className="font-mono font-semibold">XXXX0001234</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Bank Name</span>
                      <span className="font-semibold">HDFC Bank</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-rose-500 mt-4">
                    ⚠ Update these with your actual bank details in the code
                  </p>
                </div>
              )}

              {/* UTR Input */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                    UTR / Transaction Reference *
                  </label>
                  <input
                    type="text"
                    value={utrNumber}
                    onChange={(e) => setUtrNumber(e.target.value)}
                    placeholder="e.g. 123456789012"
                    required
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                  />
                  <p className="text-[10px] text-slate-400 mt-2">
                    Enter the UTR/Reference number from your payment confirmation
                  </p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-3">
                  <span className="text-amber-500 shrink-0 text-sm">ℹ</span>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Your account will be activated within 2-4 hours after payment verification.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-teal-500/20 disabled:opacity-50 transition"
                >
                  {loading ? "Submitting..." : `Submit Payment · ₹${totalAmount.toLocaleString("en-IN")} →`}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
