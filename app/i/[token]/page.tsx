import Link from "next/link";
import { loadInvitation } from "@/lib/invitations";
import { loadBriefForInvitation } from "@/lib/briefs";
import { createCheckinLinkForInvitation } from "@/lib/checkins";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { Markdown } from "@/components/ui";
import { RespondForm } from "./respond-form";
import { AcknowledgeBriefForm } from "./acknowledge-brief-form";
import { formatEuroCents, formatShiftWhen } from "@/lib/shift-format";

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

  // P38 — the gap the manager found: nothing in the product ever handed a promoter their
  // check-in link. Minted fresh on every view (stateless — see `createCheckinLinkForInvitation`'s
  // own comment), so this renders identically the moment the promoter accepts AND every time they
  // reopen this same link on the day of the shift, which is exactly when they come looking for it.
  const checkinResult = v.status === "accepted" ? await createCheckinLinkForInvitation(token) : null;

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <h1 className="text-lg font-semibold">{t("invitation.title")}</h1>

      <dl className="mt-6 space-y-3 rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-5 text-sm shadow-[var(--elevation-card)]">
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
            {formatShiftWhen(v.onDate, v.startTime, v.endTime)}
          </dd>
        </div>
        {v.dressCode && (
          <div>
            <dt className="text-[color:var(--color-muted)]">{t("invitation.dress_code")}</dt>
            <dd className="font-medium">{v.dressCode}</dd>
          </div>
        )}
        {v.rateCents > 0 && (
          <div>
            <dt className="text-[color:var(--color-muted)]">{t("invitation.rate")}</dt>
            <dd className="font-medium">{formatEuroCents(v.rateCents)}</dd>
          </div>
        )}
      </dl>

      {brief && (
        <div className="mt-6 rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-5 shadow-[var(--elevation-card)]">
          <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">{brief.title || t("invitation.brief.title")}</h2>
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
      ) : null}

      {v.status === "accepted" ? (
        <div className="mt-6 rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-5 shadow-[var(--elevation-card)]">
          <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">{t("invitation.next_steps.title")}</h2>
          <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
            {t("invitation.next_steps.body")}
          </p>
          {checkinResult?.ok ? (
            <a
              href={checkinResult.url}
              className="mt-4 inline-block w-full rounded-lg bg-[color:var(--color-accent)] px-4 py-3 text-center font-semibold text-white transition hover:bg-[color:var(--color-accent-hover)]"
            >
              {t("invitation.next_steps.open_checkin")}
            </a>
          ) : (
            <p className="mt-4 text-sm text-[color:var(--color-bad)]">
              {t("invitation.next_steps.error")}
            </p>
          )}
        </div>
      ) : null}

      {!answered ? (
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
      ) : null}

      {/* P32 · Gate 1. The promoter must be able to reach the privacy notice from the first
          page they ever see from us, without logging in and without asking anyone. */}
      <p className="mt-10 text-center text-xs">
        <Link
          className="text-[color:var(--color-muted)] underline underline-offset-2"
          href={`/i/${token}/privacy`}
        >
          {t("promoter_privacy.link")}
        </Link>
      </p>
    </main>
  );
}
