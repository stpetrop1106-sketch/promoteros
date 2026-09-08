import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

/**
 * Matched deliberately narrowly.
 *
 * The coordinator area needs session refresh and a signed-out redirect. The marketing pages
 * (`/`, `/privacy`) and the promoter-facing token URLs (`/i/[token]`, `/c/[token]`) are
 * anonymous by design — running auth middleware over them would add a round trip to the auth
 * server on every promoter tap and risk breaking a path P1 must not touch.
 */
export const config = {
  matcher: [
    "/shifts/:path*",
    "/promoters/:path*",
    "/campaigns/:path*",
    "/settings/:path*",
    "/login",
  ],
};
