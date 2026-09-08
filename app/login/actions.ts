"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export type LoginState = {
  status: "idle" | "sent" | "invalid_email" | "rate_limited" | "error";
};

// Deliberately permissive: the authoritative check is that the message actually arrives.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Only ever redirect within this app — never to a URL an attacker put in the query string. */
function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/shifts";
  return value;
}

/**
 * Send a magic link.
 *
 * The reply is the same whether or not the address is known. An error that distinguished them
 * would turn this form into a way to ask "does this agency use PromoterOS, and who works there" —
 * and a coordinator's work address is exactly what a competing agency would probe for.
 *
 * Having a Supabase session is not access. Access needs an `app_users` row, which only a pending
 * `app_user_invites` row can create (see `0006_auth.sql`). An uninvited sign-in reaches a screen
 * saying so and no data whatsoever.
 */
export async function requestMagicLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = safeNext(String(formData.get("next") ?? "") || null);

  if (!EMAIL.test(email)) return { status: "invalid_email" };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const db = await createServerSupabase();

  const { error } = await db.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${appUrl}/login/callback?next=${encodeURIComponent(next)}`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    if (error.status === 429) return { status: "rate_limited" };
    return { status: "error" };
  }

  return { status: "sent" };
}

export async function signOut(): Promise<void> {
  const db = await createServerSupabase();
  await db.auth.signOut();
  redirect("/login");
}
