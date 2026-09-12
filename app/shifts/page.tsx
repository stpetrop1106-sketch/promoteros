import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import {
  Badge,
  EmptyState,
  Icon,
  LinkButton,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui";
import { SHIFT_STATUS_BADGE, SHIFT_STATUS_KEY, type ShiftStatus } from "@/app/campaigns/_shared";

export const dynamic = "force-dynamic";

type ShiftRow = {
  id: string;
  on_date: string;
  start_time: string;
  end_time: string;
  promoters_required: number;
  status: string;
  stores: { name: string } | null;
  campaigns: { name: string } | null;
};

/**
 * "YYYY-MM-DD" → "09/09/2026", rebuilt from its own parts.
 *
 * Never through a `Date`: `new Date("2026-09-09")` parses as UTC midnight and prints the previous
 * day for anyone west of Greenwich. The value is already an Athens calendar date, so there is
 * nothing to convert — only to reformat. Same reasoning as `app/dashboard/page.tsx`.
 */
function formatDateString(onDate: string): string {
  const [y, m, d] = onDate.split("-");
  return `${d}/${m}/${y}`;
}

export default async function ShiftsPage() {
  const t = translatorFor(DEFAULT_LOCALE);
  await requireUser();
  const db = await createServerSupabase();

  // No `where agency_id = …` here on purpose. The RLS policy from 0002 supplies it, so a bug in
  // this file cannot widen the query beyond the coordinator's own agency.
  const { data, error } = await db
    .from("shifts")
    .select(
      "id, on_date, start_time, end_time, promoters_required, status, stores(name), campaigns(name)",
    )
    .order("on_date", { ascending: true })
    .limit(50);

  if (error) throw new Error(error.message);
  const shifts = (data ?? []) as unknown as ShiftRow[];

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 sm:py-12">
      <div className="flex flex-col gap-6">
        <PageHeader
          title={t("shifts.title")}
          subtitle={shifts.length > 0 ? t("shifts.list.subtitle", { count: shifts.length }) : undefined}
          icon={<Icon name="calendar" size={20} />}
        />

        {shifts.length === 0 ? (
          /* A new agency has no shifts because it has no campaign yet — shifts are created inside
             one. Saying where they come from is more use than saying there are none. */
          <EmptyState
            icon={<Icon name="calendar" size={24} />}
            title={t("shifts.empty.title")}
            description={t("shifts.empty.body")}
            action={<LinkButton href="/campaigns/new">{t("shifts.empty.cta")}</LinkButton>}
          />
        ) : (
          <Table label={t("shifts.title")}>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t("shifts.date")}</TableHeaderCell>
                <TableHeaderCell>{t("shifts.campaign")}</TableHeaderCell>
                <TableHeaderCell>{t("shifts.store")}</TableHeaderCell>
                {/* Numbers right, text left — so the column reads as a column of numbers and not
                    as a ragged list of digits. */}
                <TableHeaderCell className="text-right">{t("shifts.needed")}</TableHeaderCell>
                <TableHeaderCell>{t("campaigns.list.col_status")}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {shifts.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    {/* The date is the row's identity and its link. Time drops to a second line
                        in the muted tone: two facts, one of which the eye needs first. */}
                    <Link
                      href={`/shifts/${s.id}`}
                      className="rounded-sm font-medium text-[color:var(--color-accent)] hover:underline focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
                    >
                      {formatDateString(s.on_date)}
                    </Link>
                    <span className="mt-0.5 block text-xs tabular-nums text-[color:var(--color-muted)]">
                      {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                    </span>
                  </TableCell>
                  <TableCell className="text-[color:var(--color-ink)]">
                    {s.campaigns?.name ?? "—"}
                  </TableCell>
                  <TableCell>{s.stores?.name ?? "—"}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-[color:var(--color-ink)]">
                    {s.promoters_required}
                  </TableCell>
                  <TableCell>
                    <Badge variant={SHIFT_STATUS_BADGE[s.status as ShiftStatus] ?? "neutral"} dot>
                      {t(SHIFT_STATUS_KEY[s.status as ShiftStatus] ?? "campaigns.shift_status.open")}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </main>
  );
}
