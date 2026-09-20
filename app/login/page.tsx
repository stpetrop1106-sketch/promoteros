import type { Metadata } from "next";
import Link from "next/link";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { createServerSupabase } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Login" };

function safeNext(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
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
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <div className="rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-6 shadow-[var(--elevation-card)] sm:p-8">
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
