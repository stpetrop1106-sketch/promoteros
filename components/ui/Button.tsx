import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

/**
 * `subtle` was added in P34. The first four are load-bearing across 45 screens
 * and never change meaning.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
/** `lg` was added in P34 for the one primary action on a landing/empty screen. */
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  /** Visual style. Defaults to "primary". */
  variant?: ButtonVariant;
  /** Defaults to "md". */
  size?: ButtonSize;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
  /** Decorative glyph before the label — pass `<Icon name="plus" />`. */
  iconLeft?: ReactNode;
  /** Decorative glyph after the label, e.g. a chevron on a "next" action. */
  iconRight?: ReactNode;
  /** Stretch to the container's width. Used inside narrow forms and on mobile. */
  fullWidth?: boolean;
  children: ReactNode;
  /**
   * Native button type. Defaults to "button" so a bare <Button> never
   * accidentally submits a surrounding form. Pass "submit" explicitly to
   * use inside a <form action={...}>.
   */
  type?: "button" | "submit" | "reset";
}

/**
 * Shared chassis.
 *
 * Two details carry most of the perceived quality here. The first is that the
 * focus ring is a double box-shadow — a surface-coloured gap, then the accent —
 * so the ring reads cleanly against a card, a canvas or a coloured banner alike,
 * which a plain `outline` does not. The second is `active:translate-y-px`: a
 * one-pixel press is the cheapest possible way to make a control feel physical.
 */
const BASE =
  "relative inline-flex select-none items-center justify-center gap-2 rounded-lg font-semibold " +
  "transition-[background-color,border-color,color,box-shadow,transform] duration-150 " +
  "ease-[var(--ease-out-soft)] active:translate-y-px " +
  "focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] " +
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 " +
  "disabled:shadow-none disabled:active:translate-y-0";

const VARIANTS: Record<ButtonVariant, string> = {
  /* A hairline of the darker brand blue inside the fill keeps the button from
     looking like a flat rectangle of colour, and a tight shadow lifts it off
     the card without the drop-shadow look of a 2014 button. */
  primary:
    "bg-[color:var(--color-accent)] text-white shadow-[0_1px_2px_0_rgb(20_26_41/0.16),inset_0_1px_0_0_rgb(255_255_255/0.12)] " +
    "ring-1 ring-inset ring-[color:var(--color-accent-press)]/30 " +
    "hover:bg-[color:var(--color-accent-hover)] active:bg-[color:var(--color-accent-press)]",
  secondary:
    "border border-[color:var(--color-line)] bg-[color:var(--color-surface)] text-[color:var(--color-ink)] " +
    "shadow-[var(--shadow-2xs)] hover:border-[color:var(--color-line-strong)] " +
    "hover:bg-[color:var(--color-surface-hover)] active:bg-[color:var(--color-canvas-sunken)]",
  ghost:
    "text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-canvas-sunken)] " +
    "hover:text-[color:var(--color-ink)] active:bg-[color:var(--color-n-200)]",
  danger:
    "bg-[color:var(--color-bad)] text-white shadow-[0_1px_2px_0_rgb(20_26_41/0.16),inset_0_1px_0_0_rgb(255_255_255/0.14)] " +
    "ring-1 ring-inset ring-[color:var(--color-bad-ink)]/30 " +
    "hover:bg-[color:var(--color-bad-ink)] active:bg-[color:var(--color-bad-ink)]",
  /* Added in P34: a quiet blue chip for a secondary action that is still the
     accent's business, e.g. "Δες τις προτάσεις" next to a primary invite. */
  subtle:
    "bg-[color:var(--color-accent-subtle)] text-[color:var(--color-accent-ink)] " +
    "hover:bg-[color:var(--color-accent-line)] active:bg-[color:var(--color-accent-line)]",
};

/**
 * `md` is 44px — the same height as a `TextField`, deliberately.
 *
 * `app/promoters/promoter-form.tsx` puts a Button on the end of a field row and
 * `app/promoters/page.tsx` builds a whole filter bar out of both; a 40px button
 * against a 44px input is exactly the kind of four-pixel mismatch that reads as
 * "nobody laid this out". 44px is also the minimum comfortable touch target,
 * which matters because the promoter-facing pages are phone-first.
 */
const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 gap-1.5 px-3 text-xs",
  md: "h-11 px-4.5 text-sm",
  lg: "h-12 px-6 text-base",
};

/**
 * Standard action button. Works as a plain <button>, so it also works
 * inside a <form action={...}> — pass type="submit" plus name/value to
 * identify which action triggered the submit (e.g. multiple submit
 * buttons in one server-action form).
 */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  iconLeft,
  iconRight,
  fullWidth = false,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const isDisabled = Boolean(disabled) || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        BASE,
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80"
        />
      ) : iconLeft ? (
        <span aria-hidden="true" className="-ml-0.5 shrink-0">
          {iconLeft}
        </span>
      ) : null}
      {/* Deliberately unconstrained: a Greek label is routinely 40% longer than
          its English twin, and clipping or forcing it onto one line is how a
          button ends up reading "Αποθήκευση αλλαγ…". */}
      <span>{children}</span>
      {iconRight && !loading ? (
        <span aria-hidden="true" className="-mr-0.5 shrink-0">
          {iconRight}
        </span>
      ) : null}
    </button>
  );
}
