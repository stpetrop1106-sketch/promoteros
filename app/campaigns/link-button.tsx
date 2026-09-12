import type { Route } from "next";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { LinkButton as KitLinkButton } from "@/components/ui";

type LinkButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type LinkButtonSize = "sm" | "md";

export interface LinkButtonProps<RouteType extends string = string>
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  // Generic over the route string, mirroring Next's typed-routes wrapper pattern — a plain
  // `href: string` here would widen every caller's literal/template href and fail `next/link`'s
  // `RouteImpl` check, even for hrefs that are valid routes.
  href: Route<RouteType>;
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
 * P35 emptied this out. It used to mirror Button's token classes by hand, as did an identical
 * copy under `app/promoters/` — two lanes each writing the same file because neither could import
 * the other's. Both had drifted: 32/40px heights against Button's 36/44, a focus `outline`
 * against Button's ring, no press translate. The shared implementation now lives in
 * `components/ui/LinkButton`, which builds itself from Button's own chassis, so the two can never
 * disagree again.
 *
 * The wrapper stays because a dozen screens import `LinkButton` from here and the prop shape is
 * their contract — nothing about the call sites changed.
 */
export function LinkButton<RouteType extends string>({
  href,
  variant = "primary",
  size = "md",
  iconLeft,
  iconRight,
  fullWidth,
  children,
  ...rest
}: LinkButtonProps<RouteType>) {
  return (
    <KitLinkButton
      href={href}
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
