// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get("host") || "";

  const isBookingSubdomain = hostname.startsWith("book.");

  if (isBookingSubdomain) {
    // 🆕 যদি কেউ /login লিখে, তবে তাকে অ্যাডমিন প্যানেলে পাঠিয়ে দিন
    if (url.pathname === "/login") {
      return NextResponse.redirect(new URL("https://app.staynexa.in/login"));
    }

    if (url.pathname.startsWith("/book/")) {
      return NextResponse.next();
    }
    
    return NextResponse.rewrite(new URL(`/book${url.pathname}`, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
