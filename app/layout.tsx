// app/layout.tsx
import "./globals.css";
import AppShell from "./components/AppShell";

export const metadata = {
  title: "Staynexa - Hotel Management System",
  description: "India's #1 Hotel PMS - Manage bookings, payments, housekeeping, and grow your hotel business.",
  // ✅ Google Search Console Verification
  verification: {
    google: "TZoCcL76UA6-PI6WvlYvjo6w9PHNRz05TgYF8KFzgSY",
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
