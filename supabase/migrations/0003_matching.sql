-- L1 — the matching engine.
--
-- This is a weighted scoring function, deliberately not an LLM: the coordinator has to see
-- why someone ranked third and be able to override it. See CLAUDE.md and decisions.md D2.
--
-- It always returns per-factor sub-scores, never just a total. The UI renders the breakdown,
-- and the breakdown is frozen onto the invitation when one is sent.

-- ---------------------------------------------------------------------------
-- Which skills a campaign actually calls for
-- ---------------------------------------------------------------------------

create table if not exists campaign_skills (
  campaign_id uuid not null references campaigns (id) on delete cascade,
  skill_id    uuid not null references skills (id) on delete cascade,
  required    boolean not null default false,
  primary key (campaign_id, skill_id)
);

alter table campaign_skills enable row level security;
alter table campaign_skills force row level security;
drop policy if exists tenant_isolation on campaign_skills;
create policy tenant_isolation on campaign_skills
  for all
  using (exists (
    select 1 from campaigns c
    where c.id = campaign_skills.campaign_id and c.agency_id = current_agency_id()
  ))
  with check (exists (
    select 1 from campaigns c
    where c.id = campaign_skills.campaign_id and c.agency_id = current_agency_id()
  ));

-- ---------------------------------------------------------------------------
-- Distance
-- ---------------------------------------------------------------------------

create or replace function haversine_m(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) returns integer
language sql
immutable
parallel safe
as $$
  select round(
    2 * 6371000 * asin(sqrt(
      sin(radians(lat2 - lat1) / 2) ^ 2 +
      cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lng2 - lng1) / 2) ^ 2
    ))
  )::integer;
$$;

-- Having a car widens the radius rather than removing the penalty: a promoter with a car
-- still prefers a nearby store, and coordinators expect that to show in the ranking.
create or replace function distance_score(metres integer, has_car boolean)
returns double precision
language sql
immutable
parallel safe
as $$
  select 1.0 / (1.0 + metres::double precision / case when has_car then 15000 else 5000 end);
$$;

-- ---------------------------------------------------------------------------
-- match_promoters(shift)
-- ---------------------------------------------------------------------------

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
    distance_score(s.distance_m, s.has_car)                             as f_distance,
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
order by r.r_score desc, r.r_distance_m asc
limit p_limit;
$$;

comment on function match_promoters is
  'Ranked candidates for a shift. Hard filters first, then a weighted score with per-factor breakdown.';
