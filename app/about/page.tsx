import Link from 'next/link';
import { Linkedin, ArrowRight, ShieldCheck, Zap, TrendingUp, Users } from 'lucide-react';

export const metadata = {
  title: "About Us | Staynexa - Founded by Bapan Namasudra & Arnika Das",
  description: "Learn about Staynexa, India's leading hotel management software. Founded in 2026 by Bapan Namasudra (CEO) and Arnika Das (COO) to help hotels automate operations.",
  keywords: ["Staynexa founder", "Bapan Namasudra Staynexa", "Arnika Das Staynexa", "hotel management software India", "Staynexa 2026"],
  authors: [{ name: "Bapan Namasudra" }],
};

export default function AboutPage() {
  // Google Structured Data (JSON-LD)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Staynexa",
    "url": "https://staynexa.in",
    "logo": "https://staynexa.in/logo.png",
    "foundingDate": "2026",
    "description": "India's leading hotel management software launched in 2026.",
    "founders": [
      {
        "@type": "Person",
        "name": "Bapan Namasudra",
        "jobTitle": "Founder & CEO",
        "url": "https://www.linkedin.com/in/bapan-namasudra-b24130229?utm_source=share_via&utm_content=profile&utm_medium=member_android" 
      },
      {
        "@type": "Person",
        "name": "Arnika Das",
        "jobTitle": "Co-Founder & COO",
        "url": "https://www.linkedin.com/in/arnika-das"
      }
    ]
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* 1. HERO SECTION (Premium Dark Theme) */}
      <section className="relative pt-28 pb-24 text-center px-4 overflow-hidden bg-slate-900">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl">
          <div className="absolute top-[-20%] left-[10%] w-[500px] h-[500px] bg-emerald-500 rounded-full mix-blend-multiply filter blur-[120px] opacity-20"></div>
          <div className="absolute bottom-[-20%] right-[10%] w-[400px] h-[400px] bg-blue-600 rounded-full mix-blend-multiply filter blur-[100px] opacity-20"></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-emerald-400 text-sm font-semibold mb-8 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            OUR STORY
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight mb-6 leading-tight">
            Empowering Hoteliers to <br className="hidden md:block" />
            <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">Run on Autopilot.</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Staynexa was launched in <strong className="text-white">2026</strong>. We replaced messy spreadsheets and disconnected tools with one powerful, unified platform designed for modern hospitality.
          </p>
        </div>
      </section>

      {/* 2. STATS SECTION (Floating Cards) */}
      <section className="relative z-20 -mt-12 max-w-5xl mx-auto px-4">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8 grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-slate-100 text-center">
          <div>
            <h3 className="text-3xl md:text-4xl font-extrabold text-slate-900">500+</h3>
            <p className="text-sm text-slate-500 font-medium mt-1">Hotels</p>
          </div>
          <div>
            <h3 className="text-3xl md:text-4xl font-extrabold text-slate-900">25K+</h3>
            <p className="text-sm text-slate-500 font-medium mt-1">Rooms Managed</p>
          </div>
          <div>
            <h3 className="text-3xl md:text-4xl font-extrabold text-slate-900">₹100Cr+</h3>
            <p className="text-sm text-slate-500 font-medium mt-1">Processed</p>
          </div>
          <div>
            <h3 className="text-3xl md:text-4xl font-extrabold text-slate-900">24/7</h3>
            <p className="text-sm text-slate-500 font-medium mt-1">Support</p>
          </div>
        </div>
      </section>

      {/* 3. FOUNDERS SECTION (Premium Cards) */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Meet Our Founders</h2>
          <p className="text-slate-600 mb-16 max-w-2xl mx-auto">The visionaries behind Staynexa, dedicated to empowering hoteliers worldwide with cutting-edge technology.</p>

          <div className="grid md:grid-cols-2 gap-10 max-w-4xl mx-auto">
            
            {/* Founder 1: Bapan */}
            <div className="group relative bg-white rounded-3xl p-8 shadow-sm hover:shadow-2xl transition-all duration-300 border border-slate-100 overflow-hidden text-left">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
              
              <div className="flex items-center gap-6 mb-6">
                <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-emerald-100 shadow-sm relative">
                  {/* আপনার আসল ছবি এখানে যুক্ত করুন */}
                  <img 
                    src="/bapan-namasudra.jpg" 
                    alt="Bapan Namasudra" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">Bapan Namasudra</h3>
                  <p className="text-emerald-600 text-sm font-bold tracking-wide uppercase mt-1">Founder & CEO</p>
                </div>
              </div>
              
              <p className="text-slate-600 text-sm leading-relaxed mb-8">
                A visionary leader passionate about revolutionizing the hospitality industry through intuitive technology. Bapan drives the strategic vision and product innovation at Staynexa.
              </p>
              
              <a 
                href="https://www.linkedin.com/in/bapan-namasudra-b24130229?utm_source=share_via&utm_content=profile&utm_medium=member_android" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors"
              >
                <Linkedin className="w-4 h-4" /> Connect on LinkedIn
              </a>
            </div>

            {/* Founder 2: Arnika */}
            <div className="group relative bg-white rounded-3xl p-8 shadow-sm hover:shadow-2xl transition-all duration-300 border border-slate-100 overflow-hidden text-left">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
              
              <div className="flex items-center gap-6 mb-6">
                <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-blue-100 shadow-sm relative">
                  {/* আপনার আসল ছবি এখানে যুক্ত করুন */}
                  <img 
                    src="/arnika-das.jpg" 
                    alt="Arnika Das" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">Arnika Das</h3>
                  <p className="text-blue-600 text-sm font-bold tracking-wide uppercase mt-1">Co-Founder & COO</p>
                </div>
              </div>
              
              <p className="text-slate-600 text-sm leading-relaxed mb-8">
                The strategic mind ensuring smooth operations and exceptional experiences. Arnika oversees customer success, operations, and ensures our partner hotels achieve maximum growth.
              </p>
              
              <a 
                href="https://www.linkedin.com/in/arnika-das" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-blue-600 transition-colors"
              >
                <Linkedin className="w-4 h-4" /> Connect on LinkedIn
              </a>
            </div>

          </div>
        </div>
      </section>

      {/* 4. OUR VALUES SECTION (New Professional Addition) */}
      <section className="py-24 bg-white border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Why We Built Staynexa</h2>
            <p className="text-slate-600">Our core principles that drive everything we do.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6 rounded-2xl bg-slate-50">
              <div className="w-14 h-14 mx-auto bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-6">
                <Zap className="w-7 h-7" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 mb-2">Simplicity First</h4>
              <p className="text-sm text-slate-600">We believe powerful software shouldn't require a manual. Everything we build is intuitive and easy to use.</p>
            </div>
            
            <div className="text-center p-6 rounded-2xl bg-slate-50">
              <div className="w-14 h-14 mx-auto bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-6">
                <TrendingUp className="w-7 h-7" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 mb-2">Growth Focused</h4>
              <p className="text-sm text-slate-600">We don't just give you software; we provide the tools to increase your direct bookings and revenue.</p>
            </div>

            <div className="text-center p-6 rounded-2xl bg-slate-50">
              <div className="w-14 h-14 mx-auto bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-6">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 mb-2">Reliability</h4>
              <p className="text-sm text-slate-600">Your hotel runs 24/7, and so does our platform. We guarantee 99.9% uptime and dedicated support.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. CTA SECTION */}
      <section className="py-24 bg-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Ready to modernize your hotel?</h2>
          <p className="text-slate-400 mb-10 text-lg">Join 500+ forward-thinking hoteliers using Staynexa to automate their operations.</p>
          <Link 
            href="/#contact"
            className="inline-flex items-center gap-2 bg-emerald-500 text-white px-8 py-4 rounded-xl font-bold hover:bg-emerald-600 transition-all shadow-lg hover:shadow-emerald-500/25"
          >
            Start Your Free Trial <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

    </div>
  );
}