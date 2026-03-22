import { NextRequest, NextResponse } from "next/server";

const publicRoutes = ["/login", "/api/auth/login", "/landing", "/test", "/test2"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // For API routes (except /api/auth/login which is already allowed above),
  // let them handle their own auth and return 401
  // Don't redirect API routes to /login
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Check for auth token (only for page routes, not API)
  const token = request.cookies.get("auth-token")?.value;

  if (!token) {
    // Redirect to login (only for page routes)
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
