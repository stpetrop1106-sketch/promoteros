import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTokenSignature } from "@/lib/tokens";
import { verifyAvailabilityToken } from "@/lib/availability-links";

/**
 * Which agency is the data controller for the promoter holding THIS link.
 *
 * `/privacy/promoters` used to answer that question with "the only row in `agencies`", and threw
 * the moment a second one existed — which is to say, the moment we sold the product twice. That
 * was deliberate (a shared notice cannot name two controllers) but it made the promoter's privacy
 * notice a blocker on our own second customer: the link sits at the foot of `/i`, `/c` and `/a`,
 * so every promoter of *both* agencies would have hit a 500 (audit A2, finding 2).
 *
 * The fix is not a query parameter. `?agency=<slug>` would let anyone walk the list of our
 * customers by guessing, which is exactly the cross-tenant leak CLAUDE.md §4 forbids. The promoter
 * already holds a signed, purpose-scoped token that names one record in one agency, so the token
 * resolves the controller and nothing else does. Someone with no token learns nothing, and someone
 * with a token learns only the name of the agency whose link they were sent — which is precisely
 * what a privacy notice is obliged to tell them.
 *
 * Every function here takes the raw token and returns an `agency_id` or null. They select the
 * single column they need: no join reaches a campaign, a client, a store or another promoter.
 */

/** The invitation link, `/i/[token]`. Signature-only, so an expired invitation still reaches the notice. */
export async function agencyForInvitationToken(token: string): Promise<string | null> {
  const verified = verifyTokenSignature(token, "invitation");
  if (!verified.ok) return null;

  const db = createAdminClient();
  const { data } = await db
    .from("invitations")
    .select("agency_id")
    .eq("id", verified.recordId)
    .single();
  return data?.agency_id ? String(data.agency_id) : null;
}

/** The check-in link, `/c/[token]`. */
export async function agencyForCheckinToken(token: string): Promise<string | null> {
  const verified = verifyTokenSignature(token, "checkin");
  if (!verified.ok) return null;

  const db = createAdminClient();
  const { data } = await db
    .from("assignments")
    .select("agency_id")
    .eq("id", verified.recordId)
    .single();
  return data?.agency_id ? String(data.agency_id) : null;
}

/** The availability link, `/a/[token]`. Carries a promoter id, not a record in a shift. */
export async function agencyForAvailabilityToken(token: string): Promise<string | null> {
  const verified = verifyAvailabilityToken(token);
  if (!verified.ok) return null;

  const db = createAdminClient();
  const { data } = await db
    .from("promoters")
    .select("agency_id")
    .eq("id", verified.promoterId)
    .single();
  return data?.agency_id ? String(data.agency_id) : null;
}
