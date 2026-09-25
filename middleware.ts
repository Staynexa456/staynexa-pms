// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get("host") || "";

  // বুকিং সাবডোমেইন (book.staynexa.in) চেক
  if (hostname.startsWith("book.")) {
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
