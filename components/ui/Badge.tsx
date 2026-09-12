import type { ReactNode } from "react";
import { cn } from "./cn";

/** `accent` was added in P34; the first five are used across the app. */
export type BadgeVariant = "neutral" | "ok" | "warn" | "bad" | "info" | "accent";
/** Added in P34. `md` is the default and matches every existing call site. */
export type BadgeSize = "sm" | "md";

/**
 * Soft-tinted, never a saturated block.
 *
 * A shift list is twenty rows of pills. At full saturation that is a page of
 * traffic lights and the eye cannot find the one row that is actually wrong —
 * which is the entire job of the status column. So each variant is a `subtle`
 * tint behind an `ink` foreground that clears AA on it, plus an inset hairline
 * of the `line` tone, which is what gives the pill an edge without a border
 * that darkens the whole row.
 */
const VARIANTS: Record<BadgeVariant, string> = {
  neutral:
    "bg-[color:var(--color-neutral-subtle)] text-[color:var(--color-neutral-ink)] ring-[color:var(--color-neutral-line)]",
  ok: "bg-[color:var(--color-ok-subtle)] text-[color:var(--color-ok-ink)] ring-[color:var(--color-ok-line)]",
  warn: "bg-[color:var(--color-warn-subtle)] text-[color:var(--color-warn-ink)] ring-[color:var(--color-warn-line)]",
  bad: "bg-[color:var(--color-bad-subtle)] text-[color:var(--color-bad-ink)] ring-[color:var(--color-bad-line)]",
  info: "bg-[color:var(--color-accent-subtle)] text-[color:var(--color-accent-ink)] ring-[color:var(--color-accent-line)]",
  accent:
    "bg-[color:var(--color-action-subtle)] text-[color:var(--color-action-ink)] ring-[color:var(--color-action)]/25",
};

const DOTS: Record<BadgeVariant, string> = {
  neutral: "bg-[color:var(--color-n-400)]",
  ok: "bg-[color:var(--color-ok)]",
  warn: "bg-[color:var(--color-warn)]",
  bad: "bg-[color:var(--color-bad)]",
  info: "bg-[color:var(--color-accent)]",
  accent: "bg-[color:var(--color-action-hover)]",
};

const SIZES: Record<BadgeSize, string> = {
  sm: "h-5 gap-1.5 px-2 text-2xs",
  md: "h-6 gap-1.5 px-2.5 text-xs",
};

export interface BadgeProps {
  /** Defaults to "neutral". */
  variant?: BadgeVariant;
  /** Defaults to "md". */
  size?: BadgeSize;
  /**
   * Show a solid status dot before the label. Worth it in a dense table, where
   * the dot is the thing the eye catches at a glance and the word confirms it.
   */
  dot?: boolean;
  /** Decorative glyph before the label, e.g. `<Icon name="clock" size={12} />`. */
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Small status pill, e.g. shift/assignment/invitation state. */
export function Badge({
  variant = "neutral",
  size = "md",
  dot = false,
  icon,
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full font-semibold leading-none ring-1 ring-inset",
        SIZES[size],
        VARIANTS[variant],
        className,
      )}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={cn("size-1.5 shrink-0 rounded-full", DOTS[variant])}
        />
      ) : null}
      {icon && !dot ? (
        <span aria-hidden="true" className="shrink-0">
          {icon}
        </span>
      ) : null}
      <span className="truncate">{children}</span>
    </span>
  );
}
