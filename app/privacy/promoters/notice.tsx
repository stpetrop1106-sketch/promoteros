import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_LOCALE, translatorFor } from "@/lib/i18n";

/**
 * The promoter-facing privacy notice itself, so that the same words can be served from the
 * unparameterised `/privacy/promoters` and from the token-scoped routes under `/i`, `/c` and `/a`.
 *
 * Two things about it are load-bearing and should not be "simplified" later:
 *
 * 1. **The controller is the AGENCY, not us.** That is the legal shape of the whole product —
 *    the agency decides what it holds about its promoters, we run the software on its
 *    instructions as processor. A notice that named PromoterOS as controller would be both
 *    wrong and commercially fatal, because it would mean we had taken on the agency's
 *    obligations towards its own roster.
 *
 * 2. **It refuses to render without a real controller identity**, exactly like
 *    `app/privacy/page.tsx`. A privacy notice with "[Your Company Ltd]" in it is worse than no
 *    notice: it looks like compliance and is not. So the agency's registered legal name and a
 *    working contact address must be in the database (added by migration 0014) before a
 *    promoter can be shown this page at all.
 *
 * `agencyId` is how the caller says WHICH controller. A token-scoped route resolves it from the
 * promoter's own signed link (`lib/promoter-controller.ts`); `/privacy/promoters` passes null and
 * gets the old single-agency behaviour, which is correct for a visitor who arrived with no link
 * at all and only works while exactly one agency exists.
 *
 * There is deliberately NO consent checkbox anywhere in here. See docs/decisions.md D5.
 */
export async function PromoterPrivacyNotice({ agencyId }: { agencyId: string | null }) {
  const t = translatorFor(DEFAULT_LOCALE);

  const processor = process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME;
  const processorEmail = process.env.NEXT_PUBLIC_PRIVACY_EMAIL;

  if (!processor || !processorEmail) {
    throw new Error(
      "Set NEXT_PUBLIC_LEGAL_ENTITY_NAME and NEXT_PUBLIC_PRIVACY_EMAIL before showing the promoter privacy notice.",
    );
  }

  const db = createAdminClient();
  const query = db.from("agencies").select("id, name, legal_name, privacy_contact_email");
  const { data, error } = agencyId
    ? await query.eq("id", agencyId).limit(1)
    : await query.limit(2);

  if (error) {
    throw new Error(`Promoter privacy notice could not read the controller: ${error.message}`);
  }

  const agencies = data ?? [];

  if (agencies.length !== 1) {
    // Unparameterised and ambiguous. A per-agency notice is reached through the promoter's own
    // link; this route has nothing to resolve a controller from, so it says so rather than
    // naming somebody else's company to somebody else's promoter.
    throw new Error(
      agencies.length === 0
        ? agencyId
          ? `Agency ${agencyId} was not found, so the promoter privacy notice has no controller to name.`
          : "No agency exists, so there is no data controller to name in the promoter privacy notice."
        : "More than one agency exists and no token identified which one. Reach this notice from the promoter's own link (/i, /c or /a), which resolves its own controller.",
    );
  }

  const agency = agencies[0]!;
  const agencyName = agency.name ? String(agency.name) : "";
  const agencyLegalName = agency.legal_name ? String(agency.legal_name) : "";
  const agencyEmail = agency.privacy_contact_email ? String(agency.privacy_contact_email) : "";

  if (!agencyName || !agencyLegalName || !agencyEmail) {
    throw new Error(
      `Agency ${agency.id} has no legal_name and/or privacy_contact_email. The promoter privacy notice will not render with a placeholder controller — set both columns (migration 0014) first.`,
    );
  }

  const vars = { agency: agencyName, agencyLegal: agencyLegalName, agencyEmail, processor };

  const sections = [
    ["promoter_privacy.controller_title", t("promoter_privacy.controller_body", vars)],
    ["promoter_privacy.data_title", t("promoter_privacy.data_body")],
    ["promoter_privacy.not_held_title", t("promoter_privacy.not_held_body")],
    ["promoter_privacy.purpose_title", t("promoter_privacy.purpose_body", vars)],
    ["promoter_privacy.basis_title", t("promoter_privacy.basis_body")],
    ["promoter_privacy.retention_title", t("promoter_privacy.retention_body", vars)],
    ["promoter_privacy.rights_title", t("promoter_privacy.rights_body", vars)],
  ] as const;

  return (
    <main className="min-h-screen bg-[color:var(--color-canvas)] px-5 py-10 sm:px-8 sm:py-16">
      <article className="mx-auto max-w-2xl rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-6 shadow-[var(--elevation-card)] sm:p-10">
        <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--color-ink)] sm:text-3xl">
          {t("promoter_privacy.title")}
        </h1>
        <p className="mt-3 leading-7 text-[color:var(--color-muted)]">
          {t("promoter_privacy.intro", vars)}
        </p>
        <div className="mt-10 space-y-8">
          {sections.map(([title, body]) => (
            <section key={title}>
              <h2 className="text-lg font-semibold text-[color:var(--color-ink)]">{t(title)}</h2>
              <p className="mt-2 whitespace-pre-line leading-7 text-[color:var(--color-muted)]">
                {body}
              </p>
            </section>
          ))}
        </div>
        <p className="mt-10 border-t border-[color:var(--color-line)] pt-6 text-sm text-[color:var(--color-muted)]">
          {t("promoter_privacy.processor_note", { processor, processorEmail })}
        </p>
      </article>
    </main>
  );
}
