import Link from "next/link";
import { DEFAULT_LOCALE, translatorFor } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  const t = translatorFor(DEFAULT_LOCALE);
  const company = process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME;
  const email = process.env.NEXT_PUBLIC_PRIVACY_EMAIL;

  if (!company || !email) {
    throw new Error(
      "Set NEXT_PUBLIC_LEGAL_ENTITY_NAME and NEXT_PUBLIC_PRIVACY_EMAIL before publishing the privacy policy.",
    );
  }

  const sections = [
    ["privacy.controller_title", t("privacy.controller_body", { company, email })],
    ["privacy.data_title", t("privacy.data_body")],
    ["privacy.purpose_title", t("privacy.purpose_body")],
    ["privacy.basis_title", t("privacy.basis_body")],
    ["privacy.retention_title", t("privacy.retention_body")],
    ["privacy.rights_title", t("privacy.rights_body")],
  ] as const;

  return (
    <main className="min-h-screen bg-[color:var(--color-canvas)] px-5 py-10 sm:px-8 sm:py-16">
      <article className="mx-auto max-w-2xl rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-6 sm:p-10">
        <Link className="text-sm font-semibold text-[color:var(--color-accent)] hover:underline" href="/">
          {t("privacy.back")}
        </Link>
        <h1 className="mt-7 text-3xl font-semibold tracking-tight text-[color:var(--color-ink)]">{t("privacy.title")}</h1>
        <p className="mt-3 leading-7 text-[color:var(--color-muted)]">{t("privacy.intro")}</p>
        <div className="mt-10 space-y-8">
          {sections.map(([title, body]) => (
            <section key={title}>
              <h2 className="text-lg font-semibold text-[color:var(--color-ink)]">{t(title)}</h2>
              <p className="mt-2 leading-7 text-[color:var(--color-muted)]">{body}</p>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
