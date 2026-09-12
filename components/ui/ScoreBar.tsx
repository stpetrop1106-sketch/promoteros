import type { ReactNode } from "react";
import { cn } from "./cn";

/** `lg` was added in P34, for the single headline score on a match detail. */
export type ScoreBarSize = "sm" | "md" | "lg";

export interface ScoreBarProps {
  /** 0..1. Values outside that range are clamped. */
  value: number;
  /**
   * Accessible name for the underlying progressbar, e.g. "Match score for
   * Maria K." Required for screen readers even though the percentage is
   * also shown visually — pass it via props, never hardcode it here.
   */
  label?: string;
  /** Show the numeric percentage next to the bar. Defaults to true. */
  showValue?: boolean;
  size?: ScoreBarSize;
  /**
   * "brand" (the default) is the accent→action gradient and is what a total
   * match score uses. "muted" is a flat neutral fill for a per-factor
   * sub-score, so a breakdown of six rows does not compete with the total it
   * explains. Added in P34.
   */
  tone?: "brand" | "muted";
  /** A short line under the bar, e.g. the factor's own weight. Added in P34. */
  caption?: ReactNode;
  className?: string;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

const HEIGHTS: Record<ScoreBarSize, string> = {
  sm: "h-1.5",
  md: "h-2.5",
  lg: "h-3.5",
};

const VALUE_TEXT: Record<ScoreBarSize, string> = {
  sm: "w-9 text-xs",
  md: "w-10 text-sm",
  lg: "w-12 text-base",
};

/**
 * The product's signature element: a 0..1 score rendered as a horizontal
 * bar with its percentage, used for match scores and per-factor
 * breakdowns. Purely presentational — the caller supplies the value and
 * an accessible label.
 *
 * A coordinator reads this dozens of times a day, almost always as a *column*
 * of bars they are comparing, so P34 optimised for comparison rather than for
 * the single bar:
 *
 *  - the percentage sits in a fixed-width, tabular-numeral slot, so the digits
 *    line up vertically down the column and the eye can read the numbers as a
 *    list without the bars at all;
 *  - quarter ticks show through the empty part of the track, giving every bar
 *    the same reference marks — without them, judging 61% against 74% at a
 *    glance is guesswork;
 *  - the track is inset rather than filled flat, so an empty bar still reads as
 *    a bar, and a 2% score is still visible instead of vanishing.
 */
export function ScoreBar({
  value,
  label,
  showValue = true,
  size = "md",
  tone = "brand",
  caption,
  className,
}: ScoreBarProps) {
  const clamped = clamp01(value);
  const percent = Math.round(clamped * 100);
  const showTicks = size !== "sm";

  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-1", className)}>
      <div className="flex items-center gap-3">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label={label}
          className={cn(
            "relative w-full min-w-16 flex-1 overflow-hidden rounded-full bg-[color:var(--color-canvas-sunken)] ring-1 ring-inset ring-[color:var(--color-ink)]/5",
            HEIGHTS[size],
          )}
        >
          {showTicks
            ? [25, 50, 75].map((tick) => (
                <span
                  key={tick}
                  aria-hidden="true"
                  className="absolute inset-y-0 w-px bg-[color:var(--color-n-300)]/70"
                  style={{ left: `${tick}%` }}
                />
              ))
            : null}

          <div
            className={cn(
              "absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-[var(--ease-out-soft)]",
              tone === "muted" && "bg-[color:var(--color-n-400)]",
            )}
            style={{
              width: percent === 0 ? "0%" : `max(${percent}%, ${size === "sm" ? 6 : 10}px)`,
              ...(tone === "brand"
                ? {
                    backgroundImage:
                      "linear-gradient(90deg, var(--color-accent), var(--color-action))",
                    boxShadow: "inset 0 1px 0 0 rgb(255 255 255 / 0.22)",
                  }
                : null),
            }}
          />
        </div>

        {showValue ? (
          <span
            className={cn(
              "shrink-0 text-right font-semibold tabular-nums tracking-tight text-[color:var(--color-ink)]",
              VALUE_TEXT[size],
            )}
          >
            {percent}
            <span className="text-[color:var(--color-muted)]">%</span>
          </span>
        ) : null}
      </div>

      {caption ? (
        <p className="text-xs text-[color:var(--color-muted)]">{caption}</p>
      ) : null}
    </div>
  );
}
