import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  /** Visual style. Defaults to "primary". */
  variant?: ButtonVariant;
  /** Defaults to "md". */
  size?: ButtonSize;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
  children: ReactNode;
  /**
   * Native button type. Defaults to "button" so a bare <Button> never
   * accidentally submits a surrounding form. Pass "submit" explicitly to
   * use inside a <form action={...}>.
   */
  type?: "button" | "submit" | "reset";
}

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold " +
  "transition-colors focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)] " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-[color:var(--color-accent)] text-white hover:bg-[color:var(--color-accent-hover)]",
  secondary:
    "border border-[color:var(--color-line)] bg-[color:var(--color-surface)] text-[color:var(--color-ink)] hover:bg-[color:var(--color-canvas)]",
  ghost:
    "text-[color:var(--color-ink)] hover:bg-[color:var(--color-canvas)]",
  danger:
    "bg-[color:var(--color-bad)] text-white hover:opacity-90",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
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
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : null}
      <span>{children}</span>
    </button>
  );
}
