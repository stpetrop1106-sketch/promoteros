import Link from "next/link";
import { translatorFor, DEFAULT_LOCALE, type TranslationKey } from "@/lib/i18n";
import { formatEuroCents } from "@/lib/shift-format";
import {
  formatMonthLabel,
  formatPaidHours,
  monthsWithWorkedShifts,
  resolveSelectedMonth,
  summariseMonth,
  type PromoterShiftRow,
} from "@/lib/promoters/earnings";

/**
 * What this promoter earned in a given month, and the shifts the number is made of.
 *
 * "Worked" is decision D24: the shift's date has passed AND a check-in exists. Nothing in this
 * application has ever written the `completed` assignment status, so counting on it would have
 * produced €0 for everyone for ever while looking like a working feature. The screen states the
 * rule out loud — an unexplained number about somebody's pay is a number nobody trusts.
 *
 * Two honesty rules the markup enforces:
 *
 *  - A shift whose rate was never set shows "—", never "0,00 €". Zero is a claim; a dash is an
 *    admission.
 *  - When any worked shift could not be priced, the total carries a line saying the real figure is
 *    higher. A short total presented as a complete one is the kind of error somebody notices on
 *    payday.
 *
 * The month is chosen through the query string so the page stays a server component, the choice
 * survives a reload, and the coordinator can send a colleague a link to the month they are arguing
 * about. All arithmetic lives in `lib/promoters/earnings.ts` and is unit-tested; this file only
 * renders.
 */

type Props = {
  promoterId: string;
  rows: PromoterShiftRow[];
  today: string;
  requestedMonth: string | null;
};

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-4 py-4 sm:px-5">
      <p className="font-mono text-2xl tabular-nums text-[color:var(--color-ink)]">{value}</p>
      <p className="mt-1 text-[0.78rem] text-[color:var(--color-muted)]">{label}</p>
    </div>
  );
}

export function EarningsSection({ promoterId, rows, today, requestedMonth }: Props) {
  const t = translatorFor(DEFAULT_LOCALE);

  const months = monthsWithWorkedShifts(rows, today);

  if (months.length === 0) {
    return (
      <section className="rounded-[var(--radius-xl)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-5 sm:p-6">
        <h2 className="text-base font-semibold text-[color:var(--color-ink)]">
          {t("promoters.earnings.title")}
        </h2>
        <p className="mt-3 text-sm leading-6 text-[color:var(--color-muted)]">
          {t("promoters.earnings.none_ever")}
        </p>
        <p className="mt-2 text-xs text-[color:var(--color-muted-soft)]">
          {t("promoters.earnings.basis")}
        </p>
      </section>
    );
  }

  const monthKey = resolveSelectedMonth(requestedMonth, months, today);
  const summary = summariseMonth(rows, monthKey, today);

  return (
    <section className="overflow-hidden rounded-[var(--radius-xl)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-line)] px-5 py-4">
        <h2 className="text-base font-semibold text-[color:var(--color-ink)]">
          {t("promoters.earnings.title")}
        </h2>

        {/* A plain list of links, not a <select>: this stays a server component, every month is a
            real URL, and it works with JavaScript switched off. */}
        <nav className="flex flex-wrap gap-1.5" aria-label={t("promoters.earnings.month_label")}>
          {months.map((key) => {
            const active = key === monthKey;
            return (
              <Link
                key={key}
                href={`/promoters/${promoterId}?month=${key}`}
                aria-current={active ? "true" : undefined}
                className={`rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[0.78rem] transition ${
                  active
                    ? "bg-[color:var(--color-accent)] text-white"
                    : "border border-[color:var(--color-line)] text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)]"
                }`}
              >
                {formatMonthLabel(key)}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="grid grid-cols-3 divide-x divide-[color:var(--color-line)] border-b border-[color:var(--color-line)]">
        <Stat
          value={String(summary.shiftCount)}
          label={
            summary.shiftCount === 1
              ? t("promoters.earnings.shifts_one")
              : t("promoters.earnings.shifts_many")
          }
        />
        <Stat value={formatPaidHours(summary.paidMinutes)} label={t("promoters.earnings.hours")} />
        <Stat value={formatEuroCents(summary.totalCents)} label={t("promoters.earnings.total")} />
      </div>

      {summary.partial ? (
        <p className="border-b border-[color:var(--color-line)] bg-[color:var(--color-warn-subtle)] px-5 py-3 text-[0.8rem] leading-5 text-[color:var(--color-warn-ink)]">
          {t(
            summary.unpricedShiftCount === 1
              ? "promoters.earnings.partial"
              : "promoters.earnings.partial_many",
            { count: summary.unpricedShiftCount },
          )}
        </p>
      ) : null}

      {summary.shifts.length === 0 ? (
        <p className="px-5 py-5 text-sm text-[color:var(--color-muted)]">
          {t("promoters.earnings.empty")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-[0.85rem]">
            <thead>
              <tr className="border-b border-[color:var(--color-line)] text-[0.7rem] uppercase tracking-[0.08em] text-[color:var(--color-muted)]">
                <th className="px-5 py-2.5 font-medium">{t("promoters.earnings.col.date")}</th>
                <th className="px-3 py-2.5 font-medium">{t("promoters.earnings.col.campaign")}</th>
                <th className="px-3 py-2.5 font-medium">{t("promoters.earnings.col.location")}</th>
                <th className="px-3 py-2.5 text-right font-medium">
                  {t("promoters.earnings.col.hours")}
                </th>
                <th className="px-5 py-2.5 text-right font-medium">
                  {t("promoters.earnings.col.pay")}
                </th>
              </tr>
            </thead>
            <tbody>
              {summary.shifts.map((shift) => (
                <tr
                  key={shift.assignmentId}
                  className="border-b border-[color:var(--color-line)] last:border-b-0"
                >
                  <td className="whitespace-nowrap px-5 py-3 text-[color:var(--color-ink)]">
                    {shift.onDate}
                  </td>
                  <td className="px-3 py-3 text-[color:var(--color-ink-soft)]">
                    {[shift.clientName, shift.campaignName].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-3 py-3 text-[color:var(--color-muted)]">
                    {shift.storeName ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-mono tabular-nums text-[color:var(--color-ink-soft)]">
                    {shift.paidMinutes === null ? "—" : formatPaidHours(shift.paidMinutes)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-right font-mono tabular-nums">
                    {shift.payCents === null ? (
                      <span
                        className="text-[color:var(--color-muted-soft)]"
                        title={t("promoters.earnings.no_pay_hint")}
                      >
                        {t("promoters.earnings.no_pay")}
                      </span>
                    ) : (
                      <span className="text-[color:var(--color-ink)]">
                        {formatEuroCents(shift.payCents)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t border-[color:var(--color-line)] px-5 py-3">
        <p className="text-xs leading-5 text-[color:var(--color-muted)]">
          {t("promoters.earnings.basis")}
        </p>
        {/* Until the rate is frozen on the assignment, a campaign's rate change rewrites history.
            The screen says so rather than presenting a moving number as a settled one. */}
        <p className="mt-1 text-xs leading-5 text-[color:var(--color-muted-soft)]">
          {t("promoters.earnings.mutable_warning")}
        </p>
      </div>
    </section>
  );
}

export type { TranslationKey };
