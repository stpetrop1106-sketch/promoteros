"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client, anon key only, sharing the same cookie storage as the server
 * client so a session established on the server is visible to the browser and vice versa.
 *
 * RLS applies exactly as it does on the server — there is no privileged path here, and the
 * service-role key must never reach this file or anything it imports.
 */
export function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase browser client requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  return createBrowserClient(url, key);
}
