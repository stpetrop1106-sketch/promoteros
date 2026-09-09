import type { Metadata } from "next";
import { listAgencies } from "@/lib/admin/agencies";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { PageHeader, EmptyState } from "@/components/ui";
import { AgencyTable } from "./agency-table";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "PromoterOS admin" };

const t = translatorFor(DEFAULT_LOCALE);

/**
 * Every agency, with usage counts. Read-only, no reason required — this is exactly the
 * "aggregates, not contents" case commercial-architecture.md §5 always allows.
 *
 * The guard already ran in `app/admin/layout.tsx`; this page does not re-check admin
 * membership, but every server action reached from it does (see agency-table.tsx and
 * `[id]/actions.ts`), because a server action is its own public endpoint.
 */
export default async function AdminAgenciesPage() {
  const agencies = await listAgencies();

  return (
    <>
      <PageHeader title={t("admin.agencies.title")} subtitle={t("admin.agencies.subtitle")} />

      <div className="mt-6">
        {agencies.length === 0 ? (
          <EmptyState
            title={t("admin.agencies.empty_title")}
            description={t("admin.agencies.empty_body")}
          />
        ) : (
          <AgencyTable agencies={agencies} />
        )}
      </div>
    </>
  );
}
