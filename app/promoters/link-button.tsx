import type { Route } from "next";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { LinkButton as KitLinkButton } from "@/components/ui";

type LinkButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type LinkButtonSize = "sm" | "md";

export interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: LinkButtonVariant;
  size?: LinkButtonSize;
  /** Added in P35, forwarded to the kit. Optional, so every existing call site is unaffected. */
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
  children: ReactNode;
}

/**
 * A navigation link styled to match `components/ui/Button`.
 *
 * P35 emptied this out — see the twin at `app/campaigns/link-button.tsx`. The two files were
 * hand-copied approximations of Button written by two lanes that could not import each other's
 * code, and both had drifted from it in height, focus state and press behaviour. The shared
 * implementation is now `components/ui/LinkButton`, built from Button's own chassis.
 *
 * The `href: string` signature (rather than `Route`) is kept exactly as it was: the callers here
 * build hrefs from a promoter id at runtime, which typed routes cannot verify, and widening it
 * back would be a breaking change for them.
 */
export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  iconLeft,
  iconRight,
  fullWidth,
  children,
  ...rest
}: LinkButtonProps) {
  return (
    <KitLinkButton
      href={href as Route}
      variant={variant}
      size={size}
      iconLeft={iconLeft}
      iconRight={iconRight}
      fullWidth={fullWidth}
      {...rest}
    >
      {children}
    </KitLinkButton>
  );
}
