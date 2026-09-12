import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Staynexa - Hotel PMS",
  description: "Hotel Management System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-50 text-gray-900">
        {/* TOP NAVIGATION BAR */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center sticky top-0 z-50">
          <div className="flex items-center gap-6">
            {/* Logo */}
            <Link href="/" className="w-8 h-8 bg-slate-900 text-white flex items-center justify-center rounded font-bold text-lg">S</Link>
            
            {/* Nav Links with Icons (Using Emoji for reliability) */}
            <nav className="flex items-center gap-2">
              <Link href="/" className="p-2 rounded hover:bg-gray-100 text-lg" title="Dashboard">🏠</Link>
              <Link href="/calendar" className="p-2 rounded hover:bg-gray-100 text-lg" title="Calendar">📅</Link>
              <Link href="/inventory" className="p-2 rounded hover:bg-gray-100 text-lg" title="Inventory">📊</Link>
              <Link href="/guests" className="p-2 rounded hover:bg-gray-100 text-lg" title="Guests">👥</Link>
              <Link href="/reports" className="p-2 rounded hover:bg-gray-100 text-lg" title="Reports">📄</Link>
            </nav>

            {/* Search */}
            <input 
              type="text" 
              placeholder="🔍 Search for reservation" 
              className="ml-4 pl-3 pr-4 py-2 border border-gray-300 rounded text-sm w-64 outline-none focus:border-slate-500"
            />
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-1 border border-gray-300 px-3 py-1.5 rounded-full text-sm font-medium">✨ flexi AI</button>
            <a href="#" className="text-sm text-gray-500 hover:underline">help?</a>
            <button className="bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded">New UI</button>
            <span className="text-sm font-medium text-gray-700">Vishara Elite</span>
            <div className="w-6 h-6 bg-slate-800 text-white rounded flex items-center justify-center text-xs font-bold">V</div>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main>{children}</main>
      </body>
    </html>
  );
}
