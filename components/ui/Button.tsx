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
  "relative inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold " +
  "transition-[background-color,border-color,color,box-shadow,transform] duration-150 " +
  "ease-[var(--ease-out-soft)] active:translate-y-px " +
  "focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] " +
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 " +
  "disabled:shadow-none disabled:ring-0 disabled:active:translate-y-0";

const VARIANTS: Record<ButtonVariant, string> = {
  /* P42a: near-black on ivory. The contrast is the whole design — no gradient,
     no inner highlight, no ring, and a shadow you would have to look for. A
     primary button in this system is the quietest loud thing on the screen. */
  primary:
    "bg-[color:var(--color-accent)] text-[color:var(--color-n-25)] shadow-[var(--shadow-2xs)] " +
    "hover:bg-[color:var(--color-accent-hover)] active:bg-[color:var(--color-accent-press)]",
  /* A white pill with a hairline: a second piece of paper on the ivory, which
     is why it keeps a real white fill rather than going transparent the way
     `ghost` does. */
  secondary:
    "border border-[color:var(--color-line)] bg-[color:var(--color-surface)] text-[color:var(--color-ink)] " +
    "shadow-[var(--shadow-2xs)] hover:border-[color:var(--color-line-strong)] " +
    "hover:bg-[color:var(--color-surface-hover)] active:bg-[color:var(--color-canvas-sunken)]",
  ghost:
    "text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-canvas-sunken)] " +
    "hover:text-[color:var(--color-ink)] active:bg-[color:var(--color-n-200)]",
  danger:
    "bg-[color:var(--color-bad)] text-white shadow-[var(--shadow-2xs)] " +
    "hover:bg-[color:var(--color-bad-ink)] active:bg-[color:var(--color-bad-ink)]",
  /* A quiet sand chip for a secondary action that is still the accent's
     business, e.g. "Δες τις προτάσεις" next to a primary invite. */
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
 *
 * Heights are `min-h-*` plus vertical padding rather than a fixed `h-*`. A single-line label lands
 * on exactly the same 36/44/48px as before, so nothing in the app shifts — but a Greek label that
 * wraps to two lines inside a narrow column now grows the button instead of spilling its second
 * line out through the bottom edge, which is what a fixed height did.
 */
const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-9 gap-1.5 px-3 py-1.5 text-xs",
  md: "min-h-11 px-4.5 py-2 text-sm",
  lg: "min-h-12 px-6 py-2.5 text-base",
};

/**
 * The chassis as a string, for the one element that cannot be a `<button>`.
 *
 * Added in P35. `Button` renders a real `<button>` on purpose so it can sit inside a
 * `<form action={…}>`, which makes it the wrong element for navigation — so two lanes each grew
 * their own `LinkButton` that *mirrored* these classes by hand. Both copies had drifted: 32/40px
 * heights against Button's 36/44, an `outline` focus state against Button's ring, no press
 * translate, no inset hairline. A primary link sitting next to a primary button was four pixels
 * shorter and a different shape, on nearly every screen in the product.
 *
 * Exporting the composition is the fix that cannot drift again: `Button` below and
 * `LinkButton` both call this, so there is exactly one definition of what a button looks like.
 * Purely additive — `Button`'s own output is unchanged.
 */
export function buttonClassName({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], fullWidth && "w-full", className);
}

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
      className={buttonClassName({ variant, size, fullWidth, className })}
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
          button ends up reading "Αποθήκευση αλλαγ…". `text-center` is what makes
          the second line of a wrapped label sit under the first rather than
          ragged left against a centred glyph. */}
      <span className="text-center">{children}</span>
      {iconRight && !loading ? (
        <span aria-hidden="true" className="-mr-0.5 shrink-0">
          {iconRight}
        </span>
      ) : null}
    </button>
  );
}
