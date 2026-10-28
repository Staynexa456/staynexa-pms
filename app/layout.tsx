// app/layout.tsx
import "./globals.css";
import AppShell from "./components/AppShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://staynexa.in"),
  title: {
    default: "Staynexa - India's #1 Hotel Management System (PMS)",
    template: "%s | Staynexa",
  },
  description: "Staynexa is India's leading hotel management software. Manage bookings, payments, housekeeping, and grow your hotel business. Founded by Bapan Namasudra.",
  keywords: ["hotel management system", "PMS software India", "hotel booking engine", "Staynexa", "hotel PMS", "property management system", "Bapan Namasudra"],
  authors: [{ name: "Bapan Namasudra", url: "https://staynexa.in" }],
  creator: "Bapan Namasudra",
  publisher: "Staynexa",
  // ✅ Google Search Console Verification (আপনার পুরনো কোড থেকে রাখা হয়েছে)
  verification: {
    google: "TZoCcL76UA6-PI6WvlYvjo6w9PHNRz05TgYF8KFzgSY",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://staynexa.in",
    siteName: "Staynexa",
    title: "Staynexa - India's #1 Hotel Management System",
    description: "Manage your hotel smarter with Staynexa PMS.",
    images: [{ url: "https://staynexa.in/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Staynexa - India's #1 Hotel Management System",
    description: "Manage your hotel smarter with Staynexa PMS.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // ✅ Founder's Name & Company Info (JSON-LD Structured Data)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Staynexa PMS",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: "India's leading hotel management software for small and medium hotels.",
    offers: { "@type": "Offer", price: "999", priceCurrency: "INR" },
    author: {
      "@type": "Person",
      name: "Bapan Namasudra",
      jobTitle: "Founder & CEO",
    },
    publisher: {
      "@type": "Organization",
      name: "Staynexa",
      url: "https://staynexa.in",
    },
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        {/* Structured Data Script */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}