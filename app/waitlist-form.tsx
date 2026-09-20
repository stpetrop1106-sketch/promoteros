"use client";

import { useActionState, type ReactNode } from "react";
import { joinWaitlist } from "@/app/actions";
import { initialWaitlistState } from "@/app/waitlist-state";
import type { Locale, TranslationKey } from "@/lib/i18n";
import { translatorFor } from "@/lib/i18n";

type Attribution = {
  source: string;
  medium: string;
  campaign: string;
};

type WaitlistFormProps = {
  attribution: Attribution;
  locale: Locale;
};

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="mb-1.5 block text-sm font-medium text-[color:var(--color-ink)]">{children}</label>;
}

export function WaitlistForm({ attribution, locale }: WaitlistFormProps) {
  const t = translatorFor(locale);
  const [state, formAction, isPending] = useActionState(joinWaitlist, initialWaitlistState);

  return (
    <form action={formAction} className="rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-5 sm:p-7">
      <div className="mb-6">
        <p className="text-lg font-semibold tracking-tight text-[color:var(--color-ink)]">{t("waitlist.title")}</p>
        <p className="mt-1 text-sm leading-6 text-[color:var(--color-muted)]">{t("waitlist.intro")}</p>
      </div>

      <input type="hidden" name="utmSource" value={attribution.source} />
      <input type="hidden" name="utmMedium" value={attribution.medium} />
      <input type="hidden" name="utmCampaign" value={attribution.campaign} />
      <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="website">{t("waitlist.website")}</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-4">
        <div>
          <FieldLabel>{t("waitlist.full_name")}</FieldLabel>
          <input className="w-full rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3 py-2.5 text-sm outline-none transition focus:border-[color:var(--color-accent)] focus:ring-2 focus:ring-[color:var(--color-action)]" name="fullName" autoComplete="name" required />
        </div>
        <div>
          <FieldLabel>{t("waitlist.work_email")}</FieldLabel>
          <input className="w-full rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3 py-2.5 text-sm outline-none transition focus:border-[color:var(--color-accent)] focus:ring-2 focus:ring-[color:var(--color-action)]" name="workEmail" type="email" autoComplete="email" required />
        </div>
        <div>
          <FieldLabel>{t("waitlist.company")}</FieldLabel>
          <input className="w-full rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3 py-2.5 text-sm outline-none transition focus:border-[color:var(--color-accent)] focus:ring-2 focus:ring-[color:var(--color-action)]" name="companyName" autoComplete="organization" required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel>{t("waitlist.job_title")}</FieldLabel>
            <input className="w-full rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3 py-2.5 text-sm outline-none transition focus:border-[color:var(--color-accent)] focus:ring-2 focus:ring-[color:var(--color-action)]" name="jobTitle" autoComplete="organization-title" />
          </div>
          <div>
            <FieldLabel>{t("waitlist.promoter_count")}</FieldLabel>
            <select className="w-full rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3 py-2.5 text-sm outline-none transition focus:border-[color:var(--color-accent)] focus:ring-2 focus:ring-[color:var(--color-action)]" name="promoterCount" defaultValue="" required>
              <option value="" disabled>{t("waitlist.choose_count")}</option>
              <option value="1-30">{t("waitlist.count_1_30")}</option>
              <option value="31-100">{t("waitlist.count_31_100")}</option>
              <option value="101-300">{t("waitlist.count_101_300")}</option>
              <option value="300+">{t("waitlist.count_300_plus")}</option>
            </select>
          </div>
        </div>
        <div>
          <FieldLabel>{t("waitlist.challenge")}</FieldLabel>
          <textarea className="min-h-20 w-full resize-y rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3 py-2.5 text-sm outline-none transition focus:border-[color:var(--color-accent)] focus:ring-2 focus:ring-[color:var(--color-action)]" name="primaryChallenge" maxLength={1000} />
        </div>
      </div>

      <button className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-[color:var(--color-accent)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={isPending}>
        {isPending ? t("waitlist.submitting") : t("waitlist.submit")}
      </button>
      <p className="mt-3 text-center text-xs leading-5 text-[color:var(--color-muted)]">{t("waitlist.privacy_note")}</p>
      {state.status !== "idle" && (
        <p className={`mt-4 rounded-lg px-3 py-2 text-sm ${state.status === "error" || state.status === "rate_limited" ? "bg-[color:var(--color-bad-subtle)] text-[color:var(--color-bad-ink)]" : "bg-[color:var(--color-ok-subtle)] text-[color:var(--color-ok-ink)]"}`} aria-live="polite">
          {t(state.message as TranslationKey)}
        </p>
      )}
    </form>
  );
}
