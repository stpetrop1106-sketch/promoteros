import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { PromoterPrivacyNotice } from "./notice";

export const dynamic = "force-dynamic";

/**
 * The unparameterised promoter privacy notice.
 *
 * Nobody is *sent* here any more — the link at the foot of `/i`, `/c` and `/a` now points at a
 * token-scoped route that resolves the promoter's own controller (see `lib/promoter-controller.ts`).
 * This route survives for the two people who still reach it:
 *
 *  - **an owner or coordinator**, who is told in `/settings/agency` that this is the notice their
 *    promoters read, and who therefore gets their OWN agency's copy; and
 *  - **someone with a bookmark from when there was one agency**, who gets that agency's copy while
 *    it is still the only one.
 *
 * When neither holds — no session, and more than one agency — there is genuinely no controller to
 * name, and naming the wrong one would be a cross-tenant leak (CLAUDE.md §4). That is a 404 rather
 * than the 500 it used to be: the notice for an unidentified promoter does not exist, and a crash
 * in the logs would suggest something is broken when the right answer is "use your own link".
 */
export default async function PromoterPrivacyPage() {
  const user = await currentUser();
  if (user) return <PromoterPrivacyNotice agencyId={user.agencyId} />;

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { data } = await createAdminClient().from("agencies").select("id").limit(2);
  if ((data ?? []).length !== 1) notFound();

  return <PromoterPrivacyNotice agencyId={String(data![0]!.id)} />;
}
