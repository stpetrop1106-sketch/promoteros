import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { signOut } from "@/app/login/actions";
import { Badge, EmptyState, PageHeader, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui";
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
  const user = await requireUser();
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
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-baseline justify-end gap-3 text-sm text-[color:var(--color-muted)]">
        <span>{t("auth.signed_in_as", { email: user.email })}</span>
        <form action={signOut}>
          <button type="submit" className="hover:underline">
            {t("auth.sign_out")}
          </button>
        </form>
      </div>

      <PageHeader
        className="mt-4"
        title={t("campaigns.list.title")}
        subtitle={t("campaigns.list.subtitle")}
        actions={<LinkButton href="/campaigns/new">{t("campaigns.list.new_button")}</LinkButton>}
      />

      {campaigns.length === 0 ? (
        <EmptyState
          className="mt-8"
          title={t("campaigns.list.empty_title")}
          description={t("campaigns.list.empty_body")}
          action={<LinkButton href="/campaigns/new">{t("campaigns.list.new_button")}</LinkButton>}
        />
      ) : (
        <Table className="mt-8">
          <TableHead>
            <TableRow>
              <TableHeaderCell>{t("campaigns.list.col_name")}</TableHeaderCell>
              <TableHeaderCell>{t("campaigns.list.col_client")}</TableHeaderCell>
              <TableHeaderCell>{t("campaigns.list.col_dates")}</TableHeaderCell>
              <TableHeaderCell>{t("campaigns.list.col_status")}</TableHeaderCell>
              <TableHeaderCell>{t("campaigns.list.col_shifts")}</TableHeaderCell>
              <TableHeaderCell>{t("campaigns.list.col_coverage")}</TableHeaderCell>
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
                      className="font-medium text-[color:var(--color-accent)] hover:underline"
                    >
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell>{c.clients?.name ?? "—"}</TableCell>
                  <TableCell>{formatDateRange(c.starts_on, c.ends_on)}</TableCell>
                  <TableCell>
                    <Badge variant={CAMPAIGN_STATUS_BADGE[c.status]}>{t(CAMPAIGN_STATUS_KEY[c.status])}</Badge>
                  </TableCell>
                  <TableCell>{t("campaigns.list.shift_count", { count: c.shifts.length })}</TableCell>
                  <TableCell>
                    {required === 0
                      ? t("campaigns.detail.shifts_none_title")
                      : t("shift.coverage", { filled, required })}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
