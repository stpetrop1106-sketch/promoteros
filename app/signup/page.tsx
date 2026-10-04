import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { translatorFor, DEFAULT_LOCALE, type TranslationKey } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/**
 * "Create your PromoterOS account" — the page that was missing.
 *
 * The product has had a working account path all along (sign-in link → `/onboarding` →
 * `create_agency_for_user`) and nothing anywhere said so. The only call to action on the site was
 * the **waitlist**, which is marketing, which is going to be switched off, and which an agency
 * owner could easily mistake for signing up. This page exists to make the difference impossible to
 * miss, and it says so in as many words.
 *
 * It deliberately does not reimplement sign-in. There is exactly one way into this product — the
 * single-use link and the six-digit code on `/login` — and a second form that posts somewhere else
 * would be a second way to get it wrong. What this page adds is the explanation: what happens,
 * in what order, and why no password is ever asked for (D26).
 *
 * Someone already signed in is sent to their dashboard rather than shown a page about creating an
 * account they already have.
 */

const STEPS: TranslationKey[] = ["signup.how_1", "signup.how_2", "signup.how_3"];

export default async function SignupPage() {
  const t = translatorFor(DEFAULT_LOCALE);

  const user = await currentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-[color:var(--color-canvas)]">
      <header className="border-b border-[color:var(--color-line)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/promoteros-mark.svg" alt={t("landing.logo_alt")} width={28} height={28} />
            <span className="text-[1.05rem] font-semibold tracking-tight text-[color:var(--color-ink)]">
              {t("app.name")}
            </span>
          </Link>
          <Link
            href="/pricing"
            className="text-[0.88rem] text-[color:var(--color-muted)] transition hover:text-[color:var(--color-ink)]"
          >
            {t("signup.pricing_link")}
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
        <h1 className="max-w-[18ch] text-[1.9rem] font-semibold leading-[1.15] tracking-[-0.02em] text-[color:var(--color-ink)] sm:text-[2.4rem]">
          {t("signup.title")}
        </h1>
        <p className="mt-5 max-w-xl text-[1.02rem] leading-[1.75] text-[color:var(--color-muted)]">
          {t("signup.subtitle")}
        </p>

        {/* The one sentence this page exists for. */}
        <p className="mt-5 max-w-xl border-l-2 border-[color:var(--color-action)] pl-4 text-[0.95rem] leading-7 text-[color:var(--color-ink)]">
          {t("signup.not_waitlist")}
        </p>

        <Link
          href="/login"
          className="mt-9 inline-block rounded-[var(--radius-md)] bg-[color:var(--color-accent)] px-6 py-3.5 text-[0.98rem] font-medium text-white transition hover:bg-[color:var(--color-accent-hover)]"
        >
          {t("signup.cta")}
        </Link>

        <section className="mt-14 border-t border-[color:var(--color-line)] pt-10">
          <h2 className="text-[1.15rem] font-semibold text-[color:var(--color-ink)]">
            {t("signup.how_title")}
          </h2>
          <ol className="mt-6 flex flex-col gap-5">
            {STEPS.map((key, index) => (
              <li key={key} className="flex gap-4">
                <span className="mt-0.5 font-mono text-[0.78rem] tabular-nums text-[color:var(--color-action-ink)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-[0.98rem] leading-7 text-[color:var(--color-ink-soft)]">
                  {t(key)}
                </span>
              </li>
            ))}
          </ol>

          <p className="mt-8 max-w-xl rounded-[var(--radius-lg)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-5 py-4 text-[0.9rem] leading-7 text-[color:var(--color-muted)]">
            {t("signup.no_password_note")}
          </p>

          <p className="mt-6 text-[0.9rem] leading-7 text-[color:var(--color-muted)]">
            {t("signup.already_have_account")}
          </p>
        </section>
      </div>
    </main>
  );
}
