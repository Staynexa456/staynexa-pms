// app/about/page.tsx
import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-20">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
          About Staynexa
        </h1>
        <p className="text-lg text-gray-600 leading-relaxed">
          We are on a mission to help hoteliers run their properties on autopilot. 
          Staynexa was born out of a desire to simplify hotel management, replacing 
          messy spreadsheets and disconnected tools with one powerful, unified platform.
        </p>
      </div>

      {/* 👑 Founders Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Meet Our Founders</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            The visionaries behind Staynexa, dedicated to empowering hoteliers worldwide.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-4xl mx-auto">
          
          {/* Bapan Namasudra - Founder Card */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center hover:shadow-xl transition-shadow duration-300">
            <div className="w-32 h-32 mx-auto mb-6 rounded-full overflow-hidden border-4 border-blue-50 bg-gray-100 flex items-center justify-center">
              {/* এখানে Bapan Namasudra-এর ছবি দিন (src-এ লিংক বসান) */}
              <img 
                src="https://images.unsplash.com/photo-1560250097-0b93528c311a?ixlib=rb-4.0.3&auto=format&fit=crop&w=256&q=80" 
                alt="Bapan Namasudra" 
                className="w-full h-full object-cover"
              />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">Bapan Namasudra</h3>
            <p className="text-blue-600 font-semibold mb-4">Founder & CEO</p>
            <p className="text-gray-600 text-sm mb-6">
              A visionary leader passionate about revolutionizing the hospitality industry through intuitive technology.
            </p>
            <div className="flex justify-center gap-4">
              <a href="#" className="text-gray-400 hover:text-blue-600 transition">LinkedIn</a>
              <a href="#" className="text-gray-400 hover:text-blue-400 transition">Twitter</a>
            </div>
          </div>

          {/* Arnika Das - Co-Founder Card */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center hover:shadow-xl transition-shadow duration-300">
            <div className="w-32 h-32 mx-auto mb-6 rounded-full overflow-hidden border-4 border-blue-50 bg-gray-100 flex items-center justify-center">
              {/* এখানে Arnika Das-এর ছবি দিন (src-এ লিংক বসান) */}
              <img 
                src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&auto=format&fit=crop&w=256&q=80" 
                alt="Arnika Das" 
                className="w-full h-full object-cover"
              />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">Arnika Das</h3>
            <p className="text-blue-600 font-semibold mb-4">Co-Founder & COO</p>
            <p className="text-gray-600 text-sm mb-6">
              The strategic mind ensuring smooth operations and exceptional experiences for our partner hotels.
            </p>
            <div className="flex justify-center gap-4">
              <a href="#" className="text-gray-400 hover:text-blue-600 transition">LinkedIn</a>
              <a href="#" className="text-gray-400 hover:text-blue-400 transition">Twitter</a>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}