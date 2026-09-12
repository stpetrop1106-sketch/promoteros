import { Avatar, Badge, Card, Icon, ScoreBar } from "@/components/ui";
import type { TranslationKey } from "@/lib/i18n";
import { topReasons, type Candidate, type MatchFactor } from "@/lib/matching";
import { formatAthens } from "./time";
import type { CoverageSummary } from "./board";
import { InviteButton } from "./invite-button";

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

const factorKey = (f: MatchFactor) => `match.factor.${f}` as TranslationKey;

/**
 * P8. Answers "what happened" before "who is next" — a coordinator's first question on an
 * under-covered shift is why, not a ranked list. Shown only while the shift is under-covered;
 * `candidates` is already the top of `matchPromoters()`, which excludes anyone who declined,
 * is already confirmed, or has a pending offer — see `lib/matching`'s hard filters. Reuses the
 * existing `InviteButton`/`invite` action verbatim: re-inviting the next candidate is the same
 * operation as the very first invite, not a second code path.
 */
export function ReplacementPanel({
  shiftId,
  coverage,
  candidates,
  t,
}: {
  shiftId: string;
  coverage: CoverageSummary;
  candidates: Candidate[];
  t: T;
}) {
  const hasHistory = coverage.declines.length > 0 || coverage.cancellations.length > 0;

  return (
    <Card
      elevation="raised"
      header={
        <div className="flex items-center gap-2">
          <Icon name="spark" size={16} className="text-[color:var(--color-accent)]" />
          <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">
            {t("shifts.replacements.title")}
          </h2>
        </div>
      }
    >
      {hasHistory || coverage.pendingCount > 0 ? (
        <div className="mb-5 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-canvas)] px-4 py-3.5">
          <p className="text-2xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
            {t("shifts.replacements.why_title")}
          </p>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm text-[color:var(--color-ink-soft)]">
            {coverage.declines.map((d, i) => (
              <li key={`decline-${i}`}>
                {t("shifts.replacements.declined", {
                  name: d.fullName,
                  when: d.respondedAt ? formatAthens(d.respondedAt) : "—",
                })}
                {d.declineReason ? ` — ${t("shifts.board.reason_label", { reason: d.declineReason })}` : ""}
              </li>
            ))}
            {coverage.cancellations.map((c, i) => (
              <li key={`cancel-${i}`}>
                {t("shifts.replacements.cancelled", {
                  name: c.fullName,
                  when: c.cancelledAt ? formatAthens(c.cancelledAt) : "—",
                })}
                {c.cancelReason ? ` — ${t("shifts.board.reason_label", { reason: c.cancelReason })}` : ""}
              </li>
            ))}
            {coverage.pendingCount > 0 ? (
              <li>{t("shifts.replacements.pending_count", { count: coverage.pendingCount })}</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {candidates.length === 0 ? (
        <p className="text-sm text-[color:var(--color-muted)]">{t("match.none")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[color:var(--color-line)]">
          {candidates.map((c, i) => (
            <li key={c.promoterId} className="flex flex-wrap items-start gap-4 py-4 first:pt-0 last:pb-0">
              <span className="mt-1.5 w-4 shrink-0 text-xs font-semibold tabular-nums text-[color:var(--color-muted-soft)]">
                {i + 1}
              </span>
              <Avatar name={c.fullName} size="sm" className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="font-medium text-[color:var(--color-ink)]">{c.fullName}</span>
                  <span className="text-xs text-[color:var(--color-muted)]">
                    {t("common.km_away", { km: (c.distanceM / 1000).toFixed(1) })}
                  </span>
                  {c.hasCar ? (
                    <Badge variant="info" size="sm">
                      {t("match.has_car")}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-[color:var(--color-muted)]">
                  {topReasons(c)
                    .map((f) => t(factorKey(f)))
                    .join(" · ")}
                </p>
                <ScoreBar
                  className="mt-2.5 max-w-xs"
                  value={c.score}
                  label={t("shifts.replacements.score_label", { name: c.fullName })}
                  size="sm"
                />
              </div>
              <div className="shrink-0 pt-0.5">
                <InviteButton
                  shiftId={shiftId}
                  promoterId={c.promoterId}
                  label={t("shifts.replacements.reinvite")}
                  copyLabel={t("common.copy")}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
