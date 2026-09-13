-- Shift programmes — the "ενότητες" of the Shifts screen.
--
-- An agency's clients each send their own schedules, usually as Excel files: one brand sends a
-- September programme for six Hyper Vega stores, another sends a weekend roadshow. The coordinator
-- thinks in those programmes, not in one flat list of 400 shifts. A programme is that unit: a named
-- group of shifts, always inside one campaign (a shift cannot exist without a campaign, 0001), and
-- optionally remembering the file it was imported from.
--
-- Written by the manager ahead of P37a (sections UI) and P37c (Excel import), so both parcels build
-- on one shape instead of each inventing its own.

create table shift_programmes (
  id               uuid primary key default gen_random_uuid(),
  agency_id        uuid not null references agencies (id) on delete cascade,
  campaign_id      uuid not null references campaigns (id) on delete cascade,
  name             text not null check (length(btrim(name)) between 1 and 120),
  -- 'import' programmes came from a spreadsheet; the filename is kept so a coordinator can answer
  -- "which file did these shifts come from?" three weeks later, when the client disputes a date.
  source           text not null default 'manual' check (source in ('manual', 'import')),
  source_filename  text,
  created_by       uuid references app_users (id) on delete set null,
  created_at       timestamptz not null default now(),
  archived_at      timestamptz,
  -- Target of the composite foreign key below.
  unique (id, agency_id, campaign_id)
);

create index shift_programmes_agency_idx on shift_programmes (agency_id, archived_at);
create index shift_programmes_campaign_idx on shift_programmes (campaign_id);

-- A shift may belong to at most one programme.
alter table shifts add column programme_id uuid;

-- Composite on purpose. A programme id alone would let a shift in campaign A be filed under a
-- programme of campaign B — or, through a bug, under another agency's programme. Referencing
-- (id, agency_id, campaign_id) makes both impossible in the database itself. MATCH SIMPLE (the
-- default) skips the check while programme_id is null, so ungrouped shifts stay legal.
alter table shifts
  add constraint shifts_programme_fk
  foreign key (programme_id, agency_id, campaign_id)
  references shift_programmes (id, agency_id, campaign_id)
  on delete set null (programme_id);

create index shifts_programme_idx on shifts (programme_id);

-- ---------------------------------------------------------------------------
-- Tenant isolation — same invariant as every table in 0002
-- ---------------------------------------------------------------------------

alter table shift_programmes enable row level security;
alter table shift_programmes force row level security;

create policy tenant_isolation on shift_programmes
  for all
  using (agency_id = current_agency_id())
  with check (agency_id = current_agency_id());

grant select, insert, update, delete on shift_programmes to authenticated;

-- ---------------------------------------------------------------------------
-- Backfill: every existing shift gets a home
-- ---------------------------------------------------------------------------
-- One programme per campaign that already has shifts, named after the campaign, so the Shifts
-- screen never opens on a large "ungrouped" bucket the day this ships.

insert into shift_programmes (agency_id, campaign_id, name, source)
select c.agency_id, c.id, left(c.name, 120), 'manual'
from campaigns c
where exists (select 1 from shifts s where s.campaign_id = c.id);

update shifts s
set programme_id = p.id
from shift_programmes p
where p.campaign_id = s.campaign_id
  and p.agency_id = s.agency_id
  and s.programme_id is null;

comment on table shift_programmes is
  'A named group of shifts inside one campaign — the sections of the Shifts screen. Import programmes remember their source file.';
