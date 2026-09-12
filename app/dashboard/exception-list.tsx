import Link from "next/link";
import type { Route } from "next";
import { Badge, Card, Icon, type BadgeVariant } from "@/components/ui";
import { cn } from "@/components/ui/cn";
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

/**
 * The dot at the head of a row. The saturated base, not the subtle tint: design.md's rule is
 * that the full-strength colour is for dots, icons and solid fills only — a 2px dot is exactly
 * where a saturated colour earns its keep, and the row's own sentence carries the meaning
 * regardless, so nothing depends on seeing it.
 */
const SEVERITY_DOT: Record<ExceptionSeverity, string> = {
  critical: "bg-[color:var(--color-bad)]",
  warning: "bg-[color:var(--color-warn)]",
  info: "bg-[color:var(--color-accent)]",
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
    /*
     * A whole-row link rather than a sentence with a link on the end. The sentence *is* the
     * thing you want to open — "Η βάρδια στο Hyper Vega ξεκινά σε 2 ώρες και λείπει ένα άτομο"
     * has exactly one useful response, and making the coordinator aim at a five-word link at the
     * far right of the row on a phone was the cost of not saying so.
     *
     * Every href `lib/exceptions.ts` produces is `/shifts/<id>` — a real typed route — but typed
     * routes can only verify a literal, never a string computed at runtime. The cast is the
     * narrowest place to say so; the route itself is asserted in tests/exceptions.test.ts.
     */
    <li>
      <Link
        href={exception.action.href as Route}
        className="group flex items-start gap-3 px-5 py-3.5 transition-colors duration-150 ease-[var(--ease-out-soft)] hover:bg-[color:var(--color-surface-hover)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] sm:px-6"
      >
        <span
          aria-hidden="true"
          className={cn(
            "mt-1.5 size-2 shrink-0 rounded-full",
            SEVERITY_DOT[exception.severity],
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm leading-6 text-[color:var(--color-ink)]">{sentence}</span>
          <span className="mt-0.5 block text-xs text-[color:var(--color-muted)]">
            {exception.campaignName}
            {exception.standingForMinutes >= 1
              ? ` · ${t("dashboard.standing_for", { duration: durationText(t, exception.standingForMinutes) })}`
              : ""}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 pt-0.5 text-xs font-semibold text-[color:var(--color-accent)]">
          {/* The label is the action's name and it matters on a wide screen; on a phone the
              chevron alone carries it, and the row is the target anyway. */}
          <span className="hidden sm:inline">{t(exception.action.labelKey)}</span>
          <Icon
            name="chevronRight"
            size={16}
            className="transition-transform duration-150 ease-[var(--ease-out-soft)] group-hover:translate-x-0.5"
          />
        </span>
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
          /* `flush` because the rows bring their own padding — they have to, so that the hover
             and focus states cover the full width of the card instead of an inset rectangle
             floating inside it. */
          flush
          /* The critical group is the one card the screen is about when it exists. Giving it the
             raised elevation is the cheapest way to say "start here" without a second colour. */
          elevation={group.severity === "critical" ? "raised" : "card"}
          header={
            <div className="flex items-center gap-2.5">
              <Badge variant={SEVERITY_BADGE[group.severity]} dot>
                {t(SEVERITY_LABEL[group.severity])}
              </Badge>
              <span className="text-xs font-medium tabular-nums text-[color:var(--color-muted)]">
                {group.items.length}
              </span>
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
