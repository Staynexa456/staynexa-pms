"use client";

import "./globals.css";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { getUserHotels, type Hotel } from "./db";
import { getActiveHotelId, setActiveHotelId } from "./active-hotel";

const navItems = [
  { href: "/", label: "Dashboard", icon: "🏛" },
  { href: "/calendar", label: "Calendar", icon: "📅" },
  { href: "/housekeeping", label: "Housekeeping", icon: "🧹" }, // ✅ NEW
  { href: "/inventory", label: "Inventory", icon: "📊" },
  { href: "/guests", label: "Guests", icon: "👤" },
  { href: "/reports", label: "Reports", icon: "📈" },
];

const PUBLIC_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password"];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [activeHotel, setActiveHotelState] = useState<Hotel | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

  const isPublicPage = PUBLIC_ROUTES.some(
    (r) => pathname === r || pathname?.startsWith(r + "/")
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    }
  }, []);

  const toggleTheme = () => {
    if (typeof window === "undefined") return;
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  useEffect(() => {
    if (isPublicPage) {
      setCheckingAuth(false);
      return;
    }

    let mounted = true;

    const bootstrap = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!data?.session?.user) {
        router.push("/login");
        return;
      }

      setUserEmail(data.session.user.email || null);

      const userHotels = await getUserHotels();
      if (!mounted) return;
      setHotels(userHotels);

      const stored = getActiveHotelId();
      const active = userHotels.find((h) => h.id === stored) || userHotels[0] || null;
      if (active) {
        setActiveHotelState(active);
        setActiveHotelId(active.id);
      }

      setCheckingAuth(false);
    };

    bootstrap();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (session?.user) {
        setUserEmail(session.user.email || null);
      } else if (event === "SIGNED_OUT") {
        router.push("/login");
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [pathname, isPublicPage, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleSwitchHotel = (hotel: Hotel) => {
    setActiveHotelState(hotel);
    setActiveHotelId(hotel.id);
    setSwitcherOpen(false);
    window.dispatchEvent(new CustomEvent("hotel-changed", { detail: hotel.id }));
    setTimeout(() => {
      window.location.href = "/";
    }, 100);
  };

  if (isPublicPage) {
    return (
      <html lang="en">
        <body className="antialiased">{children}</body>
      </html>
    );
  }

  if (checkingAuth) {
    return (
      <html lang="en">
        <body className="antialiased">
          <div className="min-h-screen flex items-center justify-center bg-cream dark:bg-slate-900">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-gold border-t-transparent animate-spin" />
              <p className="text-navy dark:text-white font-medium text-sm">Loading…</p>
            </div>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body className="antialiased bg-cream dark:bg-slate-900">
        <div className="flex min-h-screen">
          <aside className="hidden lg:flex w-64 flex-col bg-navy text-white fixed h-screen">
            <div className="px-5 py-6 border-b border-white/10">
              <Link href="/" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gold flex items-center justify-center font-serif text-navy text-xl font-bold">
                  S
                </div>
                <div>
                  <h1 className="font-serif text-lg font-semibold tracking-wide">Staynexa</h1>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gold/80">Hotel PMS</p>
                </div>
              </Link>

              <div className="mt-4 relative">
                <button
                  onClick={() => setSwitcherOpen(!switcherOpen)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] uppercase tracking-widest text-gold/70 font-semibold">Property</p>
                    <p className="text-xs font-medium text-white truncate">
                      {activeHotel?.name || "Select property"}
                    </p>
                  </div>
                  <span className="text-white/50 text-xs">▾</span>
                </button>

                {switcherOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setSwitcherOpen(false)} />
                    <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-navy/10 dark:border-slate-700 py-1 max-h-72 overflow-y-auto">
                      <p className="px-3 py-2 text-[10px] uppercase tracking-widest text-navy/50 dark:text-slate-400 font-semibold">
                        Your Properties ({hotels.length})
                      </p>
                      {hotels.map((h) => (
                        <button
                          key={h.id}
                          onClick={() => handleSwitchHotel(h)}
                          className={`w-full text-left px-3 py-2.5 text-sm hover:bg-cream dark:hover:bg-slate-700 transition flex items-center justify-between ${
                            activeHotel?.id === h.id
                              ? "bg-cream/60 dark:bg-slate-700 text-navy dark:text-white font-semibold"
                              : "text-navy/80 dark:text-slate-300"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate">{h.name}</p>
                            {h.city && (
                              <p className="text-[10px] text-muted truncate">
                                {h.city}{h.state ? `, ${h.state}` : ""}
                              </p>
                            )}
                          </div>
                          {activeHotel?.id === h.id && <span className="text-gold ml-2">✓</span>}
                        </button>
                      ))}
                      <div className="border-t border-navy/10 dark:border-slate-700 mt-1 pt-1">
                        <Link
                          href="/properties"
                          onClick={() => setSwitcherOpen(false)}
                          className="block w-full text-left px-3 py-2.5 text-sm text-navy dark:text-slate-200 font-medium hover:bg-cream dark:hover:bg-slate-700 transition"
                        >
                          + Add new property
                        </Link>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
              <p className="px-3 text-[10px] uppercase tracking-[0.2em] text-white/40 mb-3">
                Front Office
              </p>
              {navItems.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/" && pathname?.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all border-l-2 ${
                      active
                        ? "bg-white/10 text-white border-gold"
                        : "text-white/70 hover:text-white hover:bg-white/5 border-transparent hover:border-gold"
                    }`}
                  >
                    <span className="text-base opacity-70 group-hover:opacity-100">{item.icon}</span>
                    <span className="font-medium tracking-wide">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-white/10">
              <Link
                href="/properties"
                className={`block text-xs font-medium transition ${
                  pathname?.startsWith("/properties")
                    ? "text-gold"
                    : "text-white/50 hover:text-gold"
                }`}
              >
                ⚙️ Manage Properties
              </Link>
            </div>
          </aside>

          <div className="w-full lg:pl-64 flex flex-col min-w-0">
            <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-cream-dark dark:border-slate-700 sticky top-0 z-30 w-full">
              <div className="px-6 py-4 flex justify-between items-center gap-4">
                <div className="relative flex-1 max-w-md">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">🔍</span>
                  <input
                    type="text"
                    placeholder="Search reservations, guests..."
                    onChange={(e) => {
                      window.dispatchEvent(new CustomEvent("global-search", { detail: e.target.value }));
                    }}
                    className="w-full pl-9 pr-4 py-2.5 border border-cream-dark dark:border-slate-600 rounded-full text-sm outline-none focus:border-gold transition-colors bg-cream/50 dark:bg-slate-700 dark:text-white"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleTheme}
                    title={isDark ? "Switch to light" : "Switch to dark"}
                    className="flex items-center justify-center w-10 h-10 rounded-full border border-cream-dark dark:border-slate-600 hover:bg-gold/10 transition"
                  >
                    {isDark ? <span className="text-lg">☀️</span> : <span className="text-lg">🌙</span>}
                  </button>

                  <button className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full border border-gold/30 text-navy dark:text-slate-200 text-xs font-medium hover:bg-gold/5 transition">
                    ✨ Ask Nexa AI
                  </button>

                  <button className="hidden md:block text-sm text-muted hover:text-navy dark:hover:text-white transition">
                    Help
                  </button>

                  <div className="flex items-center gap-3 pl-4 border-l border-cream-dark dark:border-slate-600">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-semibold text-navy dark:text-white">
                        {userEmail?.split("@")[0] || "Owner"}
                      </p>
                      <p className="text-[10px] text-muted">{userEmail || ""}</p>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-navy dark:bg-slate-600 text-gold flex items-center justify-center font-serif font-bold">
                      {userEmail?.charAt(0).toUpperCase() || "V"}
                    </div>
                    <button
                      onClick={handleLogout}
                      className="text-xs text-muted hover:text-rose-500 transition font-medium"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            </header>

            <main className="flex-1 w-full overflow-x-hidden">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}