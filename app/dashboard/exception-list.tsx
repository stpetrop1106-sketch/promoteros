import Link from "next/link";
import type { Route } from "next";
import { Badge, Card, type BadgeVariant } from "@/components/ui";
import type { TranslationKey } from "@/lib/i18n";
import type { DetectedException, ExceptionSeverity, RelativeWhen } from "@/lib/exceptions";
import { groupBySeverity } from "@/lib/exceptions";

/**
 * P28 — rendering for the ranked exception list.
 *
 * A plain server component: no `"use client"`, no state, no event handler. Everything on this
 * screen is a sentence and a link, so there is nothing for the browser to do — which also means
 * this file never crosses the server/client boundary CLAUDE.md warns about, and `lib/exceptions.ts`
 * is never dragged into a client bundle.
 */

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

const SEVERITY_LABEL: Record<ExceptionSeverity, TranslationKey> = {
  critical: "dashboard.severity.critical",
  warning: "dashboard.severity.warning",
  info: "dashboard.severity.info",
};

/** `info` is deliberately not a failure colour — see the manual-override note in lib/exceptions.ts. */
const SEVERITY_BADGE: Record<ExceptionSeverity, BadgeVariant> = {
  critical: "bad",
  warning: "warn",
  info: "info",
};

const WHEN_KEY: Record<"future" | "past", Record<RelativeWhen["unit"], [TranslationKey, TranslationKey]>> = {
  future: {
    minute: ["dashboard.when.in_minute", "dashboard.when.in_minutes"],
    hour: ["dashboard.when.in_hour", "dashboard.when.in_hours"],
    day: ["dashboard.when.in_day", "dashboard.when.in_days"],
  },
  past: {
    minute: ["dashboard.when.ago_minute", "dashboard.when.ago_minutes"],
    hour: ["dashboard.when.ago_hour", "dashboard.when.ago_hours"],
    day: ["dashboard.when.ago_day", "dashboard.when.ago_days"],
  },
};

const DURATION_KEY: Record<RelativeWhen["unit"], [TranslationKey, TranslationKey]> = {
  minute: ["dashboard.duration.minute", "dashboard.duration.minutes"],
  hour: ["dashboard.duration.hour", "dashboard.duration.hours"],
  day: ["dashboard.duration.day", "dashboard.duration.days"],
};

/** Greek has no `Intl.PluralRules` shortcut we can lean on for "1 λεπτό" vs "2 λεπτά" inside a
 *  templated sentence, so the singular gets its own key rather than a wrong ending. */
function whenText(t: T, when: RelativeWhen | null): string {
  if (!when || when.direction === "now") return t("dashboard.when.now");
  const [one, many] = WHEN_KEY[when.direction][when.unit];
  return when.value === 1 ? t(one) : t(many, { n: when.value });
}

function durationText(t: T, minutes: number): string {
  const magnitude = Math.max(1, Math.round(minutes));
  const unit: RelativeWhen["unit"] =
    magnitude < 60 ? "minute" : magnitude < 48 * 60 ? "hour" : "day";
  const value =
    unit === "minute" ? magnitude : unit === "hour" ? Math.round(magnitude / 60) : Math.round(magnitude / 1440);
  const [one, many] = DURATION_KEY[unit];
  return value === 1 ? t(one) : t(many, { n: value });
}

function ExceptionRow({ exception, t }: { exception: DetectedException; t: T }) {
  const sentence = t(exception.messageKey, {
    ...exception.messageParams,
    when: whenText(t, exception.when),
  });

  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="text-sm leading-6 text-[color:var(--color-ink)]">{sentence}</p>
        <p className="mt-0.5 text-xs text-[color:var(--color-muted)]">
          {exception.campaignName}
          {exception.standingForMinutes >= 1
            ? ` · ${t("dashboard.standing_for", { duration: durationText(t, exception.standingForMinutes) })}`
            : ""}
        </p>
      </div>
      {/* Every href `lib/exceptions.ts` produces is `/shifts/<id>` — a real typed route — but
          typed routes can only verify a literal, never a string computed at runtime. The cast is
          the narrowest place to say so; the route itself is asserted in tests/exceptions.test.ts. */}
      <Link
        href={exception.action.href as Route}
        className="shrink-0 text-sm font-medium text-[color:var(--color-accent)] hover:underline"
      >
        {t(exception.action.labelKey)} →
      </Link>
    </li>
  );
}

export function ExceptionList({ exceptions, t }: { exceptions: DetectedException[]; t: T }) {
  const groups = groupBySeverity(exceptions);

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <Card
          key={group.severity}
          header={
            <div className="flex items-center gap-3">
              <Badge variant={SEVERITY_BADGE[group.severity]}>{t(SEVERITY_LABEL[group.severity])}</Badge>
              <span className="text-sm text-[color:var(--color-muted)]">{group.items.length}</span>
            </div>
          }
        >
          <ul className="divide-y divide-[color:var(--color-line)]">
            {group.items.map((exception) => (
              <ExceptionRow key={exception.id} exception={exception} t={t} />
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
