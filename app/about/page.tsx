// app/about/page.tsx
import Link from "next/link";
import { Metadata } from "next";

// ✅ ১. গুগল এবং সোশ্যাল মিডিয়ার জন্য মেটাডাটা
export const metadata: Metadata = {
  title: "About Us | Staynexa - Hotel Management System",
  description: "Learn about Staynexa, founded by Bapan Namasudra and Arnika Das. We are on a mission to help hoteliers run their properties on autopilot with our unified PMS.",
  openGraph: {
    title: "About Staynexa | Our Founders",
    description: "Meet Bapan Namasudra (Founder & CEO) and Arnika Das (Co-Founder & COO) behind Staynexa's mission to revolutionize hotel management.",
    type: "website",
  },
};

export default function AboutPage() {
  // ✅ ২. AI এবং সার্চ ইঞ্জিনের জন্য Structured Data (Schema.org)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Staynexa",
    "url": "https://staynexa.in",
    "logo": "https://staynexa.in/favicon.ico",
    "description": "All-in-one hotel management system for bookings, payments, housekeeping, and guest communication.",
    "founder": [
      {
        "@type": "Person",
        "name": "Bapan Namasudra",
        "jobTitle": "Founder & CEO",
        "worksFor": {
          "@type": "Organization",
          "name": "Staynexa"
        },
        // ✅ আপনার আসল LinkedIn লিংক এখানে বসানো হলো
        "sameAs": [
          "https://www.linkedin.com/in/bapan-namasudra-b24130229" 
        ]
      },
      {
        "@type": "Person",
        "name": "Arnika Das",
        "jobTitle": "Co-Founder & COO",
        "worksFor": {
          "@type": "Organization",
          "name": "Staynexa"
        },
        // ⚠️ এখানে Arnika Das-এর আসল LinkedIn প্রোফাইল লিংকটি বসাতে ভুলবেন না
        "sameAs": [
          "https://www.linkedin.com/in/arnika-das" 
        ]
      }
    ]
  };

  return (
    <div className="min-h-screen bg-white selection:bg-blue-100">
      {/* 🔍 স্কিমা স্ক্রিপ্টটি পেজে যুক্ত করা হলো */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero Section */}
      <section className="relative bg-slate-50 py-24 px-4 sm:px-6 lg:px-8 text-center overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
        <div className="relative max-w-4xl mx-auto z-10">
          <span className="inline-block py-1 px-3 rounded-full bg-blue-100 text-blue-700 text-xs font-bold tracking-widest uppercase mb-6">
            Our Story
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 mb-6 tracking-tight">
            Empowering Hoteliers <br className="hidden md:block" /> to Run on Autopilot
          </h1>
          <p className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-3xl mx-auto">
            Staynexa was born out of a desire to simplify hotel management. We replaced messy spreadsheets and disconnected tools with one powerful, unified platform.
          </p>
        </div>
      </section>

      {/* Stats Section (Professional Look) */}
      <section className="border-b border-slate-100 bg-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-3xl font-extrabold text-slate-900">500+</p>
              <p className="text-sm text-slate-500 font-medium mt-1">Hotels</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-slate-900">25K+</p>
              <p className="text-sm text-slate-500 font-medium mt-1">Rooms Managed</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-slate-900">₹100Cr+</p>
              <p className="text-sm text-slate-500 font-medium mt-1">Processed</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-slate-900">24/7</p>
              <p className="text-sm text-slate-500 font-medium mt-1">Support</p>
            </div>
          </div>
        </div>
      </section>

      {/* Founders Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Meet Our Founders</h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            The visionaries behind Staynexa, dedicated to empowering hoteliers worldwide.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-4xl mx-auto">
          
          {/* Founder Card - Bapan Namasudra */}
          <div className="group relative bg-white rounded-3xl p-8 shadow-sm hover:shadow-2xl border border-slate-100 transition-all duration-300 hover:-translate-y-2 text-center">
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-blue-50 to-transparent rounded-t-3xl -z-10 group-hover:from-blue-100 transition-colors"></div>
            <div className="w-36 h-36 mx-auto mb-6 rounded-full overflow-hidden border-4 border-white shadow-lg relative bg-slate-100">
              {/* এখানে আপনার আসল ছবি বসাতে পারেন (src-এ লিংক দিন) */}
              <img 
                src="https://images.unsplash.com/photo-1560250097-0b93528c311a?ixlib=rb-4.0.3&auto=format&fit=crop&w=256&q=80" 
                alt="Bapan Namasudra - Founder" 
                className="w-full h-full object-cover"
              />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-1">Bapan Namasudra</h3>
            <p className="text-blue-600 font-semibold text-sm mb-4 tracking-wide uppercase">Founder & CEO</p>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              A visionary leader passionate about revolutionizing the hospitality industry through intuitive technology and seamless automation.
            </p>
            <div className="flex justify-center gap-4">
              {/* ✅ বাটনে আপনার আসল LinkedIn লিংক বসানো হলো */}
              <a href="https://www.linkedin.com/in/bapan-namasudra-b24130229" target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition font-bold">in</a>
            </div>
          </div>

          {/* Co-Founder Card - Arnika Das */}
          <div className="group relative bg-white rounded-3xl p-8 shadow-sm hover:shadow-2xl border border-slate-100 transition-all duration-300 hover:-translate-y-2 text-center">
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-blue-50 to-transparent rounded-t-3xl -z-10 group-hover:from-blue-100 transition-colors"></div>
            <div className="w-36 h-36 mx-auto mb-6 rounded-full overflow-hidden border-4 border-white shadow-lg relative bg-slate-100">
              {/* এখানে Arnika Das-এর আসল ছবি বসাতে পারেন */}
              <img 
                src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&auto=format&fit=crop&w=256&q=80" 
                alt="Arnika Das - Co-Founder" 
                className="w-full h-full object-cover"
              />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-1">Arnika Das</h3>
            <p className="text-blue-600 font-semibold text-sm mb-4 tracking-wide uppercase">Co-Founder & COO</p>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              The strategic mind ensuring smooth operations and exceptional experiences for our partner hotels and their guests.
            </p>
            <div className="flex justify-center gap-4">
              {/* ⚠️ Arnika Das-এর LinkedIn লিংকটি এখানে বসান */}
              <a href="https://www.linkedin.com/in/ARNIKA_PROFILE" target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition font-bold">in</a>
            </div>
          </div>

        </div>
      </section>
      
      {/* Footer CTA */}
      <section className="bg-slate-900 py-16 text-center px-4">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">Ready to modernize your hotel?</h2>
        <Link href="/signup" className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-500 transition shadow-lg shadow-blue-500/30">
          Start Your Free Trial
        </Link>
      </section>
    </div>
  );
}