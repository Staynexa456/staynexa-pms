// app/about/page.tsx
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us - Staynexa Hotel PMS",
  description: "Learn about Staynexa, India's leading hotel management platform. Our mission is to help hotels modernize their operations.",
};

export default function AboutPage() {
  const stats = [
    { label: "Hotels", value: "500+" },
    { label: "Rooms Managed", value: "25K+" },
    { label: "Bookings Processed", value: "1M+" },
    { label: "Countries", value: "3" },
  ];

  const values = [
    { icon: "🎯", title: "Built for India", desc: "We understand the unique needs of Indian hotels — GST, UPI, local OTAs, and more." },
    { icon: "🚀", title: "Always Innovating", desc: "From AI-powered insights to automated workflows, we're constantly pushing boundaries." },
    { icon: "🤝", title: "Customer First", desc: "Real humans, 24/7 support. We're here to help your business grow." },
    { icon: "🔒", title: "Security Focused", desc: "Bank-grade encryption. Your data and your guests' data are always safe." },
  ];

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
            <Link href="/features" className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Features</Link>
            <Link href="/pricing" className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Pricing</Link>
            <Link href="/about" className="px-4 py-2 text-sm font-medium text-teal-600 bg-teal-50 rounded-lg">About</Link>
            <Link href="/contact" className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Contact</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden sm:block text-sm font-semibold text-slate-700">Log in</Link>
            <Link href="/signup" className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800">Start Free Trial</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="bg-gradient-to-b from-teal-50/50 to-white py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-xs font-bold tracking-widest text-teal-600 uppercase mb-3">Our Story</p>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            We're building the future of hotel management.
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Staynexa started with a simple idea: hotel software should be easy to use, affordable, and built for modern hoteliers.
          </p>
        </div>
      </section>

      {/* STATS */}
      <section className="py-12 bg-white border-y border-slate-100">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s, i) => (
              <div key={i} className="text-center">
                <div className="text-4xl font-bold text-slate-900 mb-1">{s.value}</div>
                <div className="text-sm text-slate-500 font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MISSION */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Why we started Staynexa</h2>
              <div className="space-y-4 text-slate-600 leading-relaxed">
                <p>
                  In 2024, our founders visited dozens of small and medium hotels across India. They found that most hoteliers were struggling with outdated software, messy Excel sheets, or expensive enterprise solutions that required a team to manage.
                </p>
                <p>
                  We realized the hospitality industry needed a fresh approach: software that works out of the box, requires zero training, and grows with the hotel.
                </p>
                <p>
                  <strong>Staynexa was born.</strong> A single platform that handles bookings, payments, housekeeping, and guest communication — all with a beautiful, modern interface.
                </p>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-square rounded-3xl bg-gradient-to-br from-teal-500 to-emerald-600 p-8 flex items-center justify-center shadow-2xl">
                <div className="text-center text-white">
                  <div className="text-8xl mb-4">🏨</div>
                  <h3 className="text-3xl font-bold mb-2">Modern PMS</h3>
                  <p className="text-teal-100">Built for today's hotelier</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* VALUES */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">What Drives Us</h2>
            <p className="text-lg text-slate-600">Our core values shape every decision we make.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((v, i) => (
              <div key={i} className="p-6 bg-white border border-slate-200 rounded-2xl hover:shadow-lg transition">
                <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center text-2xl mb-4">{v.icon}</div>
                <h3 className="text-lg font-bold mb-2">{v.title}</h3>
                <p className="text-sm text-slate-600">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to Join Us?</h2>
          <p className="text-lg text-slate-300 mb-10">Start your 14-day free trial. No credit card required.</p>
          <Link href="/signup" className="inline-block px-8 py-4 bg-white text-slate-900 rounded-2xl font-bold shadow-xl hover:bg-slate-100 transition">
            Start Free Trial →
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-slate-500">© {new Date().getFullYear()} Staynexa. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
