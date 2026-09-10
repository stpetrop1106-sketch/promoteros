import type { Metadata } from "next";
import { authState } from "@/lib/auth";
import { getEntitlement } from "@/lib/billing/subscription";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { GlobalBillingBanner } from "./onboarding/global-billing-banner";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "PromoterOS",
    template: "%s | PromoterOS",
  },
  description: "Operations for promotion agencies: staffing, scheduling and field reporting.",
  icons: {
    icon: "/promoteros-mark.svg",
  },
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
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const state = await authState();
  const entitlement = state.ok ? await getEntitlement(state.user.agencyId) : null;

  return (
    <html lang={DEFAULT_LOCALE}>
      <body className="min-h-screen antialiased">
        {entitlement ? (
          <GlobalBillingBanner
            notice={entitlement.notice}
            access={entitlement.access}
            graceDaysRemaining={entitlement.graceDaysRemaining}
            trialDaysRemaining={entitlement.trialDaysRemaining}
          />
        ) : null}
        {children}
      </body>
    </html>
  );
}
