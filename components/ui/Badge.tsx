import type { ReactNode } from "react";
import { cn } from "./cn";

export type BadgeVariant = "neutral" | "ok" | "warn" | "bad" | "info";

const VARIANTS: Record<BadgeVariant, string> = {
  neutral: "bg-[color:var(--color-line)]/50 text-[color:var(--color-muted)]",
  ok: "bg-[color:var(--color-ok)]/10 text-[color:var(--color-ok)]",
  warn: "bg-[color:var(--color-warn)]/10 text-[color:var(--color-warn)]",
  bad: "bg-[color:var(--color-bad)]/10 text-[color:var(--color-bad)]",
  info: "bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]",
};

export interface BadgeProps {
  /** Defaults to "neutral". */
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

/** Small status pill, e.g. shift/assignment/invitation state. */
export function Badge({ variant = "neutral", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold leading-none",
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
