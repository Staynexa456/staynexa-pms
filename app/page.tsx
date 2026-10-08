import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white font-bold">S</div>
            <span className="text-xl font-bold text-slate-900">Staynexa</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-semibold text-slate-700">Log in</Link>
            <Link href="/signup" className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold">Start Free Trial</Link>
          </div>
        </div>
      </nav>

      <section className="bg-gradient-to-b from-teal-50 to-white py-24">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h1 className="text-5xl md:text-7xl font-bold text-slate-900 mb-6">
            Run Your Hotel <span className="text-teal-600">On Autopilot.</span>
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-10">
            All-in-one hotel management system. Bookings, payments, housekeeping — one powerful platform.
          </p>
          <Link href="/signup" className="inline-block px-10 py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg hover:bg-slate-800">
            Start 14-Day Free Trial →
          </Link>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-4xl font-bold text-center mb-14">Every Tool Your Hotel Needs</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: "📅", title: "Bookings", desc: "Real-time calendar" },
              { icon: "💳", title: "Payments", desc: "UPI, cards, cash" },
              { icon: "🌐", title: "Booking Engine", desc: "Zero commission" },
              { icon: "🧹", title: "Housekeeping", desc: "Room status" },
              { icon: "📊", title: "Analytics", desc: "Live dashboards" },
              { icon: "📧", title: "Guest Emails", desc: "Auto confirmations" },
              { icon: "🏨", title: "Multi-Property", desc: "Unlimited hotels" },
              { icon: "🔒", title: "Roles", desc: "Access control" },
            ].map((f, i) => (
              <div key={i} className="p-6 border border-slate-200 rounded-2xl hover:border-teal-400 hover:shadow-lg transition">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-bold mb-2">{f.title}</h3>
                <p className="text-sm text-slate-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-slate-900 text-center">
        <h2 className="text-4xl font-bold text-white mb-6">Ready to Get Started?</h2>
        <Link href="/signup" className="inline-block px-10 py-4 bg-white text-slate-900 rounded-2xl font-bold hover:bg-slate-100">Start Free Trial →</Link>
      </section>

      <footer className="py-8 text-center text-sm text-slate-500 border-t">
        © {new Date().getFullYear()} Staynexa. All rights reserved.
      </footer>
    </div>
  );
}
