"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export type LoginState = {
  status: "idle" | "sent" | "invalid_email" | "rate_limited" | "error";
  /** Echoed back so the code form knows which address the code belongs to. */
  email?: string;
};

export type CodeState = {
  status: "idle" | "invalid_code" | "error";
};

// Deliberately permissive: the authoritative check is that the message actually arrives.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Only ever redirect within this app — never to a URL an attacker put in the query string. */
function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
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

  return { status: "sent", email };
}

export async function signOut(): Promise<void> {
  const db = await createServerSupabase();
  await db.auth.signOut();
  redirect("/login");
}

/**
 * Sign in with the six-digit code from the email instead of the link.
 *
 * This path exists because a magic link is single-use and mail providers routinely fetch every
 * link in an incoming message to scan it — consuming the token before the person clicks, so a
 * perfectly valid link reports itself as already used. A typed code cannot be consumed by a
 * scanner, which makes this the reliable route rather than the fallback.
 *
 * `verifyOtp` establishes the session in cookies here, in a Server Action, which is one of the
 * few places Next allows a cookie to be written.
 */
export async function signInWithCode(
  _prev: CodeState,
  formData: FormData,
): Promise<CodeState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  const next = safeNext(String(formData.get("next") ?? "") || null);

  // Supabase decides the length (`mailer_otp_length`), this file used to hard-code 6, and the
  // project was configured for 8 — so the code box rejected every code it was ever sent, for
  // everyone, before the request left the browser. Accept the range Supabase can emit rather than
  // one end of it, so a setting change cannot silently close the door again.
  if (!EMAIL.test(email) || code.length < 6 || code.length > 8) {
    return { status: "invalid_code" };
  }

  const db = await createServerSupabase();
  const { error } = await db.auth.verifyOtp({ email, token: code, type: "email" });

  // Wrong code and expired code are reported identically on purpose: distinguishing them would
  // tell someone guessing whether they are close.
  if (error) return { status: "invalid_code" };

  // `next` came through `safeNext()`, which rejects anything that is not a same-origin path,
  // so this cast past typed routes asserts a check already made.
  redirect(next as Route);
}
