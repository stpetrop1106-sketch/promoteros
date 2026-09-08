# P3b — Promoter management

**Lane:** B
**Status:** in_review
**Updated:** 2026-09-08T00:45:00Z

## Owns
`app/promoters/**` (except `app/promoters/[id]/availability/**`, reserved for P5),
`docs/status/P3b.md`, append-only blocks in `lib/i18n/el.ts` / `lib/i18n/en.ts`.

## Files touched
- docs/status/P3b.md — created
- app/promoters/actions.ts — created (`geocodeAddress`, `createPromoter`, `updatePromoter`,
  `archivePromoter` — shared by `new/` and `[id]/edit/`)
- app/promoters/promoter-form.tsx — created (shared client form for create + edit, incl. the
  address/geocode flow)
- app/promoters/link-button.tsx — created (local `<a>`-as-button, mirrors `components/ui/Button`
  styling; not imported from `app/campaigns/**`, which is out of my globs)
- app/promoters/page.tsx — created (roster: search, filters, missing-coordinates flag, empty
  states)
- app/promoters/new/page.tsx — created
- app/promoters/[id]/page.tsx — created (profile: details, areas, skills, client history,
  upcoming/past shifts, link to `/promoters/[id]/availability`)
- app/promoters/[id]/edit/page.tsx — created
- app/promoters/[id]/edit/archive-control.tsx — created (two-step confirm, archive not delete)
- lib/i18n/el.ts — appended one `"promoters.*"` block at the end (re-read immediately before
  editing; re-read again afterward once the campaigns agent's concurrent append landed —
  confirmed both blocks coexist intact, mine followed by theirs, nothing lost)
- lib/i18n/en.ts — same, English mirror, same edit pass

## Done
- Read CLAUDE.md, docs/build-plan.md (§2.1, §2.3, §5, §6), docs/commercial-architecture.md §6,
  docs/status/P3a.md, docs/status/README.md, docs/data-model.md, the full `components/ui/` kit,
  `app/shifts/**` + `app/login/**` as reference patterns, and
  `supabase/migrations/0001_init.sql` / `0002_rls.sql` for the real `promoters` /
  `promoter_areas` / `promoter_skills` / `areas` / `skills` / `promoter_client_history` shapes.
- Roster (`page.tsx`): search by name/phone, filter by status/area/skill/has-car, all via a
  plain GET form (no client JS). Flags any promoter missing `home_lat`/`home_lng` with a
  warning badge. Two distinct `EmptyState`s: zero promoters (teaches that ranking needs 5-8+
  promoters spread across areas) vs. filtered-to-nothing (offers "clear filters").
- Add promoter (`new/page.tsx` + `actions.ts`): name, phone, email, birth year, areas
  (checkboxes), has-car/has-licence, skills with a 1-3 level each, status. Validated with zod
  (`ScalarSchema`); Greek inline errors next to each field.
- Address flow: coordinator types an address (not persisted — `promoters` has no address
  column, only `home_lat`/`home_lng`) and clicks "Εύρεση συντεταγμένων", which calls
  `getGeocoder().geocode(address, { country: "gr" })` through a server action. Success (any
  confidence) fills the always-editable lat/lng number fields and shows the resolved address +
  confidence for the coordinator to visually confirm before the one real "Save" click — nothing
  is auto-saved. `confidence: "low"` gets a distinct warning-styled box. `null` shows a plain-
  Greek explanation and falls straight to the same manual lat/lng fields — never blocks saving.
  Manual override is available at all times, geocoded or not.
- Duplicate phone: normalises phone (`+30` + 10-digit heuristic for bare Greek mobiles) and
  checks it before insert/update *and* on a 23505 race from the DB, returning a "this promoter
  already exists" state with a link to the existing promoter — never a raw DB error.
- Profile (`[id]/page.tsx`): details, areas, skills (with level), client history, upcoming/past
  shifts (via `assignments` → `shifts` → `stores`/`campaigns`), missing-coordinates banner,
  links to edit and to `/promoters/[id]/availability` (page left untouched, per instructions).
- Edit (`[id]/edit/page.tsx`): same form, plus a separate `Card` below it holding archive —
  two-click confirm, sets `status = 'archived'`, never a hard delete. Editing an already-archived
  promoter's form allows picking "active" again to reactivate (the archive card hides itself
  once archived; a plain-text notice explains how to bring them back instead).
- `area_id`/`skill_id` values from the form are re-checked against an RLS-scoped select before
  being written to `promoter_areas`/`promoter_skills` (those join tables have no `agency_id` of
  their own for RLS to key off, so a tampered hidden field can't graft another agency's row on).
- Ran `npx next typegen` after adding the new route folders (the checked-in `.next/types` was
  stale from before `/promoters/**` existed, which was producing spurious `RouteImpl` errors);
  regenerated cleanly.
- `npx tsc --noEmit`: **zero errors in `app/promoters/**` or `lib/i18n/**`.** Every remaining
  error in the full run is in `app/campaigns/**` (the concurrent Lane B/A campaigns parcel),
  confirmed by re-running the check filtered to everything *except* `app/campaigns/**` — clean.

## Doing now
- Nothing further planned. Parcel complete, awaiting manager review/browser walk-through of
  acceptance step 2.

## Blocked by
- nothing

## Requests to other lanes
- None required. Noting for awareness, not requesting a change: `promoters.home_area_id` exists
  in the schema but I left it unset on create/edit — the explicit field list in my brief didn't
  include it, matching engine distance is computed from `home_lat`/`home_lng` directly per
  `docs/data-model.md`, and it's nullable, so this doesn't block anything downstream.

## Notes for the manager
- Not importing anything from `app/campaigns/**` (e.g. its `LinkButton`), even read-only, since
  that lane is actively in flight and out of my globs — mirrored the same button styling locally
  in `app/promoters/link-button.tsx` instead (same visual language, independent file).
- The typed-address input is intentionally *not* submitted/stored anywhere — only the
  geocoded/manual `home_lat`/`home_lng` are. This follows the actual `promoters` schema (no
  address column) rather than adding one, since I own no migration this weekend.
- Not yet verified in an actual browser against a live Supabase project (no dev server run in
  this session) — recommend the manager (or whoever runs the acceptance walkthrough) exercise
  "add eight promoters with real addresses" as the real test of the geocoding fallback paths
  against live Nominatim responses, since that's the one thing static analysis can't confirm.
