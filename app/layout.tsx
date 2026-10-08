// app/layout.tsx
import "./globals.css";
import AppShell from "./components/AppShell";

export const metadata = {
  title: "Staynexa - Hotel Management System",
  description: "India's #1 Hotel PMS - Manage bookings, payments, housekeeping, and grow your hotel business.",
  // ✅ Google Search Console Verification
  verification: {
    google: "YPvzm5nyDbyMksoRu4FFY5o1BrNWhKZkCDWIRFGkCm0",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
