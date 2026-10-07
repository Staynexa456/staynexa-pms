// app/(marketing)/page.tsx
import Link from "next/link";
import Image from "next/image";

export default function LandingPage() {
  // ============ SEO Structured Data ============
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Staynexa PMS",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, Android, iOS",
    offers: {
      "@type": "AggregateOffer",
      lowPrice: "999",
      highPrice: "9999",
      priceCurrency: "INR",
      offerCount: "3",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      reviewCount: "127",
    },
    description:
      "India's leading hotel management system for small, medium & luxury hotels.",
    featureList: [
      "Property Management System",
      "Booking Engine",
      "Payment Management",
      "Housekeeping Management",
      "Reports & Analytics",
      "Guest Communication",
    ],
    screenshot: "https://staynexa.in/dashboard-preview.png",
    url: "https://staynexa.in",
    author: {
      "@type": "Organization",
      name: "Staynexa",
      url: "https://staynexa.in",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <div className="min-h-screen bg-white text-slate-900 antialiased">
        {/* ================= NAVBAR ================= */}
        <Navbar />

        {/* ================= HERO SECTION ================= */}
        <HeroSection />

        {/* ================= DASHBOARD PREVIEW ================= */}
        <DashboardPreview />

        {/* ================= PLATFORM MODULES (accordion-like) ================= */}
        <PlatformModules />

        {/* ================= WHY CHOOSE US ================= */}
        <WhyChooseUs />

        {/* ================= HOW IT WORKS ================= */}
        <HowItWorks />

        {/* ================= TESTIMONIALS ================= */}
        <Testimonials />

        {/* ================= PRICING PREVIEW ================= */}
        <PricingPreview />

        {/* ================= FINAL CTA ================= */}
        <FinalCTA />

        {/* ================= FOOTER ================= */}
        <Footer />
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════
// NAVBAR
// ═══════════════════════════════════════════════
function Navbar() {
  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-teal-500/20 group-hover:scale-105 transition">
            S
          </div>
          <span className="text-xl font-bold tracking-tight">Staynexa</span>
        </Link>

        {/* Nav Links */}
        <div className="hidden lg:flex items-center gap-1">
          <NavLink href="/features">Features</NavLink>
          <NavLink href="/pricing">Pricing</NavLink>
          <NavLink href="/about">About</NavLink>
          <NavLink href="/contact">Contact</NavLink>
        </div>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden sm:block text-sm font-semibold text-slate-700 hover:text-slate-900 transition"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition shadow-lg shadow-slate-900/10"
          >
            Start Free Trial
          </Link>
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
    >
      {children}
    </Link>
  );
}

// ═══════════════════════════════════════════════
// HERO SECTION
// ═══════════════════════════════════════════════
function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-b from-teal-50/50 via-white to-white" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-teal-200/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute top-40 left-0 w-[400px] h-[400px] bg-emerald-200/30 rounded-full blur-3xl -translate-x-1/2" />

      <div className="relative max-w-7xl mx-auto px-4 lg:px-8 pt-20 pb-16 lg:pt-32 lg:pb-24">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm mb-8">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-slate-700 tracking-wide">
              India's #1 Hotel Management Platform
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05] mb-6">
            Run Your Hotel
            <span className="block bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-600 bg-clip-text text-transparent">
              On Autopilot.
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Staynexa is the all-in-one hotel management system. Bookings, payments,
            housekeeping, and guest communication — powered by one powerful platform.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Link
              href="/signup"
              className="w-full sm:w-auto px-8 py-4 bg-slate-900 text-white rounded-2xl font-semibold text-base hover:bg-slate-800 transition shadow-xl shadow-slate-900/10 flex items-center justify-center gap-2"
            >
              Start 14-Day Free Trial
              <span>→</span>
            </Link>
            <Link
              href="/pricing"
              className="w-full sm:w-auto px-8 py-4 bg-white text-slate-900 rounded-2xl font-semibold text-base border-2 border-slate-200 hover:border-slate-300 transition"
            >
              View Pricing
            </Link>
          </div>

          {/* Trust text */}
          <p className="text-sm text-slate-500">
            ✓ No credit card required &nbsp;·&nbsp; ✓ Setup in 5 minutes &nbsp;·&nbsp; ✓ Cancel anytime
          </p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 mt-16 pt-12 border-t border-slate-200 max-w-2xl mx-auto">
            <Stat number="500+" label="Hotels" />
            <Stat number="25K+" label="Rooms Managed" />
            <Stat number="₹100Cr+" label="Bookings Processed" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl md:text-4xl font-bold text-slate-900 mb-1">{number}</div>
      <div className="text-xs md:text-sm text-slate-500 font-medium">{label}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// DASHBOARD PREVIEW
// ═══════════════════════════════════════════════
function DashboardPreview() {
  return (
    <section className="relative py-20 lg:py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <p className="text-xs font-bold tracking-[0.2em] text-teal-600 uppercase mb-3">
            Complete Platform
          </p>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            Your Entire Hotel in One Dashboard
          </h2>
          <p className="text-lg text-slate-600">
            Everything you need to run your hotel — from a single, beautiful interface.
          </p>
        </div>

        {/* Mock Dashboard Image */}
        <div className="relative max-w-5xl mx-auto">
          <div className="rounded-3xl overflow-hidden shadow-2xl border border-slate-200 bg-white">
            {/* Browser Chrome */}
            <div className="bg-slate-100 border-b border-slate-200 px-4 py-3 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <div className="flex-1 text-center">
                <div className="inline-block px-4 py-1 bg-white rounded text-xs text-slate-500 border border-slate-200">
                  app.staynexa.in/dashboard
                </div>
              </div>
            </div>

            {/* Dashboard Mockup */}
            <div className="p-6 bg-gradient-to-br from-slate-50 to-white">
              {/* Top Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <DashboardCard label="Today's Check-ins" value="12" accent="teal" />
                <DashboardCard label="Check-outs" value="8" accent="amber" />
                <DashboardCard label="Occupancy" value="87%" accent="emerald" />
                <DashboardCard label="Available Rooms" value="6" accent="blue" />
              </div>

              {/* Booking List */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <span className="font-semibold text-slate-900">Recent Bookings</span>
                  <span className="text-xs text-teal-600 font-semibold">View All →</span>
                </div>
                {[1, 2, 3].map((i) => (
                  <BookingRow key={i} index={i} />
                ))}
              </div>
            </div>
          </div>

          {/* Floating badge */}
          <div className="hidden lg:block absolute -bottom-6 -right-6 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 max-w-xs">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-xl">
                ✓
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 mb-1">Payment Verified</p>
                <p className="text-[10px] text-slate-500">
                  Auto-verified ₹2,800 booking
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DashboardCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  const colors: Record<string, string> = {
    teal: "text-teal-600",
    amber: "text-amber-600",
    emerald: "text-emerald-600",
    blue: "text-blue-600",
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
        {label}
      </p>
      <p className={`text-2xl font-bold ${colors[accent]}`}>{value}</p>
    </div>
  );
}

function BookingRow({ index }: { index: number }) {
  const names = ["Rajesh Kumar", "Priya Sharma", "Amit Patel"];
  const rooms = ["Deluxe Room 201", "Suite 301", "Standard 105"];
  const amounts = ["₹2,800", "₹4,500", "₹1,600"];
  return (
    <div className="px-5 py-4 border-b border-slate-100 last:border-0 flex items-center gap-4">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white font-bold text-sm">
        {names[index - 1].charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 truncate">
          {names[index - 1]}
        </p>
        <p className="text-xs text-slate-500 truncate">{rooms[index - 1]}</p>
      </div>
      <span className="text-sm font-bold text-slate-900">{amounts[index - 1]}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════
// PLATFORM MODULES
// ═══════════════════════════════════════════════
function PlatformModules() {
  const modules = [
    {
      icon: "📅",
      title: "Property Management",
      desc: "Drag-and-drop reservation calendar with real-time availability.",
    },
    {
      icon: "💳",
      title: "Payment Management",
      desc: "Accept UPI, cards, cash. Auto-verify payments & track dues.",
    },
    {
      icon: "🌐",
      title: "Booking Engine",
      desc: "Your own direct booking website with zero commission.",
    },
    {
      icon: "🧹",
      title: "Housekeeping",
      desc: "Real-time room status, staff assignments & daily tasks.",
    },
    {
      icon: "📊",
      title: "Revenue Analytics",
      desc: "Live dashboards, custom reports & business insights.",
    },
    {
      icon: "📧",
      title: "Guest Communication",
      desc: "Automated email confirmations, PDF vouchers & WhatsApp.",
    },
    {
      icon: "🏨",
      title: "Multi-Property",
      desc: "Manage unlimited hotels from a single master dashboard.",
    },
    {
      icon: "🔒",
      title: "Roles & Permissions",
      desc: "Staff accounts with granular access control.",
    },
  ];

  return (
    <section className="py-20 lg:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <p className="text-xs font-bold tracking-[0.2em] text-teal-600 uppercase mb-3">
            Complete Platform
          </p>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            Every Tool Your Hotel Needs
          </h2>
          <p className="text-lg text-slate-600">
            Replace multiple tools with a single unified system.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {modules.map((m, i) => (
            <ModuleCard key={i} {...m} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ModuleCard({
  icon,
  title,
  desc,
}: {
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="group p-6 bg-white border border-slate-200 rounded-2xl hover:border-teal-400 hover:shadow-lg hover:shadow-teal-500/5 transition-all duration-300">
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-100 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition">
        {icon}
      </div>
      <h3 className="text-base font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════
// WHY CHOOSE US
// ═══════════════════════════════════════════════
function WhyChooseUs() {
  const points = [
    {
      title: "Built for Indian Hotels",
      desc: "GST-compliant billing, UPI payments, and Indian rupee support built-in.",
    },
    {
      title: "Zero Commission Booking Engine",
      desc: "Stop paying OTA commissions. Get direct bookings from your own website.",
    },
    {
      title: "Setup in Under 5 Minutes",
      desc: "No technical knowledge needed. Add your rooms, set prices, go live.",
    },
    {
      title: "24/7 Support",
      desc: "Real humans ready to help. WhatsApp, email, and phone support.",
    },
  ];

  return (
    <section className="py-20 lg:py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            Why Hotels Choose Staynexa
          </h2>
          <p className="text-lg text-slate-600">
            Trusted by hundreds of hotels across India.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {points.map((p, i) => (
            <div
              key={i}
              className="flex items-start gap-4 p-6 bg-white rounded-2xl border border-slate-200"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                ✓
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 mb-1">
                  {p.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════
// HOW IT WORKS
// ═══════════════════════════════════════════════
function HowItWorks() {
  const steps = [
    {
      num: "01",
      title: "Sign Up Free",
      desc: "Create your account in 30 seconds. No credit card required.",
    },
    {
      num: "02",
      title: "Add Your Hotel",
      desc: "Enter your hotel details, rooms, and rates. Takes 5 minutes.",
    },
    {
      num: "03",
      title: "Start Accepting Bookings",
      desc: "Share your booking link and manage everything from one dashboard.",
    },
  ];

  return (
    <section className="py-20 lg:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            Up and Running in Minutes
          </h2>
          <p className="text-lg text-slate-600">
            Get your hotel online with just three simple steps.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((s, i) => (
            <div key={i} className="relative text-center">
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-10 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-teal-300 to-transparent" />
              )}

              <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white text-2xl font-bold mb-6 shadow-xl shadow-teal-500/20">
                {s.num}
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{s.title}</h3>
              <p className="text-sm text-slate-600 max-w-xs mx-auto leading-relaxed">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════
// TESTIMONIALS
// ═══════════════════════════════════════════════
function Testimonials() {
  const items = [
    {
      quote:
        "Staynexa completely transformed how we run our hotel. Bookings, payments, housekeeping — everything is in one place. Saved us 3 hours daily.",
      name: "Hotel Sonar Tori",
      role: "Boutique Hotel, Agartala",
    },
    {
      quote:
        "The booking engine alone paid for itself in the first month. We stopped paying 18% commission to OTAs. Best decision ever.",
      name: "Hotel Grand Palace",
      role: "Business Hotel, Kolkata",
    },
    {
      quote:
        "The support team is incredible. Any issue we had was resolved within minutes. Highly recommended for any Indian hotel.",
      name: "Vishara Elite Hotel",
      role: "Luxury Resort, Bangalore",
    },
  ];

  return (
    <section className="py-20 lg:py-24 bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            Loved by Hotels Across India
          </h2>
          <p className="text-lg text-slate-400">
            Real stories from hoteliers who chose Staynexa.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {items.map((t, i) => (
            <div
              key={i}
              className="p-6 bg-white/5 border border-white/10 rounded-2xl backdrop-blur"
            >
              <div className="flex gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((n) => (
                  <span key={n} className="text-amber-400">
                    ★
                  </span>
                ))}
              </div>
              <p className="text-sm text-slate-300 leading-relaxed mb-6">
                "{t.quote}"
              </p>
              <div className="pt-4 border-t border-white/10">
                <p className="text-sm font-bold">{t.name}</p>
                <p className="text-xs text-slate-400">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════
// PRICING PREVIEW
// ═══════════════════════════════════════════════
function PricingPreview() {
  return (
    <section className="py-20 lg:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <p className="text-xs font-bold tracking-[0.2em] text-teal-600 uppercase mb-3">
            Pricing
          </p>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-slate-600">
            Plans that grow with your hotel. Cancel anytime.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <PricingCard
            name="Starter"
            price="₹999"
            desc="For small guesthouses"
            features={["Up to 10 rooms", "Booking calendar", "Payment tracking", "Email support"]}
          />
          <PricingCard
            name="Professional"
            price="₹2,499"
            desc="For growing hotels"
            features={[
              "Up to 50 rooms",
              "Booking engine",
              "Housekeeping",
              "Reports & analytics",
              "Priority support",
            ]}
            popular
          />
          <PricingCard
            name="Business"
            price="₹4,999"
            desc="For multi-property chains"
            features={[
              "Unlimited rooms",
              "Multi-property",
              "Channel manager",
              "Dedicated account manager",
              "24/7 phone support",
            ]}
          />
        </div>

        <div className="text-center mt-12">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 text-teal-600 font-semibold hover:text-teal-700 transition"
          >
            See full pricing calculator →
          </Link>
        </div>
      </div>
    </section>
  );
}

function PricingCard({
  name,
  price,
  desc,
  features,
  popular,
}: {
  name: string;
  price: string;
  desc: string;
  features: string[];
  popular?: boolean;
}) {
  return (
    <div
      className={`relative p-7 rounded-3xl border-2 transition ${
        popular
          ? "border-slate-900 shadow-2xl shadow-slate-900/10"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-slate-900 text-white text-xs font-bold rounded-full">
          MOST POPULAR
        </div>
      )}
      <h3 className="text-xl font-bold text-slate-900 mb-1">{name}</h3>
      <p className="text-xs text-slate-500 mb-6">{desc}</p>
      <div className="mb-6">
        <span className="text-4xl font-bold text-slate-900">{price}</span>
        <span className="text-sm text-slate-500 ml-1">/month</span>
      </div>
      <ul className="space-y-3 mb-8">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
            <span className="text-teal-600 font-bold shrink-0 mt-0.5">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/signup"
        className={`block w-full py-3 rounded-xl text-center text-sm font-bold transition ${
          popular
            ? "bg-slate-900 text-white hover:bg-slate-800"
            : "bg-slate-100 text-slate-900 hover:bg-slate-200"
        }`}
      >
        Start Free Trial
      </Link>
    </div>
  );
}

// ═══════════════════════════════════════════════
// FINAL CTA
// ═══════════════════════════════════════════════
function FinalCTA() {
  return (
    <section className="py-20 lg:py-24 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="max-w-4xl mx-auto px-4 lg:px-8 text-center">
        <h2 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">
          Let's Run Your Hotel
          <span className="block bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">
            Together.
          </span>
        </h2>
        <p className="text-lg text-slate-300 mb-10 max-w-2xl mx-auto">
          Join 500+ hotels already using Staynexa. Start your 14-day free trial today.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/signup"
            className="w-full sm:w-auto px-8 py-4 bg-white text-slate-900 rounded-2xl font-bold hover:bg-slate-100 transition shadow-xl"
          >
            Start Free Trial →
          </Link>
          <Link
            href="/contact"
            className="w-full sm:w-auto px-8 py-4 bg-white/10 text-white rounded-2xl font-bold border border-white/20 hover:bg-white/20 transition"
          >
            Talk to Sales
          </Link>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════
// FOOTER
// ═══════════════════════════════════════════════
function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-16">
        <div className="grid md:grid-cols-5 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white font-bold">
                S
              </div>
              <span className="text-xl font-bold">Staynexa</span>
            </Link>
            <p className="text-sm text-slate-600 leading-relaxed mb-6 max-w-xs">
              India's leading hotel management platform. Built for modern hoteliers.
            </p>
            <div className="flex gap-3">
              <SocialIcon href="https://twitter.com" label="Twitter">
                𝕏
              </SocialIcon>
              <SocialIcon href="https://linkedin.com" label="LinkedIn">
                in
              </SocialIcon>
              <SocialIcon href="https://facebook.com" label="Facebook">
                f
              </SocialIcon>
              <SocialIcon href="https://instagram.com" label="Instagram">
                📷
              </SocialIcon>
            </div>
          </div>

          {/* Columns */}
          <FooterColumn
            title="Product"
            links={[
              { label: "Features", href: "/features" },
              { label: "Pricing", href: "/pricing" },
              { label: "Booking Engine", href: "/features" },
              { label: "Integrations", href: "/features" },
            ]}
          />
          <FooterColumn
            title="Company"
            links={[
              { label: "About", href: "/about" },
              { label: "Contact", href: "/contact" },
              { label: "Careers", href: "/careers" },
              { label: "Blog", href: "/blog" },
            ]}
          />
          <FooterColumn
            title="Legal"
            links={[
              { label: "Privacy Policy", href: "/privacy" },
              { label: "Terms of Service", href: "/terms" },
              { label: "Refund Policy", href: "/refund" },
            ]}
          />
        </div>

        <div className="pt-8 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} Staynexa. All rights reserved.
          </p>
          <p className="text-sm text-slate-500">
            Made with ♥ in India 🇮🇳
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h4 className="text-sm font-bold text-slate-900 mb-4">{title}</h4>
      <ul className="space-y-3">
        {links.map((l, i) => (
          <li key={i}>
            <Link
              href={l.href}
              className="text-sm text-slate-600 hover:text-teal-600 transition"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SocialIcon({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-teal-100 hover:text-teal-700 flex items-center justify-center text-sm font-bold text-slate-700 transition"
    >
      {children}
    </a>
  );
}