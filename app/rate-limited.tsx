import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";

/**
 * What a promoter sees if they ever trip the rate limit on `/i`, `/c` or `/a`.
 *
 * Written for a person, not for the script the limit actually exists to stop: it does not blame
 * them, and it says plainly that their link still works. Sixty requests a minute is far past
 * anything a human does, so in practice this page is read by almost nobody — which is exactly why
 * it has to be right the one time it is.
 */
export function RateLimited() {
  const t = translatorFor(DEFAULT_LOCALE);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[color:var(--color-canvas)] px-5 py-16">
      <div className="w-full max-w-md rounded-[var(--radius-2xl)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-7 text-center shadow-[var(--elevation-card)] sm:p-9">
        <h1 className="text-xl font-semibold tracking-tight text-[color:var(--color-ink)]">
          {t("rate_limit.title")}
        </h1>
        <p className="mt-4 text-[0.95rem] leading-7 text-[color:var(--color-muted)]">
          {t("rate_limit.body")}
        </p>
      </div>
    </main>
  );
}
