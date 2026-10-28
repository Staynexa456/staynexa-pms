import Link from 'next/link';
import { 
  CalendarDays, 
  CreditCard, 
  Globe, 
  Sparkles, 
  BarChart3, 
  Mail, 
  Building2, 
  ShieldCheck,
  CheckCircle2,
  Bot, 
  Share2, 
  BedDouble 
} from 'lucide-react';

export const metadata = {
  title: "Features - Staynexa | Run Your Hotel On Autopilot",
  description: "Explore Staynexa's powerful features including Nexa AI, Channel Management, Booking Engine, and Property Management. All-in-one hotel management system.",
};

const featuresList = [
  {
    icon: <Bot className="w-6 h-6 text-emerald-600" />,
    title: "Nexa AI Assistant",
    description: "Your intelligent hotel assistant. Ask Nexa AI anything about your property, guests, or performance, and get detailed, actionable insights instantly.",
    isNew: true, 
  },
  {
    icon: <Share2 className="w-6 h-6 text-emerald-600" />,
    title: "Channel Management",
    description: "Sync your hotel inventory across all major OTAs (Booking.com, Agoda, MakeMyTrip) in real-time to avoid double bookings and maximize visibility.",
  },
  {
    icon: <Globe className="w-6 h-6 text-emerald-600" />,
    title: "Booking Engine",
    description: "Enable direct bookings from your own website with zero commission. Convert more guests with a frictionless, mobile-friendly checkout experience.",
  },
  {
    icon: <BedDouble className="w-6 h-6 text-emerald-600" />,
    title: "Property Management",
    description: "Drag-and-drop calendar with real-time availability. Manage your rooms, rates, and restrictions effortlessly from a single unified dashboard.",
  },
  {
    icon: <CreditCard className="w-6 h-6 text-emerald-600" />,
    title: "Payment Management",
    description: "Accept UPI, cards, and cash seamlessly. Auto-verify transactions and track outstanding dues without manual intervention.",
  },
  {
    icon: <Sparkles className="w-6 h-6 text-emerald-600" />,
    title: "Housekeeping",
    description: "Track real-time room status and assign tasks to staff instantly. Ensure your rooms are always guest-ready and spotless.",
  },
  {
    icon: <BarChart3 className="w-6 h-6 text-emerald-600" />,
    title: "Analytics & Reports",
    description: "Make data-driven decisions with live dashboards. Get custom business reports on revenue, occupancy, and guest trends.",
  },
  {
    icon: <Mail className="w-6 h-6 text-emerald-600" />,
    title: "Guest Communication",
    description: "Automate guest emails, send PDF vouchers, and communicate instantly via WhatsApp to enhance the guest experience.",
  },
  {
    icon: <Building2 className="w-6 h-6 text-emerald-600" />,
    title: "Multi-Property Management",
    description: "Manage unlimited hotels, resorts, or homestays from one centralized dashboard. Perfect for growing hospitality chains.",
  },
  {
    icon: <ShieldCheck className="w-6 h-6 text-emerald-600" />,
    title: "Roles & Permissions",
    description: "Create staff accounts with granular access control. Keep your data secure by giving the right access to the right people.",
  },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      
      {/* 1. Header Section */}
      <section className="pt-20 pb-16 px-4 sm:px-6 lg:px-8 text-center bg-white border-b border-gray-100">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-sm font-medium mb-6">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Complete Platform
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-6">
          Every Tool Your Hotel <span className="text-emerald-600">Needs</span>
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-10">
          Replace multiple tools with a single unified system. Featuring Nexa AI, Channel Manager, and everything else to run your property on autopilot.
        </p>
        
        {/* Stats Bar */}
        <div className="flex flex-wrap justify-center gap-8 md:gap-16 pt-8 border-t border-gray-100">
          <div>
            <h3 className="text-3xl font-bold text-gray-900">500+</h3>
            <p className="text-sm text-gray-500 font-medium mt-1">Hotels</p>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-gray-900">25K+</h3>
            <p className="text-sm text-gray-500 font-medium mt-1">Rooms Managed</p>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-gray-900">₹100Cr+</h3>
            <p className="text-sm text-gray-500 font-medium mt-1">Processed</p>
          </div>
        </div>
      </section>

      {/* 2. Features Grid Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuresList.map((feature, index) => (
            <div 
              key={index} 
              className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col relative overflow-hidden group"
            >
              {feature.isNew && (
                <div className="absolute top-0 right-0 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                  AI Powered
                </div>
              )}
              
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-5 group-hover:bg-emerald-100 transition-colors">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed flex-grow">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Nexa AI Highlight Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-24">
        <div className="bg-gray-900 rounded-3xl p-8 md:p-12 shadow-xl flex flex-col md:flex-row items-center gap-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>

          <div className="flex-1 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/50 text-emerald-400 text-sm font-medium mb-6 border border-emerald-800">
              <Bot className="w-4 h-4" />
              Meet Nexa AI
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Your Hotel's Smartest Employee.</h2>
            <p className="text-gray-300 mb-8 text-lg">
              Stop digging through spreadsheets. Just ask Nexa AI. Get instant details about your property's performance, guest history, and operational bottlenecks. It's like having a data analyst on demand.
            </p>
            <ul className="space-y-4 mb-8">
              {[
                "Instant property performance insights",
                "Predictive booking trends",
                "Automated guest query handling"
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                  <span className="text-gray-200 font-medium">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex-1 w-full relative z-10">
             <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-2xl">
                <div className="flex items-center gap-3 mb-4 border-b border-gray-700 pb-4">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-sm">Nexa AI</h4>
                    <p className="text-xs text-emerald-400">Online</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="bg-gray-700 text-gray-200 p-3 rounded-lg rounded-tl-none text-sm w-4/5">
                    What is my occupancy rate for this weekend?
                  </div>
                  <div className="bg-emerald-600 text-white p-3 rounded-lg rounded-tr-none text-sm ml-auto w-4/5">
                    Your occupancy for this weekend is <strong>85%</strong>, which is up 12% from last week. I recommend increasing room rates by ₹500.
                  </div>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* 4. Call to Action (CTA) */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-24 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
          Ready to Automate Your Hotel?
        </h2>
        <p className="text-lg text-gray-600 mb-8">
          No credit card required. Setup in 5 minutes. Join 500+ hotels on Staynexa.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link 
            href="/#contact" 
            className="bg-gray-900 text-white px-8 py-4 rounded-lg font-semibold hover:bg-gray-800 transition-colors shadow-lg"
          >
            Start Free Trial
          </Link>
          <Link 
            href="/#pricing" 
            className="bg-white text-gray-900 border border-gray-200 px-8 py-4 rounded-lg font-semibold hover:bg-gray-50 transition-colors shadow-sm"
          >
            View Pricing
          </Link>
        </div>
      </section>

    </div>
  );
}