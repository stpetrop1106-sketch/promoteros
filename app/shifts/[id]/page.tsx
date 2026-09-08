import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { matchPromoters, topReasons, type MatchFactor } from "@/lib/matching";
import { translatorFor, DEFAULT_LOCALE, type TranslationKey } from "@/lib/i18n";
import { InviteButton } from "./invite-button";

export const dynamic = "force-dynamic";

const factorKey = (f: MatchFactor) => `match.factor.${f}` as TranslationKey;

export default async function ShiftDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = translatorFor(DEFAULT_LOCALE);
  await requireUser();
  const db = await createServerSupabase();

  // Scoped by RLS: a shift belonging to another agency returns no row and this page 404s,
  // which is also the right answer to give — it does not confirm the id exists.
  const { data: shift } = await db
    .from("shifts")
    .select(
      "id, on_date, start_time, end_time, promoters_required, stores(name, address), campaigns(name, dress_code)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!shift) notFound();

  const store = shift.stores as unknown as { name: string; address: string } | null;
  const campaign = shift.campaigns as unknown as { name: string } | null;

  // The shift id above was proved to belong to this agency by RLS, and `match_promoters` only
  // ever considers promoters with the shift's own `agency_id`, so this cannot cross a tenant
  // boundary. It is still the last call on a coordinator path reaching the service role —
  // `lib/matching` is another lane's file. See "Requests to other lanes" in docs/status/P1.md.
  const candidates = await matchPromoters(id);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="border-b border-[color:var(--color-line)] pb-6">
        <h1 className="text-xl font-semibold tracking-tight">{campaign?.name ?? "—"}</h1>
        <p className="mt-1 text-sm text-[color:var(--color-muted)]">
          {store?.name} · {shift.on_date} · {String(shift.start_time).slice(0, 5)}–
          {String(shift.end_time).slice(0, 5)} · {shift.promoters_required}{" "}
          {t("shifts.needed").toLowerCase()}
        </p>
      </header>

      <h2 className="mt-8 text-base font-medium">{t("match.title")}</h2>

      {candidates.length === 0 ? (
        <p className="mt-4 text-sm text-[color:var(--color-muted)]">{t("match.none")}</p>
      ) : (
        <ul className="mt-4 divide-y divide-[color:var(--color-line)]">
          {candidates.map((c, i) => (
            <li key={c.promoterId} className="flex items-start gap-4 py-4">
              <span className="w-6 pt-1 text-sm text-[color:var(--color-muted)]">
                {i + 1}
              </span>

              <div className="flex-1">
                <div className="flex items-baseline gap-3">
                  <span className="font-medium">{c.fullName}</span>
                  <span className="text-sm text-[color:var(--color-muted)]">
                    {t("common.km_away", { km: (c.distanceM / 1000).toFixed(1) })}
                  </span>
                  {c.hasCar && (
                    <span className="text-xs text-[color:var(--color-muted)]">
                      {t("match.has_car")}
                    </span>
                  )}
                </div>

                {/* The reasons, not just the number — a coordinator overrides on reasons. */}
                <p className="mt-1 text-sm text-[color:var(--color-muted)]">
                  {topReasons(c)
                    .map((f) => t(factorKey(f)))
                    .join(" · ")}
                </p>

                <div className="mt-2 h-1 w-48 rounded bg-[color:var(--color-line)]">
                  <div
                    className="h-1 rounded bg-[color:var(--color-accent)]"
                    style={{ width: `${Math.round(c.score * 100)}%` }}
                  />
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm font-medium">{Math.round(c.score * 100)}%</div>
                <InviteButton
                  shiftId={id}
                  promoterId={c.promoterId}
                  label={t("match.invite")}
                  copyLabel={t("common.copy")}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
