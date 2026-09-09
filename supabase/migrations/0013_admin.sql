-- P18 — Admin console: platform admins, an append-only audit log, and the cross-tenant
-- read/write functions the console is allowed to use instead of a SQL console.
--
-- docs/commercial-architecture.md §5 (what we can see) and §7 (schema). This is the most
-- sensitive surface in the product: it sees across every tenant. Every choice below exists so
-- that "did anyone at PromoterOS look at our data?" has a real answer, not an assurance.
--
-- Three design decisions, worth reading before changing anything:
--
--   1. `platform_admins` is entirely separate from `app_users`, exactly like 0011 kept billing
--      role changes out of reach of a coordinator's browser. It has RLS enabled and FORCED, no
--      policies at all, and zero table privileges granted to `authenticated` or `anon`. There
--      is no query shape — not even "select my own row" — that reaches it from the browser.
--      The only paths to it are the SECURITY DEFINER functions below (owned by the migration
--      role, which is why they can still read it) and the Supabase SQL editor. Nothing here can
--      turn an agency owner into a platform admin by them editing their own row, because there
--      is no row of theirs to edit.
--
--   2. `admin_audit_log` is genuinely append-only. `authenticated` is granted INSERT and SELECT
--      and nothing else — UPDATE and DELETE are revoked from `authenticated`, `anon`, AND
--      `service_role`. That last one matters: the service-role client (lib/supabase/admin.ts)
--      bypasses RLS entirely, so if this table only relied on policies, a future bug in admin
--      code that reached for the service role could still edit history. Revoking at the grant
--      level closes that regardless of which client calls it. The only way to alter a row after
--      the fact is the Supabase SQL editor as the table owner — a deliberate, logged-outside-
--      the-product escape hatch, not a code path.
--
--   3. Every cross-tenant read and every mutating action is its own named SECURITY DEFINER
--      function, not a generic query surface. commercial-architecture.md §5 is explicit that a
--      raw SQL console is not a feature — "if it is needed, it is a missing admin tool." So the
--      tools are built instead: `admin_list_agencies`, `admin_agency_summary`,
--      `admin_view_agency_activity`, `admin_extend_trial`, `admin_change_plan`,
--      `admin_suspend_agency` / `admin_unsuspend_agency`, `admin_mark_deletion_request` /
--      `admin_clear_deletion_request`, `admin_audit_log_query`, `admin_list_platform_admins`,
--      `admin_waitlist_stats`, `admin_waitlist_recent`. Every one of them re-checks
--      `is_platform_admin()` itself — none of them trust that only the console's own UI calls
--      them, because PostgREST would let anyone with a session call them directly.
--
-- A fourth thing, not obvious from the shape of the functions: aggregates (counts, plan,
-- subscription status, trial end, the suspended/deletion flags) are available with no reason
-- and no audit row, because commercial-architecture.md §5's table says so explicitly
-- ("Listing agencies, subscription state and usage counts | Always available. Aggregates, not
-- contents."). Only named records — recent campaigns and shifts, in `admin_view_agency_activity`
-- — are "a customer's operational data" and therefore reason-gated and logged. Deliberately not
-- included even there: promoter names and phone numbers. The console never needs to show an
-- individual promoter's personal data to answer "is this customer healthy," and CLAUDE.md's
-- data-minimisation instinct applies to us looking at customer data just as much as to what we
-- collect from promoters.
--
-- APPLY THIS BY HAND in the Supabase SQL editor, in order: STEP 1, then STEP 2, then (once,
-- manually, for the first admin) STEP 3.

-- ===========================================================================
-- STEP 1 — platform_admins and the membership check.
-- ===========================================================================

create table if not exists platform_admins (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null,
  created_at timestamptz not null default now()
);

comment on table platform_admins is
  'Platform staff, not an agency role — deliberately separate from app_users so an agency owner '
  'can never become a platform admin by editing their own row. No table privileges are granted '
  'to authenticated or anon; every read goes through a SECURITY DEFINER function below. This '
  'table changes only via the service role or by hand in the SQL editor — see STEP 3.';

alter table platform_admins enable row level security;
alter table platform_admins force row level security;
-- No policy is created, on purpose: even "select my own row" is a query shape we do not want
-- reachable from PostgREST. authenticated/anon get zero grants below, so there is no policy to
-- evaluate in the first place — this is belt-and-braces, not the only lock.
revoke all on platform_admins from authenticated, anon;

create or replace function is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from platform_admins where id = auth.uid());
$$;

comment on function is_platform_admin is
  'The gate for the whole /admin route segment and every function below. SECURITY DEFINER so it '
  'can read platform_admins despite that table granting authenticated nothing directly.';

revoke execute on function is_platform_admin() from public;
grant execute on function is_platform_admin() to authenticated;

create or replace function current_platform_admin_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select full_name from platform_admins where id = auth.uid();
$$;

revoke execute on function current_platform_admin_name() from public;
grant execute on function current_platform_admin_name() to authenticated;

-- ===========================================================================
-- STEP 2 — the audit log, the agency flags it references, and the admin tools.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- admin_audit_log — append-only, no exceptions.
-- ---------------------------------------------------------------------------

create table if not exists admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid not null references platform_admins (id) on delete restrict,
  action      text not null check (btrim(action) <> ''),
  agency_id   uuid references agencies (id) on delete set null,
  target_type text,
  target_id   uuid,
  -- A typed reason, not a checkbox. commercial-architecture.md §6: "the audit log is not
  -- filterable to nothing" only matters if what is in it is actually informative.
  reason      text not null check (char_length(btrim(reason)) >= 10),
  created_at  timestamptz not null default now()
);

comment on table admin_audit_log is
  'Who looked at what, when, and why. Append-only: authenticated gets INSERT and SELECT only. '
  'UPDATE and DELETE are revoked from authenticated, anon, AND service_role below, so no code '
  'path in this application — including a future bug that reaches for the service-role client — '
  'can alter or remove a row. Only the table owner in the SQL editor can.';

create index if not exists admin_audit_log_admin_idx on admin_audit_log (admin_id);
create index if not exists admin_audit_log_agency_idx on admin_audit_log (agency_id);
create index if not exists admin_audit_log_created_idx on admin_audit_log (created_at desc);

alter table admin_audit_log enable row level security;
alter table admin_audit_log force row level security;

drop policy if exists admin_audit_select on admin_audit_log;
create policy admin_audit_select on admin_audit_log
  for select
  using (is_platform_admin());

drop policy if exists admin_audit_insert on admin_audit_log;
create policy admin_audit_insert on admin_audit_log
  for insert
  with check (is_platform_admin() and admin_id = auth.uid());

-- Deliberately no UPDATE or DELETE policy exists, for anyone, at all.

revoke update, delete on admin_audit_log from authenticated, anon, service_role;
grant select, insert on admin_audit_log to authenticated;
revoke all on admin_audit_log from anon;

-- Internal helper: validate the caller is a platform admin, validate the reason, write the row.
-- Not granted to anyone — it is called only from inside the SECURITY DEFINER functions below,
-- which run as this function's owner regardless of who is invoking them through PostgREST.
create or replace function _admin_write_audit(
  p_action      text,
  p_agency_id   uuid,
  p_target_type text,
  p_target_id   uuid,
  p_reason      text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_reason text := btrim(coalesce(p_reason, ''));
  v_id     uuid;
begin
  if v_uid is null or not exists (select 1 from platform_admins where id = v_uid) then
    raise exception 'not_platform_admin';
  end if;

  if p_action is null or btrim(p_action) = '' then
    raise exception 'action_required';
  end if;

  if length(v_reason) < 10 then
    raise exception 'reason_required';
  end if;

  insert into admin_audit_log (admin_id, action, agency_id, target_type, target_id, reason)
  values (v_uid, btrim(p_action), p_agency_id, p_target_type, p_target_id, v_reason)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function _admin_write_audit(text, uuid, text, uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Agency flags this console needs, that nothing else owns.
-- ---------------------------------------------------------------------------
--
-- Both nullable timestamps, both reversible by clearing them, neither destructive on its own.
-- Deliberately NOT reusing `agencies.subscription_status`: that column is written only by the
-- Stripe webhook (P17, migration 0012) and re-purposing one of its values for "suspended by
-- platform admin" would mean a later webhook delivery could silently un-suspend an agency by
-- overwriting the column with whatever Stripe last reported. A suspension the payment processor
-- can accidentally undo is not a suspension.

alter table agencies add column if not exists suspended_at timestamptz;
alter table agencies add column if not exists deletion_requested_at timestamptz;

comment on column agencies.suspended_at is
  'Set by admin_suspend_agency, cleared by admin_unsuspend_agency. Reversible, never deletes '
  'anything. NOTE: not yet enforced anywhere an agency user actually signs in or acts — see '
  'docs/status/P18.md "Requests to other lanes". Today this is a visible, audited flag; making '
  'it block access is a change to lib/auth.ts / middleware.ts, which this parcel does not own.';

comment on column agencies.deletion_requested_at is
  'Set by admin_mark_deletion_request when a promoter or agency exercises an erasure right. '
  'Marks the request only — the two-step, export-first erasure flow itself is Gate 1 work '
  '(build-plan.md §11, item G3) and is deliberately not built here.';

-- ---------------------------------------------------------------------------
-- Reads that need no reason: aggregates, not contents.
-- ---------------------------------------------------------------------------

create or replace function admin_list_agencies()
returns table (
  agency_id              uuid,
  name                   text,
  plan                   text,
  subscription_status    text,
  trial_ends_at          timestamptz,
  created_at             timestamptz,
  suspended_at           timestamptz,
  deletion_requested_at  timestamptz,
  user_count             bigint,
  promoter_count         bigint,
  campaign_count         bigint,
  shift_count            bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_platform_admin() then
    raise exception 'not_platform_admin';
  end if;

  return query
    select
      a.id,
      a.name,
      a.plan,
      a.subscription_status,
      a.trial_ends_at,
      a.created_at,
      a.suspended_at,
      a.deletion_requested_at,
      (select count(*) from app_users u where u.agency_id = a.id and u.active),
      (select count(*) from promoters p where p.agency_id = a.id),
      (select count(*) from campaigns c where c.agency_id = a.id),
      (select count(*) from shifts sh where sh.agency_id = a.id)
    from agencies a
    order by a.created_at desc;
end;
$$;

comment on function admin_list_agencies is
  'Every agency, with usage counts. No reason, no audit row — commercial-architecture.md §5: '
  'listing agencies and usage counts is always available because these are aggregates.';

revoke execute on function admin_list_agencies() from public;
grant execute on function admin_list_agencies() to authenticated;

create or replace function admin_agency_summary(p_agency_id uuid)
returns table (
  agency_id              uuid,
  name                   text,
  slug                   text,
  city                   text,
  timezone               text,
  plan                   text,
  subscription_status    text,
  trial_ends_at          timestamptz,
  created_at             timestamptz,
  suspended_at           timestamptz,
  deletion_requested_at  timestamptz,
  seat_limit             integer,
  promoter_limit         integer,
  user_count             bigint,
  promoter_count         bigint,
  campaign_count         bigint,
  shift_count            bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_platform_admin() then
    raise exception 'not_platform_admin';
  end if;

  if not exists (select 1 from agencies where id = p_agency_id) then
    raise exception 'agency_not_found';
  end if;

  return query
    select
      a.id, a.name, a.slug, a.city, a.timezone, a.plan, a.subscription_status,
      a.trial_ends_at, a.created_at, a.suspended_at, a.deletion_requested_at,
      a.seat_limit, a.promoter_limit,
      (select count(*) from app_users u where u.agency_id = a.id and u.active),
      (select count(*) from promoters p where p.agency_id = a.id),
      (select count(*) from campaigns c where c.agency_id = a.id),
      (select count(*) from shifts sh where sh.agency_id = a.id)
    from agencies a
    where a.id = p_agency_id;
end;
$$;

comment on function admin_agency_summary is
  'One agency''s aggregates for the detail page header. Same "no reason needed" rule as '
  'admin_list_agencies — still counts, not contents.';

revoke execute on function admin_agency_summary(uuid) from public;
grant execute on function admin_agency_summary(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- The one read that IS a customer's operational data: reason required, logged first.
-- ---------------------------------------------------------------------------
--
-- Deliberately excludes promoter names and phone numbers — see the file header. It shows what a
-- support conversation usually needs (recent campaigns and shifts), not a full data dump.

create or replace function admin_view_agency_activity(p_agency_id uuid, p_reason text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  if not exists (select 1 from agencies where id = p_agency_id) then
    raise exception 'agency_not_found';
  end if;

  -- Writes the audit row BEFORE any of the data below is selected. Not after, not optionally —
  -- commercial-architecture.md §5.
  perform _admin_write_audit('view_agency_activity', p_agency_id, 'agency', p_agency_id, p_reason);

  select json_build_object(
    'recent_campaigns', (
      select coalesce(json_agg(x), '[]'::json) from (
        select id, name, status, starts_on, ends_on, created_at
        from campaigns
        where agency_id = p_agency_id
        order by created_at desc
        limit 10
      ) x
    ),
    'recent_shifts', (
      select coalesce(json_agg(x), '[]'::json) from (
        select
          sh.id, sh.on_date, sh.start_time, sh.end_time, sh.status,
          st.name as store_name, c.name as campaign_name
        from shifts sh
        join stores st on st.id = sh.store_id
        join campaigns c on c.id = sh.campaign_id
        where sh.agency_id = p_agency_id
        order by sh.on_date desc, sh.created_at desc
        limit 10
      ) x
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function admin_view_agency_activity(uuid, text) from public;
grant execute on function admin_view_agency_activity(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Actions. Every one logged with a reason, every one reversible or additive — never destructive.
-- ---------------------------------------------------------------------------

create or replace function admin_extend_trial(p_agency_id uuid, p_days integer, p_reason text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new timestamptz;
begin
  if not exists (select 1 from agencies where id = p_agency_id) then
    raise exception 'agency_not_found';
  end if;
  if p_days is null or p_days <= 0 or p_days > 365 then
    raise exception 'invalid_days';
  end if;

  perform _admin_write_audit('extend_trial', p_agency_id, 'agency', p_agency_id, p_reason);

  update agencies
     set trial_ends_at = greatest(coalesce(trial_ends_at, now()), now()) + make_interval(days => p_days)
   where id = p_agency_id
  returning trial_ends_at into v_new;

  return v_new;
end;
$$;

revoke execute on function admin_extend_trial(uuid, integer, text) from public;
grant execute on function admin_extend_trial(uuid, integer, text) to authenticated;

create or replace function admin_change_plan(p_agency_id uuid, p_plan text, p_reason text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from agencies where id = p_agency_id) then
    raise exception 'agency_not_found';
  end if;
  if p_plan not in ('starter', 'agency', 'multi_brand') then
    raise exception 'invalid_plan';
  end if;

  perform _admin_write_audit('change_plan', p_agency_id, 'agency', p_agency_id, p_reason);

  update agencies set plan = p_plan where id = p_agency_id;

  return p_plan;
end;
$$;

revoke execute on function admin_change_plan(uuid, text, text) from public;
grant execute on function admin_change_plan(uuid, text, text) to authenticated;

create or replace function admin_suspend_agency(p_agency_id uuid, p_reason text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_when timestamptz;
begin
  if not exists (select 1 from agencies where id = p_agency_id) then
    raise exception 'agency_not_found';
  end if;
  if exists (select 1 from agencies where id = p_agency_id and suspended_at is not null) then
    raise exception 'already_suspended';
  end if;

  perform _admin_write_audit('suspend_agency', p_agency_id, 'agency', p_agency_id, p_reason);

  update agencies set suspended_at = now() where id = p_agency_id
  returning suspended_at into v_when;

  return v_when;
end;
$$;

revoke execute on function admin_suspend_agency(uuid, text) from public;
grant execute on function admin_suspend_agency(uuid, text) to authenticated;

create or replace function admin_unsuspend_agency(p_agency_id uuid, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from agencies where id = p_agency_id) then
    raise exception 'agency_not_found';
  end if;
  if exists (select 1 from agencies where id = p_agency_id and suspended_at is null) then
    raise exception 'not_suspended';
  end if;

  perform _admin_write_audit('unsuspend_agency', p_agency_id, 'agency', p_agency_id, p_reason);

  update agencies set suspended_at = null where id = p_agency_id;

  return true;
end;
$$;

revoke execute on function admin_unsuspend_agency(uuid, text) from public;
grant execute on function admin_unsuspend_agency(uuid, text) to authenticated;

create or replace function admin_mark_deletion_request(p_agency_id uuid, p_reason text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_when timestamptz;
begin
  if not exists (select 1 from agencies where id = p_agency_id) then
    raise exception 'agency_not_found';
  end if;

  perform _admin_write_audit('mark_deletion_request', p_agency_id, 'agency', p_agency_id, p_reason);

  update agencies set deletion_requested_at = now() where id = p_agency_id
  returning deletion_requested_at into v_when;

  return v_when;
end;
$$;

revoke execute on function admin_mark_deletion_request(uuid, text) from public;
grant execute on function admin_mark_deletion_request(uuid, text) to authenticated;

create or replace function admin_clear_deletion_request(p_agency_id uuid, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from agencies where id = p_agency_id) then
    raise exception 'agency_not_found';
  end if;

  perform _admin_write_audit('clear_deletion_request', p_agency_id, 'agency', p_agency_id, p_reason);

  update agencies set deletion_requested_at = null where id = p_agency_id;

  return true;
end;
$$;

revoke execute on function admin_clear_deletion_request(uuid, text) from public;
grant execute on function admin_clear_deletion_request(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Audit log viewer.
-- ---------------------------------------------------------------------------
--
-- Reading the log is not itself logged (it is the admin's own control tool, not customer data —
-- logging every glance at the audit log would just be noise competing with the entries that
-- matter). Filters narrow the list; none of them can hide an admin's own rows, because there is
-- no "exclude me" filter, only "which admin" (default: all of them).

create or replace function admin_audit_log_query(
  p_admin_id  uuid default null,
  p_agency_id uuid default null,
  p_from      timestamptz default null,
  p_to        timestamptz default null,
  p_limit     integer default 100
)
returns table (
  id          uuid,
  admin_id    uuid,
  admin_name  text,
  action      text,
  agency_id   uuid,
  agency_name text,
  target_type text,
  target_id   uuid,
  reason      text,
  created_at  timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_platform_admin() then
    raise exception 'not_platform_admin';
  end if;

  return query
    select
      l.id, l.admin_id, pa.full_name, l.action, l.agency_id, ag.name,
      l.target_type, l.target_id, l.reason, l.created_at
    from admin_audit_log l
    left join platform_admins pa on pa.id = l.admin_id
    left join agencies ag on ag.id = l.agency_id
    where (p_admin_id is null or l.admin_id = p_admin_id)
      and (p_agency_id is null or l.agency_id = p_agency_id)
      and (p_from is null or l.created_at >= p_from)
      and (p_to is null or l.created_at <= p_to)
    order by l.created_at desc
    limit least(coalesce(p_limit, 100), 500);
end;
$$;

revoke execute on function admin_audit_log_query(uuid, uuid, timestamptz, timestamptz, integer) from public;
grant execute on function admin_audit_log_query(uuid, uuid, timestamptz, timestamptz, integer) to authenticated;

create or replace function admin_list_platform_admins()
returns table (id uuid, full_name text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_platform_admin() then
    raise exception 'not_platform_admin';
  end if;

  return query select p.id, p.full_name from platform_admins p order by p.full_name;
end;
$$;

comment on function admin_list_platform_admins is
  'For the audit-log filter dropdown. Every admin can see every other admin''s name and id here '
  '— that is the point of a shared audit trail, not a leak.';

revoke execute on function admin_list_platform_admins() from public;
grant execute on function admin_list_platform_admins() to authenticated;

-- ---------------------------------------------------------------------------
-- Waitlist — read-only, product leads, not tenant data.
-- ---------------------------------------------------------------------------

create or replace function admin_waitlist_stats()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  if not is_platform_admin() then
    raise exception 'not_platform_admin';
  end if;

  select json_build_object(
    'total', (select count(*) from waitlist_signups),
    'by_promoter_count', (
      select coalesce(json_agg(x), '[]'::json) from (
        select promoter_count, count(*) as n
        from waitlist_signups
        group by promoter_count
        order by promoter_count
      ) x
    ),
    'by_utm_source', (
      select coalesce(json_agg(x), '[]'::json) from (
        select utm_source, count(*) as n
        from waitlist_signups
        group by utm_source
        order by n desc
      ) x
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function admin_waitlist_stats() from public;
grant execute on function admin_waitlist_stats() to authenticated;

create or replace function admin_waitlist_recent(p_limit integer default 50)
returns table (
  id             uuid,
  full_name      text,
  work_email     text,
  company_name   text,
  promoter_count text,
  utm_source     text,
  created_at     timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_platform_admin() then
    raise exception 'not_platform_admin';
  end if;

  return query
    select w.id, w.full_name, w.work_email, w.company_name, w.promoter_count, w.utm_source, w.created_at
    from waitlist_signups w
    order by w.created_at desc
    limit least(coalesce(p_limit, 50), 200);
end;
$$;

revoke execute on function admin_waitlist_recent(integer) from public;
grant execute on function admin_waitlist_recent(integer) to authenticated;

-- ===========================================================================
-- STEP 3 — seed the first platform admin. Manual, deliberate, never automated.
-- ===========================================================================
--
-- There is no self-serve path to platform_admins by design (see the grants in STEP 1), and this
-- migration does not insert a row for anyone. Run the statement below BY HAND, once, in the SQL
-- editor, after the person has signed in at least once through the normal /login magic-link flow
-- (so a matching auth.users row exists). Replace the email if seeding someone other than Stella.
--
--   insert into platform_admins (id, full_name)
--   select id, 'Stella'
--   from auth.users
--   where lower(email) = lower('st.petrop1106@gmail.com')
--   on conflict (id) do nothing;
--
-- Verify it worked:
--
--   select id, full_name, created_at from platform_admins;
--
-- Until this runs, /admin is unreachable for everyone — including Stella — which is correct:
-- a console with nobody in platform_admins should show a 404 to the whole world.
