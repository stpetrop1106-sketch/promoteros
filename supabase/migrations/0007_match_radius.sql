-- P0c — a hard maximum-distance ceiling on match_promoters.
--
-- Starts from the body applied by 0005_matching_fixes.sql (NOT 0003) and keeps both of its
-- fixes intact: the null-geocode coalesce + NULLS LAST sort (FIX 1) and the overlapping
-- `unavailable` window filter (FIX 2). The signature, the returned columns and the r_-prefixed
-- CTE structure are unchanged — lib/matching/index.ts and scripts/smoke.ts depend on them.
--
-- THE DEFECT
--   distance_score() decays asymptotically and never disqualifies. On a seeded shift a
--   promoter 308.9 km from the store ranked FOURTH at 51%: twelve completed shifts for the
--   client, a read brief, a car and high reliability outweighed a distance factor of 0.05.
--   Nothing about that arithmetic is wrong — the model simply has no notion of "too far".
--   A coordinator who is offered someone in another city stops trusting the whole ranking,
--   and this is not a seed artefact: it happens with real data the moment an agency runs
--   campaigns in two cities.
--
-- THE FIX
--   A hard ceiling applied among the other hard filters, so an out-of-range promoter does not
--   appear at all rather than appearing with a poor score. A soft penalty would not do: the
--   whole point is that no amount of brand history buys a 300 km commute.
--
--   The ceiling is configurable per agency, never hardcoded in the ranking: it is read from
--   `params->>'max_distance_km'` on the `distance` row of scoring_weights, defaulting to 60 km.
--   60 km is roughly "still inside the metropolitan area the agency staffs" — an Athens
--   coordinator can reach any Attica store, and Thessaloniki (≈300 km) is excluded. An agency
--   that genuinely staffs a whole region raises it in settings; one that works a single city
--   lowers it. Both without a deploy, which is the same rule the weights follow.
--
--   The value is parsed defensively. scoring_weights.params is free-form jsonb written by the
--   weight-tuning UI, and a bad value must not take matching down for the whole agency: a
--   non-numeric or non-positive `max_distance_km` falls back to the 60 km default rather than
--   raising, and there is no way to configure a ceiling of zero that silently returns nobody.
--
-- DECISION — a promoter with no coordinates is KEPT, not filtered out.
--   home_lat / home_lng are nullable and the promoter screen deliberately allows saving without
--   them, so "we could not compute a distance" is a common, ordinary state. It is not the same
--   claim as "this person is far away", and the ceiling only licenses the second one. Excluding
--   them would make a failed geocode invisibly delete a promoter from every ranking — the
--   coordinator would have no way to see that they were dropped, let alone why, and the person
--   most likely to be dropped is a newly added promoter whose address did not resolve. Keeping
--   them costs one low-scoring row: FIX 1 already gives them f_distance = 0, so they sink to the
--   bottom of the list where the coordinator can see them and fix the address (P3 ships a manual
--   coordinate override for exactly this). Visible and last beats invisible.
--
-- Not changed here, still open and deliberately not P0c's call: there is no promoter_areas
-- filter. "Where they are willing to work" is a stronger and more human signal than raw
-- kilometres, but it is a product decision about how an agency maintains that list, and a
-- radius ceiling is the safety net that works even when the list is empty.

create or replace function match_promoters(p_shift_id uuid, p_limit integer default 20)
returns table (
  promoter_id     uuid,
  full_name       text,
  phone           text,
  distance_m      integer,
  has_car         boolean,
  brief_completed boolean,
  brand_shifts    integer,
  skill_hits      integer,
  reliability     double precision,
  score           double precision,
  breakdown       jsonb
)
language sql
stable
as $$
with shift as (
  select s.id, s.agency_id, s.campaign_id, s.on_date, s.start_time, s.end_time,
         st.lat as store_lat, st.lng as store_lng,
         c.client_id, c.campaign_type
  from shifts s
  join stores st on st.id = s.store_id
  join campaigns c on c.id = s.campaign_id
  where s.id = p_shift_id
),
weights as (
  -- params comes along for the ride: the distance row carries the radius ceiling.
  select factor, weight, params from scoring_weights
  where agency_id = (select agency_id from shift)
),
w as (
  select
    coalesce(max(weight) filter (where factor = 'distance'), 1.4)            as w_distance,
    coalesce(max(weight) filter (where factor = 'brand_experience'), 1.2)    as w_brand,
    coalesce(max(weight) filter (where factor = 'category_experience'), 1.0) as w_category,
    coalesce(max(weight) filter (where factor = 'skill_overlap'), 1.0)       as w_skill,
    coalesce(max(weight) filter (where factor = 'brief_completed'), 0.8)     as w_brief,
    coalesce(max(weight) filter (where factor = 'reliability'), 1.3)         as w_reliability,
    -- Hard ceiling in metres, per agency. Only a positive, plainly numeric value is honoured;
    -- anything else (absent, empty, "sixty", 0, -1) falls back to 60 km. No agency can
    -- configure itself into an empty candidate list by typing badly into the settings screen.
    coalesce(
      max(
        case
          when factor = 'distance'
           and params->>'max_distance_km' ~ '^[0-9]+(\.[0-9]+)?$'
           and (params->>'max_distance_km')::double precision > 0
          then (params->>'max_distance_km')::double precision
        end
      ),
      60.0
    ) * 1000.0 as max_distance_m
  from weights
),
-- Hard filters run before any scoring: a promoter who cannot work the shift never
-- appears with a low score, they simply do not appear.
candidates as (
  select p.*
  from promoters p, shift sh, w
  where p.agency_id = sh.agency_id
    and p.status = 'active'
    -- P0c: within the agency's maximum travel radius. Applied here, with the other hard
    -- filters, so someone in another city is absent rather than merely low-scoring.
    -- A promoter with no geocode passes: see the DECISION note at the top of this file.
    and (
      p.home_lat is null
      or p.home_lng is null
      or haversine_m(p.home_lat, p.home_lng, sh.store_lat, sh.store_lng) <= w.max_distance_m
    )
    -- declared available, covering the whole shift window
    and exists (
      select 1 from availability a
      where a.promoter_id = p.id
        and a.on_date = sh.on_date
        and a.status = 'available'
        and (a.from_time is null or a.from_time <= sh.start_time)
        and (a.to_time   is null or a.to_time   >= sh.end_time)
    )
    -- 0005 FIX 2: and no declared unavailable window overlapping the shift. A whole-day
    -- unavailable row (both times null) blocks the date outright.
    and not exists (
      select 1 from availability u
      where u.promoter_id = p.id
        and u.on_date = sh.on_date
        and u.status = 'unavailable'
        and (u.from_time is null or u.from_time < sh.end_time)
        and (u.to_time   is null or u.to_time   > sh.start_time)
    )
    -- not blocked agency-wide, nor for this particular client
    and not exists (
      select 1 from blocklist b
      where b.promoter_id = p.id
        and (b.client_id is null or b.client_id = sh.client_id)
    )
    -- not already booked on this shift
    and not exists (
      select 1 from assignments asg
      where asg.shift_id = sh.id and asg.promoter_id = p.id
        and asg.status = 'confirmed'
    )
    -- no open or already-declined offer for this shift
    and not exists (
      select 1 from invitations i
      where i.shift_id = sh.id and i.promoter_id = p.id
        and i.status in ('pending', 'accepted', 'declined')
    )
    -- not double-booked elsewhere the same day
    and not exists (
      select 1
      from assignments asg2
      join shifts s2 on s2.id = asg2.shift_id
      where asg2.promoter_id = p.id
        and asg2.status = 'confirmed'
        and s2.on_date = sh.on_date
        and (sh.start_time, sh.end_time) overlaps (s2.start_time, s2.end_time)
    )
),
scored as (
  select
    c.id,
    c.full_name,
    c.phone,
    c.has_car,
    c.reliability_score,
    haversine_m(c.home_lat, c.home_lng, sh.store_lat, sh.store_lng) as distance_m,
    coalesce(h.shifts_completed, 0) as brand_shifts,
    (
      select count(*)::integer
      from promoter_skills ps
      join campaign_skills cs on cs.skill_id = ps.skill_id
      where ps.promoter_id = c.id and cs.campaign_id = sh.campaign_id
    ) as skill_hits,
    (
      select count(*)::integer
      from campaign_skills cs where cs.campaign_id = sh.campaign_id
    ) as skills_wanted,
    exists (
      select 1 from brief_ack ba
      join briefs b on b.id = ba.brief_id
      where b.campaign_id = sh.campaign_id and ba.promoter_id = c.id
    ) as brief_completed,
    exists (
      select 1
      from promoter_client_history pch
      join campaigns c2 on c2.client_id = pch.client_id
      where pch.promoter_id = c.id
        and c2.campaign_type = sh.campaign_type
        and c2.id <> sh.campaign_id
    ) as category_experience
  -- Explicit cross join: mixing comma-join with LEFT JOIN would put `c` out of scope
  -- in the ON clause below.
  from candidates c
  cross join shift sh
  left join promoter_client_history h
    on h.promoter_id = c.id and h.client_id = sh.client_id
),
factors as (
  select
    s.*,
    -- 0005 FIX 1: an unknown home location scores zero on distance rather than null. Null here
    -- propagated all the way to `score` and, because DESC sorts NULLS FIRST, put the
    -- promoter we know least about at the top of the list.
    coalesce(distance_score(s.distance_m, s.has_car), 0.0)              as f_distance,
    least(s.brand_shifts, 5)::double precision / 5.0                    as f_brand,
    case when s.category_experience then 1.0 else 0.0 end               as f_category,
    case when s.skills_wanted = 0 then 0.0
         else least(s.skill_hits, s.skills_wanted)::double precision
              / s.skills_wanted end                                     as f_skill,
    case when s.brief_completed then 1.0 else 0.0 end                   as f_brief,
    s.reliability_score                                                 as f_reliability
  from scored s
),
ranked as (
  select
    f.id            as r_promoter_id,
    f.full_name     as r_full_name,
    f.phone         as r_phone,
    f.distance_m    as r_distance_m,
    f.has_car       as r_has_car,
    f.brief_completed as r_brief_completed,
    f.brand_shifts  as r_brand_shifts,
    f.skill_hits    as r_skill_hits,
    f.reliability_score as r_reliability,
    -- Normalised to 0..1 by the sum of weights, so the number reads as a percentage and stays
    -- comparable when an agency retunes its weights.
    -- The cast to numeric is required: round(x, n) has no double precision overload.
    round(
      (
        (
          (f.f_distance    * w.w_distance)
        + (f.f_brand       * w.w_brand)
        + (f.f_category    * w.w_category)
        + (f.f_skill       * w.w_skill)
        + (f.f_brief       * w.w_brief)
        + (f.f_reliability * w.w_reliability)
        )
        / nullif(
            w.w_distance + w.w_brand + w.w_category
          + w.w_skill + w.w_brief + w.w_reliability, 0)
      )::numeric,
      4
    )::double precision as r_score,
    -- `detail` for distance stays null when the promoter has no geocode: the UI must show
    -- "distance unknown", not "0 m".
    jsonb_build_object(
      'distance',            jsonb_build_object('value', f.f_distance,    'weight', w.w_distance,    'detail', f.distance_m),
      'brand_experience',    jsonb_build_object('value', f.f_brand,       'weight', w.w_brand,       'detail', f.brand_shifts),
      'category_experience', jsonb_build_object('value', f.f_category,    'weight', w.w_category),
      'skill_overlap',       jsonb_build_object('value', f.f_skill,       'weight', w.w_skill,       'detail', f.skill_hits),
      'brief_completed',     jsonb_build_object('value', f.f_brief,       'weight', w.w_brief),
      'reliability',         jsonb_build_object('value', f.f_reliability, 'weight', w.w_reliability)
    ) as r_breakdown
  from factors f
  cross join w
)
-- The `r_` prefixes exist because RETURNS TABLE column names are in scope inside the body,
-- and an unqualified `score` or `distance_m` here would be ambiguous.
select
  r.r_promoter_id,
  r.r_full_name,
  r.r_phone,
  r.r_distance_m,
  r.r_has_car,
  r.r_brief_completed,
  r.r_brand_shifts,
  r.r_skill_hits,
  r.r_reliability,
  r.r_score,
  r.r_breakdown
from ranked r
-- NULLS LAST on both keys: belt and braces behind FIX 1, and an unknown distance must never
-- win the tie-break either.
order by r.r_score desc nulls last, r.r_distance_m asc nulls last
limit p_limit;
$$;

comment on function match_promoters is
  'Ranked candidates for a shift. Hard filters first (availability, blocklist, double-booking, and a per-agency maximum distance from scoring_weights.params->max_distance_km, default 60 km), then a weighted score with per-factor breakdown.';
