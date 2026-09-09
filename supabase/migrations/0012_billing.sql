-- P17 — Billing (Stripe).
--
-- `0011_accounts.sql` already put the commercial shape on `agencies`: plan, subscription_status,
-- trial_ends_at, seat_limit, promoter_limit. This migration adds only the parts that exist
-- because a payment processor exists — the Stripe identifiers, the paid-period clock, and the
-- log of every webhook we have ever accepted.
--
-- docs/commercial-architecture.md §3 (pricing and billing), §4 (self-serve).
--
-- The single rule this file enforces, and the reason it is worth reading before changing it:
--
--   **No browser session may ever write subscription state.**
--
-- A customer who can run `update agencies set subscription_status = 'active'` has a free
-- subscription, and PostgREST plus the anon key means the browser can attempt exactly that
-- without going near our server actions. `0006_auth.sql` granted `authenticated` only SELECT on
-- `agencies`; this migration restates that as an explicit revoke so a future migration that
-- grants UPDATE for some unrelated column has to step over a comment saying why not.
--
-- The only writer of these columns is `app/api/stripe/webhook/route.ts`, running on the service
-- role, and only after it has verified Stripe's signature over the raw request body.
--
-- MANAGER: this file is written, not applied. It is DDL and cannot go through the JS client.
-- Run it in the Supabase SQL editor. Until it runs, the billing screen renders and reports that
-- billing is not configured; nothing else in the app changes.

-- ---------------------------------------------------------------------------
-- agencies: the Stripe identifiers and the paid-period clock
-- ---------------------------------------------------------------------------

-- The Stripe customer. One agency is one customer is one subscription
-- (docs/commercial-architecture.md §1), so both ids are single-valued columns rather than a
-- child table. If an agency ever needs two concurrent subscriptions, that is a new table and a
-- new decision entry, not a comma-separated column.
alter table agencies add column if not exists stripe_customer_id text;

alter table agencies add column if not exists stripe_subscription_id text;

-- When the currently paid period ends. This is the renewal date the billing screen shows, and
-- for a subscription whose payment failed it is roughly when the money was due.
alter table agencies add column if not exists current_period_end timestamptz;

-- When the subscription first went past_due, so the 14-day grace window has a start.
--
-- Not derivable from anything 0011 provides: `current_period_end` moves when Stripe advances the
-- period, and `updated_at` moves for unrelated reasons. Without an explicit start, "full access
-- for 14 days, then read-only" (§3, dunning) would either be uncomputable or would silently
-- extend itself every time any webhook touched the row — and the direction that error takes is
-- the difference between a customer keeping access they should not have and a coordinator being
-- locked out mid-campaign. The webhook sets it on the transition into past_due and clears it on
-- the transition back to active/trialing.
alter table agencies add column if not exists past_due_since timestamptz;

-- One Stripe customer maps to one agency and vice versa. A duplicate here would mean two
-- agencies sharing a subscription, which is a billing dispute we would find out about from the
-- customer. Partial, because most rows are null until someone subscribes.
create unique index if not exists agencies_stripe_customer_id_key
  on agencies (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists agencies_stripe_subscription_id_key
  on agencies (stripe_subscription_id)
  where stripe_subscription_id is not null;

comment on column agencies.stripe_customer_id is
  'Stripe customer id. Written only by the webhook handler and the Checkout bootstrap, both on '
  'the service role. Never writable from a browser session.';

comment on column agencies.past_due_since is
  'When dunning started. Grace runs 14 days from here (docs/commercial-architecture.md §3); '
  'null whenever the subscription is not past_due.';

-- ---------------------------------------------------------------------------
-- billing_events — every webhook we have accepted
-- ---------------------------------------------------------------------------
--
-- Two jobs, and the first one is the important one:
--
--   1. **Idempotency.** Stripe retries a webhook until it gets a 2xx, and it will happily
--      deliver the same event twice even after a success. The handler inserts this row *first*;
--      a unique violation on stripe_event_id means the event was already taken and the handler
--      returns 200 without touching the agency again. Processing `invoice.paid` twice is
--      harmless; processing `customer.subscription.deleted` twice against a row that has since
--      been re-subscribed is not.
--
--   2. **Evidence.** When a customer says "I paid and it still says past due", this table is the
--      answer: what Stripe told us, when, and whether we managed to apply it.
--
-- `payload` is the event as received. It contains customer data, so nothing in the application
-- ever logs it and only the owning agency (plus the service role) can read it.

create table if not exists billing_events (
  id              uuid primary key default gen_random_uuid(),

  -- The idempotency key. Stripe's `evt_…` id is stable across retries of the same event, which
  -- is precisely what makes it usable as one.
  stripe_event_id text not null,

  -- Nullable on purpose: an event can arrive for a customer we cannot resolve to an agency yet
  -- (or at all — a Stripe account is shared with test traffic). Recording it unattributed is
  -- better than dropping it, and `on delete set null` keeps the audit trail after an agency is
  -- removed. It also means this column cannot be relied on for isolation alone; see the policy.
  agency_id       uuid references agencies (id) on delete set null,

  type            text not null,
  payload         jsonb not null,
  received_at     timestamptz not null default now(),

  -- Null while unprocessed or failed. A row with `received_at` set, `processed_at` null and an
  -- `error` is the shape of "Stripe told us something and we could not apply it" — which is a
  -- support queue, not a lost event.
  processed_at    timestamptz,
  error           text
);

create unique index if not exists billing_events_stripe_event_id_key
  on billing_events (stripe_event_id);

create index if not exists billing_events_agency_idx
  on billing_events (agency_id, received_at desc);

-- Unprocessed or failed events, newest first. This is the query a human runs when a customer
-- reports that their plan did not change.
create index if not exists billing_events_unprocessed_idx
  on billing_events (received_at desc)
  where processed_at is null;

comment on table billing_events is
  'Every Stripe webhook accepted, keyed by Stripe''s own event id so a retry is a no-op. '
  'Append-only from the application: the handler inserts once and later stamps processed_at or '
  'error on that same row. Never writable by a browser session.';

alter table billing_events enable row level security;
alter table billing_events force row level security;

-- An agency may read its own billing history and nothing else. Rows with a null agency_id are
-- invisible to every tenant, which is the correct default for an event we could not attribute:
-- an unattributed event must not become visible to whichever agency happens to ask.
drop policy if exists tenant_read on billing_events;
create policy tenant_read on billing_events
  for select
  using (agency_id is not null and agency_id = current_agency_id());

-- No insert/update/delete policy exists, and none is granted below. The service role bypasses
-- RLS and is the only writer.

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
--
-- SELECT only. The absence of INSERT/UPDATE/DELETE here is the security control, not the
-- policies above: a policy cannot be reached without the table privilege.
grant select on billing_events to authenticated;

-- Restating 0006's position explicitly. `authenticated` has only SELECT on `agencies`; billing
-- columns are not writable from a session, and a later migration that wants to let an owner
-- rename their agency must grant UPDATE (name) — a column list — and never bare UPDATE.
revoke insert, update, delete on agencies from authenticated;

-- Anonymous callers (the promoter-facing pages hold no session) have no business here at all.
revoke all on billing_events from anon;
