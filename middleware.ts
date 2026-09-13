// middleware.ts (root of repo)

import { NextResponse, type NextRequest } from "next/server";

// Routes that require authentication
const PROTECTED_ROUTES = ["/", "/calendar", "/inventory", "/guests", "/reports"];
const AUTH_ROUTES = ["/login", "/signup"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check Supabase auth cookie (Supabase sets `sb-<ref>-auth-token`)
  const cookies = request.cookies.getAll();
  const hasAuthCookie = cookies.some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));

  // If user is on an auth page and already logged in → send to dashboard
  if (AUTH_ROUTES.some((r) => pathname === r)) {
    if (hasAuthCookie) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // If user is on a protected route and NOT logged in → send to login
  const isProtected = PROTECTED_ROUTES.some(
    (r) => pathname === r || (r !== "/" && pathname.startsWith(r))
  );

  if (isProtected && !hasAuthCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run on all paths except Next.js internals, static files, and API routes
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
