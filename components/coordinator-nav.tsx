"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { translatorFor, DEFAULT_LOCALE, type TranslationKey } from "@/lib/i18n";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/components/ui/cn";

const t = translatorFor(DEFAULT_LOCALE);

/**
 * The only way to move between screens.
 *
 * Until this existed, a coordinator who landed on the dashboard could reach the shift list through
 * one link and everything else by typing a URL. The `nav.*` keys had been in both dictionaries
 * since the first parcel with nothing rendering them.
 *
 * It lives in the ROOT layout, which also wraps the public landing page, `/privacy`, `/login` and
 * the anonymous promoter pages at `/i/[token]`, `/c/[token]` and `/a/[token]`. None of those should
 * show it: a promoter confirming a shift on their phone has no account and no business seeing an
 * agency's navigation. Hence both guards — `signedIn` from the server, and the path check here for
 * the promoter routes, which a signed-in coordinator could otherwise open in the same browser.
 *
 * P34 turned the horizontal text strip into a left sidebar, and added two paths to the hide list:
 *
 *  - `/a/` — the promoter's own availability page. It is a token page exactly like `/i/` and `/c/`
 *    and was only absent because it shipped after this list was written.
 *  - `/admin` — the platform console renders its own header nav in `app/admin/layout.tsx`, and a
 *    platform admin is not acting as an agency coordinator there. Two navigations stacked on one
 *    screen was survivable when this was a text strip; with a sidebar it is not.
 */
const HIDE_ON = ["/", "/login", "/privacy", "/i/", "/c/", "/a/", "/onboarding", "/admin"];

/**
 * `href` is a `Route`, not a `string`: `typedRoutes` is on in `next.config.ts`, so a typo in a
 * destination below is a build error rather than a 404 a coordinator finds for us.
 */
type NavLink = { href: Route; key: TranslationKey; icon: IconName };

/** The four places a coordinator's day actually happens. */
const LINKS: readonly NavLink[] = [
  { href: "/dashboard", key: "nav.today", icon: "home" },
  { href: "/shifts", key: "nav.shifts", icon: "calendar" },
  { href: "/promoters", key: "nav.promoters", icon: "users" },
  { href: "/campaigns", key: "nav.campaigns", icon: "megaphone" },
] as const;

/** Kept apart, at the bottom: configuration is not part of the daily loop. */
const SETTINGS: NavLink = { href: "/settings", key: "nav.settings", icon: "sliders" };

function isHidden(pathname: string, signedIn: boolean): boolean {
  if (!signedIn) return true;
  return HIDE_ON.some((p) => (p === "/" ? pathname === "/" : pathname.startsWith(p)));
}

/** `/shifts` must not light up while you are on `/settings`, so compare the segment. */
function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The product mark, drawn rather than loaded.
 *
 * `public/promoteros-mark.svg` exists and is the favicon, but an `<img>` here would flash on every
 * navigation and cannot inherit a colour. This is the same geometry inlined.
 */
function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--color-accent)] shadow-[0_2px_6px_-1px_rgb(22_70_184/0.45)]",
        className,
      )}
    >
      <svg viewBox="0 0 64 64" className="size-5" fill="none" aria-hidden="true">
        <path d="M18 46V18H32C41.333 18 46 22.667 46 30C46 37.333 41.333 42 32 42H18Z" fill="white" />
        <path d="M32 18V42" stroke="#2ED3C6" strokeWidth="6" strokeLinecap="round" />
        <circle cx="52" cy="42" r="5" fill="#2ED3C6" />
      </svg>
    </span>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-3 pb-1.5 pt-5 text-2xs font-semibold uppercase tracking-wider text-[color:var(--color-muted-soft)]">
      {children}
    </p>
  );
}

/**
 * One destination.
 *
 * The active state is a tinted pill plus a short accent rail flush to the sidebar's left edge. The
 * rail is what makes "where am I" readable from the corner of the eye — a tint alone disappears
 * against a white sidebar the moment the screen is not the one you are looking at.
 */
function NavItem({
  link,
  pathname,
  onNavigate,
}: {
  link: NavLink;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = isActive(pathname, link.href);

  return (
    <Link
      href={link.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
        "transition-[background-color,color] duration-150 ease-[var(--ease-out-soft)]",
        "focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]",
        active
          ? "bg-[color:var(--color-accent-subtle)] text-[color:var(--color-accent-ink)]"
          : "text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-canvas-sunken)] hover:text-[color:var(--color-ink)]",
      )}
    >
      {active ? (
        <span
          aria-hidden="true"
          className="absolute -left-6 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-[color:var(--color-accent)]"
        />
      ) : null}
      <Icon
        name={link.icon}
        size={18}
        className={
          active
            ? "text-[color:var(--color-accent)]"
            : "text-[color:var(--color-muted-soft)] transition-colors group-hover:text-[color:var(--color-muted)]"
        }
      />
      <span className="truncate">{t(link.key)}</span>
    </Link>
  );
}

/** The sidebar's contents, shared by the fixed desktop rail and the mobile drawer. */
function NavPanel({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    /* `min-h-full`, not `h-full`: inside the mobile drawer's scroll container a hard 100% height
       would clip the settings row on a short landscape phone instead of letting it scroll. On the
       desktop rail the two resolve identically, so `mt-auto` still pins settings to the bottom. */
    <div className="flex min-h-full flex-col bg-[color:var(--color-surface)]">
      <div className="flex items-center gap-2.5 px-6 pb-2 pt-5">
        <BrandMark />
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="rounded-md text-[0.9375rem] font-semibold tracking-tight text-[color:var(--color-ink)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
        >
          {t("app.name")}
        </Link>
      </div>

      <nav aria-label={t("nav.label")} className="flex min-h-0 flex-1 flex-col px-6 pb-6">
        <SectionLabel>{t("shell.section_operations")}</SectionLabel>
        <div className="flex flex-col gap-0.5">
          {LINKS.map((link) => (
            <NavItem key={link.href} link={link} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>

        <div className="mt-auto pt-6">
          <div className="border-t border-[color:var(--color-line)] pt-3">
            <NavItem link={SETTINGS} pathname={pathname} onNavigate={onNavigate} />
          </div>
        </div>
      </nav>
    </div>
  );
}

/**
 * The nav chrome: a fixed rail from `lg` up, a top bar plus a drawer below it.
 *
 * The breakpoint is `lg` rather than `md` on purpose. A coordinator works on a laptop, but a
 * supervisor checking a shift on a tablet in portrait is 768px wide — enough for the content, not
 * enough to give 256px of it away permanently to navigation.
 */
function NavChrome({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => setOpen(false), []);

  // Close the drawer when the route changes. Without this, tapping a destination on a phone leaves
  // the drawer sitting over the page it just navigated to.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  /**
   * Close it when the viewport grows past the breakpoint.
   *
   * This one is not cosmetic. The drawer's container is `lg:hidden`, so widening the window while it
   * is open — rotating a tablet, dragging a window wider, an on-screen keyboard closing — removes it
   * from view while `open` stays `true`, and the effect below therefore keeps `overflow: hidden` on
   * `<body>`. The result is a desktop page that cannot be scrolled and has no visible control to fix
   * it. The media query is the same 1024px as the `lg:` classes; they have to agree.
   *
   * Both `change` and `resize` are listened for: a real browser window fires them together, but a
   * media query that is re-evaluated without its own event still gets caught by the window's. A
   * second `setOpen(false)` while it is already `false` is a no-op, so the overlap costs nothing.
   *
   * Caveat for whoever tests this next: a viewport driven by CDP/devtools emulation rather than by
   * an actual window resize fires *neither* event — nor a `ResizeObserver` on the document element,
   * which was tried. `window.innerWidth` simply changes and the page is given no signal at all, so
   * this guard cannot be exercised by that route. Resize a real browser window.
   */
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      if (query.matches) setOpen(false);
    };
    sync();
    query.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    return () => {
      query.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  // Escape closes it, and the page behind it does not scroll while it is open.
  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        return;
      }

      // Keep Tab inside the drawer. Without this the focus ring walks off the overlay and onto the
      // page underneath, which is both invisible and unscrollable while the drawer is open.
      if (event.key !== "Tab") return;
      const panel = drawerRef.current;
      if (!panel) return;

      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus into the drawer, and put it back on the button that opened it when it closes —
    // otherwise a keyboard user lands back at the top of the document on every close.
    const opener = toggleRef.current;
    drawerRef.current?.querySelector<HTMLElement>("a[href], button")?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, [open]);

  return (
    <>
      {/* Desktop: a fixed rail. Fixed rather than sticky so a long table scrolling under it never
          drags the navigation off screen. */}
      <div
        className="fixed inset-y-0 left-0 z-30 hidden w-[var(--shell-sidebar-w)] overflow-y-auto overscroll-contain border-r border-[color:var(--color-line)] bg-[color:var(--color-surface)] lg:block"
        style={{ boxShadow: "1px 0 0 0 rgb(20 26 41 / 0.02), 4px 0 24px -12px rgb(20 26 41 / 0.10)" }}
      >
        <NavPanel pathname={pathname} />
      </div>

      {/* Mobile: a sticky bar with the mark and a menu button. */}
      <div className="sticky top-0 z-30 flex h-[var(--shell-topbar-h)] items-center justify-between gap-3 border-b border-[color:var(--color-line)] bg-[color:var(--color-surface)]/85 px-4 backdrop-blur-md lg:hidden">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
        >
          <BrandMark className="size-8 rounded-lg" />
          <span className="text-sm font-semibold tracking-tight text-[color:var(--color-ink)]">
            {t("app.name")}
          </span>
        </Link>

        <button
          ref={toggleRef}
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls="promoteros-nav-drawer"
          aria-label={open ? t("shell.close_menu") : t("shell.open_menu")}
          className="flex size-10 items-center justify-center rounded-xl text-[color:var(--color-ink-soft)] transition-colors hover:bg-[color:var(--color-canvas-sunken)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
        >
          <Icon name={open ? "close" : "menu"} size={22} />
        </button>
      </div>

      {/* The drawer itself. Kept out of the DOM when closed — there is nothing here worth the cost
          of an always-mounted off-screen copy of the navigation. */}
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            tabIndex={-1}
            aria-label={t("shell.close_menu")}
            onClick={close}
            className="absolute inset-0 h-full w-full cursor-default bg-[color:var(--color-n-950)]/35 backdrop-blur-[2px]"
          />
          {/* A real dialog, not a styled div: `aria-modal` is what stops a screen reader walking
              into the page behind the overlay, which the Tab trap above only handles for sighted
              keyboard users. The panel scrolls on its own so a short phone in landscape can still
              reach the settings row at the bottom. */}
          <div
            ref={drawerRef}
            id="promoteros-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={t("nav.label")}
            className="absolute inset-y-0 left-0 flex w-[min(18rem,85vw)] flex-col overflow-y-auto overscroll-contain shadow-[var(--elevation-overlay)]"
          >
            <NavPanel pathname={pathname} onNavigate={close} />
          </div>
        </div>
      ) : null}
    </>
  );
}

/**
 * The navigation on its own.
 *
 * Kept exported and with its original `{ signedIn }` signature because that is the contract other
 * parcels were written against. `AppShell` below is what `app/layout.tsx` actually renders — it
 * wraps this together with the content offset, which has to agree with the sidebar's width and
 * therefore cannot live in a different file.
 */
export function CoordinatorNav({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname() ?? "/";

  if (isHidden(pathname, signedIn)) return null;

  return <NavChrome pathname={pathname} />;
}

/**
 * Nav plus the content column.
 *
 * Every coordinator page renders its own `<main className="mx-auto max-w-4xl px-6 py-12">`, and
 * those pages belong to other lanes — so the offset for the fixed sidebar has to be applied from
 * outside them. That is all this does: on `lg` and up it insets the content column by the sidebar
 * width, and the pages' own `mx-auto` then centres them inside what is left.
 *
 * On a public page, a promoter page or a signed-out visitor it renders `children` and nothing else
 * — no wrapper, no offset, no navigation — so those screens are byte-for-byte what they were.
 *
 * `children` is a server-rendered tree passed through as a prop, so marking this file `"use client"`
 * does not pull a single page component into the client bundle.
 */
export function AppShell({
  signedIn,
  banner,
  children,
}: {
  signedIn: boolean;
  /**
   * Agency-wide chrome that belongs *inside* the shell — today just the billing banner.
   *
   * It is a separate prop rather than another child because "is this an agency screen" is a
   * question only this file can answer, and the answer has to gate the banner too. Passed as a
   * child it rendered on `/i/[token]`: a signed-in coordinator opening their own invitation link
   * to check it showed the promoter a payment warning addressed to the agency. Anything routed
   * through `banner` disappears on the public, `/login` and promoter-token pages along with the
   * navigation. Optional, so the original `{ signedIn, children }` call still compiles.
   */
  banner?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "/";

  if (isHidden(pathname, signedIn)) return <>{children}</>;

  return (
    <div className="min-h-screen lg:pl-[var(--shell-sidebar-w)]">
      {/* The coordinator screens are keyboard-heavy and the sidebar is five tab stops in front of
          every one of them. The pages themselves cannot carry the target — they belong to other
          lanes — so the wrapper below provides it. */}
      <a
        href="#promoteros-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[color:var(--color-surface)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[color:var(--color-accent-ink)] focus:shadow-[var(--elevation-overlay)]"
      >
        {t("shell.skip_to_content")}
      </a>
      <NavChrome pathname={pathname} />
      <div id="promoteros-content" tabIndex={-1} className="min-w-0 focus:outline-none">
        {banner}
        {children}
      </div>
    </div>
  );
}
