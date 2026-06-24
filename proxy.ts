import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import authConfig from "@/auth.config";

// Next 16 renamed `middleware` -> `proxy`. This reads the session token and
// gates routes. Server actions are ALSO guarded individually (see lib/auth/
// guards.ts) — never rely on the proxy alone for authorization.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const path = nextUrl.pathname;
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role;

  // The sign-in page: send logged-in users home, allow everyone else through.
  if (path === "/sign-in") {
    if (isLoggedIn) return NextResponse.redirect(new URL("/", nextUrl));
    return NextResponse.next();
  }

  // Everything else requires a session.
  if (!isLoggedIn) {
    const signInUrl = new URL("/sign-in", nextUrl);
    if (path !== "/") signInUrl.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(signInUrl);
  }

  // Admin area is admin-only.
  if (path.startsWith("/admin") && role !== "admin") {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Run on everything except API routes, Next internals, and static assets.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
