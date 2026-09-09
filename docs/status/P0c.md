# P0c — Distance ceiling and seed realism

**Lane:** A
**Status:** in_review
**Updated:** 2026-09-09T00:00:00Z

## Owns
- `supabase/migrations/0007_match_radius.sql`
- `scripts/seed.ts`
- `docs/status/P0c.md`

## Files touched
- `docs/status/P0c.md` — updated
- `supabase/migrations/0007_match_radius.sql` — verified complete (written in the interrupted run)
- `scripts/seed.ts` — verified complete (rewritten in the interrupted run)

## Done
- **Resumed after a rate-limit kill.** Re-read `CLAUDE.md`, `docs/status/P0.md`,
  `supabase/migrations/0005_matching_fixes.sql`, `docs/status/README.md`, and both files left by
  my interrupted run, rather than assuming either was finished or needed redoing. Both were
  already complete and correct; no further edits were needed to either.
- **Verified `0007_match_radius.sql`**: built from the `0005` body (not `0003`) — both the
  null-geocode coalesce/NULLS-LAST sort and the overlapping-`unavailable`-window filter are
  intact. Signature, returned columns and `r_`-prefixed CTE structure are byte-for-byte
  unchanged from `0005`, so `lib/matching/index.ts` and `scripts/smoke.ts` still parse the
  result. Adds a hard `max_distance_m` filter among the other hard filters (not a soft
  penalty), sourced from `params->>'max_distance_km'` on the `distance` row of
  `scoring_weights`, defaulting to 60 km, parsed defensively (bad/absent/non-positive values
  fall back to the default; no way to configure a ceiling of 0). **Deliberate, commented
  decision**: a promoter with null `home_lat`/`home_lng` is *kept*, not filtered — "we could
  not compute a distance" is not "this person is far away," the promoter screen allows saving
  without coordinates, and FIX 1 already sinks them to the bottom via `f_distance = 0` where a
  coordinator can see and fix them, rather than having them silently vanish from every ranking.
- **Verified `scripts/seed.ts`**: campaign types are now shared across multiple campaigns per
  type (Aurora + Kritikos both run `Δειγματισμός`; Nefeli + Volta both run `Προώθηση`), Athens/
  Thessaloniki geography is coherent (home coords jittered around area centroids,
  `promoter_areas` restricted to the home area + real nearest neighbours in the same city,
  stores clustered the same way), and two ringers (Κατερίνα Βασιλείου, Στέλιος Παππάς) are
  seeded ~290-300 km from the Athens stores, strong on every other factor, specifically to
  exercise the distance ceiling once `0007` is live.
- **`npm run seed` ran clean, twice in a row**, with identical output both times (60 promoters
  [14 Thessaloniki, 2 ringers] · 20 stores [4 Thessaloniki] · 8 campaigns over 3 shared types ·
  24 shifts · 582 availability rows) — confirms the reset-before-insert logic makes it safe to
  re-run without duplicating rows.
- **`npm run smoke` ran clean.** Summary below.
- **`npx tsc --noEmit`**: all errors are in `app/c/**` (the other agent's in-flight checkin
  work — bad i18n keys and a route-typing issue, nothing to do with matching or seeding).
  Confirmed zero errors reference `scripts/seed.ts`, `scripts/smoke.ts`, or `0007`.

## Smoke summary (0007 NOT applied — read live from the database)
```
48 candidates across 3 shifts · 3 distinct problem(s) flagged
  - 2 of top 5 live >60 km away (Κατερίνα Βασιλείου ~294-298 km, Στέλιος Παππάς ~289-292 km)
    on all three shifts — expected and by design; see below.
scores: 16/16 distinct on every shift (was capped and non-discriminating before)
category_experience: varies per candidate (1.00 or 0.00), no longer 0 for everyone — smoke's
  own "category_experience unreachable" check (needs >1 campaign per type) did NOT fire.
dominance: 0 violations across 27 + 14 + 50 = 91 comparable pairs.
```
- **Cleared**: `category_experience` scoring 0 for everyone (P0 finding #2) — fixed by the
  seed's shared campaign-type vocabulary, confirmed live by smoke.
- **Still open, expected**: the >60 km warning (P0 finding #3) still fires on every shift,
  **because `0007_match_radius.sql` is written but not applied to the live database** — the
  ringers are deliberately seeded to prove the ceiling works once it is. This is not a
  regression; it is the seed doing its job ahead of the migration landing. Once `0007` is
  pasted into the SQL editor, both ringers drop out of every Athens shift's candidate list and
  the warning should disappear from `npm run smoke` on a re-run.

## Doing now
- Nothing. Handing over.

## Blocked by
- Nothing.

## Requests to other lanes

### Manager — apply `supabase/migrations/0007_match_radius.sql` in the Supabase SQL editor
I cannot run DDL (no `psql`, no connection string, no DDL from the JS client). The file is
written, re-verified against the currently-applied `0005` body, and the seed now contains two
promoters purpose-built to prove it works — but until it is pasted into the SQL editor the
ceiling is inert and `npm run smoke` will keep flagging the >60 km warning. After applying,
please re-run `npm run smoke` and confirm the warning is gone and both ringers now rank first
on Thessaloniki-store shifts instead of Athens ones (there are no seeded Thessaloniki shifts
today, so ringers only show up in the Athens candidate list until removed by the ceiling — a
future parcel adding a Thessaloniki shift would make this directly visible).

## Notes for the manager
- `0007` is reserved for this parcel per the brief; migration numbering otherwise unchanged.
- Both owned files were already substantially correct from the interrupted run — this session
  was verification plus running seed/smoke/tsc to confirm, not a rewrite. No code changes were
  needed to either `0007_match_radius.sql` or `scripts/seed.ts`.
