import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { authState } from "@/lib/auth";
import { getEntitlement } from "@/lib/billing/subscription";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { GlobalBillingBanner } from "./onboarding/global-billing-banner";
import { AppShell } from "@/components/coordinator-nav";
import "./globals.css";

/**
 * The typeface.
 *
 * `subsets` lists `greek` explicitly, and that is the point: `next/font/google`
 * fails the **build** when a requested subset does not exist for a family, so
 * Greek coverage is verified by CI rather than by somebody squinting at a
 * screenshot. A font that silently falls back for Greek — which most of the
 * fashionable ones do — would look worse than the system stack on the primary
 * market's own language.
 *
 * `display: "swap"` means a promoter on a bad 4G connection reads the shift
 * details in the fallback face immediately rather than staring at nothing.
 */
const inter = Inter({
  subsets: ["latin", "latin-ext", "greek"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "PromoterOS",
    template: "%s | PromoterOS",
  },
  description: "Operations for promotion agencies: staffing, scheduling and field reporting.",
  icons: {
    icon: "/promoteros-mark.svg",
  },
};

// Next 15 moved themeColor out of `metadata`; leaving it there logs a warning on every build.
export const viewport: Viewport = {
  themeColor: "#1646B8",
};

/**
 * The root layout wraps *everything*: the marketing landing page, `/privacy`, `/login`, and the
 * anonymous promoter-facing `/i/[token]` and `/c/[token]` pages — none of which have a signed-in
 * user or an agency. P25 (docs/status/P25.md) closes the gap P22 flagged: `<BillingBanner>` was
 * only reachable from `app/settings/page.tsx`, so a coordinator looking at `/shifts` under a
 * `past_due` or read-only agency never saw it.
 *
 * A route-group layout that wrapped only the coordinator pages (`/shifts`, `/campaigns`,
 * `/promoters`, `/settings`) would be the cleaner fix, but Next.js layouts only apply to routes
 * physically nested under them — reaching that would mean moving those four directories under a
 * new `app/(coordinator)/` group, and every one of them belongs to another lane (CLAUDE.md's
 * ownership list for this parcel explicitly rules them out). So the root layout is the only place
 * this parcel can actually reach, and the two public-page constraints below are handled here
 * instead of by not being here at all.
 *
 * `authState()` is the same check every coordinator page already calls (`lib/auth.ts`); it is
 * documented to never throw for "no session" and does a single lightweight auth check, not a
 * billing query. The expensive part — `getEntitlement()`'s three queries (agency row, seats used,
 * promoters used) — only runs once `state.ok` is true, i.e. once there is a real signed-in
 * coordinator with an agency. A stranger on the landing page, someone at `/login`, and a promoter
 * opening `/i/[token]` on their phone are all `state.ok === false`, so none of them ever reach
 * `getEntitlement()` — no entitlement lookup, no extra round trip, nothing that can throw for a
 * missing user/agency/billing row because the call simply never happens for them.
 *
 * This stays a server component. The one piece of client-only state it needs — hiding the banner
 * on `/settings`, which already renders its own copy — lives inside `<GlobalBillingBanner>`
 * instead (see that file's comment).
 */
/**
 * Never let the banner break the site.
 *
 * The reasoning above was right about *sessions* but wrong about *contexts*. `authState()` does
 * not throw for "no user" — but it does throw when the Supabase client cannot be constructed at
 * all, which is exactly what happens while Next prerenders `/_not-found` at build time: no
 * request, no cookies, and on a fresh CI machine no environment either. That took down the whole
 * production build with `Error occurred prerendering page "/_not-found"`, days after the code
 * looked correct in dev.
 *
 * So this is fail-safe by construction. Anything goes wrong — missing env, no request context, a
 * database that is down — and the layout renders no banner and the page below it still works. A
 * missing billing warning is a small loss; a marketing page or a promoter's shift link that 500s
 * because a billing lookup failed is an incident.
 */
async function loadShell() {
  try {
    const state = await authState();
    if (!state.ok) return { signedIn: false, entitlement: null };
    return { signedIn: true, entitlement: await getEntitlement(state.user.agencyId) };
  } catch {
    return { signedIn: false, entitlement: null };
  }
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { signedIn, entitlement } = await loadShell();

  return (
    <html lang={DEFAULT_LOCALE} className={inter.variable}>
      <body className="min-h-screen antialiased">
        {/*
         * `AppShell` replaced the bare `<CoordinatorNav>` in P34. It renders the same navigation
         * under the same `signedIn` guard, and additionally owns the content offset for the fixed
         * sidebar — which has to be applied from out here, because every coordinator page renders
         * its own `<main className="mx-auto …">` and those pages belong to other lanes.
         *
         * On a public page, a promoter's token page or for a signed-out visitor it renders its
         * children and nothing else, so the landing page, `/login` and `/i/[token]` keep exactly
         * the markup they had.
         *
         * The banner goes *inside* the shell so it lands in the content column rather than under
         * the sidebar. Nothing about `loadShell()` above changed: it is still the fail-safe that
         * keeps a billing lookup from taking down the marketing page.
         */}
        <AppShell signedIn={signedIn}>
          {entitlement ? (
            <GlobalBillingBanner
              notice={entitlement.notice}
              access={entitlement.access}
              graceDaysRemaining={entitlement.graceDaysRemaining}
              trialDaysRemaining={entitlement.trialDaysRemaining}
            />
          ) : null}
          {children}
        </AppShell>
      </body>
    </html>
  );
}
