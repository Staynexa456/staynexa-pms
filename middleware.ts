// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get("host") || "";

  // ১. চেক করুন ইউজার বুকিং সাবডোমেইনে (book.staynexa.in) আছে কিনা
  if (hostname.startsWith("book.")) {
    // বুকিং সাবডোমেইনে কোনো অথেনটিকেশন চেক ছাড়াই সরাসরি /book পাথে পাঠান
    if (url.pathname.startsWith("/book/")) {
      return NextResponse.next();
    }
    return NextResponse.rewrite(new URL(`/book${url.pathname}`, req.url));
  }

  // ২. অ্যাডমিন সাবডোমেইনে (app.staynexa.in) থাকলে স্বাভাবিক লজিক চলবে
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
