-- Let an agency owner set their own controller identity.
--
-- P33 built the settings screen and found it could not write: `0006_auth.sql` grants `authenticated`
-- only SELECT on `agencies`, and `0012_billing.sql` explicitly revokes insert/update/delete. That is
-- the privilege-escalation defence from `0011_accounts.sql` working exactly as intended — an agency
-- owner must not be able to edit their own row freely, because that row also carries
-- `subscription_status`, `plan`, `seat_limit`, `promoter_limit`, the Stripe ids and `suspended_at`.
-- Those are written only by the billing webhook and the admin console. An owner who could set
-- `subscription_status = 'active'` would have a free subscription; one who could clear
-- `suspended_at` would undo a suspension.
--
-- So this opens the narrowest possible door: a COLUMN-SCOPED grant on exactly the three fields the
-- agency is the right authority for, plus an RLS policy that still requires the row to be their own
-- agency and the caller to be an active owner.
--
-- Never widen this to `grant update on agencies to authenticated`.

-- ---------------------------------------------------------------------------
-- Who is an owner, decided by the database rather than by a claim in a request
-- ---------------------------------------------------------------------------

create or replace function is_agency_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from app_users
    where id = auth.uid()
      and role = 'owner'
      and active
  );
$$;

comment on function is_agency_owner is
  'True when the caller is an active owner of their own agency. security definer so it can read app_users, whose grants were revoked from authenticated in 0011.';

revoke execute on function is_agency_owner() from anon;
grant execute on function is_agency_owner() to authenticated;

-- ---------------------------------------------------------------------------
-- The narrow write
-- ---------------------------------------------------------------------------

-- Column-scoped on purpose. Postgres refuses an UPDATE that touches any column outside this list,
-- so even a bug in application code cannot reach `subscription_status` or `suspended_at`.
grant update (legal_name, privacy_contact_email, promoter_retention_months)
  on agencies to authenticated;

drop policy if exists agency_identity_update on agencies;

create policy agency_identity_update on agencies
  for update
  using (id = current_agency_id() and is_agency_owner())
  with check (id = current_agency_id() and is_agency_owner());

comment on policy agency_identity_update on agencies is
  'An active owner may edit only their own agency row, and the column grant limits that to the three controller-identity fields. Both halves are required: the grant alone would still be scoped by RLS, and the policy alone would expose every column.';
