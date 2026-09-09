import type { Metadata } from "next";
import { waitlistStats, waitlistRecent } from "@/lib/admin/waitlist";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import {
  PageHeader,
  Card,
  EmptyState,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "PromoterOS admin" };

const t = translatorFor(DEFAULT_LOCALE);

function formatWhen(value: string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));
}

/**
 * `waitlist_signups` — product leads, not tenant data. Read-only, no reason, no audit row
 * (commercial-architecture.md §5's waitlist bullet).
 */
export default async function AdminWaitlistPage() {
  const [stats, recent] = await Promise.all([waitlistStats(), waitlistRecent(50)]);

  return (
    <>
      <PageHeader title={t("admin.waitlist.title")} subtitle={t("admin.waitlist.subtitle")} />

      {!stats || stats.total === 0 ? (
        <div className="mt-6">
          <EmptyState title={t("admin.waitlist.empty_title")} />
        </div>
      ) : (
        <>
          <p className="mt-4 text-sm text-[color:var(--color-muted)]">
            {t("admin.waitlist.total", { count: stats.total })}
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Card
              header={
                <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">
                  {t("admin.waitlist.by_size_title")}
                </h2>
              }
            >
              <ul className="flex flex-col divide-y divide-[color:var(--color-line)]">
                {stats.byPromoterCount.map((row) => (
                  <li
                    key={row.promoterCount}
                    className="flex items-center justify-between py-2 text-sm first:pt-0 last:pb-0"
                  >
                    <span className="text-[color:var(--color-ink)]">{row.promoterCount}</span>
                    <span className="font-semibold text-[color:var(--color-ink)]">{row.count}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card
              header={
                <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">
                  {t("admin.waitlist.by_source_title")}
                </h2>
              }
            >
              <ul className="flex flex-col divide-y divide-[color:var(--color-line)]">
                {stats.byUtmSource.map((row) => (
                  <li
                    key={row.utmSource ?? "none"}
                    className="flex items-center justify-between py-2 text-sm first:pt-0 last:pb-0"
                  >
                    <span className="text-[color:var(--color-ink)]">
                      {row.utmSource ?? t("admin.waitlist.unknown_source")}
                    </span>
                    <span className="font-semibold text-[color:var(--color-ink)]">{row.count}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="mt-6">
            <h2 className="mb-2 text-sm font-semibold text-[color:var(--color-ink)]">
              {t("admin.waitlist.recent_title")}
            </h2>
            {recent.length === 0 ? (
              <EmptyState title={t("admin.waitlist.empty_title")} />
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>{t("admin.waitlist.col.name")}</TableHeaderCell>
                    <TableHeaderCell>{t("admin.waitlist.col.email")}</TableHeaderCell>
                    <TableHeaderCell>{t("admin.waitlist.col.company")}</TableHeaderCell>
                    <TableHeaderCell>{t("admin.waitlist.col.size")}</TableHeaderCell>
                    <TableHeaderCell>{t("admin.waitlist.col.source")}</TableHeaderCell>
                    <TableHeaderCell>{t("admin.waitlist.col.when")}</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recent.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.fullName}</TableCell>
                      <TableCell>{row.workEmail}</TableCell>
                      <TableCell>{row.companyName}</TableCell>
                      <TableCell>{row.promoterCount}</TableCell>
                      <TableCell>{row.utmSource ?? t("admin.waitlist.unknown_source")}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatWhen(row.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </>
      )}
    </>
  );
}
