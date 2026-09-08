import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { Badge, Card, PageHeader, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui";
import { LinkButton } from "@/app/campaigns/link-button";
import {
  CAMPAIGN_STATUS_BADGE,
  CAMPAIGN_STATUS_KEY,
  SHIFT_STATUS_BADGE,
  SHIFT_STATUS_KEY,
  formatCents,
  formatDateRange,
  timeLabel,
  type CampaignStatus,
  type ShiftStatus,
} from "@/app/campaigns/_shared";
import { setCampaignStatus } from "./actions";
import { CancelCampaignForm } from "./cancel-campaign-form";

export const dynamic = "force-dynamic";

type CampaignRow = {
  id: string;
  name: string;
  campaign_type: string | null;
  starts_on: string;
  ends_on: string;
  dress_code: string | null;
  rate_cents: number;
  status: CampaignStatus;
  clients: { name: string } | null;
};

type BriefRow = {
  id: string;
  title: string;
  published_at: string | null;
};

type ShiftRow = {
  id: string;
  on_date: string;
  start_time: string;
  end_time: string;
  promoters_required: number;
  status: ShiftStatus;
  stores: { name: string } | null;
  assignments: { id: string; status: string }[];
};

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = translatorFor(DEFAULT_LOCALE);
  await requireUser();
  const db = await createServerSupabase();

  // Scoped by RLS: a campaign belonging to another agency returns no row and this page 404s.
  const { data: campaign } = await db
    .from("campaigns")
    .select("id, name, campaign_type, starts_on, ends_on, dress_code, rate_cents, status, clients(name)")
    .eq("id", id)
    .maybeSingle();

  if (!campaign) notFound();
  const c = campaign as unknown as CampaignRow;

  const [{ data: briefRows }, { data: shiftRows }] = await Promise.all([
    db
      .from("briefs")
      .select("id, title, published_at")
      .eq("campaign_id", id)
      .order("version", { ascending: false })
      .limit(1),
    db
      .from("shifts")
      .select("id, on_date, start_time, end_time, promoters_required, status, stores(name), assignments(id, status)")
      .eq("campaign_id", id)
      .order("on_date", { ascending: true }),
  ]);

  const brief = ((briefRows ?? [])[0] ?? null) as unknown as BriefRow | null;
  const shifts = (shiftRows ?? []) as unknown as ShiftRow[];

  const storeNames = Array.from(new Set(shifts.map((s) => s.stores?.name).filter((n): n is string => Boolean(n))));

  let totalFilled = 0;
  let totalRequired = 0;
  for (const shift of shifts) {
    totalRequired += shift.promoters_required;
    const confirmed = shift.assignments.filter((a) => a.status === "confirmed").length;
    totalFilled += Math.min(confirmed, shift.promoters_required);
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link href="/campaigns" className="text-sm text-[color:var(--color-accent)] hover:underline">
        {t("campaigns.detail.back")}
      </Link>

      <PageHeader
        className="mt-4"
        title={c.name}
        subtitle={[c.clients?.name, c.campaign_type].filter(Boolean).join(" · ")}
        actions={
          <LinkButton href={`/campaigns/${id}/shifts/new`}>{t("campaigns.detail.add_shifts")}</LinkButton>
        }
      />

      <div className="mt-8 flex flex-col gap-6">
        <Card header={<h2 className="text-base font-semibold">{t("campaigns.detail.overview_title")}</h2>}>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-muted)]">
                {t("campaigns.detail.dates_label")}
              </dt>
              <dd className="mt-1 text-sm text-[color:var(--color-ink)]">{formatDateRange(c.starts_on, c.ends_on)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-muted)]">
                {t("campaigns.detail.status_label")}
              </dt>
              <dd className="mt-1">
                <Badge variant={CAMPAIGN_STATUS_BADGE[c.status]}>{t(CAMPAIGN_STATUS_KEY[c.status])}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-muted)]">
                {t("campaigns.detail.rate_label")}
              </dt>
              <dd className="mt-1 text-sm text-[color:var(--color-ink)]">{formatCents(c.rate_cents)} €</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-muted)]">
                {t("campaigns.detail.dress_code_label")}
              </dt>
              <dd className="mt-1 text-sm text-[color:var(--color-ink)]">{c.dress_code ?? "—"}</dd>
            </div>
          </dl>
        </Card>

        <Card header={<h2 className="text-base font-semibold">{t("campaigns.detail.brief_title")}</h2>}>
          {brief ? (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-[color:var(--color-ink)]">{brief.title}</p>
                <p className="mt-1 text-xs text-[color:var(--color-muted)]">
                  {brief.published_at ? t("campaigns.detail.brief_published") : t("campaigns.detail.brief_draft")}
                </p>
              </div>
              <LinkButton href={`/campaigns/${id}/brief`} variant="secondary" size="sm">
                {t("campaigns.detail.brief_edit")}
              </LinkButton>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-[color:var(--color-muted)]">{t("campaigns.detail.brief_none")}</p>
              <LinkButton href={`/campaigns/${id}/brief`} variant="secondary" size="sm">
                {t("campaigns.detail.brief_write")}
              </LinkButton>
            </div>
          )}
        </Card>

        <Card header={<h2 className="text-base font-semibold">{t("campaigns.detail.stores_title")}</h2>}>
          {storeNames.length === 0 ? (
            <p className="text-sm text-[color:var(--color-muted)]">{t("campaigns.detail.stores_none")}</p>
          ) : (
            <p className="text-sm text-[color:var(--color-ink)]">{storeNames.join(" · ")}</p>
          )}
        </Card>

        <Card
          header={
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold">{t("campaigns.detail.shifts_title")}</h2>
              {shifts.length > 0 ? (
                <span className="text-sm text-[color:var(--color-muted)]">
                  {t("shift.coverage", { filled: totalFilled, required: totalRequired })}
                </span>
              ) : null}
            </div>
          }
        >
          {shifts.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-sm font-semibold text-[color:var(--color-ink)]">
                {t("campaigns.detail.shifts_none_title")}
              </p>
              <p className="max-w-sm text-sm text-[color:var(--color-muted)]">
                {t("campaigns.detail.shifts_none_body")}
              </p>
              <LinkButton href={`/campaigns/${id}/shifts/new`} size="sm">
                {t("campaigns.detail.add_shifts")}
              </LinkButton>
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>{t("shifts.date")}</TableHeaderCell>
                  <TableHeaderCell>{t("shifts.store")}</TableHeaderCell>
                  <TableHeaderCell>{t("shifts.needed")}</TableHeaderCell>
                  <TableHeaderCell>{t("campaigns.detail.col_coverage")}</TableHeaderCell>
                  <TableHeaderCell>{t("campaigns.list.col_status")}</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {shifts.map((shift) => {
                  const confirmed = shift.assignments.filter((a) => a.status === "confirmed").length;
                  return (
                    <TableRow key={shift.id}>
                      <TableCell>
                        <Link
                          href={`/shifts/${shift.id}`}
                          className="text-[color:var(--color-accent)] hover:underline"
                        >
                          {shift.on_date} · {timeLabel(shift.start_time)}–{timeLabel(shift.end_time)}
                        </Link>
                      </TableCell>
                      <TableCell>{shift.stores?.name ?? "—"}</TableCell>
                      <TableCell>{shift.promoters_required}</TableCell>
                      <TableCell>
                        {t("shift.coverage", {
                          filled: Math.min(confirmed, shift.promoters_required),
                          required: shift.promoters_required,
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={SHIFT_STATUS_BADGE[shift.status]}>{t(SHIFT_STATUS_KEY[shift.status])}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>

        {(c.status === "draft" || c.status === "active") && (
          <Card header={<h2 className="text-base font-semibold">{t("campaigns.detail.status_title")}</h2>}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-3">
                {c.status === "draft" ? (
                  <form action={setCampaignStatus.bind(null, id, "active")}>
                    <button
                      type="submit"
                      className="inline-flex h-8 items-center rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3 text-sm font-semibold text-[color:var(--color-ink)] hover:bg-[color:var(--color-canvas)]"
                    >
                      {t("campaigns.detail.mark_active")}
                    </button>
                  </form>
                ) : null}
                {c.status === "active" ? (
                  <form action={setCampaignStatus.bind(null, id, "completed")}>
                    <button
                      type="submit"
                      className="inline-flex h-8 items-center rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3 text-sm font-semibold text-[color:var(--color-ink)] hover:bg-[color:var(--color-canvas)]"
                    >
                      {t("campaigns.detail.mark_completed")}
                    </button>
                  </form>
                ) : null}
              </div>

              <CancelCampaignForm
                action={setCampaignStatus.bind(null, id, "cancelled")}
                label={t("campaigns.detail.cancel")}
                confirmText={t("campaigns.detail.cancel_confirm", { name: c.name })}
              />
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}
