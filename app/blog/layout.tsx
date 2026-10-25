// app/blog/layout.tsx
import Link from "next/link";

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* HEADER / NAVBAR */}
      <header className="bg-slate-900 text-white sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            
            {/* LOGO */}
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xl">
                  S
                </div>
                <span className="font-bold text-xl tracking-tight">
                  Staynexa<span className="text-blue-400">.</span>
                </span>
              </Link>
            </div>

            {/* DESKTOP MENU */}
            <nav className="hidden md:flex space-x-8 items-center">
              <Link href="/" className="text-slate-300 hover:text-white font-medium transition">
                Home
              </Link>
              <Link href="/#features" className="text-slate-300 hover:text-white font-medium transition">
                Features
              </Link>
              <Link href="/pricing" className="text-slate-300 hover:text-white font-medium transition">
                Pricing
              </Link>
              <Link href="/about" className="text-slate-300 hover:text-white font-medium transition">
                About
              </Link>
              <Link href="/contact" className="text-slate-300 hover:text-white font-medium transition">
                Contact
              </Link>
              <Link href="/blog" className="text-white font-bold transition">
                Blog
              </Link>
            </nav>

            {/* AUTH BUTTONS */}
            <div className="hidden md:flex items-center space-x-4">
              <Link href="/login" className="text-slate-300 hover:text-white font-medium transition">
                Log in
              </Link>
              <Link 
                href="/signup" 
                className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg font-medium transition shadow-sm hover:shadow-md"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1">
        {children}
      </main>

      {/* SIMPLE FOOTER */}
      <footer className="bg-slate-900 border-t border-slate-800 py-8 text-center mt-auto">
        <p className="text-slate-400 text-sm">
          © {new Date().getFullYear()} Staynexa. All rights reserved.
        </p>
        <div className="mt-2 flex justify-center gap-4 text-sm text-slate-500">
          <Link href="/about" className="hover:text-blue-400">About Us</Link>
          <Link href="/contact" className="hover:text-blue-400">Contact</Link>
          <Link href="/privacy" className="hover:text-blue-400">Privacy Policy</Link>
        </div>
      </footer>
    </div>
  );
}