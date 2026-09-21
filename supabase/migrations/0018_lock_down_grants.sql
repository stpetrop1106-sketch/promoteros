-- Close what the A1 security audit found (docs/audit/security.md).
--
-- Three findings, one root cause each, all reproduced against the live project before this was
-- written. The common thread: PostgREST is a public endpoint and the browser holds the anon key,
-- so a GRANT is a published API, and a REVOKE that names the wrong role protects nothing.

-- ---------------------------------------------------------------------------
-- A1-01 (critical) — a coordinator could mint themselves an owner account
-- ---------------------------------------------------------------------------
-- `app_user_invites` was granted to `authenticated` by 0006_auth.sql, and its only policy is
-- "the row belongs to my agency" — which a coordinator's own agency satisfies. `ensure_app_user()`
-- then provisions the named address with WHATEVER ROLE THE INVITE ROW SAYS, on that person's first
-- sign-in. So one direct INSERT, with nothing but the public key and an ordinary session, created
-- an owner; the accomplice then removed the real owner through the legitimate RPC, whose "never
-- remove the last owner" rule was satisfied because there were now two.
--
-- 0011_accounts.sql:710 closed exactly this hole for `app_users` and left the older invitation
-- table untouched. Nothing in the application needs the write grant: `ensure_app_user()` is
-- security definer and reads past RLS. SELECT stays, because the team screen lists pending invites.
revoke insert, update, delete on app_user_invites from authenticated;

comment on table app_user_invites is
  'Pre-authorised email addresses, read by ensure_app_user() on first sign-in. Writable ONLY by the service role and by security-definer functions: a write grant here is a grant to mint owners (audit A1-01).';

-- ---------------------------------------------------------------------------
-- A1-02 (high) and A1-04 (medium) — REVOKE FROM PUBLIC left the default role grants in place
-- ---------------------------------------------------------------------------
-- Supabase grants EXECUTE on new functions to `anon` and `authenticated` by default. Revoking from
-- `public` does not remove those, so every function the migrations "locked down" stayed callable
-- from the internet. Most survive because they check the caller in their own body — but
-- `increment_waitlist_rate_limit` does not: it was granted to `service_role` only and was being
-- executed by anonymous callers, who could drive the public waitlist's circuit breaker to its
-- global limit and take the sign-up form down for everyone.
--
-- Revoke by name, for every function the migrations intended to restrict. `if exists` is not
-- available for function revokes, so each is guarded by a lookup rather than assumed present.
do $$
declare
  fn record;
  restricted text[] := array[
    'increment_waitlist_rate_limit',
    'grant_agency_access',
    'ensure_app_user',
    'create_agency_for_user',
    'invite_team_member',
    'set_team_member_role',
    'remove_team_member',
    'revoke_agency_invitation',
    'accept_agency_invitation',
    'agency_invitation_preview',
    'admin_agency_summary',
    'admin_suspend_agency',
    'admin_unsuspend_agency',
    'admin_change_plan',
    'admin_extend_trial',
    'admin_mark_deletion_request',
    'admin_clear_deletion_request',
    'admin_view_agency_activity',
    'admin_list_agencies',
    'admin_waitlist_list',
    'admin_audit_list',
    'is_agency_owner'
  ];
begin
  for fn in
    select p.oid::regprocedure as signature, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (restricted)
  loop
    -- anon must never reach these. `authenticated` keeps only what the app actually calls from a
    -- user session; everything else is re-granted explicitly below.
    execute format('revoke execute on function %s from anon, authenticated', fn.signature);
  end loop;
end
$$;

-- What a signed-in user genuinely calls, restored by name. Each of these already verifies the
-- caller inside its own body; the grant is what lets the app work, the body is what makes it safe.
grant execute on function ensure_app_user() to authenticated;
grant execute on function create_agency_for_user(text, text, text) to authenticated;
grant execute on function invite_team_member(uuid, text, text, user_role, timestamptz) to authenticated;
grant execute on function set_team_member_role(uuid, user_role) to authenticated;
grant execute on function remove_team_member(uuid) to authenticated;
grant execute on function revoke_agency_invitation(uuid) to authenticated;
grant execute on function accept_agency_invitation(text) to authenticated;
grant execute on function is_agency_owner() to authenticated;

-- The staff-invitation preview is opened by someone who is NOT signed in yet — that is the whole
-- point of the link — so it is the one function anon keeps. It is keyed on the token hash and
-- returns only the agency name and role for a token the caller already holds.
grant execute on function agency_invitation_preview(text) to anon, authenticated;

-- The admin console runs as the signed-in platform admin, so those functions stay reachable by
-- `authenticated` and refuse anyone who is not in `platform_admins`.
grant execute on function admin_agency_summary(uuid) to authenticated;
grant execute on function admin_suspend_agency(uuid, text) to authenticated;
grant execute on function admin_unsuspend_agency(uuid, text) to authenticated;
grant execute on function admin_change_plan(uuid, plan_tier, text) to authenticated;
grant execute on function admin_extend_trial(uuid, integer, text) to authenticated;
grant execute on function admin_mark_deletion_request(uuid, text) to authenticated;
grant execute on function admin_clear_deletion_request(uuid, text) to authenticated;
grant execute on function admin_view_agency_activity(uuid) to authenticated;
grant execute on function admin_list_agencies(text, integer, integer) to authenticated;
grant execute on function admin_waitlist_list(integer, integer) to authenticated;
grant execute on function admin_audit_list(integer, integer) to authenticated;
