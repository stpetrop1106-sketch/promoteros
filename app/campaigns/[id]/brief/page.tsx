import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  Icon,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui";
import { loadBriefRoster, type BriefAckPromoter } from "@/lib/briefs";
import { BriefForm } from "./brief-form";

export const dynamic = "force-dynamic";

/** Mirrors `app/campaigns/[id]/report/page.tsx`'s `formatInstant`. */
function formatInstant(iso: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return "—";
  return new Intl.DateTimeFormat("el-GR", {
    timeZone: "Europe/Athens",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(parsed));
}

/** One column table of promoter names, optionally with the date each acknowledged the brief. */
function PromoterTable({
  t,
  rows,
  showDate,
}: {
  t: ReturnType<typeof translatorFor>;
  rows: BriefAckPromoter[];
  showDate: boolean;
}) {
  return (
    <Table label={t("campaigns.brief.roster.title")}>
      <TableHead>
        <TableRow>
          <TableHeaderCell>{t("campaigns.brief.roster.column.promoter")}</TableHeaderCell>
          {showDate && (
            <TableHeaderCell>{t("campaigns.brief.roster.column.acknowledged_at")}</TableHeaderCell>
          )}
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.promoterId}>
            <TableCell className="font-medium text-[color:var(--color-ink)]">
              <div className="flex items-center gap-2.5">
                <Avatar name={row.promoterName} size="sm" />
                {row.promoterName}
              </div>
            </TableCell>
            {showDate && (
              <TableCell>{row.acknowledgedAt ? formatInstant(row.acknowledgedAt) : "—"}</TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default async function CampaignBriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = translatorFor(DEFAULT_LOCALE);
  await requireUser();
  const db = await createServerSupabase();

  const { data: campaign } = await db.from("campaigns").select("id, name").eq("id", id).maybeSingle();
  if (!campaign) notFound();

  const { data: brief } = await db
    .from("briefs")
    .select("title, body_md")
    .eq("campaign_id", id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const roster = await loadBriefRoster(db, id);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10 sm:py-12">
      <div className="flex flex-col gap-8">
        <PageHeader
          eyebrow={
            <Link
              href={`/campaigns/${id}`}
              className="inline-flex items-center gap-1 rounded-sm hover:text-[color:var(--color-ink)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
            >
              <Icon name="chevronLeft" size={14} />
              {campaign.name}
            </Link>
          }
          title={t("campaigns.brief.title")}
          subtitle={t("campaigns.brief.subtitle", { campaign: campaign.name })}
        />

        <Card elevation="raised">
          <BriefForm
            campaignId={id}
            initialTitle={brief?.title ?? t("campaigns.brief.default_title", { campaign: campaign.name })}
            initialBody={brief?.body_md ?? ""}
          />
        </Card>

        {roster.kind !== "no_brief" && (
          <Card header={<h2 className="text-sm font-semibold text-[color:var(--color-ink)]">{t("campaigns.brief.roster.title")}</h2>}>
            {roster.kind === "not_published" ? (
              <p className="text-sm text-[color:var(--color-muted)]">
                {t("campaigns.brief.roster.not_published")}
              </p>
            ) : roster.kind === "no_staff" ? (
              <p className="text-sm text-[color:var(--color-muted)]">
                {t("campaigns.brief.roster.no_staff")}
              </p>
            ) : (
              <div className="flex flex-col gap-6">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant={roster.pending.length > 0 ? "bad" : "ok"} size="sm" dot>
                      {roster.pending.length}
                    </Badge>
                    <h3 className="text-sm font-semibold text-[color:var(--color-ink)]">
                      {t("campaigns.brief.roster.pending_title")}
                    </h3>
                  </div>
                  <div className="mt-3">
                    {roster.pending.length === 0 ? (
                      <EmptyState bare title={t("campaigns.brief.roster.empty_pending")} />
                    ) : (
                      <PromoterTable t={t} rows={roster.pending} showDate={false} />
                    )}
                  </div>
                </div>

                <div className="border-t border-[color:var(--color-line)] pt-6">
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral" size="sm" dot>
                      {roster.acknowledged.length}
                    </Badge>
                    <h3 className="text-sm font-semibold text-[color:var(--color-ink)]">
                      {t("campaigns.brief.roster.acknowledged_title")}
                    </h3>
                  </div>
                  <div className="mt-3">
                    {roster.acknowledged.length === 0 ? (
                      <EmptyState bare title={t("campaigns.brief.roster.empty_acknowledged")} />
                    ) : (
                      <PromoterTable t={t} rows={roster.acknowledged} showDate />
                    )}
                  </div>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </main>
  );
}
