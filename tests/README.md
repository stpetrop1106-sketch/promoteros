# Tests (P15)

`npm test` runs `vitest run` against everything in `tests/**/*.test.ts`. Node environment,
no network, no database, no `.env`. Config: `vitest.config.ts` at the project root (path alias
`@/` -> project root, matching `tsconfig.json`).

## What is covered

- **`geo.test.ts`** — `lib/geo.ts`. `distanceMetres` against known real-world coordinate pairs
  (tolerance band, not exact metres), symmetry, zero-distance identity. `distanceScore`:
  1.0 at zero distance, strictly decreasing with distance, always in `(0, 1]`, car beats no-car
  at the same distance, and the car/no-car gap widens within a realistic search radius (see the
  comment in the test file — the gap has a mathematical peak around `sqrt(h_car * h_noCar)` metres
  and narrows again beyond it, since both curves are bounded and converge back toward 0).

- **`tokens.test.ts`** — `lib/tokens.ts`. Security-critical, written adversarially: round trip,
  cross-purpose rejection (`wrong_purpose`), tampered payload and tampered signature (both
  `bad_signature`), malformed input never throws, expiry (`vi.useFakeTimers()`, zero and negative
  TTL), `hashToken` determinism and collision-freeness, and that the hash never contains the raw
  token. `TOKEN_SIGNING_SECRET` is set at the top of the file, not read from `.env`.

  One documented mismatch with the original test brief: a token that is literally `"."` (a lone
  dot) is expected by the brief to fail as `malformed`, but the actual implementation classifies
  it as `bad_signature` — `token.split(".")` on `"."` yields two empty-string parts, which passes
  the `parts.length !== 2` check, so it falls through to the length-mismatched signature
  comparison instead. It still correctly returns `ok: false` and never throws, so this is not a
  security bug, just a slightly different reason code than the brief assumed. See the test named
  `"a lone dot fails without throwing"` for the exact assertion, and `docs/status/P15.md`.

- **`matching.test.ts`** — `lib/matching/index.ts`, `topReasons` only. Ordering by
  `value * weight` descending, exclusion of zero-value factors, the `n` limit (including `n: 0`
  and the default of 3), and an all-zero-factor candidate resolving to `[]` without throwing.
  Fixtures are hand-built `Candidate` objects — no database.

## What is NOT covered (no safety net yet)

- **`matchPromoters()`** (the SQL-backed half of `lib/matching/index.ts`) is untested here by
  design — it calls `createAdminClient().rpc("match_promoters", ...)`, which needs a live
  Supabase connection and seeded data. That belongs in an integration/smoke test
  (`scripts/smoke.ts`, per P0 in `docs/build-plan.md`), not a unit test. If the SQL scoring
  function's *weights or filter logic* changes, nothing in this directory will catch a
  regression — only `npm run smoke` against real data will.
- `lib/invitations.ts` (`createInvitation`, `loadInvitation`, `respondToInvitation`,
  `refreshShiftStatus`) — no unit coverage. It's mostly database orchestration around
  `lib/tokens.ts`, which *is* covered.
- `lib/geocoding/**`, `lib/messaging/**`, `lib/supabase/**`, `lib/i18n/**` — not owned by this
  parcel and not covered.
- Anything in `app/**` (routes, server actions, UI) has no test coverage at all yet.

## How to add a test

1. Create `tests/<name>.test.ts`. Anything matching `tests/**/*.test.ts` is picked up
   automatically — no config change needed.
2. Import the module under test with the `@/` alias, e.g. `import { thing } from "@/lib/thing"`.
3. Keep it deterministic: no bare `Date.now()` (use `vi.useFakeTimers()` /
   `vi.setSystemTime()` instead), no real randomness, no network or database calls. Build
   fixtures by hand rather than reaching for seeded or real data.
4. If a test exposes a genuine bug in the source rather than a test-writing mistake, do not
   fix the source file (see `CLAUDE.md` / the P15 handoff — this lane owns `tests/**` only).
   Write the failing test, mark it `it.fails` or skip it with a comment explaining what's wrong,
   and report it in `docs/status/P15.md` (or your own parcel's status file) so the owning lane
   can pick it up.
5. Run `npm test` and `npx tsc --noEmit` before committing.
