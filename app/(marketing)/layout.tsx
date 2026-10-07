// app/(marketing)/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://staynexa.in"),
  title: {
    default: "Staynexa - India's #1 Hotel Management System (PMS)",
    template: "%s | Staynexa",
  },
  description:
    "Staynexa is India's most advanced hotel management software. Manage bookings, payments, housekeeping, and grow your hotel business. Trusted by 500+ hotels. Start your free trial today.",
  keywords: [
    "hotel management system",
    "hotel PMS software India",
    "hotel booking engine",
    "Staynexa PMS",
    "property management system",
    "hotel software",
    "guest management software",
    "hotel billing software",
  ],
  authors: [{ name: "Staynexa" }],
  creator: "Staynexa",
  publisher: "Staynexa",
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://staynexa.in",
    siteName: "Staynexa",
    title: "Staynexa - India's #1 Hotel Management System",
    description:
      "Manage your hotel smarter with Staynexa PMS. Bookings, payments, housekeeping & more.",
    images: [
      {
        url: "https://staynexa.in/og-image.png",
        width: 1200,
        height: 630,
        alt: "Staynexa PMS Dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Staynexa - India's #1 Hotel Management System",
    description: "Manage your hotel smarter with Staynexa PMS.",
    images: ["https://staynexa.in/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://staynexa.in",
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}