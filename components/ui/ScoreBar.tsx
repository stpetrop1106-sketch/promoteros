import { cn } from "./cn";

export type ScoreBarSize = "sm" | "md";

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
  className?: string;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

const HEIGHTS: Record<ScoreBarSize, string> = {
  sm: "h-1.5",
  md: "h-2.5",
};

/**
 * The product's signature element: a 0..1 score rendered as a horizontal
 * bar with its percentage, used for match scores and per-factor
 * breakdowns. Purely presentational — the caller supplies the value and
 * an accessible label.
 */
export function ScoreBar({ value, label, showValue = true, size = "md", className }: ScoreBarProps) {
  const clamped = clamp01(value);
  const percent = Math.round(clamped * 100);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={label}
        className={cn(
          "relative w-full min-w-16 flex-1 overflow-hidden rounded-full bg-[color:var(--color-line)]/60",
          HEIGHTS[size],
        )}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-out"
          style={{
            width: `${percent}%`,
            backgroundImage: "linear-gradient(90deg, var(--color-accent), var(--color-action))",
          }}
        />
      </div>
      {showValue ? (
        <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums text-[color:var(--color-ink)]">
          {percent}%
        </span>
      ) : null}
    </div>
  );
}
