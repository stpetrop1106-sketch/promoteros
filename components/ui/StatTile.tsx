import type { ReactNode } from "react";
import { cn } from "./cn";

export type StatTileTone = "neutral" | "accent" | "ok" | "warn" | "bad";

export interface StatTileProps {
  /** What the number counts, e.g. "Βάρδιες χωρίς κάλυψη". Always a `t()` key. */
  label: string;
  /** The number itself. A node, so a unit or a fraction can be styled inside. */
  value: ReactNode;
  /** Decorative glyph — pass `<Icon name="calendar" />`. */
  icon?: ReactNode;
  /** One line under the value, e.g. "σε 7 ημέρες". */
  hint?: string;
  /** Tints the icon chip and the value. `neutral` by default. */
  tone?: StatTileTone;
  /** Optional trailing slot, e.g. a link into the filtered list. */
  action?: ReactNode;
  className?: string;
}

const ICON_TONES: Record<StatTileTone, string> = {
  neutral:
    "bg-[color:var(--color-neutral-subtle)] text-[color:var(--color-neutral-ink)]",
  accent:
    "bg-[color:var(--color-accent-subtle)] text-[color:var(--color-accent-ink)]",
  ok: "bg-[color:var(--color-ok-subtle)] text-[color:var(--color-ok-ink)]",
  warn: "bg-[color:var(--color-warn-subtle)] text-[color:var(--color-warn-ink)]",
  bad: "bg-[color:var(--color-bad-subtle)] text-[color:var(--color-bad-ink)]",
};

const VALUE_TONES: Record<StatTileTone, string> = {
  neutral: "text-[color:var(--color-ink)]",
  accent: "text-[color:var(--color-ink)]",
  ok: "text-[color:var(--color-ok-ink)]",
  warn: "text-[color:var(--color-warn-ink)]",
  bad: "text-[color:var(--color-bad-ink)]",
};

/**
 * One metric in the stat strip that sits under a page heading.
 *
 * The order is deliberate and the opposite of the obvious one: the **label
 * reads first, small and quiet**, then the number lands large underneath. A
 * coordinator scanning the strip is looking for the number that is wrong, and
 * that only works if all the numbers share a baseline and a size — so the
 * value is fixed at `text-3xl` and never grows with its content.
 *
 * Purely presentational. Tone is the caller's judgement, not the tile's: a
 * value of 0 is good for "no-shows" and bad for "covered", and this component
 * has no way to know which.
 */
export function StatTile({
  label,
  value,
  icon,
  hint,
  tone = "neutral",
  action,
  className,
}: StatTileProps) {
  return (
    <div
      className={cn(
        "group relative flex items-start gap-4 rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4 shadow-[var(--elevation-card)] transition-shadow duration-200 sm:p-5",
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            ICON_TONES[tone],
          )}
        >
          {icon}
        </span>
      ) : null}

      <div className="min-w-0 flex-1">
        {/* Two lines, then clip — not one line with an ellipsis. "Βάρδιες χωρίς κάλυψη"
            is 20 characters and the English is 13; truncating to one line hides the half
            of the Greek label that says *which* shifts. `StatStrip` is a grid, so the
            tiles in a row stretch to the tallest, and the label box is held at exactly two
            lines (`min-h-9` = 2 × the 1.125rem `text-xs` line height) so a one-line label
            and a two-line label next to it still put their numbers on the same baseline —
            which is the whole reason the strip is scannable. */}
        <p className="line-clamp-2 min-h-9 text-xs font-medium uppercase tracking-wide text-[color:var(--color-muted)]">
          {label}
        </p>
        <p
          className={cn(
            "mt-1 text-3xl font-semibold tabular-nums leading-none tracking-tight",
            VALUE_TONES[tone],
          )}
        >
          {value}
        </p>
        {hint ? (
          <p className="mt-2 text-xs text-[color:var(--color-muted)]">{hint}</p>
        ) : null}
      </div>

      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  );
}

export interface StatStripProps {
  children: ReactNode;
  className?: string;
}

/**
 * The row the tiles live in. A plain auto-fit grid rather than fixed column
 * counts, so a page with three tiles and a page with five both look composed
 * and neither wraps to a single orphan on a laptop.
 */
export function StatStrip({ children, className }: StatStripProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
