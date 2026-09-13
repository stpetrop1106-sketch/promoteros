"use client";

import { useMemo, useState } from "react";
import { Card, EmptyState, Icon, SelectField, TextField } from "@/components/ui";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import type { CandidateShift } from "./data";
import { SendInviteButton } from "./send-invite-button";

const t = translatorFor(DEFAULT_LOCALE);

/** "YYYY-MM-DD" → "09/09/2026", rebuilt from its own parts rather than through a `Date` — same
 *  reasoning as `app/shifts/[id]/page.tsx` and `lib/invite-eligibility.ts`'s own file comment. */
function formatDateString(onDate: string): string {
  const [y, m, d] = onDate.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * P38 — the panel behind "Στείλε πρόσκληση" on a promoter's profile.
 *
 * `shifts` is already the full list of upcoming, still-open shifts with eligibility computed
 * against this one promoter (`app/promoters/[id]/invite/data.ts`'s `loadInvitePanel`) — small
 * enough (an agency's live open shifts, not its whole history) to filter client-side by campaign
 * and date instantly, with no round trip per keystroke. A coordinator with 300 open shifts needs
 * the right one in seconds, not after a page reload.
 */
export function InvitePanel({
  promoterId,
  promoterPhone,
  shifts,
}: {
  promoterId: string;
  promoterPhone: string | null;
  shifts: CandidateShift[];
}) {
  const [campaignId, setCampaignId] = useState("");
  const [date, setDate] = useState("");

  const campaignOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of shifts) seen.set(s.campaignId, s.campaignName);
    return Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
  }, [shifts]);

  const filtered = shifts.filter((s) => {
    if (campaignId && s.campaignId !== campaignId) return false;
    if (date && s.onDate !== date) return false;
    return true;
  });

  const hasFilters = campaignId !== "" || date !== "";

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <SelectField
            id="invite-filter-campaign"
            label={t("invite_panel.filter.campaign_label")}
            options={campaignOptions}
            placeholder={t("invite_panel.filter.campaign_all")}
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            containerClassName="min-w-48"
          />
          <TextField
            id="invite-filter-date"
            type="date"
            label={t("invite_panel.filter.date_label")}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            containerClassName="min-w-40"
          />
          {hasFilters ? (
            <button
              type="button"
              onClick={() => {
                setCampaignId("");
                setDate("");
              }}
              className="h-11 rounded-sm text-xs font-medium text-[color:var(--color-accent)] underline underline-offset-2 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
            >
              {t("invite_panel.filter.clear")}
            </button>
          ) : null}
        </div>
      </Card>

      {shifts.length === 0 ? (
        <EmptyState icon={<Icon name="calendar" size={22} />} title={t("invite_panel.empty_no_shifts")} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Icon name="filter" size={22} />} title={t("invite_panel.empty_filtered")} />
      ) : (
        <ul className="flex flex-col divide-y divide-[color:var(--color-line)] rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)]">
          {filtered.map((s) => (
            <li key={s.id} className="flex flex-wrap items-start justify-between gap-4 px-4 py-4">
              <div className="min-w-0">
                <p className="font-medium text-[color:var(--color-ink)]">
                  {formatDateString(s.onDate)} · {s.startTime}–{s.endTime}
                </p>
                <p className="mt-0.5 text-sm text-[color:var(--color-muted)]">
                  {s.campaignName} · {s.storeName}
                </p>
                <p className="mt-1 text-xs text-[color:var(--color-muted-soft)]">
                  {t("invite_panel.slots_needed", { count: s.promotersRequired })}
                </p>
              </div>
              <SendInviteButton
                shiftId={s.id}
                promoterId={promoterId}
                promoterPhone={promoterPhone}
                blocking={s.blocking}
                warnings={s.warnings}
                label={t("invite_panel.send.button")}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
