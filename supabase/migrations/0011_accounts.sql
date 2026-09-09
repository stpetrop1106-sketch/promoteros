-- P19 — Accounts, team and onboarding.
--
-- Until now the only way to get an account was for someone with database access to run
-- `select grant_agency_access(...)` in the SQL editor (see docs/status/P1.md). That is a
-- hand-operated prototype. This migration is what turns it into a product: an agency can sign
-- itself up, and its owner can invite their own staff, with nobody touching SQL.
--
-- docs/commercial-architecture.md §1 (account model), §2 (sign-up), §7 (schema).
--
-- Three things here are security, not convenience, and are worth reading before changing:
--
--   1. `authenticated` loses INSERT/UPDATE/DELETE on `app_users`. A server action is a public
--      HTTP endpoint and so is PostgREST itself: with the anon key and any staff session, a
--      coordinator could previously have run
--          update app_users set role = 'owner' where id = <their own id>
--      and the 0002 policy (`agency_id = current_agency_id()`) would have allowed it, because
--      the row really is in their agency. Application-side role checks cannot stop that — the
--      browser can skip the application. So every role/membership write now goes through a
--      `security definer` function that re-derives the actor from `auth.uid()`, and the table
--      itself is no longer writable by the role the browser holds.
--
--   2. `current_agency_id()` now requires `active`. Removing a user sets `active = false`;
--      before this change that user kept a working `current_agency_id()` and therefore kept
--      full RLS read access to the agency they had just been removed from. `lib/auth.ts`
--      already refused them at the application layer, but PostgREST would not have.
--
--   3. An invitation's agency comes from the token, never from the request. `accept_agency_
--      invitation` takes only a token hash; the agency, the role and the permitted email
--      address are all read off the stored row.
--
-- APPLY THIS BY HAND in the Supabase SQL editor. It is DDL and cannot go through the JS client.

-- ===========================================================================
-- STEP 1 — run this single statement on its own, before the rest of the file.
-- ===========================================================================
--
-- `alter type ... add value` cannot be used in the same transaction that uses the new value,
-- and on older servers cannot run inside a transaction block at all. The Supabase SQL editor
-- wraps a pasted script in one transaction, so run this line by itself, then run STEP 2.
--
-- Nothing below refers to the literal 'owner' at DDL-parse time — every reference is either
-- `role::text = 'owner'` (a plain text comparison, resolvable before the value exists) or lives
-- inside a plpgsql body, which is not resolved until it runs. So STEP 2 will still apply
-- cleanly if the two steps do end up in one transaction; running them separately is the
-- belt-and-braces order, not a workaround for a bug.
--
-- The value is appended, so the enum's sort order becomes
-- coordinator < supervisor < admin < owner. Nothing in the codebase compares roles ordinally;
-- if a screen ever wants owners first it must order explicitly, not rely on the enum.

alter type user_role add value if not exists 'owner';

-- ===========================================================================
-- STEP 2 — the rest of the migration.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- agencies: the commercial columns
-- ---------------------------------------------------------------------------
--
-- The Stripe columns (stripe_customer_id, stripe_subscription_id) are deliberately NOT added
-- here. They belong to the billing parcel (P17), which owns its own migration; adding them now
-- would mean two parcels writing the same shape.

alter table agencies add column if not exists city text;

alter table agencies add column if not exists plan text not null default 'starter';

alter table agencies add column if not exists subscription_status text not null default 'trialing';

alter table agencies add column if not exists trial_ends_at timestamptz;

-- Starter tier, per docs/commercial-architecture.md §3. Every self-serve signup starts here and
-- the billing webhook moves it later; no signup path may choose its own limits.
alter table agencies add column if not exists seat_limit integer not null default 3;

alter table agencies add column if not exists promoter_limit integer not null default 150;

-- Plain text with a check rather than enums: P17 will add tiers and states, and extending a
-- check constraint is an ordinary transaction while extending an enum is the dance in STEP 1.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'agencies_plan_check') then
    alter table agencies add constraint agencies_plan_check
      check (plan in ('starter', 'agency', 'multi_brand'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'agencies_subscription_status_check') then
    alter table agencies add constraint agencies_subscription_status_check
      check (subscription_status in ('trialing', 'active', 'past_due', 'canceled', 'paused'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'agencies_seat_limit_check') then
    alter table agencies add constraint agencies_seat_limit_check
      check (seat_limit > 0 and promoter_limit > 0);
  end if;
end $$;

-- Existing rows (the demo agency) predate the trial clock. Give them one rather than leaving a
-- null that every later `trial_ends_at < now()` check would have to special-case.
update agencies set trial_ends_at = now() + interval '14 days' where trial_ends_at is null;

comment on column agencies.seat_limit is
  'Maximum active staff logins. Enforced when an invitation is issued AND again when it is '
  'accepted — an invitation issued under the old limit must not be able to overshoot a '
  'downgraded plan days later.';

-- ---------------------------------------------------------------------------
-- app_users: who invited whom, and when they actually arrived
-- ---------------------------------------------------------------------------

alter table app_users add column if not exists invited_by uuid references app_users (id) on delete set null;
alter table app_users add column if not exists invited_at timestamptz;
alter table app_users add column if not exists accepted_at timestamptz;

comment on column app_users.accepted_at is
  'When this person first signed in and claimed their invitation. Null for rows created by the '
  'operator helper grant_agency_access() before the person ever appeared.';

-- ---------------------------------------------------------------------------
-- agency_invitations
-- ---------------------------------------------------------------------------
--
-- Same discipline as promoter `invitations` (lib/tokens.ts, lib/invitations.ts): the raw token
-- exists in the email and nowhere else, only its SHA-256 hash is stored, and the row is
-- single-use and expiring. A database leak hands nobody a working invitation.

create table if not exists agency_invitations (
  -- The id is normally supplied by the caller, because the signed token has to carry it. The
  -- default is there so a hand-written row in the SQL editor is not a trap.
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references agencies (id) on delete cascade,
  email       text not null,
  role        user_role not null,
  token_hash  text not null,
  invited_by  uuid references app_users (id) on delete set null,
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);

comment on table agency_invitations is
  'A pending offer of a staff login inside one agency. The agency, role and permitted email '
  'address are read off this row at accept time and never taken from the request, so holding a '
  'token can only ever join you to the agency that issued it, in the role it chose.';

create unique index if not exists agency_invitations_token_hash_key
  on agency_invitations (token_hash);

-- One outstanding invitation per address per agency: re-inviting replaces rather than piles up.
create unique index if not exists agency_invitations_pending_key
  on agency_invitations (agency_id, lower(email))
  where accepted_at is null;

create index if not exists agency_invitations_agency_idx
  on agency_invitations (agency_id);

-- Same isolation rule as every other tenant table (CLAUDE.md §4): an invitation is visible only
-- inside the agency that issued it. The accept path reads past this as `security definer`,
-- because the person accepting is by definition not yet a member of anything.
alter table agency_invitations enable row level security;
alter table agency_invitations force row level security;

drop policy if exists tenant_isolation on agency_invitations;
create policy tenant_isolation on agency_invitations
  for all
  using (agency_id = current_agency_id())
  with check (agency_id = current_agency_id());

-- ---------------------------------------------------------------------------
-- current_agency_id(): a removed user must actually lose access
-- ---------------------------------------------------------------------------
--
-- Replaces the 0002 definition. `active = false` is how a removal is recorded (archive, not
-- delete — docs/commercial-architecture.md §6), and without this clause a removed coordinator
-- kept a valid agency id and therefore kept every RLS grant in 0002.

create or replace function current_agency_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select agency_id from app_users where id = auth.uid() and active;
$$;

comment on function current_agency_id is
  'The calling user''s agency, or null when they have none or have been deactivated. Every '
  'tenant policy keys off this, so null fails closed.';

-- ---------------------------------------------------------------------------
-- is_agency_owner()
-- ---------------------------------------------------------------------------
--
-- `role::text = 'owner'` rather than `role = 'owner'::user_role` on purpose: a text comparison
-- resolves at DDL time even if STEP 1 has not been committed yet. See the note in STEP 1.

create or replace function is_agency_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from app_users
    where id = auth.uid() and active and role::text = 'owner'
  );
$$;

comment on function is_agency_owner is
  'True when the caller is an active owner of their agency. Server actions must call this (or a '
  'function that does) rather than trusting a role carried in a form field.';

-- ---------------------------------------------------------------------------
-- Self-serve signup
-- ---------------------------------------------------------------------------

create or replace function create_agency_for_user(
  p_name      text,
  p_city      text default null,
  p_timezone  text default 'Europe/Athens',
  p_full_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_email  text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_name   text := btrim(coalesce(p_name, ''));
  v_city   text := nullif(btrim(coalesce(p_city, '')), '');
  v_tz     text := nullif(btrim(coalesce(p_timezone, '')), '');
  v_base   text;
  v_slug   text;
  v_agency uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if v_email = '' then
    raise exception 'no_email';
  end if;

  if length(v_name) < 2 then
    raise exception 'name_too_short';
  end if;

  -- A user belongs to exactly one tenant (docs/commercial-architecture.md §1). This is the
  -- check that makes that true, and it must live here rather than in the UI: the UI is a public
  -- HTTP endpoint and this function is the only writer.
  if exists (select 1 from app_users where id = v_uid) then
    raise exception 'already_in_agency';
  end if;

  if v_tz is null then
    v_tz := 'Europe/Athens';
  end if;

  -- Slug from the name where the name is latin, otherwise a stable synthetic one. Greek agency
  -- names are the common case and they strip to nothing, so 'agency' plus a suffix is not the
  -- edge case here — it is the norm. The slug is an internal handle, never shown.
  v_base := btrim(regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'), '-');
  if v_base = '' then
    v_base := 'agency';
  end if;
  v_base := left(v_base, 40);

  v_slug := v_base;
  while exists (select 1 from agencies where slug = v_slug) loop
    v_slug := v_base || '-' || left(replace(gen_random_uuid()::text, '-', ''), 6);
  end loop;

  insert into agencies (name, slug, city, timezone, plan, subscription_status, trial_ends_at)
  values (v_name, v_slug, v_city, v_tz, 'starter', 'trialing', now() + interval '14 days')
  returning id into v_agency;

  insert into app_users (id, agency_id, role, full_name, email, accepted_at)
  values (
    v_uid,
    v_agency,
    'owner'::user_role,
    coalesce(nullif(btrim(coalesce(p_full_name, '')), ''), v_email),
    v_email,
    now()
  );

  -- Without weights every candidate scores the same and the ranked list — the whole product —
  -- is meaningless on day one. These are the defaults from scripts/seed.ts; the distance row
  -- carries the radius ceiling read by match_promoters (0007).
  insert into scoring_weights (agency_id, factor, weight, params) values
    (v_agency, 'distance',            1.4, '{"max_distance_km": 60}'::jsonb),
    (v_agency, 'brand_experience',    1.2, '{}'::jsonb),
    (v_agency, 'category_experience', 1.0, '{}'::jsonb),
    (v_agency, 'skill_overlap',       1.0, '{}'::jsonb),
    (v_agency, 'brief_completed',     0.8, '{}'::jsonb),
    (v_agency, 'reliability',         1.3, '{}'::jsonb)
  on conflict (agency_id, factor) do nothing;

  return v_agency;
end;
$$;

comment on function create_agency_for_user is
  'Provision an agency and its owner atomically for a self-serve signup. Fails if the caller '
  'already belongs to an agency.';

-- ---------------------------------------------------------------------------
-- Inviting staff
-- ---------------------------------------------------------------------------
--
-- The invitation id is minted by the caller so that the signed token can carry it and the row
-- can be written once, with its real hash, rather than inserted with a placeholder and patched
-- (which is what lib/invitations.ts has to do for promoters).

create or replace function invite_team_member(
  p_invitation_id uuid,
  p_email         text,
  p_role          user_role,
  p_token_hash    text,
  p_expires_at    timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_agency uuid;
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_seats  integer;
  v_used   integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- Only an owner may invite. Derived from auth.uid(), never from anything the caller sent.
  if not is_agency_owner() then
    raise exception 'not_owner';
  end if;

  v_agency := current_agency_id();
  if v_agency is null then
    raise exception 'no_agency';
  end if;

  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then
    raise exception 'email_invalid';
  end if;

  -- An owner may create owners, coordinators and supervisors. 'admin' is the legacy value from
  -- 0001 and is not offered: it means nothing in the role model of §1 and would be a confusing
  -- second kind of privileged user.
  if p_role::text not in ('owner', 'coordinator', 'supervisor') then
    raise exception 'role_invalid';
  end if;

  if p_token_hash is null or length(p_token_hash) < 32 then
    raise exception 'token_invalid';
  end if;

  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'expiry_invalid';
  end if;

  -- Already a member of this agency? Say so specifically instead of sending a link that would
  -- fail confusingly at accept time.
  if exists (
    select 1 from app_users
    where agency_id = v_agency and lower(email) = v_email and active
  ) then
    raise exception 'already_member';
  end if;

  -- One tenant per person, globally. Catching it here turns a dead-end invitation into a clear
  -- message for the owner sending it.
  if exists (select 1 from app_users where lower(email) = v_email and active) then
    raise exception 'belongs_to_other_agency';
  end if;

  select seat_limit into v_seats from agencies where id = v_agency;
  select count(*) into v_used from app_users where agency_id = v_agency and active;

  -- Outstanding invitations hold a seat: three invitations against two free seats would let the
  -- third person in and only fail once they had already signed in.
  v_used := v_used + (
    select count(*) from agency_invitations
    where agency_id = v_agency
      and accepted_at is null
      and expires_at > now()
      and lower(email) <> v_email
  );

  if v_used >= coalesce(v_seats, 3) then
    raise exception 'seat_limit_reached';
  end if;

  -- Re-inviting the same address replaces the outstanding invitation, so the older link stops
  -- working the moment a new one is sent.
  delete from agency_invitations
  where agency_id = v_agency and lower(email) = v_email and accepted_at is null;

  insert into agency_invitations (id, agency_id, email, role, token_hash, invited_by, expires_at)
  values (p_invitation_id, v_agency, v_email, p_role, p_token_hash, v_uid, p_expires_at);

  return p_invitation_id;
end;
$$;

comment on function invite_team_member is
  'Owner-only. Issues one hashed, expiring, single-use staff invitation inside the caller''s own '
  'agency. The agency is taken from the caller''s session, never from an argument.';

create or replace function revoke_agency_invitation(p_invitation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agency uuid;
  v_count  integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not is_agency_owner() then
    raise exception 'not_owner';
  end if;

  v_agency := current_agency_id();

  -- `agency_id = v_agency` is what makes the id in the request harmless: an id belonging to
  -- another agency simply matches nothing.
  delete from agency_invitations
  where id = p_invitation_id and agency_id = v_agency and accepted_at is null;

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'invitation_not_found';
  end if;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Accepting an invitation
-- ---------------------------------------------------------------------------

-- Readable by anyone holding the token, including a visitor who has not signed in yet — they
-- need to be told which agency invited them and which address to sign in with. It reveals
-- nothing to anyone who does not already hold an unguessable 256-bit hash preimage.
create or replace function agency_invitation_preview(p_token_hash text)
-- Output names are prefixed so none of them collides with a column of `agency_invitations`:
-- inside plpgsql an output parameter named `expires_at` shadows the column and turns an
-- unqualified reference into an ambiguity error at runtime, which is a horrible way to find out.
returns table (
  agency_name        text,
  invited_email      text,
  invited_role       text,
  invite_expires_at  timestamptz,
  invite_accepted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
    select a.name, i.email, i.role::text, i.expires_at, i.accepted_at
    from agency_invitations i
    join agencies a on a.id = i.agency_id
    where i.token_hash = p_token_hash;
end;
$$;

create or replace function accept_agency_invitation(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_email   text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_inv     agency_invitations;
  v_seats   integer;
  v_used    integer;
  v_existing app_users;
  v_has_row boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if v_email = '' then
    raise exception 'no_email';
  end if;

  select * into v_inv from agency_invitations where token_hash = p_token_hash;
  if not found then
    raise exception 'invitation_not_found';
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'invitation_used';
  end if;
  if v_inv.expires_at <= now() then
    raise exception 'invitation_expired';
  end if;

  -- The invitation was sent to one address. Holding the link is not enough — you must be signed
  -- in as the person it was sent to, or a forwarded email would be a way into someone else's
  -- tenant.
  if lower(v_inv.email) <> v_email then
    raise exception 'invitation_email_mismatch';
  end if;

  -- `found` is captured immediately: every SELECT below overwrites it, and a membership test
  -- that silently reads a later statement's result is exactly the kind of bug that ends up
  -- attaching someone to the wrong tenant.
  select * into v_existing from app_users where id = v_uid;
  v_has_row := found;

  if v_has_row and v_existing.agency_id <> v_inv.agency_id then
    raise exception 'already_in_agency';
  end if;

  if not v_has_row then
    select seat_limit into v_seats from agencies where id = v_inv.agency_id;
    select count(*) into v_used from app_users where agency_id = v_inv.agency_id and active;
    -- Checked again here, not only at invite time: the plan may have been downgraded, or other
    -- invitations accepted, in the days between sending and clicking.
    if v_used >= coalesce(v_seats, 3) then
      raise exception 'seat_limit_reached';
    end if;

    insert into app_users (id, agency_id, role, full_name, email, invited_by, invited_at, accepted_at)
    values (
      v_uid,
      v_inv.agency_id,
      v_inv.role,
      coalesce(nullif(btrim(auth.jwt() -> 'user_metadata' ->> 'full_name'), ''), v_email),
      v_email,
      v_inv.invited_by,
      v_inv.created_at,
      now()
    );
  elsif not v_existing.active then
    -- A previously removed colleague, re-invited. Reactivating rather than inserting keeps their
    -- history (who invited them originally, what they created) attached.
    select seat_limit into v_seats from agencies where id = v_inv.agency_id;
    select count(*) into v_used from app_users where agency_id = v_inv.agency_id and active;
    if v_used >= coalesce(v_seats, 3) then
      raise exception 'seat_limit_reached';
    end if;

    update app_users
       set active = true,
           role = v_inv.role,
           accepted_at = now()
     where id = v_uid;
  end if;

  -- Single use: the same link cannot be replayed, and the partial unique index frees the
  -- address for a future invitation.
  update agency_invitations set accepted_at = now() where id = v_inv.id and accepted_at is null;

  return v_inv.agency_id;
end;
$$;

comment on function accept_agency_invitation is
  'Attach the calling verified user to the agency named on the invitation the token belongs to. '
  'The agency, the role and the permitted email address all come from the stored row.';

-- ---------------------------------------------------------------------------
-- Changing a role, removing a member
-- ---------------------------------------------------------------------------

create or replace function set_team_member_role(p_user_id uuid, p_role user_role)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_agency  uuid;
  v_target  app_users;
  v_owners  integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not is_agency_owner() then
    raise exception 'not_owner';
  end if;

  -- Nobody changes their own role. This is the escalation path that matters: without it an
  -- owner-check alone still lets a compromised owner session be laundered, and it removes any
  -- possibility of a coordinator promoting themselves through a mistake in a later refactor.
  if p_user_id = v_uid then
    raise exception 'cannot_change_own_role';
  end if;

  if p_role::text not in ('owner', 'coordinator', 'supervisor') then
    raise exception 'role_invalid';
  end if;

  v_agency := current_agency_id();

  select * into v_target from app_users where id = p_user_id and agency_id = v_agency;
  if not found then
    raise exception 'member_not_found';
  end if;
  if not v_target.active then
    raise exception 'member_inactive';
  end if;

  -- An agency with no owner cannot invite, cannot pay and cannot recover itself.
  if v_target.role::text = 'owner' and p_role::text <> 'owner' then
    select count(*) into v_owners
      from app_users
     where agency_id = v_agency and active and role::text = 'owner';
    if v_owners <= 1 then
      raise exception 'last_owner';
    end if;
  end if;

  update app_users set role = p_role where id = p_user_id and agency_id = v_agency;
  return true;
end;
$$;

create or replace function remove_team_member(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_agency uuid;
  v_target app_users;
  v_owners integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not is_agency_owner() then
    raise exception 'not_owner';
  end if;
  if p_user_id = v_uid then
    raise exception 'cannot_remove_self';
  end if;

  v_agency := current_agency_id();

  select * into v_target from app_users where id = p_user_id and agency_id = v_agency;
  if not found then
    raise exception 'member_not_found';
  end if;
  if not v_target.active then
    raise exception 'member_inactive';
  end if;

  if v_target.role::text = 'owner' then
    select count(*) into v_owners
      from app_users
     where agency_id = v_agency and active and role::text = 'owner';
    if v_owners <= 1 then
      raise exception 'last_owner';
    end if;
  end if;

  -- Deactivate, never delete: their name stays on the campaigns and shifts they created, and
  -- the action is reversible by re-inviting them (docs/commercial-architecture.md §6).
  -- `current_agency_id()` requires `active`, so this revokes their data access immediately.
  update app_users set active = false where id = p_user_id and agency_id = v_agency;

  -- Anything still outstanding for that address stops working too.
  delete from agency_invitations
  where agency_id = v_agency and lower(email) = lower(v_target.email) and accepted_at is null;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

-- The browser holds the anon key and a session. That is enough to call PostgREST directly, so
-- what `authenticated` may write to `app_users` is the real permission model — not the checks
-- in app/settings/team/actions.ts, which any caller can simply skip.
--
-- Before this, 0006 granted insert/update/delete on app_users to authenticated and the 0002
-- policy allowed anything inside the caller's own agency. That combination permitted:
--   * `update app_users set role = 'owner' where id = <self>`      — self-promotion
--   * `insert into app_users (id, agency_id, role) values (...)`   — minting a colleague
--   * `delete from app_users where id = <the owner>`               — removing the owner
-- all three from a coordinator's browser. They are closed here at the table, not in the UI.
revoke insert, update, delete on app_users from authenticated;

-- What is left is a person editing their own contact details. Role, agency and active are not
-- in the list, so they cannot be written by the browser at all — only by the functions above.
grant update (full_name, phone) on app_users to authenticated;

-- Invitations are readable inside their own agency (the team screen lists pending ones) and
-- writable only through invite_team_member / revoke_agency_invitation / accept_agency_invitation.
grant select on agency_invitations to authenticated;

grant execute on function current_agency_id() to authenticated;
grant execute on function is_agency_owner() to authenticated;
grant execute on function create_agency_for_user(text, text, text, text) to authenticated;
grant execute on function invite_team_member(uuid, text, user_role, text, timestamptz) to authenticated;
grant execute on function revoke_agency_invitation(uuid) to authenticated;
grant execute on function accept_agency_invitation(text) to authenticated;
grant execute on function set_team_member_role(uuid, user_role) to authenticated;
grant execute on function remove_team_member(uuid) to authenticated;

-- The preview is the one function an anonymous visitor may call: someone who has just clicked
-- the link in their email has no session yet and must still be told who invited them.
grant execute on function agency_invitation_preview(text) to authenticated, anon;

-- None of these are for the browser to call unauthenticated.
revoke execute on function create_agency_for_user(text, text, text, text) from anon;
revoke execute on function invite_team_member(uuid, text, user_role, text, timestamptz) from anon;
revoke execute on function revoke_agency_invitation(uuid) from anon;
revoke execute on function accept_agency_invitation(text) from anon;
revoke execute on function set_team_member_role(uuid, user_role) from anon;
revoke execute on function remove_team_member(uuid) from anon;
