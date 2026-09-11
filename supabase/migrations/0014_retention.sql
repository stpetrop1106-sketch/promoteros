-- P32 — Gate 1: retention and erasure.
--
-- `promoters.retention_until` has existed since 0001 with nothing enforcing it. An unenforced
-- retention column is worse than no column: it documents an intention we are not honouring.
-- This migration adds the minimum the sweep (`scripts/retention-sweep.ts`) and the erasure
-- path (`lib/erasure.ts`) need, and nothing else.
--
-- MANAGER: this file is written, NOT applied. I cannot run DDL against the live database.
-- Run it in the Supabase SQL editor, then re-run `npx tsx --env-file=.env scripts/retention-sweep.ts`
-- (dry run by default) to confirm it reports rather than errors.
--
-- NOTHING IN THIS FILE DELETES ANYTHING. It adds columns, one table, one index and one
-- constraint. Deletion happens only when a human runs the sweep with --apply.

-- ---------------------------------------------------------------------------
-- 1. The anonymisation marker
-- ---------------------------------------------------------------------------
--
-- We anonymise the promoter row rather than deleting it. See docs/gdpr.md for the per-table
-- reasoning; the short version is that `assignments.promoter_id` is `not null` with
-- `on delete cascade`, so deleting the row would take the agency's shift history — who covered
-- what, how many samples went out — down with it. That history is the agency's business record
-- and stops being personal data once the person behind the id is gone.
--
-- `anonymised_at` is what makes the sweep idempotent: a row that carries it is never processed
-- again, and it is the evidence that the erasure actually happened.
alter table promoters add column if not exists anonymised_at timestamptz;

comment on column promoters.anonymised_at is
  'Set when every identifying field on this row was scrubbed. A row with this set is a tombstone: it exists only so the shift history that references it stays intact. Never null it back out.';

-- ---------------------------------------------------------------------------
-- 2. The declared retention window — deliberately NOT defaulted
-- ---------------------------------------------------------------------------
--
-- CLAUDE.md rule for this parcel: never invent a retention period. So this column is
-- nullable with NO default. Null means "this agency has not declared a policy yet", and the
-- sweep will not infer one — it reports the gap and touches nothing.
--
-- PROPOSED VALUE, AWAITING THE FOUNDER'S CONFIRMATION: 24 months after the promoter's last
-- activity. The reasoning is operational, not legal: promotion work is seasonal, so a promoter
-- who last worked one Christmas is still a live prospect the next, and two cycles is the
-- shortest window that does not throw away a usable roster. The competing candidate is 60
-- months, which is where you land if you tie promoter records to the limitation period for
-- wage claims and to accounting-record retention. Those are questions for the founder's
-- lawyer and accountant — this migration takes no position, it only provides the field.
alter table agencies add column if not exists promoter_retention_months integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'agencies_promoter_retention_months_check'
  ) then
    alter table agencies add constraint agencies_promoter_retention_months_check
      check (promoter_retention_months is null or promoter_retention_months between 1 and 240);
  end if;
end $$;

comment on column agencies.promoter_retention_months is
  'How long a promoter''s identifying record is kept after their last activity. NULL = no policy declared; the retention sweep reports the gap and infers nothing. 24 is proposed and unconfirmed — see docs/gdpr.md.';

-- ---------------------------------------------------------------------------
-- 3. Controller identity for the promoter privacy notice
-- ---------------------------------------------------------------------------
--
-- The controller for promoter data is the AGENCY, not us — we are the processor. /privacy/promoters
-- refuses to render without a real legal name and a real contact address rather than showing a
-- placeholder, so those have to live somewhere. They live here, per agency, because the answer is
-- different for every customer.
alter table agencies add column if not exists legal_name text;
alter table agencies add column if not exists privacy_contact_email text;

comment on column agencies.legal_name is
  'The registered legal entity that is the data controller for this agency''s promoters. /privacy/promoters will not render without it.';
comment on column agencies.privacy_contact_email is
  'Where a promoter sends an access or erasure request. Reaches the agency, never us. /privacy/promoters will not render without it.';

-- ---------------------------------------------------------------------------
-- 4. Evidence that an erasure happened
-- ---------------------------------------------------------------------------
--
-- GDPR Art. 5(2) is accountability: being able to show what we did, not just assert it. This
-- table holds no personal data — a promoter id that now points at a scrubbed tombstone, a
-- timestamp, a reason code and per-table counts.
create table if not exists promoter_erasures (
  id           uuid primary key default gen_random_uuid(),
  agency_id    uuid not null references agencies (id) on delete cascade,
  promoter_id  uuid not null references promoters (id) on delete cascade,
  -- 'retention_sweep' | 'subject_request' | 'manual'
  reason       text not null,
  -- Who ran it. Null when the sweep ran headless from a machine, which is the normal case.
  actor_user_id uuid references app_users (id) on delete set null,
  -- {"availability": 12, "invitations": 4, ...} — what was deleted, for the audit trail.
  deleted_counts jsonb not null default '{}'::jsonb,
  -- Free text that survived anonymisation and needs a human eye. See docs/gdpr.md.
  residual_notes text,
  created_at   timestamptz not null default now(),
  unique (promoter_id)
);

comment on table promoter_erasures is
  'One row per erased promoter. Contains no personal data by construction — it is the receipt, not the record.';

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'promoter_erasures' and policyname = 'tenant_isolation'
  ) then
    alter table promoter_erasures enable row level security;
    alter table promoter_erasures force row level security;
    create policy tenant_isolation on promoter_erasures
      for all
      using (agency_id = current_agency_id())
      with check (agency_id = current_agency_id());
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Indexes
-- ---------------------------------------------------------------------------
--
-- The sweep's only hot query: rows whose retention date has passed and that have not already
-- been dealt with. Partial, because that set should always be small and usually empty.
create index if not exists promoters_retention_due_idx
  on promoters (agency_id, retention_until)
  where retention_until is not null and anonymised_at is null;

create index if not exists promoter_erasures_agency_idx
  on promoter_erasures (agency_id, created_at desc);
