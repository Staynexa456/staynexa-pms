import Link from 'next/link';

// ১. SEO Metadata (গুগল সার্চে নাম ও বছর দেখানোর জন্য)
export const metadata = {
  title: "About Us | Staynexa - Founded by Bapan Namasudra & Arnika Das",
  description: "Learn about Staynexa, India's leading hotel management software. Founded in 2026 by Bapan Namasudra (CEO) and Arnika Das (COO) to help hotels automate operations.",
  keywords: ["Staynexa founder", "Bapan Namasudra Staynexa", "Arnika Das Staynexa", "hotel management software India", "Staynexa 2026"],
  authors: [{ name: "Bapan Namasudra" }],
};

export default function AboutPage() {
  // ২. Structured Data (JSON-LD) - গুগলকে ফাউন্ডার ও প্রতিষ্ঠার বছর জানানোর জন্য
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Staynexa",
    "url": "https://staynexa.in",
    "logo": "https://staynexa.in/logo.png", // আপনার লোগোর আসল লিংক দিন
    "foundingDate": "2026", // এখানে ২০২৬ করে দেওয়া হয়েছে
    "description": "India's leading hotel management software launched in 2026.",
    "founders": [
      {
        "@type": "Person",
        "name": "Bapan Namasudra",
        "jobTitle": "Founder & CEO",
        "url": "https://www.linkedin.com/in/bapan-namasudra" // আপনার লিংক দিন
      },
      {
        "@type": "Person",
        "name": "Arnika Das",
        "jobTitle": "Co-Founder & COO",
        "url": "https://www.linkedin.com/in/arnika-das" // আপনার লিংক দিন
      }
    ]
  };

  return (
    <div className="min-h-screen bg-white">
      {/* JSON-LD Script */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* HERO SECTION */}
      <section className="pt-20 pb-16 text-center bg-gray-50 border-b border-gray-100 px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-sm font-semibold mb-6">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
          OUR STORY
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-6 max-w-3xl mx-auto">
          Empowering Hoteliers to Run on Autopilot
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Staynexa was launched in <strong>2026</strong>. We replaced messy spreadsheets and disconnected tools with one powerful, unified platform.
        </p>
      </section>

      {/* STATS SECTION */}
      <section className="py-10 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <h3 className="text-3xl font-bold text-gray-900">500+</h3>
            <p className="text-sm text-gray-500 mt-1">Hotels</p>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-gray-900">25K+</h3>
            <p className="text-sm text-gray-500 mt-1">Rooms Managed</p>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-gray-900">₹100Cr+</h3>
            <p className="text-sm text-gray-500 mt-1">Processed</p>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-gray-900">24/7</h3>
            <p className="text-sm text-gray-500 mt-1">Support</p>
          </div>
        </div>
      </section>

      {/* FOUNDERS SECTION */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Meet Our Founders</h2>
          <p className="text-gray-600 mb-12">The visionaries behind Staynexa, dedicated to empowering hoteliers worldwide.</p>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            
            {/* Founder 1 */}
            <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-32 h-32 mx-auto rounded-full overflow-hidden border-4 border-gray-50 mb-6">
                {/* এখানে আপনার আসল ছবির লিংক দিন */}
                <img 
                  src="/bapan-namasudra.jpg" 
                  alt="Bapan Namasudra - Founder & CEO of Staynexa" 
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Bapan Namasudra</h3>
              <p className="text-blue-600 text-sm font-semibold mb-4 uppercase tracking-wider">Founder & CEO</p>
              <p className="text-gray-600 text-sm leading-relaxed mb-6">
                A visionary leader passionate about revolutionizing the hospitality industry through intuitive technology and seamless automation.
              </p>
              <a href="https://www.linkedin.com/in/bapan-namasudra" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-50 text-gray-500 hover:bg-blue-600 hover:text-white transition-colors">
                <span className="font-bold">in</span>
              </a>
            </div>

            {/* Founder 2 */}
            <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-32 h-32 mx-auto rounded-full overflow-hidden border-4 border-gray-50 mb-6">
                <img 
                  src="/arnika-das.jpg" 
                  alt="Arnika Das - Co-Founder & COO of Staynexa" 
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Arnika Das</h3>
              <p className="text-blue-600 text-sm font-semibold mb-4 uppercase tracking-wider">Co-Founder & COO</p>
              <p className="text-gray-600 text-sm leading-relaxed mb-6">
                The strategic mind ensuring smooth operations and exceptional experiences for our partner hotels and their guests.
              </p>
              <a href="https://www.linkedin.com/in/arnika-das" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-50 text-gray-500 hover:bg-blue-600 hover:text-white transition-colors">
                 <span className="font-bold">in</span>
              </a>
            </div>

          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="py-20 bg-gray-900 text-center px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-6">Ready to modernize your hotel?</h2>
          <Link 
            href="/#contact"
            className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg"
          >
            Start Your Free Trial
          </Link>
        </div>
      </section>

    </div>
  );
}