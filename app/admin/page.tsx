import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white font-bold">S</div>
            <span className="text-xl font-bold">Staynexa</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden sm:block text-sm font-semibold text-slate-700">Log in</Link>
            <Link href="/signup" className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800">Start Free Trial</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-teal-50/50 to-white">
        <div className="max-w-7xl mx-auto px-4 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm mb-8">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold">India's #1 Hotel Management Platform</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Run Your Hotel
            <span className="block bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">On Autopilot.</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-10">
            All-in-one hotel management system. Bookings, payments, housekeeping in one powerful platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Link href="/signup" className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-semibold shadow-xl hover:bg-slate-800">Start 14-Day Free Trial →</Link>
          </div>
          <div className="grid grid-cols-3 gap-8 mt-16 pt-12 border-t border-slate-200 max-w-2xl mx-auto">
            <div><div className="text-3xl md:text-4xl font-bold">500+</div><div className="text-xs text-slate-500 mt-1">Hotels</div></div>
            <div><div className="text-3xl md:text-4xl font-bold">25K+</div><div className="text-xs text-slate-500 mt-1">Rooms</div></div>
            <div><div className="text-3xl md:text-4xl font-bold">₹100Cr+</div><div className="text-xs text-slate-500 mt-1">Processed</div></div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Every Tool Your Hotel Needs</h2>
            <p className="text-lg text-slate-600">Replace multiple tools with a single unified system.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: "📅", title: "Property Management", desc: "Drag-and-drop calendar" },
              { icon: "💳", title: "Payment Management", desc: "UPI, cards, cash" },
              { icon: "🌐", title: "Booking Engine", desc: "Zero commission bookings" },
              { icon: "🧹", title: "Housekeeping", desc: "Real-time room status" },
              { icon: "📊", title: "Analytics", desc: "Live dashboards & reports" },
              { icon: "📧", title: "Guest Emails", desc: "Auto confirmations & PDF" },
              { icon: "🏨", title: "Multi-Property", desc: "Manage unlimited hotels" },
              { icon: "🔒", title: "Roles & Permissions", desc: "Granular access control" },
            ].map((f, i) => (
              <div key={i} className="p-6 bg-white border border-slate-200 rounded-2xl hover:border-teal-400 hover:shadow-lg transition">
                <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center text-2xl mb-4">{f.icon}</div>
                <h3 className="text-base font-bold mb-2">{f.title}</h3>
                <p className="text-sm text-slate-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-6xl font-bold mb-6">Let's Run Your Hotel Together.</h2>
          <p className="text-lg text-slate-300 mb-10">Join 500+ hotels already using Staynexa.</p>
          <Link href="/signup" className="inline-block px-8 py-4 bg-white text-slate-900 rounded-2xl font-bold shadow-xl hover:bg-slate-100">Start Free Trial →</Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-12 text-center">
        <p className="text-sm text-slate-500">© {new Date().getFullYear()} Staynexa. All rights reserved.</p>
      </footer>
    </div>
  );
}
