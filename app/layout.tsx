import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Staynexa — Hotel PMS",
  description: "Premium hotel management system",
};

const navItems = [
  { href: "/", label: "Dashboard", icon: "🏛" },
  { href: "/calendar", label: "Calendar", icon: "📅" },
  { href: "/inventory", label: "Inventory", icon: "📊" },
  { href: "/guests", label: "Guests", icon: "👤" },
  { href: "/reports", label: "Reports", icon: "📈" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-cream">
        <div className="flex min-h-screen">
          {/* ─────────── PREMIUM SIDEBAR ─────────── */}
          <aside className="hidden lg:flex w-64 flex-col bg-navy text-white fixed h-screen">
            {/* Logo */}
            <div className="px-6 py-8 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gold flex items-center justify-center font-serif text-navy text-xl font-bold">
                  S
                </div>
                <div>
                  <h1 className="font-serif text-xl font-semibold tracking-wide">
                    Staynexa
                  </h1>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gold/80">
                    Hotel PMS
                  </p>
                </div>
              </div>
            </div>

            {/* Nav Items */}
            <nav className="flex-1 px-4 py-6 space-y-1">
              <p className="px-3 text-[10px] uppercase tracking-[0.2em] text-white/40 mb-3">
                Front Office
              </p>
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-all border-l-2 border-transparent hover:border-gold"
                >
                  <span className="text-base opacity-70 group-hover:opacity-100">
                    {item.icon}
                  </span>
                  <span className="font-medium tracking-wide">{item.label}</span>
                </Link>
              ))}
            </nav>

            {/* Property Badge */}
            <div className="p-4 border-t border-white/10">
              <div className="rounded-lg bg-white/5 p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-gold/80 mb-1">
                  Property
                </p>
                <p className="text-sm font-medium text-white">
                  Vishara Elite Hotel
                </p>
              </div>
            </div>
          </aside>

          {/* ─────────── MAIN CONTENT AREA ─────────── */}
          <div className="flex-1 lg:ml-64 flex flex-col">
            {/* Top Bar */}
            <header className="bg-white/80 backdrop-blur-md border-b border-cream-dark sticky top-0 z-40">
              <div className="px-6 py-4 flex justify-between items-center">
                {/* Search */}
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">
                    🔍
                  </span>
                  <input
                    type="text"
                    placeholder="Search reservations, guests..."
                    className="pl-9 pr-4 py-2.5 border border-cream-dark rounded-full text-sm w-80 outline-none focus:border-gold transition-colors bg-cream/50"
                  />
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-4">
                  <button className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full border border-gold/30 text-navy text-xs font-medium hover:bg-gold/5 transition">
                    ✨ Ask Nexa AI
                  </button>
                  <button className="text-sm text-muted hover:text-navy transition">
                    Help
                  </button>
                  <div className="flex items-center gap-2 pl-4 border-l border-cream-dark">
                    <div className="text-right">
                      <p className="text-xs font-semibold text-navy">
                        Vishara Elite
                      </p>
                      <p className="text-[10px] text-muted">Owner</p>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-navy text-gold flex items-center justify-center font-serif font-bold">
                      V
                    </div>
                  </div>
                </div>
              </div>
            </header>

            {/* Page Content */}
            <main className="flex-1">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
