import "server-only";

/**
 * A thin Stripe REST client over `fetch`.
 *
 * **No SDK, deliberately.** Stripe's API is a form-encoded HTTP API and we use five endpoints of
 * it; the SDK would add a dependency, a bundled type surface and a release cadence to track, in
 * exchange for nothing we need. `docs/decisions.md` records the same reasoning for the messaging
 * adapters.
 *
 * **Nothing here reads `STRIPE_SECRET_KEY` at module load.** No key exists yet
 * (`docs/keys-needed.md` §2), and a module-scope `throw` would take down every page that
 * transitively imports this file — including pages that have nothing to do with billing. Instead
 * every call returns a `not_configured` failure and `isConfigured()` lets the UI ask first. This
 * is the same posture as `lib/messaging/index.ts` with WhatsApp credentials.
 *
 * Nothing in this file throws. Callers get a result they must look at.
 */

const API_BASE = "https://api.stripe.com/v1";

/**
 * Pinned. An unpinned client silently follows Stripe's account default, which means a dashboard
 * setting elsewhere can change the shape of the JSON this file parses.
 */
const API_VERSION = "2024-06-20";

const TIMEOUT_MS = 15_000;

export type StripeErrorCode =
  /** No `STRIPE_SECRET_KEY`. Not an error condition — the expected state until Stella has one. */
  | "not_configured"
  /** Could not reach Stripe, or it timed out. Retryable. */
  | "network"
  /** Stripe answered with a 4xx/5xx. */
  | "api";

export type StripeError = {
  code: StripeErrorCode;
  /** Safe to log: Stripe's own message, never a request body. */
  message: string;
  status?: number;
  /** Stripe's machine-readable error code, e.g. `resource_missing`. */
  stripeCode?: string;
};

export type StripeResult<T> = { ok: true; data: T } | { ok: false; error: StripeError };

/** The subset of a Stripe object we actually read. Everything else is ignored on purpose. */
export type StripeCustomer = { id: string };

export type StripeCheckoutSession = {
  id: string;
  /** Where to send the browser. Absent only for session types we do not create. */
  url: string | null;
  customer: string | null;
  subscription: string | null;
};

export type StripePortalSession = { id: string; url: string };

export type StripeSubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused";

export type StripeSubscription = {
  id: string;
  status: StripeSubscriptionStatus | string;
  customer: string | null;
  /** Unix seconds. */
  current_period_end: number | null;
  cancel_at_period_end: boolean | null;
  items?: { data?: Array<{ price?: { id?: string | null } | null }> };
  metadata?: Record<string, string>;
};

/** True when a secret key is present. The UI checks this before offering to charge anyone. */
export function isConfigured(): boolean {
  return secretKey() !== null;
}

/**
 * `test`, `live`, or null when unconfigured. The billing screen shows a test-mode marker: an
 * agency seeing a real price against a test key would otherwise have no way to know the
 * subscription it just created is not real.
 */
export function stripeMode(): "test" | "live" | null {
  const key = secretKey();
  if (!key) return null;
  return key.startsWith("sk_live_") || key.startsWith("rk_live_") ? "live" : "test";
}

function secretKey(): string | null {
  const value = process.env.STRIPE_SECRET_KEY;
  return value && value.trim() !== "" ? value.trim() : null;
}

/** Nested parameter values, in the shapes Stripe's form encoding accepts. */
export type StripeParams = {
  [key: string]: string | number | boolean | null | undefined | StripeParams | StripeParams[];
};

/**
 * Stripe reads `application/x-www-form-urlencoded` with bracketed paths for nesting:
 * `line_items[0][price]=price_123`, `metadata[agency_id]=…`. Null and undefined are dropped
 * rather than sent as the string "null", which Stripe would store literally.
 */
export function encodeParams(params: StripeParams, prefix = ""): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;

    const path = prefix === "" ? key : `${prefix}[${key}]`;

    if (Array.isArray(value)) {
      value.forEach((entry, index) => {
        const nested = encodeParams(entry, `${path}[${index}]`);
        if (nested !== "") parts.push(nested);
      });
      continue;
    }

    if (typeof value === "object") {
      const nested = encodeParams(value, path);
      if (nested !== "") parts.push(nested);
      continue;
    }

    parts.push(`${encodeURIComponent(path)}=${encodeURIComponent(String(value))}`);
  }

  return parts.join("&");
}

type RequestOptions = {
  method: "GET" | "POST";
  path: string;
  params?: StripeParams;
  /**
   * Stripe's own idempotency key for POSTs. A retried Checkout creation must not leave two
   * half-finished sessions behind, and a network timeout is indistinguishable from a failure.
   */
  idempotencyKey?: string;
};

/**
 * One HTTP call. Every public function below is a wrapper around this, and this is the only
 * place that touches the network or the secret key.
 */
async function request<T>({
  method,
  path,
  params,
  idempotencyKey,
}: RequestOptions): Promise<StripeResult<T>> {
  const key = secretKey();
  if (!key) {
    return {
      ok: false,
      error: { code: "not_configured", message: "STRIPE_SECRET_KEY is not set" },
    };
  }

  const body = params ? encodeParams(params) : undefined;
  const url =
    method === "GET" && body ? `${API_BASE}${path}?${body}` : `${API_BASE}${path}`;

  const headers: Record<string, string> = {
    authorization: `Bearer ${key}`,
    "stripe-version": API_VERSION,
  };
  if (method === "POST") headers["content-type"] = "application/x-www-form-urlencoded";
  if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: method === "POST" ? (body ?? "") : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: "network",
        message: cause instanceof Error ? cause.message : "Stripe request failed",
      },
    };
  }

  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text === "" ? null : JSON.parse(text);
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const detail =
      parsed && typeof parsed === "object" && "error" in parsed
        ? ((parsed as { error?: { message?: string; code?: string } }).error ?? {})
        : {};

    return {
      ok: false,
      error: {
        code: "api",
        status: response.status,
        message: detail.message ?? `Stripe returned ${response.status}`,
        stripeCode: detail.code,
      },
    };
  }

  return { ok: true, data: parsed as T };
}

/**
 * The customer record money hangs off.
 *
 * `metadata.agency_id` is how a webhook that arrives with nothing but a customer id finds its
 * way home, and it is also the thing that makes a support question answerable in the Stripe
 * dashboard without a database round trip.
 */
export function createCustomer(input: {
  agencyId: string;
  name: string;
  email: string;
}): Promise<StripeResult<StripeCustomer>> {
  return request<StripeCustomer>({
    method: "POST",
    path: "/customers",
    params: {
      name: input.name,
      email: input.email,
      metadata: { agency_id: input.agencyId },
    },
    // One customer per agency, however many times the button is pressed.
    idempotencyKey: `customer:${input.agencyId}`,
  });
}

/**
 * A hosted Checkout session — the page the customer's card details go to instead of to us.
 *
 * Card data never touching our servers is the entire reason we use Checkout rather than a form
 * (docs/commercial-architecture.md §3), so there is no variant of this that collects a PAN.
 *
 * `automatic_tax` is on because EU VAT and reverse charge are Stripe Tax's job; it is inert
 * until Stripe Tax is enabled on the account, so turning it on early costs nothing.
 */
export function createCheckoutSession(input: {
  customerId: string;
  priceId: string;
  agencyId: string;
  successUrl: string;
  cancelUrl: string;
  /** Unix seconds. Carries an unfinished free trial into the subscription instead of ending it. */
  trialEnd?: number | null;
  locale?: "el" | "en" | "auto";
}): Promise<StripeResult<StripeCheckoutSession>> {
  const trialEnd =
    input.trialEnd && input.trialEnd > Math.floor(Date.now() / 1000) + 60 ? input.trialEnd : null;

  return request<StripeCheckoutSession>({
    method: "POST",
    path: "/checkout/sessions",
    params: {
      mode: "subscription",
      customer: input.customerId,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      locale: input.locale ?? "auto",
      line_items: [{ price: input.priceId, quantity: 1 }],
      // Both places on purpose. The session metadata is what `checkout.session.completed`
      // carries; the subscription_data copy is what every later subscription.* event carries.
      metadata: { agency_id: input.agencyId },
      subscription_data: {
        metadata: { agency_id: input.agencyId },
        trial_end: trialEnd,
      },
      automatic_tax: { enabled: true },
      customer_update: { address: "auto", name: "auto" },
      // A Greek business customer needs its VAT number on the invoice.
      tax_id_collection: { enabled: true },
      billing_address_collection: "required",
      allow_promotion_codes: true,
    },
  });
}

/**
 * The Billing Portal: card changes, invoices, VAT id, cancellation. All the self-serve work we
 * would otherwise have to build and support (docs/commercial-architecture.md §4).
 */
export function createBillingPortalSession(input: {
  customerId: string;
  returnUrl: string;
  locale?: "el" | "en" | "auto";
}): Promise<StripeResult<StripePortalSession>> {
  return request<StripePortalSession>({
    method: "POST",
    path: "/billing_portal/sessions",
    params: {
      customer: input.customerId,
      return_url: input.returnUrl,
      locale: input.locale ?? "auto",
    },
  });
}

/**
 * Read a subscription back from Stripe.
 *
 * The webhook uses this when an event carries only a subscription id, so that state is always
 * applied from Stripe's current view rather than from a payload that may have been overtaken by
 * a later event that arrived first. Stripe does not guarantee webhook ordering.
 */
export function retrieveSubscription(
  subscriptionId: string,
): Promise<StripeResult<StripeSubscription>> {
  return request<StripeSubscription>({
    method: "GET",
    path: `/subscriptions/${encodeURIComponent(subscriptionId)}`,
  });
}

/** The price id a subscription is currently on, or null. */
export function priceIdOf(subscription: StripeSubscription): string | null {
  return subscription.items?.data?.[0]?.price?.id ?? null;
}
