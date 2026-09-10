import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/admin/guard";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";

export const metadata: Metadata = { title: "PromoterOS admin" };

// This layout queries `platform_admins`, so nothing under /admin can be prerendered. Without
// this, `next build` tried to statically generate /admin, ran the guard with no request and no
// database, and failed the whole production build.
export const dynamic = "force-dynamic";

const t = translatorFor(DEFAULT_LOCALE);

/**
 * Guards the whole `/admin` segment. `requirePlatformAdmin()` 404s anyone who is not in
 * `platform_admins` — including a signed-in agency owner — before any child page or action runs.
 *
 * Not matched by `middleware.ts` (that file belongs to Lane A/P1) — see docs/status/P18.md
 * "Requests to other lanes" for what that means in practice and what is requested instead.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requirePlatformAdmin();

  return (
    <div className="min-h-screen bg-[color:var(--color-canvas)]">
      <header className="border-b border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-6 py-3">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-6">
            <span className="text-sm font-semibold text-[color:var(--color-ink)]">
              {t("admin.title")}
            </span>
            <nav className="flex gap-4 text-sm">
              <Link
                href="/admin/agencies"
                className="text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)]"
              >
                {t("admin.nav.agencies")}
              </Link>
              <Link
                href="/admin/audit"
                className="text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)]"
              >
                {t("admin.nav.audit")}
              </Link>
              <Link
                href="/admin/waitlist"
                className="text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)]"
              >
                {t("admin.nav.waitlist")}
              </Link>
            </nav>
          </div>
          <span className="text-xs text-[color:var(--color-muted)]">
            {t("admin.subtitle", { name: admin.fullName })}
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
