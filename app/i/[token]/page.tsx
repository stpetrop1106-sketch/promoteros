import Link from "next/link";
import { loadInvitation } from "@/lib/invitations";
import { loadBriefForInvitation } from "@/lib/briefs";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { Markdown } from "@/components/ui";
import { RespondForm } from "./respond-form";
import { AcknowledgeBriefForm } from "./acknowledge-brief-form";

export const dynamic = "force-dynamic";

/**
 * The promoter-facing invitation page.
 *
 * No login: the signed link is the credential. Designed for a phone, opened from whichever
 * messenger the promoter already uses.
 */
export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const t = translatorFor(DEFAULT_LOCALE);
  const result = await loadInvitation(token);

  if (!result.ok) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-[color:var(--color-muted)]">{t("invitation.expired")}</p>
      </main>
    );
  }

  const v = result.view;
  const answered = v.status !== "pending";

  // Independent of `result` above on purpose — see lib/briefs.ts's file comment. `briefResult`
  // failing (a token race) just means the section below renders nothing; it never blocks the
  // shift details or the accept/decline flow that already succeeded.
  const briefResult = await loadBriefForInvitation(token);
  const brief = briefResult.ok ? briefResult.view : null;

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <h1 className="text-lg font-semibold">{t("invitation.title")}</h1>

      <dl className="mt-6 space-y-3 rounded-lg border border-[color:var(--color-line)] bg-white p-5 text-sm">
        <div>
          <dt className="text-[color:var(--color-muted)]">{t("shifts.campaign")}</dt>
          <dd className="font-medium">{v.campaignName}</dd>
        </div>
        <div>
          <dt className="text-[color:var(--color-muted)]">{t("shifts.store")}</dt>
          <dd className="font-medium">{v.storeName}</dd>
        </div>
        <div>
          <dt className="text-[color:var(--color-muted)]">{t("shifts.date")}</dt>
          <dd className="font-medium">
            {v.onDate} · {v.startTime}–{v.endTime}
          </dd>
        </div>
        {v.dressCode && (
          <div>
            <dt className="text-[color:var(--color-muted)]">Dress code</dt>
            <dd className="font-medium">{v.dressCode}</dd>
          </div>
        )}
        {v.rateCents > 0 && (
          <div>
            <dt className="text-[color:var(--color-muted)]">€</dt>
            <dd className="font-medium">{(v.rateCents / 100).toFixed(2)}</dd>
          </div>
        )}
      </dl>

      {brief && (
        <div className="mt-6 rounded-lg border border-[color:var(--color-line)] bg-white p-5">
          <h2 className="text-sm font-semibold">{brief.title || t("invitation.brief.title")}</h2>
          <Markdown source={brief.bodyMd} className="text-[color:var(--color-ink)]" />
          <AcknowledgeBriefForm
            token={token}
            initialAcknowledgedAt={brief.acknowledgedAt}
            confirmLabel={t("invitation.brief.confirm")}
            acknowledgedTemplate={t("invitation.brief.acknowledged_on")}
            errorLabel={t("invitation.brief.error")}
          />
        </div>
      )}

      {answered ? (
        <p className="mt-6 text-sm text-[color:var(--color-muted)]">
          {v.status === "accepted" ? t("invitation.accepted") : t("invitation.declined")}
        </p>
      ) : (
        <>
          <p className="mt-6 text-center text-sm">{t("invitation.question")}</p>
          <RespondForm
            token={token}
            acceptLabel={t("invitation.accept")}
            declineLabel={t("invitation.decline")}
            acceptedLabel={t("invitation.accepted")}
            declinedLabel={t("invitation.declined")}
          />
        </>
      )}

      {/* P32 · Gate 1. The promoter must be able to reach the privacy notice from the first
          page they ever see from us, without logging in and without asking anyone. */}
      <p className="mt-10 text-center text-xs">
        <Link
          className="text-[color:var(--color-muted)] underline underline-offset-2"
          href="/privacy/promoters"
        >
          {t("promoter_privacy.link")}
        </Link>
      </p>
    </main>
  );
}
