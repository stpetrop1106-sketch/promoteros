import type { Metadata } from "next";
import { queryAuditLog, listPlatformAdmins } from "@/lib/admin/audit";
import { listAgencies } from "@/lib/admin/agencies";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { PageHeader, Card, EmptyState, Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "PromoterOS admin" };

const t = translatorFor(DEFAULT_LOCALE);

function formatWhen(value: string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Filterable by admin, agency and date — and never filterable to nothing (commercial-
 * architecture.md §6). Filters are plain GET query params: the default view (no params) shows
 * every entry from every admin, including the viewer's own, and there is no filter that hides
 * an admin's own rows — only "which admin" (default: all).
 *
 * Reading this page is not itself audited: it is the platform admin's own control surface, not a
 * customer's data.
 */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const adminId = one(params.admin) || undefined;
  const agencyId = one(params.agency) || undefined;
  const from = one(params.from) || undefined;
  const to = one(params.to) || undefined;

  const [entries, admins, agencies] = await Promise.all([
    queryAuditLog({
      adminId,
      agencyId,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(to).toISOString() : undefined,
      limit: 200,
    }),
    listPlatformAdmins(),
    listAgencies(),
  ]);

  return (
    <>
      <PageHeader title={t("admin.audit.title")} subtitle={t("admin.audit.subtitle")} />

      <Card className="mt-6">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="audit-admin" className="text-sm font-medium text-[color:var(--color-ink)]">
              {t("admin.audit.filter.admin_label")}
            </label>
            <select
              id="audit-admin"
              name="admin"
              defaultValue={adminId ?? ""}
              className="h-10 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3 text-sm text-[color:var(--color-ink)]"
            >
              <option value="">{t("admin.audit.filter.admin_all")}</option>
              {admins.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.fullName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="audit-agency" className="text-sm font-medium text-[color:var(--color-ink)]">
              {t("admin.audit.filter.agency_label")}
            </label>
            <select
              id="audit-agency"
              name="agency"
              defaultValue={agencyId ?? ""}
              className="h-10 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3 text-sm text-[color:var(--color-ink)]"
            >
              <option value="">{t("admin.audit.filter.agency_all")}</option>
              {agencies.map((a) => (
                <option key={a.agencyId} value={a.agencyId}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="audit-from" className="text-sm font-medium text-[color:var(--color-ink)]">
              {t("admin.audit.filter.from_label")}
            </label>
            <input
              id="audit-from"
              type="date"
              name="from"
              defaultValue={from ?? ""}
              className="h-10 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3 text-sm text-[color:var(--color-ink)]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="audit-to" className="text-sm font-medium text-[color:var(--color-ink)]">
              {t("admin.audit.filter.to_label")}
            </label>
            <input
              id="audit-to"
              type="date"
              name="to"
              defaultValue={to ?? ""}
              className="h-10 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3 text-sm text-[color:var(--color-ink)]"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-lg bg-[color:var(--color-accent)] px-4 text-sm font-semibold text-white hover:bg-[color:var(--color-accent-hover)]"
            >
              {t("admin.audit.filter.apply")}
            </button>
            <a
              href="/admin/audit"
              className="inline-flex h-10 items-center rounded-lg border border-[color:var(--color-line)] px-4 text-sm font-semibold text-[color:var(--color-ink)] hover:bg-[color:var(--color-canvas)]"
            >
              {t("admin.audit.filter.clear")}
            </a>
          </div>
        </form>
      </Card>

      <div className="mt-6">
        {entries.length === 0 ? (
          <EmptyState title={t("admin.audit.empty_title")} description={t("admin.audit.empty_body")} />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t("admin.audit.col.when")}</TableHeaderCell>
                <TableHeaderCell>{t("admin.audit.col.admin")}</TableHeaderCell>
                <TableHeaderCell>{t("admin.audit.col.action")}</TableHeaderCell>
                <TableHeaderCell>{t("admin.audit.col.agency")}</TableHeaderCell>
                <TableHeaderCell>{t("admin.audit.col.target")}</TableHeaderCell>
                <TableHeaderCell>{t("admin.audit.col.reason")}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap">{formatWhen(entry.createdAt)}</TableCell>
                  <TableCell>{entry.adminName ?? entry.adminId}</TableCell>
                  <TableCell className="font-mono text-xs">{entry.action}</TableCell>
                  <TableCell>{entry.agencyName ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {entry.targetType ?? "—"}
                    {entry.targetId ? ` / ${entry.targetId.slice(0, 8)}` : ""}
                  </TableCell>
                  <TableCell className="max-w-xs">{entry.reason}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  );
}
