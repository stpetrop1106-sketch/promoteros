-- P0 — match_promoters correctness fixes.
--
-- 0003 is applied and must not be edited, so this replaces the function body. Two defects,
-- neither of which fires against the current seed — both fire as soon as a real coordinator
-- uses the product. Verified by `npm run smoke`, which flags both conditions.
--
-- FIX 1 — a promoter with no geocode ranked FIRST, with no score.
--   `home_lat` / `home_lng` are nullable, and P3 (promoter CRUD + geocoding) ships a manual
--   override precisely because geocoding fails. For such a promoter haversine_m() returns
--   null, distance_score(null, …) returns null, and null propagates through the weighted sum
--   so `score` is null. PostgreSQL sorts DESC as NULLS FIRST by default, so
--   `order by r_score desc` puts every un-geocoded promoter at the top of the coordinator's
--   ranked list with a blank score. The conservative reading of an unknown address is "no
--   distance credit", not "best candidate", so the factor coalesces to 0 and the sort is
--   pinned NULLS LAST as well.
--
-- FIX 2 — an `unavailable` window overlapping the shift was ignored.
--   The hard filter only asked whether an `available` row covers the shift. The unique key on
--   availability is (promoter_id, on_date, from_time), so a promoter can hold a whole-day
--   `available` row AND a partial `unavailable` row for the same date — which is exactly what
--   P5 (availability entry, "including partial days") will let a coordinator enter for
--   "available Saturday, but not 14:00–16:00". Today's seed writes one row per promoter per
--   date, so this changes nothing about the current output; it stops a promoter being offered
--   a shift they have explicitly blocked out.
--
-- Deliberately NOT changed here, because they are product decisions and not P0's to take:
--   * no hard distance radius and no promoter_areas filter. A promoter 309 km away currently
--     reaches the top five of a seeded shift on brand experience alone. See docs/status/P0.md.
--   * category_experience scores 0 for every candidate on every seeded shift. That is a seed
--     shape problem (each campaign_type belongs to exactly one campaign), not a function bug.

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
  select factor, weight from scoring_weights
  where agency_id = (select agency_id from shift)
),
w as (
  select
    coalesce(max(weight) filter (where factor = 'distance'), 1.4)            as w_distance,
    coalesce(max(weight) filter (where factor = 'brand_experience'), 1.2)    as w_brand,
    coalesce(max(weight) filter (where factor = 'category_experience'), 1.0) as w_category,
    coalesce(max(weight) filter (where factor = 'skill_overlap'), 1.0)       as w_skill,
    coalesce(max(weight) filter (where factor = 'brief_completed'), 0.8)     as w_brief,
    coalesce(max(weight) filter (where factor = 'reliability'), 1.3)         as w_reliability
  from weights
),
-- Hard filters run before any scoring: a promoter who cannot work the shift never
-- appears with a low score, they simply do not appear.
candidates as (
  select p.*
  from promoters p, shift sh
  where p.agency_id = sh.agency_id
    and p.status = 'active'
    -- declared available, covering the whole shift window
    and exists (
      select 1 from availability a
      where a.promoter_id = p.id
        and a.on_date = sh.on_date
        and a.status = 'available'
        and (a.from_time is null or a.from_time <= sh.start_time)
        and (a.to_time   is null or a.to_time   >= sh.end_time)
    )
    -- FIX 2: and no declared unavailable window overlapping the shift. A whole-day
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
    -- FIX 1: an unknown home location scores zero on distance rather than null. Null here
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
  'Ranked candidates for a shift. Hard filters first, then a weighted score with per-factor breakdown.';
