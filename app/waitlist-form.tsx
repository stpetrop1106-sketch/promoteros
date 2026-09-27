"use client";

import { useActionState, type ReactNode } from "react";
import { joinWaitlist } from "@/app/actions";
import { initialWaitlistState } from "@/app/waitlist-state";
import type { Locale, TranslationKey } from "@/lib/i18n";
import { translatorFor } from "@/lib/i18n";

/**
 * The early-access form — the only conversion on the site while the product is in validation.
 *
 * It asks two questions beyond the obvious ones (how shifts are run today, and whether they want
 * to be called) because the point of a waitlist at this stage is not a count of addresses, it is
 * a shortlist of agencies worth talking to. Both are optional: a half-answered form from a real
 * agency beats a perfect one abandoned at question four.
 *
 * The action, the honeypot, the rate limit and the field names are unchanged from the version that
 * was already collecting signups. Only the fields shown and their styling moved.
 */

type Attribution = {
  source: string;
  medium: string;
  campaign: string;
};

type WaitlistFormProps = {
  attribution: Attribution;
  locale: Locale;
};

const FIELD =
  "w-full rounded-[var(--radius-sm)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3 py-2.5 text-[0.92rem] text-[color:var(--color-ink)] outline-none transition focus:border-[color:var(--color-accent)] focus:ring-2 focus:ring-[color:var(--color-action)]";

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-[0.82rem] font-medium text-[color:var(--color-ink-soft)]">
      {children}
    </label>
  );
}

const COUNTS: { value: string; key: TranslationKey }[] = [
  { value: "1-25", key: "waitlist.count_1_25" },
  { value: "26-50", key: "waitlist.count_26_50" },
  { value: "51-100", key: "waitlist.count_51_100" },
  { value: "101-250", key: "waitlist.count_101_250" },
  { value: "250+", key: "waitlist.count_250_plus" },
];

const TOOLING: { value: string; key: TranslationKey }[] = [
  { value: "spreadsheet", key: "waitlist.tooling_sheets" },
  { value: "messaging", key: "waitlist.tooling_messaging" },
  { value: "internal", key: "waitlist.tooling_internal" },
  { value: "other", key: "waitlist.tooling_other" },
];

const CHALLENGES: { value: string; key: TranslationKey }[] = [
  { value: "scheduling", key: "waitlist.challenge_scheduling" },
  { value: "finding", key: "waitlist.challenge_finding" },
  { value: "confirmation", key: "waitlist.challenge_confirm" },
  { value: "arrival", key: "waitlist.challenge_arrival" },
  { value: "replacements", key: "waitlist.challenge_replacements" },
  { value: "communication", key: "waitlist.challenge_comms" },
];

export function WaitlistForm({ attribution, locale }: WaitlistFormProps) {
  const t = translatorFor(locale);
  const [state, formAction, isPending] = useActionState(joinWaitlist, initialWaitlistState);

  return (
    <form
      action={formAction}
      className="rounded-[var(--radius-xl)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-5 sm:p-7"
    >
      <input type="hidden" name="utmSource" value={attribution.source} />
      <input type="hidden" name="utmMedium" value={attribution.medium} />
      <input type="hidden" name="utmCampaign" value={attribution.campaign} />
      <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="website">{t("waitlist.website")}</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-4">
        <div>
          <FieldLabel>{t("waitlist.company")}</FieldLabel>
          <input className={FIELD} name="companyName" autoComplete="organization" required />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel>{t("waitlist.full_name")}</FieldLabel>
            <input className={FIELD} name="fullName" autoComplete="name" required />
          </div>
          <div>
            <FieldLabel>{t("waitlist.job_title")}</FieldLabel>
            <input className={FIELD} name="jobTitle" autoComplete="organization-title" />
          </div>
        </div>

        <div>
          <FieldLabel>{t("waitlist.work_email")}</FieldLabel>
          <input className={FIELD} name="workEmail" type="email" autoComplete="email" required />
        </div>

        <div>
          <FieldLabel>{t("waitlist.promoter_count")}</FieldLabel>
          <select className={FIELD} name="promoterCount" defaultValue="" required>
            <option value="">{t("waitlist.choose_count")}</option>
            {COUNTS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.key)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel>{t("waitlist.tooling")}</FieldLabel>
            <select className={FIELD} name="currentTooling" defaultValue="">
              <option value="">{t("waitlist.tooling_choose")}</option>
              {TOOLING.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.key)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>{t("waitlist.challenge")}</FieldLabel>
            <select className={FIELD} name="primaryChallenge" defaultValue="">
              <option value="">{t("waitlist.challenge_choose")}</option>
              {CHALLENGES.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.key)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset className="mt-1">
          <legend className="mb-2 text-[0.82rem] font-medium text-[color:var(--color-ink-soft)]">
            {t("waitlist.demo")}
          </legend>
          <div className="flex gap-2">
            {(["yes", "no"] as const).map((choice) => (
              <label
                key={choice}
                className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-[color:var(--color-line)] px-3 py-2.5 text-[0.9rem] text-[color:var(--color-ink-soft)] transition has-[:checked]:border-[color:var(--color-accent)] has-[:checked]:bg-[color:var(--color-accent-subtle)] has-[:checked]:text-[color:var(--color-ink)]"
              >
                <input type="radio" name="wantsDemo" value={choice} className="accent-[color:var(--color-action)]" />
                {choice === "yes" ? t("waitlist.demo_yes") : t("waitlist.demo_no")}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <button
        className="mt-6 inline-flex w-full items-center justify-center rounded-[var(--radius-sm)] bg-[color:var(--color-accent)] px-4 py-3 text-[0.95rem] font-medium text-white transition hover:bg-[color:var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        type="submit"
        disabled={isPending}
      >
        {isPending ? t("waitlist.submitting") : t("home.early.cta")}
      </button>

      <p className="mt-3 text-[0.76rem] leading-5 text-[color:var(--color-muted)]">
        {t("waitlist.privacy_note")}
      </p>

      {state.status !== "idle" && (
        <p
          className={`mt-4 rounded-[var(--radius-sm)] px-3 py-2.5 text-[0.88rem] ${
            state.status === "error" || state.status === "rate_limited"
              ? "bg-[color:var(--color-bad-subtle)] text-[color:var(--color-bad-ink)]"
              : "bg-[color:var(--color-ok-subtle)] text-[color:var(--color-ok-ink)]"
          }`}
          aria-live="polite"
        >
          {t(state.message as TranslationKey)}
        </p>
      )}
    </form>
  );
}
