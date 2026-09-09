import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stripe webhook signature verification, done by hand.
 *
 * This is the security boundary of the whole parcel. `app/api/stripe/webhook/route.ts` is the
 * only writer of subscription state, and it is a public, unauthenticated HTTP endpoint. Without
 * verification it is an anonymous write endpoint into the billing table: anyone who guesses the
 * path can POST `{"type":"customer.subscription.updated", …}` and hand themselves a plan.
 *
 * The scheme (Stripe docs, "Verify webhook signatures manually"):
 *
 *   Stripe-Signature: t=1699999999,v1=<hex>,v1=<hex during a secret rotation>
 *
 * and `v1` is HMAC-SHA256 over the exact bytes `"<t>.<raw request body>"`, keyed by the
 * endpoint's `whsec_…` secret used verbatim, prefix included.
 *
 * Three details that are easy to get wrong and are each a real hole:
 *
 *   1. **The raw body.** `JSON.parse` then `JSON.stringify` does not round-trip byte for byte
 *      (key order, number formatting, unicode escapes), so the signature must be checked against
 *      the untouched request text, before anything parses it. Hence: verify first, parse second.
 *   2. **Constant-time comparison.** A `===` on the hex digest leaks, through timing, how much
 *      of a guessed signature was right. `timingSafeEqual` does not.
 *   3. **The timestamp tolerance.** Without it a captured request stays valid forever, so anyone
 *      who ever saw one legitimate webhook — a proxy log, a screenshot — can replay it at will.
 *      Five minutes matches Stripe's own default.
 */

/** Stripe's default replay window. Also the ceiling on clock skew we tolerate. */
export const DEFAULT_TOLERANCE_SECONDS = 300;

export type SignatureFailure =
  | "missing_signature"
  | "malformed_signature"
  | "timestamp_out_of_tolerance"
  | "no_match";

export type VerifyResult =
  | { ok: true; timestamp: number }
  | { ok: false; reason: SignatureFailure };

type ParsedHeader = { timestamp: number; signatures: string[] };

function parseSignatureHeader(header: string): ParsedHeader | null {
  let timestamp: number | null = null;
  const signatures: string[] = [];

  for (const part of header.split(",")) {
    const index = part.indexOf("=");
    if (index === -1) continue;

    const scheme = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();

    if (scheme === "t") {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) timestamp = parsed;
    } else if (scheme === "v1") {
      // More than one v1 is normal during a secret rotation: Stripe signs with both.
      signatures.push(value);
    }
  }

  if (timestamp === null || signatures.length === 0) return null;
  return { timestamp, signatures };
}

/** Constant-time hex comparison. Length mismatch short-circuits — that leaks nothing useful. */
function hexEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    // Non-hex input from an attacker. Not a match.
    return false;
  }
}

/**
 * Verify a webhook. Call with the *raw* body text.
 *
 * `nowSeconds` is injectable so the tolerance can be tested without waiting five minutes.
 */
export function verifyStripeSignature(input: {
  payload: string;
  header: string | null;
  secret: string;
  toleranceSeconds?: number;
  nowSeconds?: number;
}): VerifyResult {
  if (!input.header || input.header.trim() === "") {
    return { ok: false, reason: "missing_signature" };
  }

  const parsed = parseSignatureHeader(input.header);
  if (!parsed) return { ok: false, reason: "malformed_signature" };

  const tolerance = input.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);

  // Absolute difference, so a webhook stamped in the future (a skewed clock, or an attacker
  // trying to mint one that stays valid) is rejected too.
  if (Math.abs(now - parsed.timestamp) > tolerance) {
    return { ok: false, reason: "timestamp_out_of_tolerance" };
  }

  const expected = createHmac("sha256", input.secret)
    .update(`${parsed.timestamp}.${input.payload}`, "utf8")
    .digest("hex");

  const matched = parsed.signatures.some((candidate) => hexEquals(candidate, expected));

  return matched ? { ok: true, timestamp: parsed.timestamp } : { ok: false, reason: "no_match" };
}

/** The endpoint secret, or null. Absent is the expected state until the endpoint is registered. */
export function webhookSecret(): string | null {
  const value = process.env.STRIPE_WEBHOOK_SECRET;
  return value && value.trim() !== "" ? value.trim() : null;
}

// ---------------------------------------------------------------------------
// Event shapes
// ---------------------------------------------------------------------------

/**
 * The events we act on. Anything else is recorded and ignored — Stripe endpoints receive more
 * types than they handle, and an unhandled type is not an error.
 */
export const HANDLED_EVENT_TYPES = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
  "invoice.paid",
] as const;

export type HandledEventType = (typeof HANDLED_EVENT_TYPES)[number];

export function isHandledEventType(type: string): type is HandledEventType {
  return (HANDLED_EVENT_TYPES as readonly string[]).includes(type);
}

/**
 * A parsed event, narrowed to the fields we read.
 *
 * The object inside `data.object` is deliberately loose: it is a Checkout session, a
 * subscription or an invoice depending on `type`, and the reader below pulls out only ids. We
 * never trust the payload's *state* — the handler re-reads the subscription from Stripe — so
 * there is nothing to gain from modelling it fully.
 */
export type StripeEventEnvelope = {
  id: string;
  type: string;
  created?: number;
  data: { object: Record<string, unknown> };
};

/** Parse the raw body. Returns null for anything that is not a Stripe event envelope. */
export function parseEventEnvelope(payload: string): StripeEventEnvelope | null {
  let value: unknown;
  try {
    value = JSON.parse(payload);
  } catch {
    return null;
  }

  if (!value || typeof value !== "object") return null;

  const candidate = value as {
    id?: unknown;
    type?: unknown;
    created?: unknown;
    data?: { object?: unknown };
  };

  if (typeof candidate.id !== "string" || candidate.id === "") return null;
  if (typeof candidate.type !== "string" || candidate.type === "") return null;

  const object =
    candidate.data && typeof candidate.data.object === "object" && candidate.data.object !== null
      ? (candidate.data.object as Record<string, unknown>)
      : {};

  return {
    id: candidate.id,
    type: candidate.type,
    created: typeof candidate.created === "number" ? candidate.created : undefined,
    data: { object },
  };
}

/** A string field, or null. Stripe expands some references into objects; `id` is read off those. */
export function readString(object: Record<string, unknown>, key: string): string | null {
  const value = object[key];
  if (typeof value === "string" && value !== "") return value;

  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string" && id !== "") return id;
  }

  return null;
}

/** `metadata.agency_id`, when the event carries it. */
export function readAgencyId(object: Record<string, unknown>): string | null {
  const metadata = object["metadata"];
  if (!metadata || typeof metadata !== "object") return null;

  const value = (metadata as Record<string, unknown>)["agency_id"];
  return typeof value === "string" && value !== "" ? value : null;
}

/**
 * The subscription this event is about, wherever it hides.
 *
 * A Checkout session carries `subscription`; an invoice carries `subscription` (and, on newer
 * API versions, `parent.subscription_details.subscription`); a subscription event carries the
 * subscription itself, so its own `id` is the answer.
 */
export function readSubscriptionId(
  type: string,
  object: Record<string, unknown>,
): string | null {
  if (type.startsWith("customer.subscription.")) return readString(object, "id");

  const direct = readString(object, "subscription");
  if (direct) return direct;

  const parent = object["parent"];
  if (parent && typeof parent === "object") {
    const details = (parent as Record<string, unknown>)["subscription_details"];
    if (details && typeof details === "object") {
      return readString(details as Record<string, unknown>, "subscription");
    }
  }

  return null;
}
