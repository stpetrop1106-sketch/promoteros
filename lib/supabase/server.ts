import "server-only";
import { cookies } from "next/headers";
import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";

/**
 * The default Supabase client for every authenticated server path.
 *
 * It runs on the ANON key with the caller's session cookies attached, which means Postgres
 * sees the request as `authenticated` with a real `auth.uid()`, and every policy written in
 * `0002_rls.sql` applies. A query for another agency's rows returns zero rows rather than
 * relying on the application remembering to add `where agency_id = …`.
 *
 * CLAUDE.md §4 and decision D13: tenant isolation is enforced in the database. This client is
 * how the application submits to that enforcement. `lib/supabase/admin.ts` bypasses it and is
 * legitimate only after a signed promoter token has been verified.
 */
export async function createServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase server client requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  const cookieStore = await cookies();

  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet) {
      try {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      } catch {
        // Server Components cannot write cookies. Harmless: `middleware.ts` refreshes the
        // session on every protected request, so the rotated token is persisted there.
      }
    },
  };

  return createServerClient(url, key, { cookies: cookieMethods });
}
