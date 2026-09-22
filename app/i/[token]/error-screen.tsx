import { translatorFor, type Locale, type TranslationKey } from "@/lib/i18n";

/**
 * A3-05, the `/i` half. `loadInvitation` can fail as `malformed`, `bad_signature`, `expired`,
 * `wrong_purpose` or `not_found`, and all five used to render the same sentence — "Η πρόσκληση
 * έχει λήξει." — which for four of them is simply untrue. See `app/c/[token]/error-screen.tsx`
 * for the full reasoning; this is the same screen against the invitation's own keys.
 */
const KEY_BY_REASON: Record<string, TranslationKey> = {
  expired: "invitation.error.expired",
  not_found: "invitation.error.not_found",
  wrong_purpose: "invitation.error.wrong_purpose",
  malformed: "invitation.error.bad_token",
  bad_signature: "invitation.error.bad_token",
};

export function InvitationErrorScreen({ reason, locale }: { reason: string; locale: Locale }) {
  const t = translatorFor(locale);
  const key = KEY_BY_REASON[reason] ?? "invitation.error.bad_token";

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
