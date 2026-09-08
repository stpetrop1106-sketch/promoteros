# Data model

Postgres (Supabase). Every tenant-scoped table carries `agency_id` and an RLS policy.
`snake_case`, `timestamptz` in UTC, money in integer cents, distance in metres.

## Tenancy and people

```
agencies            id, name, slug, country, timezone, created_at
app_users           id (= auth.users.id), agency_id, role, full_name, email, phone, active
                    role ∈ coordinator | supervisor | admin
```

Clients are the brands the agency serves — never tenants themselves.

```
clients             id, agency_id, name, notes, created_at
client_contacts     id, client_id, full_name, email, phone, role
```

## Promoters

```
promoters           id, agency_id, full_name, phone, email, birth_year, gender,
                    home_lat, home_lng, home_area_id,
                    has_car, has_licence, transport_notes,
                    status,            -- active | paused | archived | blocklisted
                    reliability_score, -- derived, recomputed nightly
                    created_at, retention_until

areas               id, agency_id, name, city, centroid_lat, centroid_lng
promoter_areas      promoter_id, area_id            -- where they will work

skills              id, agency_id, name, category    -- supermarket, beauty, perfume, events…
promoter_skills     promoter_id, skill_id, level     -- 1..3

promoter_client_history
                    promoter_id, client_id, shifts_completed, last_worked_on, avg_rating
```

`retention_until` exists so deletion is a job, not a promise. See `CLAUDE.md` §2.

## Availability

```
availability        id, agency_id, promoter_id, on_date,
                    status,            -- available | unavailable
                    from_time, to_time -- null,null = whole day
                    source             -- self | coordinator | inferred
                    unique (promoter_id, on_date, from_time)
```

Partial days are the normal case, not an edge case ("available after 17:00").

## Campaigns, stores, shifts

```
stores              id, agency_id, client_id, name, chain, address,
                    lat, lng, area_id, contact_name, contact_phone

campaigns           id, agency_id, client_id, name, campaign_type,
                    starts_on, ends_on, dress_code, rate_cents, currency,
                    status             -- draft | active | completed | cancelled

briefs              id, campaign_id, title, body_md, version, published_at
brief_ack           brief_id, promoter_id, acknowledged_at, quiz_score

shifts              id, agency_id, campaign_id, store_id,
                    on_date, start_time, end_time,
                    promoters_required, rate_cents_override,
                    supervisor_id,     -- app_users.id, nullable
                    status             -- open | partially_filled | filled | completed | cancelled
```

`promoters_required` vs accepted assignments gives the coverage indicator the coordinator lives by.

## Assignment, invitation, replacement

The two-table split matters: an **invitation** is an offer with a lifecycle, an **assignment** is a
confirmed booking. A shift can burn through many invitations before it is filled.

```
assignments         id, agency_id, shift_id, promoter_id,
                    status,            -- confirmed | cancelled | no_show | completed
                    confirmed_at, cancelled_at, cancel_reason
                    unique (shift_id, promoter_id)

invitations         id, agency_id, shift_id, promoter_id,
                    token_hash,        -- store the HASH, never the token
                    match_score, match_breakdown jsonb,
                    channel,           -- clipboard | telegram | whatsapp | viber | sms
                    sent_at, expires_at, responded_at,
                    status,            -- pending | accepted | declined | expired | superseded
                    decline_reason
                    unique (shift_id, promoter_id, sent_at)

replacement_runs    id, shift_id, triggered_by, trigger,  -- cancellation | no_show | manual
                    candidate_ids uuid[], current_position, wave_expires_at,
                    status             -- running | filled | exhausted | stopped
```

`match_breakdown` is frozen onto the invitation on purpose — we must be able to explain months later
why this person was offered this shift.

## Check-in and field data

```
check_ins           id, agency_id, assignment_id,
                    checked_in_at,
                    distance_from_store_m,   -- derived
                    within_geofence boolean,
                    method,                  -- geolocation | manual_override | coordinator
                    override_reason
```

**No `lat`/`lng` columns here, by design.** We compute distance at capture time and discard the
position. See `CLAUDE.md` §3 — this is a legal constraint, not an optimisation.

```
field_reports       id, agency_id, assignment_id, shift_id,
                    units_promoted, sales_count, interactions_count,
                    stock_issues, store_manager_name, notes, submitted_at

report_photos       id, agency_id, field_report_id, storage_path, caption, taken_at
```

## Matching configuration

```
scoring_weights     agency_id, factor, weight, params jsonb
                    factor ∈ distance | brand_experience | category_experience |
                             skill_overlap | brief_completed | reliability
blocklist           agency_id, promoter_id, client_id (nullable), reason, created_at
```

A null `client_id` blocks the promoter agency-wide; a set one blocks them for that client only —
the common real case ("this client asked us not to send her again").

## Indexes that are not optional

```
availability (promoter_id, on_date)
promoters   (agency_id, status)
shifts      (agency_id, on_date)
invitations (shift_id, status)
invitations (token_hash)          -- unique, this is the lookup for /i/[token]
assignments (shift_id, status)
```

Distance is haversine in SQL over `home_lat/home_lng` — no external API in v1.
PostGIS and real travel times are a later decision, recorded in `decisions.md` when taken.
