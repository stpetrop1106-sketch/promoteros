-- The free trial becomes one month (decision D25).
--
-- WHERE THE TRIAL LIVES, AND WHY THIS IS THE ONLY EDIT
-- ---------------------------------------------------
-- The owner asked to be able to change 1 month → 2 months without hunting through the codebase.
-- That already holds, and it is written down here so nobody "helpfully" duplicates it:
--
--   * `agencies.trial_ends_at` is the single authority. `lib/billing/access.ts` derives access,
--     the banner, the grace window and `trialDaysRemaining` from that column and never from a
--     length constant — verified by grep: no TypeScript anywhere hardcodes a trial length.
--   * The ONLY place a length is written is the `interval` literal below, inside
--     `create_agency_for_user`, which is what a self-serve signup calls.
--
-- So changing the trial is this one literal. Two months is `interval '2 months'`.
--
-- The body below is reproduced verbatim from `pg_get_functiondef` on the live database rather than
-- retyped from 0011, so that nothing applied since (migration 0018's grants, in particular) can be
-- silently reverted by this file. `create or replace` with an unchanged signature keeps those
-- grants intact.

CREATE OR REPLACE FUNCTION public.create_agency_for_user(p_name text, p_city text DEFAULT NULL::text, p_timezone text DEFAULT 'Europe/Athens'::text, p_full_name text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  values (v_name, v_slug, v_city, v_tz, 'starter', 'trialing', now() + interval '1 month')
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
$function$
;
