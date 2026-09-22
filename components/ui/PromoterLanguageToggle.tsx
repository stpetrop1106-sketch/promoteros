import Link from "next/link";
import type { Route } from "next";

/**
 * A3-16 — the one control that makes the English dictionary reachable on a promoter page.
 *
 * Promoter pages have no navigation, no account and no settings screen, so there is nowhere a
 * `LocaleSwitcher` could live. This is a plain link back to the same page with `?lang=` on it —
 * no state, no JavaScript, and nothing to go wrong on a bad connection.
 *
 * The visible label is the OTHER language's own name ("English" while reading Greek, "Ελληνικά"
 * while reading English), which is the one string a promoter can recognise without already
 * understanding the page.
 *
 * Generic over the route string, mirroring `app/c/[token]/checkin-form.tsx`: a plain
 * `pathname: string` prop would widen the caller's template literal and fail `next/link`'s
 * typed-route check for a route that genuinely exists.
 */
export type PromoterLanguageToggleProps<RouteType extends string> = {
  /** The page's own path, without a query string. */
  pathname: Route<RouteType>;
  /** The locale to switch TO, or `undefined` to switch to the default locale (no query string). */
  query: { lang: string } | undefined;
  /** Accessible name for the link, e.g. "Γλώσσα". */
  label: string;
  /** The other language, written in itself. */
  otherLabel: string;
  className?: string;
};

export function PromoterLanguageToggle<RouteType extends string>({
  pathname,
  query,
  label,
  otherLabel,
  className,
}: PromoterLanguageToggleProps<RouteType>) {
  return (
    <Link
      href={{ pathname, query }}
      aria-label={label}
      // A 44px target, the same bar every other promoter control already meets (A3-22).
      className={
        "inline-flex min-h-[44px] items-center px-3 py-2 text-sm text-[color:var(--color-muted)] underline underline-offset-2 " +
        (className ?? "")
      }
    >
      {otherLabel}
    </Link>
  );
}
