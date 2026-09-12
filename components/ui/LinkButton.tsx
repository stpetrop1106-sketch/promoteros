import Link from "next/link";
import type { Route } from "next";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { buttonClassName, type ButtonSize, type ButtonVariant } from "./Button";

export interface LinkButtonProps<RouteType extends string = string>
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  /**
   * Generic over the route string, mirroring Next's typed-routes wrapper pattern. A plain
   * `href: string` here would widen every caller's literal/template href and fail `next/link`'s
   * `RouteImpl` check, even for hrefs that are perfectly valid routes.
   */
  href: Route<RouteType>;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the container's width — the phone case, where an action owns its own row. */
  fullWidth?: boolean;
  /** Decorative glyph before the label. */
  iconLeft?: ReactNode;
  /** Decorative glyph after the label, e.g. a chevron on a "next" action. */
  iconRight?: ReactNode;
  children: ReactNode;
}

/**
 * A navigation link wearing `Button`'s chassis.
 *
 * Added in P35, and it is a *deduplication*, not a new idea: `app/campaigns/link-button.tsx` and
 * `app/promoters/link-button.tsx` were two hand-copied approximations of the same thing, written
 * by two lanes that could not import each other's files. Both had drifted away from `Button` —
 * 32/40px against 36/44, a focus `outline` against the ring, no press translate, no inset
 * hairline — so on almost every screen the primary *link* was four pixels shorter and a slightly
 * different shape from the primary *button* beside it. Both files now delegate here.
 *
 * `<a>` rather than `<button>` is the whole reason this exists: an anchor inside a button is
 * invalid HTML, and a button is not a navigation. Everything visual comes from
 * `buttonClassName()`, so this cannot drift from `Button` again.
 */
export function LinkButton<RouteType extends string>({
  href,
  variant = "primary",
  size = "md",
  fullWidth = false,
  iconLeft,
  iconRight,
  className,
  children,
  ...rest
}: LinkButtonProps<RouteType>) {
  return (
    <Link
      href={href}
      className={buttonClassName({ variant, size, fullWidth, className })}
      {...rest}
    >
      {iconLeft ? (
        <span aria-hidden="true" className="-ml-0.5 shrink-0">
          {iconLeft}
        </span>
      ) : null}
      {/* Unconstrained for the same reason `Button`'s label is: a Greek label runs 30–40% longer
          than its English twin, and "Προσθήκη promo…" is not a button. */}
      <span className="text-center">{children}</span>
      {iconRight ? (
        <span aria-hidden="true" className="-mr-0.5 shrink-0">
          {iconRight}
        </span>
      ) : null}
    </Link>
  );
}
