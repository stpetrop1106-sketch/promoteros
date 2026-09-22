-- Close what the A1 security audit found (docs/audit/security.md).
--
-- Two findings, one root cause each, both reproduced against the live project before this was
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
-- remove the last owner" rule was satisfied because there were now two owners.
--
-- 0011_accounts.sql closed exactly this hole for `app_users` and left the older invitation table
-- untouched. Nothing in the application needs the write grant: `ensure_app_user()` is security
-- definer and reads past RLS. SELECT stays, because the team screen lists pending invitations.
revoke insert, update, delete on app_user_invites from authenticated;

comment on table app_user_invites is
  'Pre-authorised email addresses, read by ensure_app_user() on first sign-in. Writable ONLY by the service role and by security-definer functions: a write grant here is a grant to mint owners (audit A1-01).';

-- ---------------------------------------------------------------------------
-- A1-02 (high) and A1-04 (medium) — REVOKE FROM PUBLIC left the default role grants in place
-- ---------------------------------------------------------------------------
-- Supabase grants EXECUTE on every new function to `anon` and `authenticated` by default. Revoking
-- from `public` does not remove those, so every function the migrations "locked down" stayed
-- callable from the internet. Most survive because they check the caller in their own body — but
-- `increment_waitlist_rate_limit` does not: it was granted to `service_role` only and was being
-- executed by anonymous callers, who could drive the public waitlist's circuit breaker to its
-- global limit and take the sign-up form down for everyone, for an hour at a time.
--
-- Driven from `pg_proc` rather than from hand-written signatures: five of the signatures assumed
-- while writing this migration turned out to be wrong and two of the functions did not exist at
-- all, which is precisely the kind of drift that leaves a REVOKE silently ineffective.
do $$
declare
  fn record;
  -- Everything the migrations meant to restrict.
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
    'is_agency_owner',
    'admin_agency_summary',
    'admin_suspend_agency',
    'admin_unsuspend_agency',
    'admin_change_plan',
    'admin_extend_trial',
    'admin_mark_deletion_request',
    'admin_clear_deletion_request',
    'admin_view_agency_activity',
    'admin_list_agencies'
  ];
  -- What a signed-in user genuinely calls. Each of these verifies the caller inside its own body;
  -- the grant is what lets the app work, the body is what makes it safe. The admin ones are
  -- included because the console runs as the signed-in platform admin and they refuse anyone who
  -- is not in `platform_admins`.
  app_callable text[] := array[
    'ensure_app_user',
    'create_agency_for_user',
    'invite_team_member',
    'set_team_member_role',
    'remove_team_member',
    'revoke_agency_invitation',
    'accept_agency_invitation',
    'agency_invitation_preview',
    'is_agency_owner',
    'admin_agency_summary',
    'admin_suspend_agency',
    'admin_unsuspend_agency',
    'admin_change_plan',
    'admin_extend_trial',
    'admin_mark_deletion_request',
    'admin_clear_deletion_request',
    'admin_view_agency_activity',
    'admin_list_agencies'
  ];
begin
  for fn in
    select p.oid::regprocedure as signature, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any (restricted)
  loop
    execute format('revoke execute on function %s from anon, authenticated', fn.signature);

    if fn.proname = any (app_callable) then
      execute format('grant execute on function %s to authenticated', fn.signature);
    end if;

    -- The staff-invitation preview is opened by someone who is NOT signed in yet — that is the
    -- whole point of the link — so it is the one function anon keeps. It is keyed on the token
    -- hash and returns only the agency name and the invited role, to a caller already holding
    -- that token.
    if fn.proname = 'agency_invitation_preview' then
      execute format('grant execute on function %s to anon', fn.signature);
    end if;
  end loop;
end
$$;
