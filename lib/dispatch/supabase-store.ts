import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { DispatchStore } from "./engine";
import type { DispatchOutcome, DispatchStatus, ExistingDispatch } from "./outcome";

/**
 * P39 — `DispatchStore` over `message_dispatches`, on the service role.
 *
 * Service role because 0017 grants `authenticated` SELECT only: dispatch rows are written by the
 * server and never by a browser session. Every value written here comes from rows the server
 * itself loaded (the promoter's own `agency_id`), never from a request.
 */

type AdminDb = ReturnType<typeof createAdminClient>;

const TABLE = "message_dispatches";

export function supabaseDispatchStore(db: AdminDb): DispatchStore {
  return {
    async insertPending(key) {
      const { data, error } = await db
        .from(TABLE)
        .insert({
          agency_id: key.agencyId,
          promoter_id: key.promoterId,
          kind: key.kind,
          period_key: key.periodKey,
          status: "pending",
        })
        .select("id")
        .single<{ id: string }>();

      if (error) {
        // 23505 = unique_violation on (promoter_id, kind, period_key): the lock is held.
        if (error.code === "23505") return { inserted: false };
        throw new Error(`message_dispatches insert: ${error.code ?? "error"}`);
      }
      if (!data) throw new Error("message_dispatches insert: no row");
      return { inserted: true, id: data.id };
    },

    async findExisting(key) {
      const { data, error } = await db
        .from(TABLE)
        .select("id, status, attempts, updated_at")
        .eq("promoter_id", key.promoterId)
        .eq("kind", key.kind)
        .eq("period_key", key.periodKey)
        .maybeSingle<{ id: string; status: DispatchStatus; attempts: number; updated_at: string }>();

      if (error) throw new Error(`message_dispatches select: ${error.code ?? "error"}`);
      if (!data) return null;
      return {
        id: data.id,
        status: data.status,
        attempts: data.attempts,
        updatedAt: data.updated_at,
      } satisfies ExistingDispatch;
    },

    async reclaim(existing) {
      // Conditional on BOTH the status and the attempt counter we read. Under READ COMMITTED a
      // second concurrent UPDATE waits for the first, re-evaluates this WHERE against the new row
      // version, finds `attempts` has moved, and matches nothing. Exactly one run wins.
      const { data, error } = await db
        .from(TABLE)
        .update({
          status: "pending",
          attempts: existing.attempts + 1,
          channel: null,
          skip_reason: null,
          error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .eq("status", existing.status)
        .eq("attempts", existing.attempts)
        .select("id");

      if (error) throw new Error(`message_dispatches reclaim: ${error.code ?? "error"}`);
      return (data ?? []).length === 1;
    },

    async finish(id, outcome: DispatchOutcome) {
      const now = new Date().toISOString();
      const patch =
        outcome.status === "sent"
          ? {
              status: "sent",
              channel: outcome.channel,
              provider_message_id: outcome.providerMessageId,
              skip_reason: null,
              error: null,
              sent_at: now,
              updated_at: now,
            }
          : outcome.status === "skipped"
            ? {
                status: "skipped",
                channel: outcome.channel,
                skip_reason: outcome.skipReason,
                error: null,
                updated_at: now,
              }
            : {
                status: "failed",
                channel: outcome.channel,
                skip_reason: null,
                error: outcome.error,
                updated_at: now,
              };

      const { error } = await db.from(TABLE).update(patch).eq("id", id);
      if (error) throw new Error(`message_dispatches finish: ${error.code ?? "error"}`);
    },
  };
}
