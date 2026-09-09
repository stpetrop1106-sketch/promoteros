# Billing setup — what to do in Stripe

Everything in `lib/billing/**`, `app/api/stripe/**` and `app/settings/billing/**` is written and
runs today **with no Stripe account at all**: the billing screen renders, shows the real
subscription state from our own database, and says plainly that billing is not switched on. Nothing
crashes and no page goes blank. This file is the checklist for turning it on.

**Test mode needs no business verification, no company, no IBAN.** Steps 1–6 can be done in twenty
minutes with nothing but an email address, and the whole loop — subscribe, webhook, plan change,
failed payment, cancellation — is testable end to end with test cards. Only step 8 needs a real
business.

---

## 1. Create the Stripe account

<https://dashboard.stripe.com/register>. Stay in **test mode** — the toggle at the top right of the
dashboard. Everything below is done in test mode first; the live switch is step 8.

## 2. Create the products and prices

Products → **Add product**, three times. Names matter only to us; the customer sees them from
`lib/i18n/*.ts`, not from Stripe.

| Product | Price | Billing period | Notes |
|---|---|---|---|
| PromoterOS Starter | €149.00 | Monthly, recurring | |
| PromoterOS Starter | €1,490.00 | Yearly, recurring | Two months free — add as a second price on the same product |
| PromoterOS Agency | €249.00 | Monthly, recurring | |
| PromoterOS Agency | €2,490.00 | Yearly, recurring | |
| PromoterOS Multi-brand | €499.00 | Monthly, recurring | |
| PromoterOS Multi-brand | €4,990.00 | Yearly, recurring | |

Currency **EUR** for all six. Set prices as **tax inclusive: no** (exclusive), so Stripe Tax can add
Greek VAT or apply the reverse charge for an EU business customer.

Each price has an id that looks like `price_1Q…`. Copy all six — that is what goes in `.env`.

The amounts and the limits they buy live in `lib/billing/plans.ts`. If a price ever changes, change
it in both places: Stripe charges the card, our table decides how many seats and promoters that
buys.

## 3. Environment variables

```dotenv
# Secret key: Developers → API keys. Starts sk_test_ in test mode.
STRIPE_SECRET_KEY=sk_test_…

# Set in step 5, when the webhook endpoint is created.
STRIPE_WEBHOOK_SECRET=whsec_…

# The six price ids from step 2.
STRIPE_PRICE_STARTER_MONTHLY=price_…
STRIPE_PRICE_STARTER_ANNUAL=price_…
STRIPE_PRICE_AGENCY_MONTHLY=price_…
STRIPE_PRICE_AGENCY_ANNUAL=price_…
STRIPE_PRICE_MULTI_BRAND_MONTHLY=price_…
STRIPE_PRICE_MULTI_BRAND_ANNUAL=price_…

# Already set for other reasons; billing needs it for the Checkout return URLs.
NEXT_PUBLIC_APP_URL=https://…
```

Same names in Vercel → Settings → Environment Variables. **`STRIPE_SECRET_KEY` and
`STRIPE_WEBHOOK_SECRET` are server-only.** Neither ever gets a `NEXT_PUBLIC_` prefix; that prefix
means "ship this to every browser", and for a secret key that is a total compromise of the Stripe
account.

A missing price id is not an error — that tier's button is disabled with a sentence saying the price
has not been created yet. So the six can be added one at a time.

## 4. Turn on the Billing Portal

Settings → Billing → **Customer portal**. Activate it, and allow:

- update payment method
- view invoice history
- cancel subscription
- update tax id and billing address

That page is the whole of "card, invoices, VAT id and cancellation" in the product
(`docs/commercial-architecture.md` §4). We build none of it.

## 5. Register the webhook endpoint

Developers → **Webhooks** → Add endpoint.

- **URL:** `https://<your domain>/api/stripe/webhook`
- **Events to send:**
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`

Stripe then shows a **signing secret** starting `whsec_`. That is `STRIPE_WEBHOOK_SECRET`. Redeploy
after setting it.

Until it is set, the endpoint answers `503 {"error":"not_configured"}` and refuses to process
anything. That is deliberate: without the secret we cannot tell a real Stripe delivery from a
forged one, and a 503 keeps the event in Stripe's retry queue so nothing is lost.

## 6. Test the loop locally with the Stripe CLI

Install: <https://stripe.com/docs/stripe-cli>. Then:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

`stripe listen` prints its **own** `whsec_…` secret for the forwarding session. Put *that* one in
your local `.env` while testing; the dashboard's secret is for the deployed URL.

With it running:

1. Open `/settings/billing` as the agency owner and press **Start subscription**.
2. Pay with the test card `4242 4242 4242 4242`, any future expiry, any CVC.
3. You land back on `/settings/billing?checkout=success`. Within a second or two the plan and status
   change — that change comes from the webhook, not from the redirect.

Useful triggers, each of which should move the agency row:

```bash
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.deleted
```

Note that `stripe trigger` invents its own customer, so those events are usually **unattributed** —
recorded in `billing_events` with an error saying no agency matched. That is the correct behaviour.
To exercise a real agency, use the dashboard against the customer created in step 6.2, or a test
card that declines: `4000 0000 0000 0341` (attaches fine, fails on the first charge) puts a real
subscription into `past_due`.

### What to check after each test

```sql
select stripe_event_id, type, agency_id, processed_at, error
from billing_events order by received_at desc limit 10;

select name, plan, subscription_status, past_due_since, current_period_end,
       seat_limit, promoter_limit
from agencies;
```

- Every event should have a `processed_at` **or** an `error`. Never both null for long.
- Re-sending the same event from the dashboard must not change anything: the insert hits the unique
  index on `stripe_event_id` and the handler stops. That is the idempotency guarantee.

## 7. What the customer sees in each state

Enforcement lives in one place, `lib/billing/subscription.ts`. From
`docs/commercial-architecture.md` §3:

| State | What works |
|---|---|
| `trialing`, `active` | Everything |
| Trial expired | Everything, with a banner, for 14 days. Then read-only |
| `past_due` | **Everything, with a banner, for 14 days.** A failed card never stops a shift that is being staffed |
| After those 14 days | Read and export only. Nothing is deleted |
| `paused`, `canceled` | Read and export only. Nothing is deleted |
| Over the seat or promoter limit | Adding another is blocked. Everything that exists keeps working |

**We never delete a customer's data for non-payment.** A deleted roster is a catastrophe for the
agency and a lawsuit for us.

## 8. Before real money

Not code, and not blocking anything above.

1. **Business verification** in Stripe: company details, an IBAN for payouts.
2. **Stripe Tax** enabled (Settings → Tax). Checkout already requests it and collects a VAT id; it
   is inert until Tax is switched on.
3. Recreate the six prices in **live mode** — test-mode prices do not exist there — and swap the
   `.env` values along with `STRIPE_SECRET_KEY` (`sk_live_…`).
4. Register the webhook endpoint again in live mode and take the new `whsec_`.
5. **myDATA.** Stripe issues the invoice, but a Greek entity also has myDATA reporting obligations.
   That is an accountant question, not a code question (`docs/commercial-architecture.md` §3).

The billing screen shows a "Stripe test mode" line whenever the key is a test key, so it is never a
guess which mode a deployment is in.

## Where each piece lives

| Concern | File |
|---|---|
| Tiers, prices, limits, price-id lookup | `lib/billing/plans.ts` |
| HTTP calls to Stripe (no SDK) | `lib/billing/stripe.ts` |
| Signature verification, event parsing | `lib/billing/webhook.ts` |
| Applying an event to an agency row | `lib/billing/sync.ts` |
| Entitlement and the access rules | `lib/billing/subscription.ts` |
| The endpoint Stripe calls | `app/api/stripe/webhook/route.ts` |
| The screen and its two buttons | `app/settings/billing/**` |
| Schema | `supabase/migrations/0012_billing.sql` |
