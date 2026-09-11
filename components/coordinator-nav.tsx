"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";

const t = translatorFor(DEFAULT_LOCALE);

/**
 * The only way to move between screens.
 *
 * Until this existed, a coordinator who landed on the dashboard could reach the shift list through
 * one link and everything else by typing a URL. The `nav.*` keys had been in both dictionaries
 * since the first parcel with nothing rendering them.
 *
 * It lives in the ROOT layout, which also wraps the public landing page, `/privacy`, `/login` and
 * the anonymous promoter pages at `/i/[token]` and `/c/[token]`. None of those should show it: a
 * promoter confirming a shift on their phone has no account and no business seeing an agency's
 * navigation. Hence both guards — `signedIn` from the server, and the path check here for the
 * promoter routes, which a signed-in coordinator could otherwise open in the same browser.
 */
const HIDE_ON = ["/", "/login", "/privacy", "/i/", "/c/", "/onboarding"];

const LINKS = [
  { href: "/dashboard", key: "nav.today" },
  { href: "/shifts", key: "nav.shifts" },
  { href: "/promoters", key: "nav.promoters" },
  { href: "/campaigns", key: "nav.campaigns" },
  { href: "/settings", key: "nav.settings" },
] as const;

export function CoordinatorNav({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname() ?? "/";

  if (!signedIn) return null;
  if (HIDE_ON.some((p) => (p === "/" ? pathname === "/" : pathname.startsWith(p)))) return null;

  return (
    <nav
      aria-label={t("nav.label")}
      className="border-b border-[color:var(--color-line)] bg-[color:var(--color-surface)]"
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-1 px-6 py-2">
        <Link href="/dashboard" className="mr-3 text-sm font-semibold tracking-tight">
          {t("app.name")}
        </Link>

        {LINKS.map(({ href, key }) => {
          // `/shifts` must not light up while you are on `/settings`, so compare the segment.
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "rounded px-2.5 py-1.5 text-sm font-medium text-[color:var(--color-accent)]"
                  : "rounded px-2.5 py-1.5 text-sm text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)]"
              }
            >
              {t(key)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
