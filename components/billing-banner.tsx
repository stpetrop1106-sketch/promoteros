"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AccessLevel, BillingNotice } from "@/lib/billing/subscription";
import { translatorFor, DEFAULT_LOCALE, type TranslationKey } from "@/lib/i18n";

/**
 * The visible half of billing enforcement (`docs/commercial-architecture.md` §3).
 *
 * `lib/billing/subscription.ts`'s `evaluateAccess()` already produces one `BillingNotice` at a
 * time, with one sentence per notice in `lib/i18n` (P17's `billing.notice.*` block) — this
 * component reuses those keys rather than duplicating the copy, so the banner and the billing
 * screen can never say two different things about the same state.
 *
 * Dismissible only for the states that still have full access (`grace`): a failed card or an
 * expired trial gets a banner the coordinator can put away and get back to work, because
 * `evaluateAccess()` already gave them the full 14-day grace window — nothing is at risk yet.
 * `read_only` is never dismissible: that state *is* the restriction, not a warning about one, so
 * it stays visible everywhere it is rendered for as long as it is true.
 *
 * A client component because "dismissed" is a per-viewer, per-browser-tab-session fact
 * (`sessionStorage`, not a cookie or a database row) — reopening the tab tomorrow shows it again,
 * which is correct: yesterday's card failure is still today's problem until it is fixed.
 */

const NOTICE_TITLE: Record<BillingNotice, TranslationKey> = {
  trial_ending: "billing.notice.trial_ending.title",
  trial_expired: "billing.notice.trial_expired.title",
  past_due: "billing.notice.past_due.title",
  grace_ending: "billing.notice.grace_ending.title",
  read_only_unpaid: "billing.notice.read_only_unpaid.title",
  paused: "billing.notice.paused.title",
  canceled: "billing.notice.canceled.title",
};

const NOTICE_BODY: Record<BillingNotice, TranslationKey> = {
  trial_ending: "billing.notice.trial_ending.body",
  trial_expired: "billing.notice.trial_expired.body",
  past_due: "billing.notice.past_due.body",
  grace_ending: "billing.notice.grace_ending.body",
  read_only_unpaid: "billing.notice.read_only_unpaid.body",
  paused: "billing.notice.paused.body",
  canceled: "billing.notice.canceled.body",
};

const t = translatorFor(DEFAULT_LOCALE);

function dismissKey(notice: BillingNotice): string {
  return `promoteros.billing_banner_dismissed.${notice}`;
}

export type BillingBannerProps = {
  notice: BillingNotice | null;
  access: AccessLevel;
  /** Whole days left of grace, rounded up. Null when not in a grace window. */
  graceDaysRemaining: number | null;
  /** Whole days until the trial ends. Null when there is no trial. */
  trialDaysRemaining: number | null;
};

export function BillingBanner({ notice, access, graceDaysRemaining, trialDaysRemaining }: BillingBannerProps) {
  const dismissible = access !== "read_only";
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!notice || !dismissible) return;
    try {
      setDismissed(window.sessionStorage.getItem(dismissKey(notice)) === "1");
    } catch {
      // Private browsing / storage blocked: never let a storage failure hide a billing notice —
      // worst case it shows every time, which is safe, unlike the reverse.
    }
  }, [notice, dismissible]);

  if (!notice || dismissed) return null;

  const days = graceDaysRemaining ?? trialDaysRemaining ?? 0;
  const bad = access === "read_only";

  function handleDismiss() {
    try {
      window.sessionStorage.setItem(dismissKey(notice as BillingNotice), "1");
    } catch {
      // Ignore — the banner simply reappears on the next page, which is safe.
    }
    setDismissed(true);
  }

  return (
    <div
      role="status"
      className={
        "flex flex-wrap items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm " +
        (bad
          ? "border-[color:var(--color-bad)] bg-[color:var(--color-bad)]/10"
          : "border-[color:var(--color-warn)] bg-[color:var(--color-warn)]/10")
      }
    >
      <div>
        <p className="font-semibold text-[color:var(--color-ink)]">{t(NOTICE_TITLE[notice])}</p>
        <p className="mt-0.5 text-[color:var(--color-muted)]">
          {t(NOTICE_BODY[notice], { days: Math.max(0, days) })}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Link
          href="/settings/billing"
          className="whitespace-nowrap font-medium text-[color:var(--color-accent)] hover:underline"
        >
          {t("enforcement.banner.billing_cta")}
        </Link>
        {dismissible ? (
          <button
            type="button"
            onClick={handleDismiss}
            aria-label={t("enforcement.banner.dismiss")}
            className="text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)]"
          >
            ✕
          </button>
        ) : null}
      </div>
    </div>
  );
}
