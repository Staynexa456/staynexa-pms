// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get("host") || "";

  // ১. বুকিং সাবডোমেইন ডিটেক্ট করুন (book.staynexa.in)
  const isBookingSubdomain = hostname.startsWith("book.");

  // ২. যদি বুকিং সাবডোমেইনে হয়, তবে গেস্টদের পাবলিক পেজে পাঠান
  if (isBookingSubdomain) {
    // যদি ইতিমধ্যে /book/ পাথে থাকে, তবে কিছু করার নেই
    if (url.pathname.startsWith("/book/")) {
      return NextResponse.next();
    }
    // না হলে, /book/ পাথে রিরাইট করুন (URL একই থাকবে, কিন্তু পেজ বদলে যাবে)
    return NextResponse.rewrite(new URL(`/book${url.pathname}`, req.url));
  }

  // ৩. অ্যাডমিন সাবডোমেইনের জন্য স্বাভাবিক লজিক চলবে
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
