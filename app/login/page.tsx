import type { Metadata } from "next";
import Link from "next/link";
import { translatorFor, DEFAULT_LOCALE, type TranslationKey } from "@/lib/i18n";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signOut } from "./actions";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Login" };

function safeNext(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

const ROLE_LABEL: Record<string, TranslationKey> = {
  owner: "team.role.owner",
  coordinator: "team.role.coordinator",
  supervisor: "team.role.supervisor",
  admin: "team.role.admin",
};

type LiveInvitation = { agencyName: string; role: string };

/**
 * A2 finding 10 — is there a live staff invitation waiting for this address?
 *
 * A person invited to an agency who signs in through the ordinary magic link, rather than through
 * the invitation link, used to land on a page whose primary action creates a **second tenant**.
 * That is the easiest way for a customer's own staff to end up in an empty parallel agency,
 * wonder where the data went, and telephone the owner — and a second agency row is also what
 * breaks every promoter's privacy notice (finding 2).
 *
 * The service-role client is necessary and is safe here for one specific reason: this user has no
 * `app_users` row, so `current_agency_id()` is null and every RLS policy on
 * `agency_invitations` denies them — including the row addressed to them personally. The lookup
 * is keyed on the email Supabase Auth itself verified for the signed-in session, never on anything
 * from the request, and only the inviting agency's name and the offered role are read. Nothing
 * about any other tenant is reachable through it.
 *
 * What it deliberately does NOT do is offer to accept. Only the SHA-256 hash of the invitation
 * token is stored (0011_accounts.sql, the same discipline as promoter tokens), so the link cannot
 * be reconstructed from the row — by us or by anyone who reads the database. The honest answer is
 * to say an invitation exists, name who sent it, and point at the email that carries the link.
 */
async function liveInvitationFor(email: string | undefined): Promise<LiveInvitation | null> {
  if (!email) return null;

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("agency_invitations")
      .select("role, expires_at, agencies(name)")
      .ilike("email", email)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return null;
    const agency = data.agencies as unknown as { name: string } | null;
    return { agencyName: agency?.name ?? "", role: String(data.role) };
  } catch {
    // A missing service-role key must never take down the sign-in page.
    return null;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const t = translatorFor(DEFAULT_LOCALE);
  const params = await searchParams;
  const next = safeNext(params.next);

  const db = await createServerSupabase();
  const {
    data: { user },
  } = await db.auth.getUser();

  // Authenticated, but no `app_users` row: nobody has authorised this address for an agency, so
  // every RLS policy denies everything. Say that plainly instead of showing an empty dashboard.
  if (user && params.reason === "no_agency") {
    const invitation = await liveInvitationFor(user.email);

    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <div className="rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-6 shadow-[var(--elevation-card)] sm:p-8">
          {/* A2 finding 10 — when an invitation is waiting for this exact address, it is the
              answer to "why can I not see anything", and creating a second agency is the wrong
              thing to make the biggest button on the page. */}
          {invitation ? (
            <>
              <h1 className="text-xl font-semibold tracking-tight text-[color:var(--color-ink)]">
                {t("auth.invitation_waiting_title")}
              </h1>
              <p className="mt-3 text-sm leading-6 text-[color:var(--color-muted)]">
                {t("auth.invitation_waiting_body", {
                  agency: invitation.agencyName,
                  role: t(ROLE_LABEL[invitation.role] ?? "team.role.coordinator"),
                })}
              </p>
              <p className="mt-3 rounded-xl border border-[color:var(--color-accent-line)] bg-[color:var(--color-accent-subtle)]/50 px-4 py-3 text-sm leading-6 text-[color:var(--color-accent-ink)]">
                {t("auth.invitation_waiting_how", { email: user.email ?? "" })}
              </p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold tracking-tight text-[color:var(--color-ink)]">{t("auth.no_agency_title")}</h1>
              <p className="mt-3 text-sm text-[color:var(--color-muted)]">
                {t("auth.no_agency_body")}
              </p>

              {/* Signing in without an agency used to be a dead end. Since 0011 a user can
                  provision their own tenant, so offer that rather than leaving them stuck. */}
              <Link
                href="/onboarding"
                className="mt-6 inline-flex items-center justify-center rounded-lg bg-[color:var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[color:var(--color-accent-hover)]"
              >
                {t("auth.create_agency_cta")}
              </Link>
            </>
          )}

          <p className="mt-6 text-sm text-[color:var(--color-muted)]">
            {t("auth.signed_in_as", { email: user.email ?? "" })}
          </p>
          <form action={signOut} className="mt-2">
            <button
              type="submit"
              className="rounded-lg border border-[color:var(--color-line)] px-3 py-1 text-sm text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface-hover)]"
            >
              {t("auth.sign_out")}
            </button>
          </form>

          {/* Demoted to a text link when an invitation is waiting: still reachable for the person
              who really did mean to start their own agency, no longer the obvious thing to press. */}
          {invitation ? (
            <p className="mt-6 border-t border-[color:var(--color-line)] pt-4 text-xs leading-5 text-[color:var(--color-muted)]">
              {t("auth.invitation_waiting_other")}{" "}
              <Link href="/onboarding" className="font-semibold underline hover:no-underline">
                {t("auth.create_agency_cta")}
              </Link>
            </p>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-6 shadow-[var(--elevation-card)] sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight text-[color:var(--color-ink)]">{t("auth.login_title")}</h1>
        <p className="mt-3 text-sm text-[color:var(--color-muted)]">{t("auth.login_intro")}</p>

        {params.reason === "link_failed" && (
          <p className="mt-4 text-sm text-[color:var(--color-bad)]">{t("auth.link_failed")}</p>
        )}

        <LoginForm
          next={next}
          labels={{
            email: t("auth.email_label"),
            placeholder: t("auth.email_placeholder"),
            submit: t("auth.send_link"),
            sending: t("auth.sending"),
            sent: t("auth.link_sent"),
            invalidEmail: t("auth.error_invalid_email"),
            rateLimited: t("auth.error_rate_limited"),
            error: t("auth.error_generic"),
            codeLabel: t("auth.code_label"),
            codeHint: t("auth.code_hint"),
            codeSubmit: t("auth.code_submit"),
            codeChecking: t("auth.code_checking"),
            codeInvalid: t("auth.code_invalid"),
          }}
        />
      </div>
    </main>
  );
}
