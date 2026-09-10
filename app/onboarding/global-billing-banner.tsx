"use client";

import { usePathname } from "next/navigation";
import { BillingBanner, type BillingBannerProps } from "@/components/billing-banner";

/**
 * The root layout's copy of the billing banner (P25 — see docs/status/P25.md for the full
 * reasoning). It lives in `app/onboarding/**` rather than under `components/` because that is
 * the only directory in this parcel's file scope that isn't a route file itself: Next.js only
 * treats `page.tsx`/`layout.tsx`/etc. as route-defining, so an ordinary `.tsx` module in this
 * folder is just importable code, exactly like any file under `components/` would be — it does
 * not add a `/onboarding/global-billing-banner` route.
 *
 * Why this needs to be a Client Component when `app/layout.tsx` stays a server component:
 * `app/settings/page.tsx` (P22) already renders `<BillingBanner>` directly, so the root layout's
 * copy has to suppress itself on `/settings/**` or a coordinator would see the same notice
 * twice. The App Router has no supported way for a Server Component layout to read the current
 * pathname (that requires either a `usePathname()` Client Component, which this is, or a custom
 * header injected by `middleware.ts` — which is P22's file, not mine). Keeping the pathname check
 * in this one small leaf, rather than in `app/layout.tsx` itself, is what lets the root layout
 * stay a server component as required.
 */
export function GlobalBillingBanner(props: BillingBannerProps) {
  const pathname = usePathname();
  const onSettings = pathname === "/settings" || pathname?.startsWith("/settings/");
  if (onSettings) return null;

  return (
    <div className="mx-auto max-w-6xl px-6 pt-4">
      <BillingBanner {...props} />
    </div>
  );
}
