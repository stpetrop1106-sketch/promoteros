-- P39 — automatic messaging: the dispatch log, and the owner's switch.
--
-- The owner asked for the availability link to go out by itself: once when a promoter is added,
-- and to every promoter on the 1st and the 15th of the month. Email (Resend) is the one channel we
-- can automate today, and "automatically" means a cron job and a background task that nobody is
-- watching. Two things follow, and this migration is both of them.
--
-- 1. A LOG THAT IS ALSO THE LOCK. `unique (promoter_id, kind, period_key)` is the idempotency
--    guarantee: a sender inserts the `pending` row BEFORE it calls the provider, and a unique
--    violation means another run already owns that (promoter, message, period). A cron retry, two
--    overlapping runs, or an owner pressing "send now" twice can never email one person twice.
--
-- 2. AN OFF SWITCH THE AGENCY OWNS. `agencies.auto_availability_links`, editable by an active owner
--    through a column-scoped grant — exactly the 0015 pattern. Never `grant update on agencies`.
--
-- MANAGER: written, not applied. Until it runs, the app behaves exactly as before: the cron route
-- and the welcome send find no table and record nothing, and /settings/messaging says the
-- migration is missing rather than crashing.

-- ---------------------------------------------------------------------------
-- The dispatch log
-- ---------------------------------------------------------------------------

create table if not exists message_dispatches (
  id                   uuid primary key default gen_random_uuid(),
  agency_id            uuid not null references agencies (id) on delete cascade,
  promoter_id          uuid not null references promoters (id) on delete cascade,
  -- What was sent. Text + check rather than an enum so adding a kind is one constraint swap, not
  -- an `alter type` that cannot run inside a transaction on older Postgres.
  kind                 text not null
                       check (kind in ('availability_link', 'checkin_link', 'invitation')),
  -- Which occurrence of that message this is:
  --   availability_link → 'YYYY-MM-01' / 'YYYY-MM-15' (the cron), 'manual-YYYY-MM-DD' (the owner's
  --                        "send now", at most once per Athens day), 'welcome' (on creation)
  --   checkin_link      → the assignment id
  --   invitation        → the invitation id
  period_key           text not null check (length(period_key) between 1 and 64),
  -- 'email', 'clipboard', … — null while pending. Text, because a skipped row never reached a
  -- channel and `invitation_channel` is the invitations table's vocabulary, not this one's.
  channel              text,
  status               text not null default 'pending'
                       check (status in ('pending', 'sent', 'skipped', 'failed')),
  skip_reason          text
                       check (skip_reason is null or skip_reason in (
                         'no_email', 'invalid_email', 'reserved_domain', 'email_not_configured'
                       )),
  -- The provider's id for the message (Resend's email id). Not personal data on its own.
  provider_message_id  text,
  -- A short provider error code, never a raw response body and never an address.
  error                text check (error is null or length(error) <= 500),
  -- A failed or skipped row may be re-claimed by a later run of the same period; see
  -- lib/dispatch/engine.ts. The attempt counter is also the optimistic-concurrency token for that
  -- re-claim, so two runs cannot both re-claim one row.
  attempts             integer not null default 1 check (attempts >= 1),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  sent_at              timestamptz,

  unique (promoter_id, kind, period_key)
);

-- Deliberately NOT stored: the email address, the phone number, the name, the link itself, the
-- message body. The log proves that something went to promoter X on date Y and nothing more. The
-- address is read from `promoters` at send time, so erasing a promoter leaves nothing behind here
-- that identifies them once their row is a tombstone.

create index if not exists message_dispatches_agency_kind_idx
  on message_dispatches (agency_id, kind, created_at desc);

comment on table message_dispatches is
  'One row per automatic message per promoter per period. The unique key is the idempotency lock: the row is inserted as pending before the provider is called. Ids only — no address, no body.';

-- ---------------------------------------------------------------------------
-- Tenant isolation, and who may write
-- ---------------------------------------------------------------------------

alter table message_dispatches enable row level security;
alter table message_dispatches force row level security;

drop policy if exists tenant_isolation_select on message_dispatches;

-- SELECT only. A coordinator's settings screen reads the log; nothing a browser holds may write
-- it. Every insert and update comes from the server on the service role, which bypasses RLS.
create policy tenant_isolation_select on message_dispatches
  for select
  using (agency_id = current_agency_id());

-- Supabase's default privileges grant ALL on new public tables to anon and authenticated.
-- Revoke that explicitly, then give back exactly one verb.
revoke all on message_dispatches from anon;
revoke all on message_dispatches from authenticated;
grant select on message_dispatches to authenticated;

-- ---------------------------------------------------------------------------
-- The owner's switch
-- ---------------------------------------------------------------------------

alter table agencies
  add column if not exists auto_availability_links boolean not null default true;

comment on column agencies.auto_availability_links is
  'When true, the availability link is emailed to a promoter when they are added and to every active promoter on the 1st and 15th (Europe/Athens). Owner-editable (0017).';

-- Column-scoped, exactly like 0015. Postgres refuses an UPDATE that touches any other column, so
-- this cannot reach subscription_status, suspended_at or the Stripe ids.
grant update (auto_availability_links) on agencies to authenticated;

-- 0015's `agency_identity_update` policy already scopes UPDATE on agencies to
-- `id = current_agency_id() and is_agency_owner()`, and policies are per-row, not per-column, so
-- it already covers this column. Restated under its own name anyway, with the identical predicate:
-- permissive policies are OR-ed, so this widens nothing today, and it keeps this column owner-only
-- even if someone later narrows or drops 0015's policy without reading this file.
drop policy if exists agency_messaging_update on agencies;

create policy agency_messaging_update on agencies
  for update
  using (id = current_agency_id() and is_agency_owner())
  with check (id = current_agency_id() and is_agency_owner());

-- ---------------------------------------------------------------------------
-- invitations.channel learns the word 'email'
-- ---------------------------------------------------------------------------

-- `lib/invitations.ts` records the channel an invitation actually went out on. Before this value
-- exists, that best-effort update fails quietly and the invitation keeps 'clipboard'.
-- Postgres 12+ allows ADD VALUE inside a transaction as long as the value is not used in it.
alter type invitation_channel add value if not exists 'email';
