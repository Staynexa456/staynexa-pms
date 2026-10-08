// app/pricing/page.tsx
"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

export default function PricingPage() {
  const [propertyCount, setPropertyCount] = useState(1);
  const [roomCount, setRoomCount] = useState(20);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [selectedPlan, setSelectedPlan] = useState<"starter" | "professional" | "business">("professional");

  const plans = {
    starter: {
      name: "Starter",
      basePrice: 999,
      features: [
        "Up to 10 rooms per property",
        "Booking calendar",
        "Payment tracking",
        "Guest management",
        "Email support",
      ],
      color: "slate",
    },
    professional: {
      name: "Professional",
      basePrice: 2499,
      features: [
        "Up to 50 rooms per property",
        "Direct Booking Engine",
        "Housekeeping module",
        "Reports & Analytics",
        "Automated guest emails",
        "Priority support",
      ],
      color: "teal",
      popular: true,
    },
    business: {
      name: "Business",
      basePrice: 4999,
      features: [
        "Unlimited rooms",
        "Multi-property support",
        "Channel Manager",
        "REST API access",
        "Dedicated account manager",
        "24/7 phone support",
      ],
      color: "amber",
    },
  };

  // Calculate price
  const calculatedPrice = useMemo(() => {
    const plan = plans[selectedPlan];
    const propertyMultiplier = propertyCount;
    const roomFactor = roomCount > 50 ? 1.5 : roomCount > 20 ? 1.2 : 1;
    const baseTotal = plan.basePrice * propertyMultiplier * roomFactor;

    if (billingCycle === "yearly") {
      return Math.round(baseTotal * 12 * 0.8); // 20% discount
    }
    return Math.round(baseTotal);
  }, [selectedPlan, propertyCount, roomCount, billingCycle]);

  const monthlyEquivalent = billingCycle === "yearly" ? Math.round(calculatedPrice / 12) : calculatedPrice;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white font-bold">S</div>
            <span className="text-xl font-bold">Staynexa</span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            <Link href="/#features" className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Features</Link>
            <Link href="/pricing" className="px-4 py-2 text-sm font-medium text-teal-600 bg-teal-50 rounded-lg">Pricing</Link>
            <Link href="/#about" className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">About</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden sm:block text-sm font-semibold text-slate-700">Log in</Link>
            <Link href="/signup" className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800">Start Free Trial</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="bg-gradient-to-b from-teal-50/50 to-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-xs font-bold tracking-widest text-teal-600 uppercase mb-3">Pricing</p>
          <h1 className="text-5xl md:text-6xl font-bold mb-6">Simple, Transparent Pricing</h1>
          <p className="text-lg text-slate-600">Choose the plan that fits your hotel's needs. Cancel anytime.</p>
        </div>
      </section>

      {/* CALCULATOR */}
      <section className="py-12 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          {/* Billing toggle */}
          <div className="flex justify-center mb-10">
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={`px-6 py-2.5 rounded-lg text-sm font-bold transition ${
                  billingCycle === "monthly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle("yearly")}
                className={`px-6 py-2.5 rounded-lg text-sm font-bold transition flex items-center gap-2 ${
                  billingCycle === "yearly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Yearly
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Save 20%</span>
              </button>
            </div>
          </div>

          {/* Configuration */}
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-10">
            <ConfigCard
              label="Number of Properties"
              value={propertyCount}
              min={1}
              max={20}
              onChange={setPropertyCount}
              hint="How many hotels/resorts do you manage?"
            />
            <ConfigCard
              label="Total Rooms"
              value={roomCount}
              min={5}
              max={500}
              step={5}
              onChange={setRoomCount}
              hint="Total rooms across all properties"
            />
          </div>

          {/* Plans */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {(Object.keys(plans) as Array<keyof typeof plans>).map((key) => {
              const plan = plans[key];
              const isSelected = selectedPlan === key;
              const colorClasses: any = {
                slate: { border: "border-slate-300", bg: "bg-slate-50", text: "text-slate-700", btn: "bg-slate-900 text-white", badge: "bg-slate-900" },
                teal: { border: "border-teal-400", bg: "bg-teal-50", text: "text-teal-700", btn: "bg-teal-600 text-white", badge: "bg-teal-600" },
                amber: { border: "border-amber-400", bg: "bg-amber-50", text: "text-amber-700", btn: "bg-amber-600 text-white", badge: "bg-amber-600" },
              };
              const c = colorClasses[plan.color];
              return (
                <button
                  key={key}
                  onClick={() => setSelectedPlan(key)}
                  className={`relative text-left p-7 rounded-3xl border-2 transition-all ${
                    isSelected
                      ? `${c.border} ${c.bg} ring-4 ring-offset-2 ring-slate-200 shadow-xl scale-[1.02]`
                      : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"
                  }`}
                >
                  {plan.popular && (
                    <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 ${c.badge} text-white text-[10px] font-bold rounded-full uppercase tracking-widest`}>
                      Most Popular
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold">{plan.name}</h3>
                    {isSelected && (
                      <span className={`w-6 h-6 rounded-full ${c.btn} flex items-center justify-center text-xs`}>✓</span>
                    )}
                  </div>
                  <div className="mb-6">
                    <span className="text-3xl font-bold">₹{plan.basePrice.toLocaleString("en-IN")}</span>
                    <span className="text-sm text-slate-500 ml-1">/property/month</span>
                  </div>
                  <ul className="space-y-2.5">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className={`${c.text} font-bold shrink-0 mt-0.5`}>✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>

          {/* QUOTE SUMMARY */}
          <div className="max-w-2xl mx-auto bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 text-white shadow-2xl">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <span>📋</span> Your Quote Summary
            </h3>

            <div className="space-y-4 mb-6">
              <SummaryRow label="Package" value={plans[selectedPlan].name} />
              <SummaryRow label="Properties" value={`${propertyCount} ${propertyCount === 1 ? "property" : "properties"}`} />
              <SummaryRow label="Total Rooms" value={`${roomCount} rooms`} />
              <SummaryRow label="Billing Cycle" value={billingCycle === "monthly" ? "Monthly" : "Yearly (20% off)"} />
            </div>

            <div className="border-t border-white/20 pt-6">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">
                    {billingCycle === "monthly" ? "Monthly Total" : "Yearly Total"}
                  </p>
                  <p className="text-4xl font-bold">
                    ₹{calculatedPrice.toLocaleString("en-IN")}
                  </p>
                  {billingCycle === "yearly" && (
                    <p className="text-xs text-emerald-400 mt-1">
                      ≈ ₹{monthlyEquivalent.toLocaleString("en-IN")}/month · Save ₹{(monthlyEquivalent * 12 * 0.25).toLocaleString("en-IN")}
                    </p>
                  )}
                </div>
                <Link
                  href="/signup"
                  className="px-6 py-3.5 bg-white text-slate-900 rounded-xl font-bold text-sm hover:bg-slate-100 transition"
                >
                  Start Free Trial →
                </Link>
              </div>
              <p className="text-xs text-slate-400 mt-4 text-center">
                ✓ 14-day free trial · ✓ No credit card required · ✓ Cancel anytime
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {[
              {
                q: "Can I change plans later?",
                a: "Yes, you can upgrade or downgrade your plan anytime. Changes take effect immediately.",
              },
              {
                q: "Is there a setup fee?",
                a: "No, there are no setup fees. You only pay the monthly or yearly subscription.",
              },
              {
                q: "What payment methods do you accept?",
                a: "We accept UPI, Credit/Debit Cards, Net Banking, and Bank Transfers.",
              },
              {
                q: "Do you offer refunds?",
                a: "Yes, we offer a 7-day money-back guarantee if you're not satisfied.",
              },
              {
                q: "Is there a free trial?",
                a: "Yes! Every new account gets a 14-day free trial. No credit card required to start.",
              },
            ].map((faq, i) => (
              <details key={i} className="group bg-white rounded-2xl border border-slate-200 p-6 cursor-pointer">
                <summary className="flex items-center justify-between font-bold text-slate-800 list-none">
                  <span>{faq.q}</span>
                  <span className="text-teal-600 group-open:rotate-45 transition-transform text-xl">+</span>
                </summary>
                <p className="text-sm text-slate-600 mt-3 leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-teal-600 to-emerald-600 text-white">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to Get Started?</h2>
          <p className="text-lg text-white/90 mb-10">Join 500+ hotels using Staynexa. Start your 14-day free trial today.</p>
          <Link
            href="/signup"
            className="inline-block px-10 py-4 bg-white text-teal-700 rounded-2xl font-bold text-lg hover:bg-slate-100 transition shadow-xl"
          >
            Start Free Trial →
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white font-bold">S</div>
            <span className="text-xl font-bold">Staynexa</span>
          </div>
          <p className="text-sm text-slate-500 mb-6">India's leading hotel management platform.</p>
          <p className="text-xs text-slate-400">© {new Date().getFullYear()} Staynexa. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════
// SUB COMPONENTS
// ═══════════════════════════════════════════════
function ConfigCard({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">{label}</label>
      {hint && <p className="text-xs text-slate-400 mb-4">{hint}</p>}
      <div className="flex items-center gap-4">
        <button
          onClick={() => onChange(Math.max(min, value - step))}
          className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-lg font-bold text-slate-700 disabled:opacity-30"
          disabled={value <= min}
        >
          −
        </button>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(e) => {
            const v = Number(e.target.value) || min;
            onChange(Math.min(max, Math.max(min, v)));
          }}
          className="flex-1 text-center text-3xl font-bold text-slate-900 outline-none bg-transparent"
        />
        <button
          onClick={() => onChange(Math.min(max, value + step))}
          className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-lg font-bold text-slate-700 disabled:opacity-30"
          disabled={value >= max}
        >
          +
        </button>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  );
}
