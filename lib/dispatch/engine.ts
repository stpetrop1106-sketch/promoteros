/**
 * P39 — claim, send, record. The one function every automatic message goes through.
 *
 * No Supabase import: the store is an interface, so the exactly-once rules are unit-tested against
 * an in-memory store that enforces the same unique key as `0017_message_dispatches.sql`
 * (`tests/dispatch.test.ts`). `./supabase-store.ts` is the real implementation.
 *
 * THE ORDER IS THE GUARANTEE:
 *
 *   1. CLAIM  — insert the `pending` row. A unique violation means someone else has this
 *               (promoter, kind, period). Take it over only if `canReclaim()` says so, and only
 *               through a conditional update that a concurrent run cannot also win.
 *   2. BUILD  — mint the link and compose the message. After the claim, so a message is never
 *               built for someone another run already owns.
 *   3. SEND   — through the adapter, with an idempotency key derived from the row id.
 *   4. RECORD — `sent` / `skipped` / `failed`.
 *
 * Nothing here throws to its caller. One promoter's failure is that promoter's row, never the
 * end of the run.
 */

import type { MessagingAdapter, OutboundMessage } from "@/lib/messaging";
import {
  canReclaim,
  idempotencyKeyFor,
  outcomeFromSend,
  redactError,
  type DispatchKey,
  type DispatchOutcome,
  type DispatchResult,
  type ExistingDispatch,
} from "./outcome";

export type InsertResult = { inserted: true; id: string } | { inserted: false };

export interface DispatchStore {
  /** Insert a `pending` row. `{ inserted: false }` on a unique violation; throws on anything else. */
  insertPending(key: DispatchKey): Promise<InsertResult>;
  /** The row that holds this key, if any. */
  findExisting(key: DispatchKey): Promise<ExistingDispatch | null>;
  /**
   * Take over `existing`: set it back to `pending` with `attempts + 1`, ONLY IF its `attempts` is
   * still the value read. True when this caller won.
   */
  reclaim(existing: ExistingDispatch): Promise<boolean>;
  /** Record the outcome. Throws on failure; the engine swallows it (see below). */
  finish(id: string, outcome: DispatchOutcome): Promise<void>;
}

export type EngineDeps = {
  store: DispatchStore;
  adapter: MessagingAdapter;
  now?: () => Date;
};

export async function claim(
  store: DispatchStore,
  key: DispatchKey,
  now: Date,
): Promise<{ claimed: true; id: string } | { claimed: false }> {
  const first = await store.insertPending(key);
  if (first.inserted) return { claimed: true, id: first.id };

  const existing = await store.findExisting(key);
  if (!existing || !canReclaim(existing, now)) return { claimed: false };

  const won = await store.reclaim(existing);
  return won ? { claimed: true, id: existing.id } : { claimed: false };
}

export async function dispatchOne(
  deps: EngineDeps,
  key: DispatchKey,
  build: () => Promise<OutboundMessage>,
): Promise<DispatchResult> {
  const now = deps.now ?? (() => new Date());

  let id: string;
  try {
    const claimed = await claim(deps.store, key, now());
    if (!claimed.claimed) return { result: "already_claimed" };
    id = claimed.id;
  } catch {
    // Could not even claim (database unreachable, migration not applied). Nothing was sent, and
    // nothing may be sent without a claim.
    return { result: "error" };
  }

  let outcome: DispatchOutcome;
  try {
    const message = await build();
    const result = await deps.adapter.send({ ...message, idempotencyKey: idempotencyKeyFor(id) });
    outcome = outcomeFromSend(result);
  } catch (err) {
    outcome = {
      status: "failed",
      channel: deps.adapter.channel,
      error: redactError(err instanceof Error ? err.message : "unexpected_error"),
    };
  }

  try {
    await deps.store.finish(id, outcome);
  } catch {
    // The message may well have gone out; the row stays `pending`. That is the safe side: a
    // pending row is only re-claimed once stale, and the resend reuses this row's idempotency key,
    // which the provider de-duplicates. Report what actually happened to the recipient.
  }

  switch (outcome.status) {
    case "sent":
      return { result: "sent" };
    case "skipped":
      return { result: "skipped", skipReason: outcome.skipReason };
    case "failed":
      return { result: "failed" };
  }
}
