-- Row Level Security baseline.
--
-- CLAUDE.md §4: agencies in this market compete for the same clients and the same promoters.
-- Tenant isolation is a feature we sell, so it is enforced in the database rather than in
-- application code that someone can forget to write.
--
-- The finer role model (coordinator vs supervisor vs client portal) lands in L4; this
-- migration establishes the invariant that nothing crosses an agency boundary.

create or replace function current_agency_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select agency_id from app_users where id = auth.uid();
$$;

comment on function current_agency_id is
  'The calling user''s agency. Null for anonymous requests, which is why every policy below fails closed.';

do $$
declare
  t text;
  tenant_tables text[] := array[
    'app_users', 'clients', 'client_contacts', 'areas', 'promoters',
    'availability', 'stores', 'campaigns', 'briefs', 'shifts',
    'assignments', 'invitations', 'replacement_runs', 'check_ins',
    'field_reports', 'report_photos', 'scoring_weights', 'blocklist', 'skills'
  ];
begin
  foreach t in array tenant_tables loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format($f$
      create policy tenant_isolation on %I
        for all
        using (agency_id = current_agency_id())
        with check (agency_id = current_agency_id())
    $f$, t);
  end loop;
end $$;

-- Join tables carry no agency_id of their own; they inherit isolation from their parent.
alter table promoter_areas enable row level security;
alter table promoter_areas force row level security;
create policy tenant_isolation on promoter_areas
  for all
  using (exists (
    select 1 from promoters p
    where p.id = promoter_areas.promoter_id and p.agency_id = current_agency_id()
  ))
  with check (exists (
    select 1 from promoters p
    where p.id = promoter_areas.promoter_id and p.agency_id = current_agency_id()
  ));

alter table promoter_skills enable row level security;
alter table promoter_skills force row level security;
create policy tenant_isolation on promoter_skills
  for all
  using (exists (
    select 1 from promoters p
    where p.id = promoter_skills.promoter_id and p.agency_id = current_agency_id()
  ))
  with check (exists (
    select 1 from promoters p
    where p.id = promoter_skills.promoter_id and p.agency_id = current_agency_id()
  ));

alter table promoter_client_history enable row level security;
alter table promoter_client_history force row level security;
create policy tenant_isolation on promoter_client_history
  for all
  using (exists (
    select 1 from promoters p
    where p.id = promoter_client_history.promoter_id and p.agency_id = current_agency_id()
  ))
  with check (exists (
    select 1 from promoters p
    where p.id = promoter_client_history.promoter_id and p.agency_id = current_agency_id()
  ));

alter table brief_ack enable row level security;
alter table brief_ack force row level security;
create policy tenant_isolation on brief_ack
  for all
  using (exists (
    select 1 from briefs b
    where b.id = brief_ack.brief_id and b.agency_id = current_agency_id()
  ))
  with check (exists (
    select 1 from briefs b
    where b.id = brief_ack.brief_id and b.agency_id = current_agency_id()
  ));

-- agencies itself: you may read only your own row.
alter table agencies enable row level security;
alter table agencies force row level security;
create policy own_agency on agencies
  for select
  using (id = current_agency_id());

-- Promoter-facing pages (/i/[token], /c/[token]) are anonymous by design and never query
-- these tables directly — they go through server actions using the service role after the
-- token has been verified. Anonymous access stays closed here on purpose.
