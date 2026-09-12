import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { Badge, EmptyState, Icon, PageHeader, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui";
import { LinkButton } from "@/app/campaigns/link-button";
import { CAMPAIGN_STATUS_BADGE, CAMPAIGN_STATUS_KEY, formatDateRange, type CampaignStatus } from "@/app/campaigns/_shared";

export const dynamic = "force-dynamic";

type CampaignListRow = {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  status: CampaignStatus;
  clients: { name: string } | null;
  shifts: { id: string; promoters_required: number; assignments: { id: string; status: string }[] }[];
};

function coverageOf(shifts: CampaignListRow["shifts"]): { filled: number; required: number } {
  let filled = 0;
  let required = 0;
  for (const shift of shifts) {
    required += shift.promoters_required;
    const confirmed = shift.assignments.filter((a) => a.status === "confirmed").length;
    filled += Math.min(confirmed, shift.promoters_required);
  }
  return { filled, required };
}

export default async function CampaignsPage() {
  const t = translatorFor(DEFAULT_LOCALE);
  await requireUser();
  const db = await createServerSupabase();

  // No `where agency_id = …` here on purpose — RLS from 0002 supplies it.
  const { data, error } = await db
    .from("campaigns")
    .select(
      "id, name, starts_on, ends_on, status, clients(name), shifts(id, promoters_required, assignments(id, status))",
    )
    .order("starts_on", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  const campaigns = (data ?? []) as unknown as CampaignListRow[];

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 sm:py-12">
      <div className="flex flex-col gap-6">
        {/* The "signed in as … / sign out" line used to sit HERE, above the title, so the first
            thing on the screen was an email address. It now lives at the foot of the sidebar with
            the rest of the account chrome — `components/account-row.tsx`. */}
        <PageHeader
          title={t("campaigns.list.title")}
          subtitle={t("campaigns.list.subtitle")}
          icon={<Icon name="megaphone" size={20} />}
          actions={
            <LinkButton href="/campaigns/new" iconLeft={<Icon name="plus" size={16} />}>
              {t("campaigns.list.new_button")}
            </LinkButton>
          }
        />

        {campaigns.length === 0 ? (
          <EmptyState
            icon={<Icon name="megaphone" size={24} />}
            title={t("campaigns.list.empty_title")}
            description={t("campaigns.list.empty_body")}
            action={
              <LinkButton href="/campaigns/new" iconLeft={<Icon name="plus" size={16} />}>
                {t("campaigns.list.new_button")}
              </LinkButton>
            }
          />
        ) : (
          <Table label={t("campaigns.list.title")}>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t("campaigns.list.col_name")}</TableHeaderCell>
                <TableHeaderCell>{t("campaigns.list.col_client")}</TableHeaderCell>
                <TableHeaderCell>{t("campaigns.list.col_dates")}</TableHeaderCell>
                <TableHeaderCell className="text-right">
                  {t("campaigns.list.col_shifts")}
                </TableHeaderCell>
                <TableHeaderCell className="text-right">
                  {t("campaigns.list.col_coverage")}
                </TableHeaderCell>
                {/* Status last and right-aligned: it is the column the eye returns to, and a
                    ragged pill column in the middle of the table is the thing that makes a list
                    of twenty rows read as noise. */}
                <TableHeaderCell className="text-right">
                  {t("campaigns.list.col_status")}
                </TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {campaigns.map((c) => {
                const { filled, required } = coverageOf(c.shifts);
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link
                        href={`/campaigns/${c.id}`}
                        className="rounded-sm font-medium text-[color:var(--color-ink)] hover:text-[color:var(--color-accent)] hover:underline focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
                      >
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell>{c.clients?.name ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {formatDateRange(c.starts_on, c.ends_on)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t("campaigns.list.shift_count", { count: c.shifts.length })}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {required === 0 ? (
                        <span className="text-[color:var(--color-muted-soft)]">—</span>
                      ) : (
                        t("shift.coverage", { filled, required })
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={CAMPAIGN_STATUS_BADGE[c.status]} dot>
                        {t(CAMPAIGN_STATUS_KEY[c.status])}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </main>
  );
}
