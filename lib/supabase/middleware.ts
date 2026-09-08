import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Paths a signed-out visitor may not reach. Everything else — the marketing pages and the
 * promoter-facing token URLs `/i/[token]` and `/c/[token]` — stays anonymous by design.
 */
export const PROTECTED_PREFIXES = ["/shifts", "/promoters", "/campaigns", "/settings"] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Refresh the Supabase session on every matched request and gate the coordinator area.
 *
 * Two jobs, and they must happen in this order:
 *  1. `getUser()` validates the access token against the auth server and rotates the refresh
 *     token when needed. Server Components cannot write cookies, so this is the only place the
 *     rotated session is actually persisted.
 *  2. Redirect an unauthenticated visitor away from the coordinator area.
 *
 * The redirect is convenience, not the security boundary. The boundary is RLS in Postgres plus
 * `requireUser()` on the page itself — middleware alone must never be what keeps one agency out
 * of another's data.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return request.cookies.getAll();
    },
    setAll(cookiesToSet) {
      for (const { name, value } of cookiesToSet) {
        request.cookies.set(name, value);
      }
      response = NextResponse.next({ request });
      for (const { name, value, options } of cookiesToSet) {
        response.cookies.set(name, value, options);
      }
    },
  };

  const supabase = createServerClient(url, key, { cookies: cookieMethods });

  // getUser(), never getSession(): only getUser() verifies the JWT with the auth server.
  // A cookie can be forged; a verified user cannot.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && isProtectedPath(pathname)) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    // Relative path only — never a full URL, so this cannot be turned into an open redirect.
    login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  // A signed-in visitor on /login goes to their work — unless they arrived carrying a `reason`,
  // which is how `requireUser()` reports "authenticated but not attached to an agency". Without
  // that exemption the two redirects would bounce off each other forever.
  if (user && pathname === "/login" && !request.nextUrl.searchParams.has("reason")) {
    const shifts = request.nextUrl.clone();
    shifts.pathname = "/shifts";
    shifts.search = "";
    return NextResponse.redirect(shifts);
  }

  return response;
}
