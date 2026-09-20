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
 * tint behind an `ink` foreground that clears AA on it.
 *
 * P42a dropped the inset hairline. The reference's status pills are flat
 * pastel with no edge at all, and on a white card inside an ivory page the
 * hairline was only there to fight the old cool-grey ramp — on a warm tint it
 * reads as a smudge around the word. The tint alone has enough contrast against
 * white to hold its shape, and the pill is `rounded-full`, so nothing about it
 * can be mistaken for a table cell.
 */
const VARIANTS: Record<BadgeVariant, string> = {
  neutral:
    "bg-[color:var(--color-neutral-subtle)] text-[color:var(--color-neutral-ink)]",
  ok: "bg-[color:var(--color-ok-subtle)] text-[color:var(--color-ok-ink)]",
  warn: "bg-[color:var(--color-warn-subtle)] text-[color:var(--color-warn-ink)]",
  bad: "bg-[color:var(--color-bad-subtle)] text-[color:var(--color-bad-ink)]",
  info: "bg-[color:var(--color-accent-subtle)] text-[color:var(--color-accent-ink)]",
  accent:
    "bg-[color:var(--color-action-subtle)] text-[color:var(--color-action-ink)]",
};

const DOTS: Record<BadgeVariant, string> = {
  neutral: "bg-[color:var(--color-n-400)]",
  ok: "bg-[color:var(--color-ok)]",
  warn: "bg-[color:var(--color-warn)]",
  bad: "bg-[color:var(--color-bad)]",
  info: "bg-[color:var(--color-accent)]",
  accent: "bg-[color:var(--color-action-hover)]",
};

/* Fully rounded, and wide enough that the fill reads as a pill rather than as a
   highlighter stroke behind the word. The extra horizontal padding is most of
   why the reference's pills look considered. */
const SIZES: Record<BadgeSize, string> = {
  sm: "h-5.5 gap-1.5 px-2.5 text-2xs",
  md: "h-6.5 gap-1.5 px-3 text-xs",
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
        "inline-flex max-w-full items-center rounded-full font-semibold leading-none",
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
