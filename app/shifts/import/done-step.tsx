"use client";

import { Button, Icon, LinkButton } from "@/components/ui";
import type { TranslationKey } from "@/lib/i18n";
import type { CommitOutcome } from "./types";
import { Banner, reasonLabel, t, tCount } from "./wizard-ui";

export function DoneStep({ outcome, onClose }: { outcome: CommitOutcome; onClose: () => void }) {
  const section = outcome.programmeName;
  const created: string[] = [];
  if (outcome.clientCreated) created.push(t("shifts.import.done.created_client"));
  if (outcome.campaignCreated) created.push(t("shifts.import.done.created_campaign", { name: outcome.campaignName }));
  if (outcome.storesCreated.length > 0) {
    created.push(
      tCount(outcome.storesCreated.length, "shifts.import.done.created_stores_one", "shifts.import.done.created_stores_other", {
        names: outcome.storesCreated.join(", "),
      }),
    );
  }
  if (outcome.programmeCreated) created.push(t("shifts.import.done.created_section", { section }));

  // Lands on the section itself (`section-card.tsx` carries the matching id), not just its campaign.
  const sectionHref = outcome.campaignId
    ? (`/shifts?campaign=${outcome.campaignId}#section-${outcome.programmeId ?? ""}` as const)
    : null;

  return (
    <div className="flex flex-col gap-5">
      {outcome.failedAt === null ? (
        <Banner tone="ok" role="status">
          <p className="text-base font-semibold">
            {tCount(outcome.shiftsCreated, "shifts.import.done.success_one", "shifts.import.done.success_other", { section })}
          </p>
        </Banner>
      ) : (
        <Banner tone="bad" role="alert">
          <p className="font-semibold">{t(`shifts.import.done.failed.${outcome.failedAt}` as TranslationKey)}</p>
          <p className="mt-1">
            {tCount(outcome.shiftsNotCreated, "shifts.import.done.not_created_one", "shifts.import.done.not_created_other")}
          </p>
          {outcome.shiftsCreated > 0 ? (
            <p className="mt-1">
              {tCount(outcome.shiftsCreated, "shifts.import.done.partial_created_one", "shifts.import.done.partial_created_other", { section })}
            </p>
          ) : null}
          <p className="mt-1">
            {t(
              outcome.programmeId
                ? "shifts.import.done.recover_section"
                : created.length > 0
                  ? "shifts.import.done.recover_nothing"
                  : "shifts.import.done.recover_retry",
            )}
          </p>
        </Banner>
      )}

      {created.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-2xs font-medium uppercase tracking-wide text-[color:var(--color-muted)]">{t("shifts.import.done.created_title")}</p>
          <ul className="flex flex-col gap-1 text-sm text-[color:var(--color-ink-soft)]">
            {created.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <Icon name="check" size={16} className="mt-0.5 shrink-0 text-[color:var(--color-ok)]" />
                <span className="break-words">{line}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {outcome.leftOut.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-2xs font-medium uppercase tracking-wide text-[color:var(--color-muted)]">{t("shifts.import.done.left_out_title")}</p>
          <ul className="flex flex-col gap-1 text-sm text-[color:var(--color-ink-soft)]">
            {outcome.leftOut.map(({ reason, count }) => (
              <li key={reason}>{t("shifts.import.done.left_out_line", { count, reason: reasonLabel(reason) })}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {sectionHref && outcome.programmeId ? (
          <LinkButton href={sectionHref} onClick={onClose} iconRight={<Icon name="arrowRight" size={16} />}>
            {t("shifts.import.done.open_section")}
          </LinkButton>
        ) : null}
        <Button type="button" variant="ghost" onClick={onClose}>
          {t("shifts.import.close")}
        </Button>
      </div>
    </div>
  );
}
