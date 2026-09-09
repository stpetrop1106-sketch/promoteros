import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleStripeEvent } from "@/lib/billing/sync";
import {
  isHandledEventType,
  parseEventEnvelope,
  readAgencyId,
  verifyStripeSignature,
  webhookSecret,
} from "@/lib/billing/webhook";

/**
 * The Stripe webhook endpoint. The only writer of subscription state in the product.
 *
 * It is a public URL with no session, so the entire trust model is the signature check below.
 * Everything about the order of operations here is deliberate:
 *
 *   1. **Read the raw body, verify the signature, and only then parse.** The signature covers
 *      the exact bytes Stripe sent; re-serialising parsed JSON does not reproduce them. Parsing
 *      before verifying would also mean running our parser on unauthenticated input.
 *   2. **Record before acting.** The event is inserted into `billing_events` with Stripe's own
 *      event id under a unique index. A duplicate delivery — Stripe retries until it gets a 2xx,
 *      and retries can outlive a success — hits that index, and we return 200 having done
 *      nothing. That is the idempotency guarantee, and it lives in Postgres rather than in a
 *      flag this file has to remember to check.
 *   3. **Return 200 once the event is recorded, even if applying it failed.** A non-200 makes
 *      Stripe retry for days; if our handler has a bug, every retry re-runs the same bug. The
 *      failure is written to `billing_events.error` instead, where it is a support queue rather
 *      than a retry storm. The exceptions are the two states where retrying is the *right*
 *      answer: an unverifiable request (no secret configured) and a database we cannot reach.
 *
 * Nothing here logs a payload. Stripe objects carry a customer's name, email and address; the
 * log lines carry an event id and a type, which is enough to find the row.
 */

/** `crypto` and the service-role client are Node APIs — never the edge runtime. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EventRow = {
  stripe_event_id: string;
  agency_id: string | null;
  type: string;
  payload: unknown;
};

/** Postgres unique violation: this exact event has already been recorded. */
const UNIQUE_VIOLATION = "23505";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = webhookSecret();

  if (!secret) {
    // No endpoint secret yet (docs/keys-needed.md §2). We cannot tell a real Stripe delivery
    // from a forgery, so we refuse rather than guess. 503 keeps the event in Stripe's retry
    // queue, so nothing is lost once the secret is configured.
    console.warn("[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set; refusing to process");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const payload = await request.text();

  const verified = verifyStripeSignature({
    payload,
    header: request.headers.get("stripe-signature"),
    secret,
  });

  if (!verified.ok) {
    // 400, not 401: Stripe treats 4xx as "do not retry", which is right — a request we cannot
    // verify will not become verifiable later.
    console.warn(`[stripe-webhook] rejected: ${verified.reason}`);
    return NextResponse.json({ error: verified.reason }, { status: 400 });
  }

  const envelope = parseEventEnvelope(payload);
  if (!envelope) {
    console.warn("[stripe-webhook] signature valid but body is not an event envelope");
    return NextResponse.json({ error: "malformed_event" }, { status: 400 });
  }

  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch {
    // Misconfigured deployment. 500 so Stripe retries once we fix it.
    console.error("[stripe-webhook] service-role client unavailable");
    return NextResponse.json({ error: "storage_unavailable" }, { status: 500 });
  }

  const row: EventRow = {
    stripe_event_id: envelope.id,
    // Best effort at insert time; `handleStripeEvent` resolves it properly and we stamp it below.
    agency_id: readAgencyId(envelope.data.object),
    type: envelope.type,
    payload: JSON.parse(payload) as unknown,
  };

  const inserted = await db.from("billing_events").insert(row).select("id").maybeSingle();

  if (inserted.error) {
    if (inserted.error.code === UNIQUE_VIOLATION) {
      // Already processed. Stop here — replaying `customer.subscription.deleted` against an
      // agency that has since re-subscribed would cancel a paying customer.
      return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
    }

    // We could not record it, so we must not act on it either: without the row there is no
    // idempotency key and a retry would run the handler twice. 500 asks Stripe to try again.
    console.error(`[stripe-webhook] could not record ${envelope.id}: ${inserted.error.code}`);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }

  // Unhandled types are recorded and left alone — an endpoint receives more than it acts on.
  if (!isHandledEventType(envelope.type)) {
    await stamp(db, envelope.id, { processedAt: new Date().toISOString() });
    return NextResponse.json({ received: true, handled: false }, { status: 200 });
  }

  const outcome = await handleStripeEvent(envelope);

  switch (outcome.result) {
    case "applied":
      await stamp(db, envelope.id, {
        processedAt: new Date().toISOString(),
        agencyId: outcome.agencyId,
      });
      break;

    case "ignored":
      await stamp(db, envelope.id, {
        processedAt: new Date().toISOString(),
        agencyId: outcome.agencyId,
      });
      break;

    case "unattributed":
      // Verified, genuinely from our Stripe account, but not matched to an agency — most often
      // traffic from a shared test account. Recorded with a reason, not silently dropped.
      await stamp(db, envelope.id, { error: "no matching agency for this event" });
      console.warn(`[stripe-webhook] unattributed event ${envelope.id} (${envelope.type})`);
      break;

    case "failed":
      await stamp(db, envelope.id, { error: outcome.message, agencyId: outcome.agencyId });
      console.error(`[stripe-webhook] failed to apply ${envelope.id} (${envelope.type})`);
      break;
  }

  // 200 in every one of those branches, by design. See the note at the top of the file.
  return NextResponse.json({ received: true }, { status: 200 });
}

/** Stamp the outcome onto the recorded event. Never throws — the response is already decided. */
async function stamp(
  db: ReturnType<typeof createAdminClient>,
  eventId: string,
  fields: { processedAt?: string; error?: string; agencyId?: string | null },
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (fields.processedAt) update["processed_at"] = fields.processedAt;
  if (fields.error) update["error"] = fields.error.slice(0, 500);
  if (fields.agencyId) update["agency_id"] = fields.agencyId;
  if (Object.keys(update).length === 0) return;

  const { error } = await db.from("billing_events").update(update).eq("stripe_event_id", eventId);
  if (error) console.error(`[stripe-webhook] could not stamp ${eventId}: ${error.code}`);
}

/**
 * A GET is not part of the contract, but a human pasting the URL into a browser deserves an
 * answer that is not a stack trace. Says nothing about configuration.
 */
export function GET(): NextResponse {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}
