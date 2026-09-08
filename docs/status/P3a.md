# P3a — Geocoding adapter

**Lane:** A
**Status:** in_review
**Updated:** 2026-09-08T21:15:00Z

## Owns
`lib/geocoding/**`, `tests/geocoding.test.ts`, `docs/status/P3a.md`

## Files touched
- docs/status/P3a.md — created
- lib/geocoding/index.ts — created
- lib/geocoding/nominatim.ts — created
- lib/geocoding/locationiq.ts — created
- lib/geocoding/null-provider.ts — created
- lib/geocoding/shared.ts — created (internal helpers: address normalisation, Greece bounding-box
  check, importance→confidence mapping; shared by nominatim.ts and locationiq.ts, not part of the
  frozen contract)
- tests/geocoding.test.ts — created

## Done
- Read CLAUDE.md, docs/build-plan.md (§2.1, §5, §6), docs/keys-needed.md §4, docs/status/README.md,
  lib/messaging/index.ts (mirrored its shape/reasoning), lib/geo.ts (the `Coordinates` consumer).
- `GeocodingProvider` interface + `getGeocoder()` in `lib/geocoding/index.ts`, matching the frozen
  contract in build-plan.md §6 exactly.
- `NominatimProvider` (default): descriptive `User-Agent` header (overridable via
  `NOMINATIM_USER_AGENT`, never hardcodes a personal contact), and every request serialised
  through an in-process queue enforcing >=1000ms between calls (module-level singleton, so it
  holds across repeated `getGeocoder()` calls, not just within one instance).
- `LocationIqProvider`: same Nominatim-shaped response parsing, used when `GEOCODING_API_KEY` is
  set; no in-process rate limit (LocationIQ enforces its own).
- `NullProvider`: always resolves `null`, selected by `GEOCODING_PROVIDER=none`.
- Every failure path returns `null`, never throws: network error, non-200, empty result array,
  malformed/non-JSON body, and timeout via `AbortSignal.timeout(5000)` — verified by dedicated
  tests for each on both providers.
- Sanity check: rejects results outside Greece's rough bounding box (lat 34-42, lng 19-30) when
  `country` is `"gr"` (the default), returning `null` instead of a corrupt coordinate.
- Confidence derived from the provider's `importance` score (falls back to OSM `type` when
  importance is absent); a `low`-confidence result is still returned, never discarded.
- Address normalisation (trim + collapse whitespace) before every query; an address that's empty
  after normalising short-circuits before any fetch call.
- `getGeocoder()` selection: env `GEOCODING_PROVIDER` (`nominatim` default | `locationiq` | `none`),
  and falls back to nominatim with `console.warn` when `locationiq` is requested without a key —
  mirrors `getAdapter()`'s missing-Telegram-token fallback exactly.
- `tests/geocoding.test.ts`: 22 unit tests, no network (stubs `globalThis.fetch`, restored in a
  global `afterEach`). Covers both providers: successful parse, empty result array, non-200,
  malformed body, timeout/abort, plain network error, out-of-bounds rejection, low-confidence
  passthrough, empty-after-normalisation short-circuit, and (LocationIQ only) that the API key
  never appears in a `console.warn`/`console.error` call. Plus 5 tests on `getGeocoder()`
  selection/fallback. Exported a test-only `__resetRateLimiterForTests()` from `nominatim.ts` so
  the shared rate-limit queue's clock resets between tests — without it, tests after the first
  would pay a real ~1s delay each from the shared module-level queue.
- `npx tsc --noEmit`: **zero errors in `lib/geocoding/**` or `tests/geocoding.test.ts`.** Four
  pre-existing errors remain elsewhere (`app/login/actions.ts`, `lib/auth.ts` — typed-route
  mismatch; `lib/supabase/middleware.ts`, `lib/supabase/server.ts` — implicit-any
  `cookiesToSet`), all in other agents' in-flight files, not touched by this parcel.
- `npx vitest run tests/geocoding.test.ts`: 22/22 passing. Full suite (`npx vitest run`): 4 files,
  **54/54 passing** — no regression to geo/tokens/matching tests.

## Doing now
- Nothing further planned. Parcel complete, awaiting manager review.

## Blocked by
- nothing

## Requests to other lanes
- none — vitest.config.ts already existed (P15's, in_review) and needed no changes; the geocoding
  test file slotted into its existing `tests/**/*.test.ts` include / `@` alias with no edits.

## Notes for the manager
- Nominatim's rate-limit queue is a module-level singleton by design (not per-`NominatimProvider`
  instance): if `getGeocoder()` is called fresh per request, the 1-req/sec limit still holds
  process-wide. This is the correct production behaviour but meant tests needed a reset hook
  (`__resetRateLimiterForTests`, exported from `nominatim.ts`, prefixed `__` and not part of the
  contract) to avoid stacking real ~1s delays across the test file.
- Deliberately did NOT put any real contact address (including Stella's email) in the Nominatim
  `User-Agent` header — that would be personal data sent to a third-party service as a request
  header. Left a generic default (`"PromoterOS/1.0 (development build; no contact configured)"`)
  overridable via `NOMINATIM_USER_AGENT`, with a comment pointing at docs/keys-needed.md §4 for
  when a real one should be set.
- `formattedAddress` in a result is Nominatim/LocationIQ's `display_name` when present, else the
  normalised input address — never left undefined.
- The consuming UI (P3, promoter CRUD) needs to: treat `null` as "show manual lat/lng entry, no
  error state"; render `confidence: "low"` with a prompt to confirm the pin rather than trusting
  it silently; and never pass a raw, un-normalised address string into anything that logs it
  (the provider already trims/collapses whitespace, but the original user input may still contain
  whatever the coordinator typed).
