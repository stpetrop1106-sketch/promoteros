import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { signOut } from "@/app/login/actions";

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

export default async function ShiftsPage() {
  const t = translatorFor(DEFAULT_LOCALE);
  const user = await requireUser();
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
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">{t("shifts.title")}</h1>
        <div className="flex items-baseline gap-3 text-sm text-[color:var(--color-muted)]">
          <span>{t("auth.signed_in_as", { email: user.email })}</span>
          <form action={signOut}>
            <button type="submit" className="hover:underline">
              {t("auth.sign_out")}
            </button>
          </form>
        </div>
      </div>

      {shifts.length === 0 ? (
        <p className="mt-6 text-sm text-[color:var(--color-muted)]">{t("shifts.none")}</p>
      ) : (
        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[color:var(--color-line)] text-left text-[color:var(--color-muted)]">
              <th className="py-2 font-medium">{t("shifts.date")}</th>
              <th className="py-2 font-medium">{t("shifts.campaign")}</th>
              <th className="py-2 font-medium">{t("shifts.store")}</th>
              <th className="py-2 font-medium">{t("shifts.needed")}</th>
            </tr>
          </thead>
          <tbody>
            {shifts.map((s) => (
              <tr key={s.id} className="border-b border-[color:var(--color-line)]">
                <td className="py-2">
                  <Link
                    href={`/shifts/${s.id}`}
                    className="text-[color:var(--color-accent)] hover:underline"
                  >
                    {s.on_date} · {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                  </Link>
                </td>
                <td className="py-2">{s.campaigns?.name ?? "—"}</td>
                <td className="py-2">{s.stores?.name ?? "—"}</td>
                <td className="py-2">{s.promoters_required}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
