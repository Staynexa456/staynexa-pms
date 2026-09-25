// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get("host") || "";

  // ১. বুকিং সাবডোমেইন (book.staynexa.in) চেক
  if (hostname.startsWith("book.")) {
    // যদি ইতিমধ্যে /book/ পাথে থাকে, তবে কিছু করার নেই
    if (url.pathname.startsWith("/book/")) {
      return NextResponse.next();
    }
    // না হলে, /book/ পাথে রিরাইট করুন
    return NextResponse.rewrite(new URL(`/book${url.pathname}`, req.url));
  }

  // ২. বাকি সব রুটের জন্য স্বাভাবিক লজিক
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
