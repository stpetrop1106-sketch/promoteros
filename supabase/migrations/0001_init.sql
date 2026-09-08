-- PromoterOS — initial schema
-- See docs/data-model.md for the reasoning behind these shapes.
-- Conventions: snake_case, timestamptz in UTC, money in integer cents, distance in metres.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type user_role        as enum ('coordinator', 'supervisor', 'admin');
create type promoter_status  as enum ('active', 'paused', 'archived', 'blocklisted');
create type availability_status as enum ('available', 'unavailable');
create type availability_source as enum ('self', 'coordinator', 'inferred');
create type campaign_status  as enum ('draft', 'active', 'completed', 'cancelled');
create type shift_status     as enum ('open', 'partially_filled', 'filled', 'completed', 'cancelled');
create type assignment_status as enum ('confirmed', 'cancelled', 'no_show', 'completed');
create type invitation_status as enum ('pending', 'accepted', 'declined', 'expired', 'superseded');
create type invitation_channel as enum ('clipboard', 'telegram', 'whatsapp', 'viber', 'sms');
create type checkin_method   as enum ('geolocation', 'manual_override', 'coordinator');
create type replacement_trigger as enum ('cancellation', 'no_show', 'manual');
create type replacement_status  as enum ('running', 'filled', 'exhausted', 'stopped');
create type scoring_factor   as enum (
  'distance', 'brand_experience', 'category_experience',
  'skill_overlap', 'brief_completed', 'reliability'
);

-- ---------------------------------------------------------------------------
-- Tenancy and people
-- ---------------------------------------------------------------------------

create table agencies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  country     text not null default 'GR',
  timezone    text not null default 'Europe/Athens',
  created_at  timestamptz not null default now()
);

create table app_users (
  id          uuid primary key references auth.users (id) on delete cascade,
  agency_id   uuid not null references agencies (id) on delete cascade,
  role        user_role not null,
  full_name   text not null,
  email       text not null,
  phone       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table clients (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references agencies (id) on delete cascade,
  name        text not null,
  notes       text,
  created_at  timestamptz not null default now(),
  unique (agency_id, name)
);

create table client_contacts (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references agencies (id) on delete cascade,
  client_id   uuid not null references clients (id) on delete cascade,
  full_name   text not null,
  email       text,
  phone       text,
  role        text
);

-- ---------------------------------------------------------------------------
-- Promoters
-- ---------------------------------------------------------------------------

create table areas (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references agencies (id) on delete cascade,
  name          text not null,
  city          text not null,
  centroid_lat  double precision not null,
  centroid_lng  double precision not null,
  unique (agency_id, name)
);

create table promoters (
  id                uuid primary key default gen_random_uuid(),
  agency_id         uuid not null references agencies (id) on delete cascade,
  full_name         text not null,
  phone             text not null,
  email             text,
  birth_year        integer,
  gender            text,
  home_lat          double precision,
  home_lng          double precision,
  home_area_id      uuid references areas (id) on delete set null,
  has_car           boolean not null default false,
  has_licence       boolean not null default false,
  transport_notes   text,
  status            promoter_status not null default 'active',
  -- Derived nightly from assignment outcomes. 0..1, never edited by hand.
  reliability_score double precision not null default 0.8,
  created_at        timestamptz not null default now(),
  -- Deletion is a scheduled job, not a promise. See CLAUDE.md §2.
  retention_until   date,
  unique (agency_id, phone)
);

create table promoter_areas (
  promoter_id uuid not null references promoters (id) on delete cascade,
  area_id     uuid not null references areas (id) on delete cascade,
  primary key (promoter_id, area_id)
);

create table skills (
  id        uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies (id) on delete cascade,
  name      text not null,
  category  text,
  unique (agency_id, name)
);

create table promoter_skills (
  promoter_id uuid not null references promoters (id) on delete cascade,
  skill_id    uuid not null references skills (id) on delete cascade,
  level       smallint not null default 1 check (level between 1 and 3),
  primary key (promoter_id, skill_id)
);

create table promoter_client_history (
  promoter_id      uuid not null references promoters (id) on delete cascade,
  client_id        uuid not null references clients (id) on delete cascade,
  shifts_completed integer not null default 0,
  last_worked_on   date,
  avg_rating       double precision,
  primary key (promoter_id, client_id)
);

-- ---------------------------------------------------------------------------
-- Availability
-- ---------------------------------------------------------------------------

create table availability (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references agencies (id) on delete cascade,
  promoter_id uuid not null references promoters (id) on delete cascade,
  on_date     date not null,
  status      availability_status not null default 'available',
  -- null/null means the whole day. Partial days are the normal case, not an edge case.
  from_time   time,
  to_time     time,
  source      availability_source not null default 'self',
  created_at  timestamptz not null default now(),
  unique (promoter_id, on_date, from_time)
);

-- ---------------------------------------------------------------------------
-- Campaigns, stores, shifts
-- ---------------------------------------------------------------------------

create table stores (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references agencies (id) on delete cascade,
  client_id     uuid references clients (id) on delete set null,
  name          text not null,
  chain         text,
  address       text,
  lat           double precision not null,
  lng           double precision not null,
  area_id       uuid references areas (id) on delete set null,
  contact_name  text,
  contact_phone text
);

create table campaigns (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references agencies (id) on delete cascade,
  client_id     uuid not null references clients (id) on delete cascade,
  name          text not null,
  campaign_type text,
  starts_on     date not null,
  ends_on       date not null,
  dress_code    text,
  rate_cents    integer not null default 0,
  currency      text not null default 'EUR',
  status        campaign_status not null default 'draft',
  created_at    timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create table briefs (
  id           uuid primary key default gen_random_uuid(),
  agency_id    uuid not null references agencies (id) on delete cascade,
  campaign_id  uuid not null references campaigns (id) on delete cascade,
  title        text not null,
  body_md      text not null default '',
  version      integer not null default 1,
  published_at timestamptz
);

create table brief_ack (
  brief_id        uuid not null references briefs (id) on delete cascade,
  promoter_id     uuid not null references promoters (id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  quiz_score      smallint,
  primary key (brief_id, promoter_id)
);

create table shifts (
  id                  uuid primary key default gen_random_uuid(),
  agency_id           uuid not null references agencies (id) on delete cascade,
  campaign_id         uuid not null references campaigns (id) on delete cascade,
  store_id            uuid not null references stores (id) on delete restrict,
  on_date             date not null,
  start_time          time not null,
  end_time            time not null,
  promoters_required  smallint not null default 1 check (promoters_required > 0),
  rate_cents_override integer,
  supervisor_id       uuid references app_users (id) on delete set null,
  status              shift_status not null default 'open',
  created_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Assignment, invitation, replacement
--
-- The split matters: an invitation is an OFFER with a lifecycle, an assignment is a
-- CONFIRMED booking. A shift can burn through many invitations before it is filled.
-- ---------------------------------------------------------------------------

create table assignments (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references agencies (id) on delete cascade,
  shift_id      uuid not null references shifts (id) on delete cascade,
  promoter_id   uuid not null references promoters (id) on delete cascade,
  status        assignment_status not null default 'confirmed',
  confirmed_at  timestamptz not null default now(),
  cancelled_at  timestamptz,
  cancel_reason text,
  unique (shift_id, promoter_id)
);

create table invitations (
  id              uuid primary key default gen_random_uuid(),
  agency_id       uuid not null references agencies (id) on delete cascade,
  shift_id        uuid not null references shifts (id) on delete cascade,
  promoter_id     uuid not null references promoters (id) on delete cascade,
  -- Store the HASH. The raw token exists only in the link we hand to the promoter.
  token_hash      text not null unique,
  match_score     double precision,
  -- Frozen at send time: we must be able to explain months later why this person was offered
  -- this shift, to the client and to the promoter.
  match_breakdown jsonb,
  channel         invitation_channel not null default 'clipboard',
  sent_at         timestamptz not null default now(),
  expires_at      timestamptz not null,
  responded_at    timestamptz,
  status          invitation_status not null default 'pending',
  decline_reason  text
);

create table replacement_runs (
  id              uuid primary key default gen_random_uuid(),
  agency_id       uuid not null references agencies (id) on delete cascade,
  shift_id        uuid not null references shifts (id) on delete cascade,
  triggered_by    uuid references app_users (id) on delete set null,
  trigger         replacement_trigger not null,
  candidate_ids   uuid[] not null default '{}',
  current_position smallint not null default 0,
  wave_expires_at timestamptz,
  status          replacement_status not null default 'running',
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Check-in and field data
-- ---------------------------------------------------------------------------

-- NOTE: there are deliberately no lat/lng columns here. We compute the distance at capture
-- time and discard the position. This is a legal constraint, not an optimisation — see
-- CLAUDE.md §3 and docs/decisions.md D4.
create table check_ins (
  id                    uuid primary key default gen_random_uuid(),
  agency_id             uuid not null references agencies (id) on delete cascade,
  assignment_id         uuid not null references assignments (id) on delete cascade,
  checked_in_at         timestamptz not null default now(),
  distance_from_store_m integer,
  within_geofence       boolean,
  method                checkin_method not null default 'geolocation',
  override_reason       text,
  unique (assignment_id)
);

create table field_reports (
  id                 uuid primary key default gen_random_uuid(),
  agency_id          uuid not null references agencies (id) on delete cascade,
  assignment_id      uuid not null references assignments (id) on delete cascade,
  shift_id           uuid not null references shifts (id) on delete cascade,
  units_promoted     integer,
  sales_count        integer,
  interactions_count integer,
  stock_issues       text,
  store_manager_name text,
  notes              text,
  submitted_at       timestamptz not null default now(),
  unique (assignment_id)
);

create table report_photos (
  id              uuid primary key default gen_random_uuid(),
  agency_id       uuid not null references agencies (id) on delete cascade,
  field_report_id uuid not null references field_reports (id) on delete cascade,
  storage_path    text not null,
  caption         text,
  taken_at        timestamptz
);

-- ---------------------------------------------------------------------------
-- Matching configuration
-- ---------------------------------------------------------------------------

create table scoring_weights (
  agency_id uuid not null references agencies (id) on delete cascade,
  factor    scoring_factor not null,
  weight    double precision not null default 1,
  params    jsonb not null default '{}'::jsonb,
  primary key (agency_id, factor)
);

-- A null client_id blocks the promoter agency-wide; a set one blocks them for that client
-- only, which is the common real case ("this client asked us not to send her again").
create table blocklist (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references agencies (id) on delete cascade,
  promoter_id uuid not null references promoters (id) on delete cascade,
  client_id   uuid references clients (id) on delete cascade,
  reason      text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes that are not optional
-- ---------------------------------------------------------------------------

create index on availability (promoter_id, on_date);
create index on availability (agency_id, on_date);
create index on promoters (agency_id, status);
create index on shifts (agency_id, on_date);
create index on shifts (campaign_id);
create index on invitations (shift_id, status);
create index on assignments (shift_id, status);
create index on promoter_client_history (client_id);
create index on stores (agency_id);
create index on blocklist (agency_id, promoter_id);
