"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";

const t = translatorFor(DEFAULT_LOCALE);

/**
 * Finishes an implicit-flow sign-in.
 *
 * Supabase's free tier does not allow editing the magic-link email template, so every link routes
 * through `{{ .ConfirmationURL }}` → `/auth/v1/verify`, which answers 303 to:
 *
 *   /login/callback?next=…#access_token=…&refresh_token=…
 *
 * **A server never receives a URL fragment.** `app/login/callback/route.ts` therefore saw an empty
 * query and reported a perfectly valid link as expired. The browser does carry the fragment across
 * that redirect, so the only place this session can be read is here, on the client.
 *
 * `setSession` writes through the same cookie storage the server client reads, so once this
 * resolves the session is visible to every server component — no second round trip.
 */
export function CompleteSignIn({ next }: { next: string }) {

  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const params = new URLSearchParams(hash);

    // Supabase reports its own failures in the fragment too.
    if (params.get("error") || params.get("error_description")) {
      setFailed(true);
      return;
    }

    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (!accessToken || !refreshToken) {
      setFailed(true);
      return;
    }

    let cancelled = false;
    createBrowserSupabase()
      .auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (cancelled) return;
        if (error) {
          setFailed(true);
          return;
        }
        // A hard navigation, deliberately, for two reasons. `setSession` has just written the
        // auth cookie from the browser; a soft `router.replace` can render the destination from
        // a server request that raced the cookie and lands back on /login. And replacing the
        // location discards the fragment, so the tokens never stay in history — which rewriting
        // history under Next's router did achieve, but at the cost of the router then refusing
        // to navigate at all.
        window.location.replace(new URL(next, window.location.origin).toString());
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [next]);

  if (failed) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <h1 className="text-xl font-semibold tracking-tight">{t("auth.login_title")}</h1>
        <p className="mt-3 text-sm text-[color:var(--color-muted)]">{t("auth.link_failed")}</p>
        <Link
          href="/login"
          className="mt-6 inline-flex w-fit items-center justify-center rounded-lg bg-[color:var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[color:var(--color-accent-hover)]"
        >
          {t("auth.send_link")}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <p className="text-sm text-[color:var(--color-muted)]">{t("auth.completing")}</p>
    </main>
  );
}
