import Link from "next/link";
import type { Route } from "next";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cn } from "@/components/ui/cn";

type LinkButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type LinkButtonSize = "sm" | "md";

/**
 * A navigation link styled to match `components/ui/Button`. `Button` renders a real `<button>`
 * so it can sit inside a `<form action={...}>`, which makes it the wrong element for
 * navigation — an `<a>` is interactive content and is invalid nested inside a `<button>`. This
 * mirrors Button's token classes exactly rather than introducing a new visual language.
 * Self-contained here (not imported from another lane) since `app/campaigns/**` is out of
 * bounds for this parcel.
 */
const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold " +
  "transition-colors focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]";

const VARIANTS: Record<LinkButtonVariant, string> = {
  primary: "bg-[color:var(--color-accent)] text-white hover:bg-[color:var(--color-accent-hover)]",
  secondary:
    "border border-[color:var(--color-line)] bg-[color:var(--color-surface)] text-[color:var(--color-ink)] hover:bg-[color:var(--color-canvas)]",
  ghost: "text-[color:var(--color-ink)] hover:bg-[color:var(--color-canvas)]",
  danger: "bg-[color:var(--color-bad)] text-white hover:opacity-90",
};

const SIZES: Record<LinkButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
};

export interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: LinkButtonVariant;
  size?: LinkButtonSize;
  children: ReactNode;
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: LinkButtonProps) {
  return (
    <Link href={href as Route} className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...rest}>
      {children}
    </Link>
  );
}
