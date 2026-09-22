import { translatorFor, type Locale } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n";

/**
 * A3-05 — every failure on `/c` used to render one bare grey sentence: "Ο σύνδεσμος έχει λήξει ή
 * δεν είναι έγκυρος." That sentence was shown for a malformed token, a tampered signature, an
 * unknown assignment, a token minted for a different purpose — and for a shift the agency had
 * cancelled. The likeliest real cause is a URL truncated by a messenger, and telling that promoter
 * their link expired sends them to the wrong conclusion.
 *
 * `/a/[token]` already does this properly: a title, the specific reason, and a next step. This is
 * that shape, reused verbatim, so the three promoter surfaces finally agree.
 *
 * A server component: it resolves its own `t` from a `locale` prop rather than being handed one,
 * because a function cannot cross the server/client boundary and nothing here should depend on
 * which side of it a future caller sits.
 */
const KEY_BY_REASON: Record<string, TranslationKey> = {
  expired: "checkin.error.expired",
  cancelled: "checkin.error.cancelled",
  not_found: "checkin.error.not_found",
  wrong_purpose: "checkin.error.wrong_purpose",
  malformed: "checkin.error.bad_token",
  bad_signature: "checkin.error.bad_token",
};

export function CheckinErrorScreen({ reason, locale }: { reason: string; locale: Locale }) {
  const t = translatorFor(locale);
  const key = KEY_BY_REASON[reason] ?? "checkin.error.bad_token";

  return (
    <main className="mx-auto max-w-md px-6 py-16 text-center">
      <h1 className="text-lg font-semibold">{t("promoter_error.title")}</h1>
      <p className="mt-3 text-sm text-[color:var(--color-muted)]">{t(key)}</p>
      <p className="mt-2 text-sm text-[color:var(--color-muted)]">
        {t("promoter_error.ask_coordinator")}
      </p>
    </main>
  );
}
