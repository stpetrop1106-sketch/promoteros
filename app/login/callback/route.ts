import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

/** Prefer the configured public origin so the redirect survives a proxy rewriting Host. */
function originFor(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  return new URL(request.url).origin;
}

/**
 * Where the magic link lands.
 *
 * Two shapes arrive here and both are supported, because which one Supabase sends depends on the
 * email template rather than on anything in this repo:
 *  - `?code=…`                  PKCE. The verifier cookie was written when the link was requested,
 *                               so the link only completes in the browser that asked for it.
 *  - `?token_hash=…&type=…`     The newer template, verified server-side with `verifyOtp`.
 *
 * Either way the session lands in cookies here — a Route Handler is one of the few places that
 * may write them — and nothing else in the app has to know how the user got in.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = originFor(request);
  const next = safeNext(url.searchParams.get("next"));

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  // Supabase reports its own failures (expired link, already used) on the query string.
  if (url.searchParams.get("error")) {
    return NextResponse.redirect(`${origin}/login?reason=link_failed`);
  }

  const db = await createServerSupabase();

  if (code) {
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(`${origin}/login?reason=link_failed`);
    return NextResponse.redirect(`${origin}${next}`);
  }

  if (tokenHash && type) {
    const { error } = await db.auth.verifyOtp({
      type: type as "magiclink" | "email" | "recovery" | "invite",
      token_hash: tokenHash,
    });
    if (error) return NextResponse.redirect(`${origin}/login?reason=link_failed`);
    return NextResponse.redirect(`${origin}${next}`);
  }

  // Neither shape present, which is the NORMAL case on this project rather than a failure.
  //
  // Supabase's free tier forbids editing the magic-link email template, so every link goes through
  // `{{ .ConfirmationURL }}` → `/auth/v1/verify`, which answers 303 to this route with the session
  // in the URL FRAGMENT: `?next=…#access_token=…&refresh_token=…`. A server is never sent a
  // fragment, so there is nothing here to read — and this route used to call that an expired link,
  // which is what a real user saw when signing in for the first time.
  //
  // Browsers do carry a fragment across a redirect that has none of its own, so handing off to a
  // client page is what makes the session reachable at all.
  const handoff = new URL(`${origin}/login/complete`);
  handoff.searchParams.set("next", next);
  return NextResponse.redirect(handoff);
}
