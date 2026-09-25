"use client";

import "./globals.css";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { supabase } from "./supabase";
import { getUserHotels, type Hotel } from "./db";
import { getActiveHotelId, setActiveHotelId, ensureActiveHotel } from "./active-hotel";
import AskNexaAI from "./components/AskNexaAI";
import HelpModal from "./components/HelpModal";

const navItems = [
  { href: "/", label: "Dashboard", icon: "🏛" },
  { href: "/calendar", label: "Calendar", icon: "📅" },
  { href: "/rates", label: "Rates", icon: "🏷️" },
  { href: "/housekeeping", label: "Housekeeping", icon: "🧹" },
  { href: "/guests", label: "Guests", icon: "👤" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
  { href: "/reports", label: "Reports", icon: "📈" },
];

const PUBLIC_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password", "/book"];

// 🆕 এই ফাংশনটি সরাসরি ব্রাউজারের URL চেক করে, যা ১০০% নির্ভুল
const checkIsPublicPage = () => {
  if (typeof window === "undefined") return false;
  // ১. সাবডোমেইন চেক (book.staynexa.in)
  if (window.location.hostname.startsWith("book.")) return true;
  // ২. পাথ চেক (/book/...)
  const path = window.location.pathname;
  return PUBLIC_ROUTES.some((r) => path === r || path.startsWith(r + "/"));
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [activeHotel, setActiveHotelState] = useState<Hotel | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  
  // 🆕 প্রাথমিক স্টেট সেট করা (যাতে লোডিং লুপ না হয়)
  const [isPublicPage, setIsPublicPage] = useState(false);

  const bootstrappedRef = useRef(false);

  // 🆕 রেন্ডার হওয়ার সময়ই চেক করে নিন
  useEffect(() => {
    const isPublic = checkIsPublicPage();
    setIsPublicPage(isPublic);
    if (isPublic) {
      setCheckingAuth(false);
    }
  }, [pathname]);

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
    let mounted = true;

    const bootstrap = async () => {
      // 🆕 এখানে সরাসরি চেক করছি, যাতে কখনো ভুল না হয়
      const isPublic = checkIsPublicPage();
      
      if (isPublic) {
        setCheckingAuth(false);
        return;
      }

      setCheckingAuth(true);

      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (!data?.session?.user) {
        // 🆕 লগইন পেজে পাঠানোর আগে নিশ্চিত হোন এটি পাবলিক পেজ নয়
        if (!checkIsPublicPage()) {
          router.push("/login");
        }
        return;
      }

      setUserEmail(data.session.user.email || null);

      try { await ensureActiveHotel(); } catch (err) { console.error(err); }
      if (!mounted) return;

      let userHotels: Hotel[] = [];
      try { userHotels = await getUserHotels(); } catch (err) { console.error(err); }
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

    if (!bootstrappedRef.current || !isPublicPage) {
      bootstrappedRef.current = true;
      bootstrap();
    }

    return () => { mounted = false; };
  }, [isPublicPage, router]);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUserEmail(session.user.email || null);
        if (event === "SIGNED_IN") {
          (async () => {
            try {
              await ensureActiveHotel();
              const h = await getUserHotels();
              setHotels(h);
              const stored = getActiveHotelId();
              const active = h.find((x) => x.id === stored) || h[0] || null;
              if (active) { setActiveHotelState(active); setActiveHotelId(active.id); }
              setCheckingAuth(false);
            } catch (err) { console.error(err); }
          })();
        }
      } else if (event === "SIGNED_OUT") {
        if (!checkIsPublicPage()) {
          router.push("/login");
        }
      }
    });
    return () => { authListener.subscription.unsubscribe(); };
  }, [router]);

  const handleLogout = async () => { await supabase.auth.signOut(); router.push("/login"); };
  const handleSwitchHotel = (hotel: Hotel) => {
    setActiveHotelState(hotel); setActiveHotelId(hotel.id); setSwitcherOpen(false);
    window.dispatchEvent(new CustomEvent("hotel-changed", { detail: hotel.id }));
    setTimeout(() => { window.location.href = "/"; }, 100);
  };

  // 🆕 পাবলিক পেজ হলে সরাসরি চিলড্রেন রেন্ডার করুন (কোনো লেআউট বা অথ চেক ছাড়া)
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
          {/* আপনার সাইডবার, হেডার, মেইন কন্টেন্ট এখানে বসান */}
          <main className="flex-1 w-full overflow-x-hidden">{children}</main>
        </div>
        {aiOpen && <AskNexaAI onClose={() => setAiOpen(false)} />}
        {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      </body>
    </html>
  );
}
