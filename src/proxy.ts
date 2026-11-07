import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { APP_HOME } from "@/lib/site";

/**
 * Optimistic checks only (real authorization happens on the server for every read and write):
 * - `/` is the public landing page; anyone with a session cookie goes straight to the app.
 * - App pages bounce visitors without a session cookie to sign-in.
 * (A stale cookie on `/` lands on /overview, whose server check sends it to sign-in, so no loop.)
 */
export function proxy(request: NextRequest) {
  const signedIn = Boolean(getSessionCookie(request));
  if (request.nextUrl.pathname === "/") {
    return signedIn
      ? NextResponse.redirect(new URL(APP_HOME, request.url))
      : NextResponse.next();
  }
  if (!signedIn) return NextResponse.redirect(new URL("/sign-in", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/overview", "/transactions", "/reminders"],
};
