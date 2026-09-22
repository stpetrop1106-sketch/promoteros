import { Avatar, Badge, Card, Icon, LinkButton, ScoreBar } from "@/components/ui";
import type { TranslationKey } from "@/lib/i18n";
import { topReasons, type Candidate, type MatchFactor } from "@/lib/matching";
import { formatAthens } from "./time";
import type { CoverageSummary } from "./board";
import type { NoCandidatesDiagnosis } from "./no-candidates";
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
/**
 * A2 finding 9 — the empty state, with the reason it is empty.
 *
 * "Κανένας διαθέσιμος promoter" on its own is indistinguishable from "your roster does not fit",
 * and on a date nobody has declared on — which is every date more than fourteen days out, because
 * that is all a promoter's availability link ever offers — it is the wrong reading. Say which of
 * the two it is, with the numbers behind it, and give the first case its next step.
 */
function NoCandidates({
  diagnosis,
  onDate,
  t,
}: {
  diagnosis: NoCandidatesDiagnosis;
  onDate: string;
  t: T;
}) {
  const [y, m, d] = onDate.split("-");
  const date = `${d}/${m}/${y}`;

  if (diagnosis.reason === "no_promoters") {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-[color:var(--color-ink-soft)]">{t("match.none_no_promoters")}</p>
        <LinkButton href="/promoters/new" variant="secondary" size="sm">
          {t("match.none_no_promoters_cta")}
        </LinkButton>
      </div>
    );
  }

  if (diagnosis.reason === "nobody_declared") {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-[color:var(--color-ink-soft)]">
          {t("match.none_nobody_declared", { date, active: diagnosis.activeCount })}
        </p>
        <LinkButton href="/settings/messaging" variant="secondary" size="sm">
          {t("match.none_nobody_declared_cta")}
        </LinkButton>
      </div>
    );
  }

  return (
    <p className="text-sm text-[color:var(--color-ink-soft)]">
      {diagnosis.declaredCount === 1
        ? t("match.none_all_excluded_one", { date })
        : t("match.none_all_excluded_many", { declared: diagnosis.declaredCount, date })}
    </p>
  );
}

export function ReplacementPanel({
  shiftId,
  coverage,
  candidates,
  noCandidates,
  onDate,
  t,
}: {
  shiftId: string;
  coverage: CoverageSummary;
  candidates: Candidate[];
  /** Present only when `candidates` is empty — see `no-candidates.ts`. */
  noCandidates?: NoCandidatesDiagnosis | null;
  onDate: string;
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
              <li>
                {coverage.pendingCount === 1
                  ? t("shifts.replacements.pending_count_one")
                  : t("shifts.replacements.pending_count_many", { count: coverage.pendingCount })}
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {candidates.length === 0 ? (
        noCandidates ? (
          <NoCandidates diagnosis={noCandidates} onDate={onDate} t={t} />
        ) : (
          <p className="text-sm text-[color:var(--color-muted)]">{t("match.none")}</p>
        )
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
                  phone={c.phone}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
