"use server";

import { requireUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { availabilityLinkFor, mintAvailabilityToken } from "@/lib/availability-links";

/**
 * The coordinator's side of P30: mint one promoter's availability link so it can be pasted into
 * WhatsApp. The ONLY authenticated action in this folder — everything else under `/a/[token]` is
 * anonymous and token-scoped.
 *
 * It lives here rather than in `app/promoters/[id]/actions.ts` because this parcel owns exactly
 * one file under `app/promoters/**` (`availability-link.tsx`, a client component) and a client
 * component cannot mint — the signing secret is server-side. When P5 lands
 * `app/promoters/[id]/availability/**`, this belongs there; see `docs/status/P30.md`.
 *
 * Only async functions are exported (CLAUDE.md, "the server/client boundary"); the result type is
 * erased at compile time, the same shape `app/i/[token]/actions.ts` already uses.
 */

export type MintLinkState =
  | { status: "idle" }
  | { status: "ready"; url: string; expiresAt: string }
  | { status: "error"; reason: "not_found" | "failed" };

export async function createAvailabilityLink(promoterId: string): Promise<MintLinkState> {
  await requireUser();

  // Read through the RLS-scoped client, never the admin one: `own_agency` (0002_rls.sql) is what
  // makes a promoter id belonging to another agency come back as no row at all. Tenant isolation
  // is enforced by the database here, not by a comparison we could forget to write.
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("promoters")
    .select("id")
    .eq("id", promoterId)
    .maybeSingle<{ id: string }>();

  if (error) return { status: "error", reason: "failed" };
  if (!data) return { status: "error", reason: "not_found" };

  const { token, expiresAt } = mintAvailabilityToken(data.id);
  return { status: "ready", url: availabilityLinkFor(token), expiresAt: expiresAt.toISOString() };
}
