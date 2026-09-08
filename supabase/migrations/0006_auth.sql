-- P1 — Auth: turning a verified Supabase session into a tenant identity.
--
-- `0002_rls.sql` made every policy key off `current_agency_id()`, which reads `app_users` by
-- `auth.uid()`. That leaves exactly one gap: nothing creates the `app_users` row. This migration
-- closes it, and closes it in the shape we want when the second agency signs up rather than the
-- shape that is quickest for the first one (build-plan §2.1).
--
-- The rejected shortcut: "on first sign-in, attach the user to the demo agency". That means
-- anyone who can type an email address into /login joins a live tenant. It would have to be
-- undone the moment there are two agencies, so it is not built.
--
-- Instead: access is granted before the person signs in, never by the act of signing in. A row
-- in `app_user_invites` says "this address belongs to this agency in this role". Sign-in claims
-- it. No invitation means no `app_users` row, which means `current_agency_id()` is null, which
-- means every policy in 0002 fails closed and the user sees nothing at all.
--
-- APPLY THIS BY HAND in the Supabase SQL editor. It is DDL and cannot go through the JS client.

-- ---------------------------------------------------------------------------
-- Who is allowed to become a coordinator
-- ---------------------------------------------------------------------------

create table if not exists app_user_invites (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references agencies (id) on delete cascade,
  email       text not null,
  role        user_role not null default 'coordinator',
  full_name   text not null,
  created_at  timestamptz not null default now(),
  claimed_at  timestamptz,
  claimed_by  uuid references auth.users (id) on delete set null
);

comment on table app_user_invites is
  'Pre-authorisation for coordinator sign-in. An address with no unclaimed row here can hold a '
  'valid Supabase session and still reach no tenant data, because current_agency_id() stays null.';

-- Globally unique, not per-agency: one person is one coordinator of one agency in v1, and
-- app_users.id is the auth user id, so a second agency claiming the same address could not get
-- a second row anyway. Better to reject it here than to fail confusingly at claim time.
create unique index if not exists app_user_invites_email_key
  on app_user_invites (lower(email));

create index if not exists app_user_invites_agency_idx
  on app_user_invites (agency_id);

-- Same isolation rule as every other tenant table (CLAUDE.md §4). An agency sees only the
-- invitations it issued; the provisioning function below reads past this as security definer.
alter table app_user_invites enable row level security;
alter table app_user_invites force row level security;

drop policy if exists tenant_isolation on app_user_invites;
create policy tenant_isolation on app_user_invites
  for all
  using (agency_id = current_agency_id())
  with check (agency_id = current_agency_id());

-- ---------------------------------------------------------------------------
-- Provisioning
-- ---------------------------------------------------------------------------

-- Called by lib/auth.ts on a sign-in that has no app_users row yet. Idempotent, so calling it
-- on every request costs one index lookup and changes nothing.
--
-- Deliberately NOT a trigger on auth.users: that trigger fires when the magic link is
-- *requested*, before the address has proved it can receive mail, so an unverified address
-- would get a tenant row. This runs only once a verified session exists.
create or replace function ensure_app_user()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_email  text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_agency uuid;
  v_invite app_user_invites;
begin
  if v_uid is null then
    return null;
  end if;

  select agency_id into v_agency from app_users where id = v_uid;
  if found then
    return v_agency;
  end if;

  if v_email = '' then
    return null;
  end if;

  select * into v_invite
  from app_user_invites
  where lower(email) = v_email
    and claimed_at is null
  order by created_at
  limit 1;

  if not found then
    return null;
  end if;

  insert into app_users (id, agency_id, role, full_name, email)
  values (
    v_uid,
    v_invite.agency_id,
    v_invite.role,
    coalesce(nullif(btrim(v_invite.full_name), ''), v_email),
    v_email
  )
  on conflict (id) do nothing;

  update app_user_invites
     set claimed_at = now(),
         claimed_by = v_uid
   where id = v_invite.id
     and claimed_at is null;

  select agency_id into v_agency from app_users where id = v_uid;
  return v_agency;
end;
$$;

comment on function ensure_app_user is
  'Claim a pending app_user_invite for the calling verified user. Returns their agency id, or '
  'null when no invitation exists — in which case every RLS policy correctly denies everything.';

revoke execute on function ensure_app_user() from public;
grant execute on function ensure_app_user() to authenticated;

-- ---------------------------------------------------------------------------
-- Operator helper — SQL editor only, never reachable from the application
-- ---------------------------------------------------------------------------

-- Creating the first coordinator by hand is a two-step dance (find the agency id, insert the
-- invite, hope the email casing matches). This makes it one line. See docs/status/P1.md.
create or replace function grant_agency_access(
  p_email     text,
  p_full_name text,
  p_slug      text default 'demo-agency',
  p_role      user_role default 'coordinator'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agency uuid;
  v_uid    uuid;
begin
  select id into v_agency from agencies where slug = p_slug;
  if v_agency is null then
    raise exception 'No agency with slug %. Run the seed first.', p_slug;
  end if;

  insert into app_user_invites (agency_id, email, role, full_name)
  values (v_agency, lower(btrim(p_email)), p_role, p_full_name)
  on conflict ((lower(email))) do update
    set agency_id = excluded.agency_id,
        role      = excluded.role,
        full_name = excluded.full_name
    where app_user_invites.claimed_at is null;

  -- If the person has already signed in once (and bounced off the no-agency screen), attach
  -- them now rather than making them go round again.
  select id into v_uid from auth.users where lower(email) = lower(btrim(p_email));
  if v_uid is not null then
    insert into app_users (id, agency_id, role, full_name, email)
    values (v_uid, v_agency, p_role, p_full_name, lower(btrim(p_email)))
    on conflict (id) do nothing;

    update app_user_invites
       set claimed_at = now(), claimed_by = v_uid
     where lower(email) = lower(btrim(p_email))
       and claimed_at is null;
  end if;

  return v_agency;
end;
$$;

comment on function grant_agency_access is
  'Operator convenience: authorise an email address for an agency. Not granted to anon or '
  'authenticated — run it from the Supabase SQL editor only.';

revoke execute on function grant_agency_access(text, text, text, user_role) from public;
revoke execute on function grant_agency_access(text, text, text, user_role) from anon;
revoke execute on function grant_agency_access(text, text, text, user_role) from authenticated;

-- ---------------------------------------------------------------------------
-- Table privileges
-- ---------------------------------------------------------------------------

-- Until now every query ran on the service role, which needs no grants. The RLS-scoped client
-- connects as `authenticated`, so the tenant tables need table-level privileges as well as
-- policies — a missing GRANT shows up as a permission error, a missing POLICY as an empty list,
-- and the two are easy to confuse when debugging.
--
-- `anon` is pointedly absent. The promoter-facing pages are anonymous but never query these
-- tables directly; they go through the service role after a signed token has been verified.
do $$
declare
  t text;
  tenant_tables text[] := array[
    'app_users', 'app_user_invites', 'clients', 'client_contacts', 'areas',
    'promoters', 'availability', 'stores', 'campaigns', 'briefs', 'shifts', 'assignments',
    'invitations', 'replacement_runs', 'check_ins', 'field_reports', 'report_photos',
    'scoring_weights', 'blocklist', 'skills', 'promoter_areas', 'promoter_skills',
    'promoter_client_history', 'brief_ack', 'campaign_skills'
  ];
begin
  foreach t in array tenant_tables loop
    -- to_regclass rather than a bare GRANT: a table added by a later parcel that has not been
    -- applied yet should not abort this migration.
    if to_regclass(format('public.%I', t)) is not null then
      execute format('grant select, insert, update, delete on %I to authenticated', t);
    end if;
  end loop;
end $$;

-- Read-only: the `own_agency` policy in 0002 permits SELECT and nothing else, and an agency
-- row is created by an operator, never by a coordinator.
grant select on agencies to authenticated;

-- The matching function is `security invoker` by design, so calling it as `authenticated`
-- inherits every policy in 0002 and cannot rank a promoter from another agency.
grant execute on function match_promoters(uuid, integer) to authenticated;
grant execute on function current_agency_id() to authenticated;
