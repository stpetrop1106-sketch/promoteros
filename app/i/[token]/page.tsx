import Link from "next/link";
import { loadInvitation } from "@/lib/invitations";
import { loadBriefForInvitation } from "@/lib/briefs";
import { createCheckinLinkForInvitation } from "@/lib/checkins";
import { translatorFor } from "@/lib/i18n";
import { Markdown, PromoterLanguageToggle } from "@/components/ui";
import { RespondForm } from "./respond-form";
import { AcknowledgeBriefForm } from "./acknowledge-brief-form";
import { InvitationErrorScreen } from "./error-screen";
import { formatEuroCents, formatShiftWhen } from "@/lib/shift-format";
import {
  langQuery,
  localeFromSearchParams,
  otherLocale,
  type PromoterSearchParams,
} from "@/lib/promoter-locale";

export const dynamic = "force-dynamic";

/**
 * The promoter-facing invitation page.
 *
 * No login: the signed link is the credential. Designed for a phone, opened from whichever
 * messenger the promoter already uses.
 */
export default async function InvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: PromoterSearchParams;
}) {
  const { token } = await params;
  const locale = localeFromSearchParams(await searchParams);
  const t = translatorFor(locale);
  const result = await loadInvitation(token);

  // A3-05 — each reason gets its own sentence and a next step, instead of "this invitation has
  // expired" for a signature that was truncated in a WhatsApp message.
  if (!result.ok) return <InvitationErrorScreen reason={result.reason} locale={locale} />;

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

  /**
   * A3-02 — the blocker. `createCheckinLinkForInvitation` has always returned a distinct
   * `cancelled` reason when the coordinator cancelled the assignment, and this page collapsed it
   * into "we couldn't prepare the arrival link just now, try again later" sitting UNDERNEATH
   * "Ευχαριστούμε! Η βάρδια καταχωρήθηκε." A promoter reading that concludes the booking stands
   * and the link is slow. They travel to the store, and the agency's client watches someone turn
   * up for a shift the agency cancelled — the exact embarrassment this product is sold to prevent.
   *
   * So: a cancelled assignment REPLACES the confirmation rather than sitting under it, and the
   * shift details stay on the page so they can see which shift it was.
   */
  const cancelled = checkinResult !== null && !checkinResult.ok && checkinResult.reason === "cancelled";

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <h1 className="text-lg font-semibold">{t("invitation.title")}</h1>

      {/* A3-12 — who this is for and who it is from. Neither was on the page; a promoter working
          for three agencies, opening a forwarded link from a number they have not saved, had
          nothing to go on, and nothing would look wrong if a coordinator pasted the link into
          the wrong chat. */}
      {v.promoterName && (
        <p className="mt-1 text-sm text-[color:var(--color-muted)]">
          {t("invitation.hello", { name: v.promoterName })}
        </p>
      )}
      {v.agencyName && (
        <p className="mt-1 text-sm font-medium text-[color:var(--color-ink-soft)]">
          {t("invitation.from_agency", { agency: v.agencyName })}
        </p>
      )}

      <dl className="mt-6 space-y-3 rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-5 text-sm shadow-[var(--elevation-card)]">
        <div>
          <dt className="text-[color:var(--color-muted)]">{t("shifts.campaign")}</dt>
          <dd className="font-medium">{v.campaignName}</dd>
        </div>
        <div>
          <dt className="text-[color:var(--color-muted)]">{t("shifts.store")}</dt>
          {/* A3-13 — the address, in the same shape `/c/[token]` already renders it. */}
          <dd className="font-medium">
            {v.storeName}
            {v.storeAddress ? ` · ${v.storeAddress}` : ""}
          </dd>
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
            {/* A3-04 — the label now says "per hour". The number is the campaign's hourly rate
                (or the shift's own override); shown bare it read as the pay for the whole shift. */}
            <dt className="text-[color:var(--color-muted)]">{t("invitation.rate")}</dt>
            <dd className="font-medium">{formatEuroCents(v.rateCents)}</dd>
          </div>
        )}
      </dl>

      {cancelled ? (
        <div className="mt-6 rounded-2xl border border-[color:var(--color-bad)] bg-[color:var(--color-surface)] p-5 shadow-[var(--elevation-card)]">
          <h2 className="text-sm font-semibold text-[color:var(--color-bad)]">
            {t("invitation.cancelled.title")}
          </h2>
          <p className="mt-2 text-sm text-[color:var(--color-ink)]">
            {t("invitation.cancelled.body")}
          </p>
          <p className="mt-2 text-sm text-[color:var(--color-muted)]">
            {t("invitation.cancelled.ask_coordinator")}
          </p>
        </div>
      ) : null}

      {brief && (
        <div className="mt-6 rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-5 shadow-[var(--elevation-card)]">
          <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">{brief.title || t("invitation.brief.title")}</h2>
          <Markdown source={brief.bodyMd} className="text-[color:var(--color-ink)]" />
          <AcknowledgeBriefForm
            token={token}
            initialAcknowledgedAt={brief.acknowledgedAt}
            /* A3-09 — a brief that is readable but can no longer be acknowledged hides the
               button rather than offering one that is guaranteed to fail. */
            canAcknowledge={brief.canAcknowledge}
            confirmLabel={t("invitation.brief.confirm")}
            sendingLabel={t("invitation.brief.sending")}
            acknowledgedTemplate={t("invitation.brief.acknowledged_on")}
            errorLabel={t("invitation.brief.error")}
            offlineLabel={t("promoter.offline")}
          />
        </div>
      )}

      {answered && !cancelled ? (
        <p className="mt-6 text-sm text-[color:var(--color-muted)]">
          {v.status === "accepted" ? t("invitation.accepted") : t("invitation.declined")}
        </p>
      ) : null}

      {v.status === "accepted" && !cancelled ? (
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
            /* A3-11 — the buttons dimmed to 50% and said nothing for 10-30 seconds. A promoter
               cannot tell a tap that registered from one that missed, so they tap again. */
            sendingLabel={t("invitation.sending")}
            acceptedLabel={t("invitation.accepted")}
            declinedLabel={t("invitation.declined")}
            alreadyAnsweredLabel={t("invitation.error.already_answered")}
            errorLabel={t("invitation.error.generic")}
            offlineLabel={t("promoter.offline")}
          />
        </>
      ) : null}

      {/* P32 · Gate 1. The promoter must be able to reach the privacy notice from the first
          page they ever see from us, without logging in and without asking anyone.
          A3-22 — it was a 15px line of grey text, the only sub-40px target on the page. */}
      <div className="mt-10 flex items-center justify-center gap-2 text-center">
        <Link
          className="inline-flex min-h-[44px] items-center px-3 py-2 text-sm text-[color:var(--color-muted)] underline underline-offset-2"
          href={{ pathname: `/i/${token}/privacy`, query: langQuery(locale) }}
        >
          {t("promoter_privacy.link")}
        </Link>
        <span aria-hidden className="text-[color:var(--color-line)]">·</span>
        <PromoterLanguageToggle
          pathname={`/i/${token}`}
          query={langQuery(otherLocale(locale))}
          label={t("promoter.language.label")}
          otherLabel={t("promoter.language.other")}
        />
      </div>
    </main>
  );
}
