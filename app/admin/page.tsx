import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white font-bold">
              S
            </div>
            <span className="text-xl font-bold text-slate-900">Staynexa</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-semibold text-slate-700 hover:text-slate-900">
              Log in
            </Link>
            <Link href="/signup" className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800">
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-b from-teal-50 to-white py-24">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 mb-8">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-semibold text-slate-700">India's #1 Hotel Management Platform</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-slate-900 mb-6">
            Run Your Hotel
            <span className="block text-teal-600">On Autopilot.</span>
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-10">
            All-in-one hotel management system. Bookings, payments, housekeeping — one powerful platform.
          </p>
          <Link href="/signup" className="inline-block px-10 py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg hover:bg-slate-800">
            Start 14-Day Free Trial →
          </Link>
          <p className="text-sm text-slate-500 mt-6">✓ No credit card required &nbsp; ✓ Setup in 5 minutes</p>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-4xl font-bold text-center text-slate-900 mb-4">Every Tool Your Hotel Needs</h2>
          <p className="text-center text-slate-600 mb-14 text-lg">Replace multiple tools with one unified system.</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: "📅", title: "Bookings", desc: "Real-time calendar with drag-drop" },
              { icon: "💳", title: "Payments", desc: "UPI, cards, cash & auto-verify" },
              { icon: "🌐", title: "Booking Engine", desc: "Zero-commission direct bookings" },
              { icon: "🧹", title: "Housekeeping", desc: "Room status and staff tasks" },
              { icon: "📊", title: "Analytics", desc: "Live dashboards and reports" },
              { icon: "📧", title: "Guest Emails", desc: "Auto confirmations with PDF" },
              { icon: "🏨", title: "Multi-Property", desc: "Manage unlimited hotels" },
              { icon: "🔒", title: "Roles", desc: "Staff access with permissions" },
            ].map((f, i) => (
              <div key={i} className="p-6 border border-slate-200 rounded-2xl hover:border-teal-400 hover:shadow-lg transition">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-bold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-slate-900">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Ready to Get Started?</h2>
          <p className="text-lg text-slate-300 mb-10">Join 500+ hotels using Staynexa.</p>
          <Link href="/signup" className="inline-block px-10 py-4 bg-white text-slate-900 rounded-2xl font-bold text-lg hover:bg-slate-100">
            Start Free Trial →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8">
        <p className="text-center text-sm text-slate-500">© {new Date().getFullYear()} Staynexa. All rights reserved.</p>
      </footer>
    </div>
  );
}
