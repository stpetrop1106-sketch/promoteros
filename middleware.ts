import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { createRateLimiter } from "@/lib/rate-limit";

/**
 * P22 — the suspension explanation, and its sign-out escape hatch.
 *
 * `lib/auth.ts`'s `requireUser()` is the real boundary: a suspended agency's `authState()`
 * returns `{ ok: false, reason: "suspended" }`, so every page and server action that starts with
 * `await requireUser()` redirects before it queries or writes anything. That redirect lands on
 * `/login?reason=suspended`.
 *
 * `app/login/page.tsx` is not in this parcel's file set (see CLAUDE.md's ownership list), and it
 * only special-cases `reason=no_agency` — an unhandled `reason=suspended` would fall through to
 * the plain sign-in form, which is exactly the "not a broken page, not a silent empty dashboard"
 * failure the brief warns against: an already-signed-in person being asked to sign in again,
 * with no explanation of why they can't see their data. So this file intercepts that one URL
 * itself, before `updateSession()` or the page ever runs, and renders a small standalone HTML
 * response — no dependency on `app/layout.tsx` (also not ours) or any component tree. It is
 * static text from `lib/i18n` plus one form, so it stays honest even if the rest of the app
 * changes shape around it.
 *
 * The one thing a person in that state still needs is a way out (commercial-architecture.md §6:
 * "no dead ends"). They cannot use `app/login/actions.ts`'s `signOut` — that is a React Server
 * Action, which needs the real page's encoded action reference and is not something a hand-built
 * HTML form can invoke. So `POST /login?action=signout` is handled here too, with its own
 * `@supabase/ssr` client scoped to this request/response pair — the same pattern
 * `lib/supabase/middleware.ts` uses, written locally because that file is not ours to touch.
 */

const SUSPENDED_PATH = "/login";

function signOutForm(t: ReturnType<typeof translatorFor>): string {
  return (
    `<form method="post" action="/login?action=signout">` +
    `<button type="submit">${t("enforcement.suspended.signout")}</button>` +
    `</form>`
  );
}

function suspendedResponse(): NextResponse {
  const t = translatorFor(DEFAULT_LOCALE);
  const html = `<!doctype html>
<html lang="${DEFAULT_LOCALE}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${t("enforcement.suspended.title")}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 24px; background: #f7f7f5; color: #1a1a1a;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  main { max-width: 440px; }
  h1 { font-size: 1.15rem; font-weight: 600; margin: 0 0 12px; }
  p { font-size: 0.95rem; line-height: 1.6; color: #55554f; margin: 0 0 20px; }
  button {
    appearance: none; border: 1px solid #d8d6cf; background: #fff; color: #1a1a1a;
    border-radius: 8px; padding: 10px 16px; font-size: 0.9rem; font-weight: 600; cursor: pointer;
  }
  button:hover { background: #f0efe9; }
</style>
</head>
<body>
<main>
  <h1>${t("enforcement.suspended.title")}</h1>
  <p>${t("enforcement.suspended.body")}</p>
  ${signOutForm(t)}
</main>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

/**
 * Clears the Supabase session and sends the browser back to a plain `/login` (no `reason`, so
 * `updateSession()` on the next request treats it as an ordinary signed-out visit).
 *
 * Mirrors `lib/supabase/middleware.ts`'s cookie plumbing exactly (read from the request, write
 * onto the redirect response) because that is the only correct way to mutate auth cookies from
 * middleware — written locally since that file is outside this parcel's globs.
 */
async function handleSignOut(request: NextRequest): Promise<NextResponse> {
  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.search = "";
  const response = NextResponse.redirect(login, { status: 303 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return request.cookies.getAll();
    },
    setAll(cookiesToSet) {
      for (const { name, value, options } of cookiesToSet) {
        response.cookies.set(name, value, options);
      }
    },
  };

  const supabase = createServerClient(url, key, { cookies: cookieMethods });
  await supabase.auth.signOut();
  return response;
}


/**
 * The promoter-facing token routes, which until now had no limit of any kind.
 *
 * The A3 audit fired 40 requests at `/i/<garbage>` and 25 at a valid `/a/<token>` and was
 * answered every time, each answer costing two database reads through the service-role client.
 * The signature is not brute-forceable, so what is at stake is availability and our Supabase
 * bill — made worse by the availability link living for eight weeks with no way to revoke it.
 *
 * Keyed on the caller's address and the route family, never on the token: keying on the
 * credential would let anyone lock a promoter out of their own shift by replaying their link.
 *
 * 60 a minute is deliberately generous. Greek mobile carriers put many subscribers behind one
 * address, so several promoters opening their links from the same network must not collide; a
 * real promoter loads a handful of pages, a script loads thousands. See lib/rate-limit.ts for
 * what this does NOT guarantee — the counter is per instance, not global.
 */
const PROMOTER_PREFIXES = ["/i/", "/c/", "/a/"];
const promoterLimiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

function callerKey(request: NextRequest): string {
  // Vercel sets x-forwarded-for; the left-most entry is the client. Locally there is none, and
  // every caller shares one bucket, which is the conservative direction.
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const family = request.nextUrl.pathname.slice(0, 3);
  return `${ip}${family}`;
}

function tooManyRequests(retryAfterSeconds: number): NextResponse {
  const t = translatorFor(DEFAULT_LOCALE);
  const html = `<!doctype html>
<html lang="${DEFAULT_LOCALE}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${t("rate_limit.title")}</title>
<style>
  :root { color-scheme: light; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 24px; background: #f4f0e8; color: #1f1b17;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  main { max-width: 420px; }
  h1 { font-size: 1.15rem; font-weight: 600; margin: 0 0 12px; }
  p { font-size: 0.95rem; line-height: 1.6; color: #7d7466; margin: 0; }
</style>
</head>
<body>
<main>
  <h1>${t("rate_limit.title")}</h1>
  <p>${t("rate_limit.body")}</p>
</main>
</body>
</html>`;

  return new NextResponse(html, {
    status: 429,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "retry-after": String(retryAfterSeconds),
      "cache-control": "no-store",
    },
  });
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (PROMOTER_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    const decision = promoterLimiter.check(callerKey(request));
    if (!decision.allowed) return tooManyRequests(decision.retryAfterSeconds);

    // Deliberately NOT updateSession(): these routes are anonymous by design, and refreshing a
    // session against the auth server on every promoter tap is the round trip the matcher was
    // kept narrow to avoid.
    return NextResponse.next();
  }

  if (pathname === SUSPENDED_PATH) {
    if (request.method === "POST" && searchParams.get("action") === "signout") {
      return handleSignOut(request);
    }
    if (searchParams.get("reason") === "suspended") {
      return suspendedResponse();
    }
  }

  return updateSession(request);
}

/**
 * Matched deliberately narrowly.
 *
 * The coordinator area needs session refresh and a signed-out redirect. The marketing pages
 * (`/`, `/privacy`) and the promoter-facing token URLs (`/i/[token]`, `/c/[token]`) are
 * anonymous by design — running auth middleware over them would add a round trip to the auth
 * server on every promoter tap and risk breaking a path P1 must not touch.
 *
 * Billing enforcement (P22, commercial-architecture.md §3) is deliberately **not** added here as
 * a blanket check: every path below is reached by both page navigation (GET, always a read, and
 * `checkBilling()` never blocks a read) and server-action submissions (POST to that same path —
 * including read-only actions like `geocodeAddress` in `app/promoters/actions.ts`). Blocking
 * every POST when an agency is read-only would also block those reads, which is the exact
 * lockout this parcel exists to prevent. The write guard instead lives where the read/write
 * distinction is actually known: inside each server action, via `checkBilling()` — wired here
 * for `app/promoters/actions.ts` (this parcel's one writable action file); see
 * `docs/status/P22.md` for the request to the lanes that own the others.
 */
export const config = {
  matcher: [
    // The coordinator's home (P28). Safe without this — `requireUser()` redirects and RLS scopes
    // every row — but it is where a coordinator lands and lingers, so it needs the session-cookie
    // refresh every other authenticated route gets. Without it, the one screen someone leaves
    // open all morning is the one whose session quietly expires.
    "/dashboard/:path*",
    "/shifts/:path*",
    "/promoters/:path*",
    "/campaigns/:path*",
    "/settings/:path*",
    "/login",
    // Added for rate limiting only. The handler above answers these and returns before any auth
    // work happens, so the round trip the note above warns about is still not paid.
    "/i/:path*",
    "/c/:path*",
    "/a/:path*",
  ],
};
